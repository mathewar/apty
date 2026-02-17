const express = require('express');
const router = express.Router();
const db = require('../../persistence');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

// Find the active ButterflyMX provider record by provider_type
async function getButterflyMXProvider() {
    const providers = await db.getServiceProviders();
    return providers.find(p => p.provider_type === 'intercom' && p.is_active) || null;
}

function verifySignature(body, secret, signature) {
    const expected = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
        return false;
    }
}

// ButterflyMX sends webhook as raw body; mount this router with express.raw for this path
// or rely on the parsed JSON body when signature header is absent (dev mode).
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
    try {
        const provider = await getButterflyMXProvider();

        // Validate HMAC signature if provider config has a webhook_secret
        const signature = req.headers['x-butterflymx-signature'];
        if (provider) {
            let config = {};
            try { config = provider.config ? JSON.parse(provider.config) : {}; } catch {}
            if (config.webhook_secret) {
                if (!signature) return res.status(400).json({ error: 'Missing signature' });
                const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
                if (!verifySignature(rawBody, config.webhook_secret, signature)) {
                    return res.status(400).json({ error: 'Invalid signature' });
                }
            }
        }

        // Parse body (may be Buffer if express.raw fired, or already object from body-parser)
        let payload;
        if (Buffer.isBuffer(req.body)) {
            payload = JSON.parse(req.body.toString('utf8'));
        } else {
            payload = req.body;
        }

        // ButterflyMX field mapping
        const unitNumber = payload.unit && payload.unit.name ? payload.unit.name : null;
        const carrier = payload.carrier || null;
        const trackingNumber = payload.tracking_number || null;
        const eventId = payload.event_id || null;

        // Deduplicate
        if (eventId) {
            const existing = await db.getPackageByProviderEventId(eventId);
            if (existing) return res.status(200).json({ message: 'duplicate', id: existing.id });
        }

        // Resolve unit
        let unit_id = null;
        if (unitNumber) {
            const units = await db.getUnits();
            const unit = units.find(u => u.unit_number === unitNumber);
            if (unit) unit_id = unit.id;
        }

        const source = provider ? `provider:${provider.id}` : 'butterflymx';
        const pkg = {
            id: uuidv4(),
            unit_id,
            carrier,
            tracking_number: trackingNumber,
            description: payload.description || '1 package',
            status: 'arrived',
            source,
            provider_event_id: eventId,
        };
        await db.storePackage(pkg);

        // ButterflyMX expects 200 immediately
        res.status(200).json({ message: 'ok', id: pkg.id });
    } catch (err) { next(err); }
});

module.exports = router;

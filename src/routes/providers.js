const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { requirePermission } = require('../middleware/auth');

function generateApiKey() {
    return crypto.randomBytes(32).toString('hex');
}

function hashApiKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

// ── Provider management ──

router.get('/', requirePermission('providers:read'), async (req, res, next) => {
    try {
        const providers = await db.getServiceProviders();
        // Never return api_key_hash to clients
        res.json(providers.map(p => {
            const { api_key_hash, ...safe } = p;
            return safe;
        }));
    } catch (err) { next(err); }
});

router.post('/', requirePermission('providers:write'), async (req, res, next) => {
    try {
        const apiKey = generateApiKey();
        const provider = {
            id: uuidv4(),
            name: req.body.name,
            provider_type: req.body.provider_type,
            api_key_hash: hashApiKey(apiKey),
            is_active: true,
            config: req.body.config || null,
        };
        await db.storeServiceProvider(provider);
        const { api_key_hash, ...safe } = provider;
        res.status(201).json({ ...safe, api_key: apiKey });
    } catch (err) { next(err); }
});

router.put('/:id', requirePermission('providers:write'), async (req, res, next) => {
    try {
        await db.updateServiceProvider(req.params.id, req.body);
        const provider = await db.getServiceProvider(req.params.id);
        if (!provider) return res.status(404).json({ error: 'Provider not found' });
        const { api_key_hash, ...safe } = provider;
        res.json(safe);
    } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('providers:write'), async (req, res, next) => {
    try {
        await db.removeServiceProvider(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

// ── Event ingestion ──

router.post('/events', async (req, res, next) => {
    try {
        const providerKey = req.headers['x-provider-key'];
        if (!providerKey) return res.status(401).json({ error: 'Missing X-Provider-Key header' });

        const hash = hashApiKey(providerKey);
        const provider = await db.getServiceProviderByApiKeyHash(hash);
        if (!provider) return res.status(401).json({ error: 'Invalid or inactive provider key' });

        const { event_type, event_id, data } = req.body;
        if (!event_type) return res.status(400).json({ error: 'event_type is required' });

        if (event_type === 'package.arrived') {
            // Deduplicate by event_id
            if (event_id) {
                const existing = await db.getPackageByProviderEventId(event_id);
                if (existing) return res.status(200).json({ message: 'duplicate', id: existing.id });
            }

            // Resolve unit by unit_number
            let unit_id = data.unit_id || null;
            if (!unit_id && data.unit_number) {
                const units = await db.getUnits();
                const unit = units.find(u => u.unit_number === data.unit_number);
                if (unit) unit_id = unit.id;
            }

            const pkg = {
                id: uuidv4(),
                unit_id,
                carrier: data.carrier || null,
                tracking_number: data.tracking_number || null,
                description: data.description || null,
                status: 'arrived',
                source: `provider:${provider.id}`,
                provider_event_id: event_id || null,
            };
            await db.storePackage(pkg);
            return res.status(201).json(pkg);
        }

        res.status(200).json({ message: 'event received', event_type });
    } catch (err) { next(err); }
});

module.exports = router;

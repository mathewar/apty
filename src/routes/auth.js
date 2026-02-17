const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { getPermissionsForRole } = require('../auth/permissions');

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verify;
}

function safeUser(user) {
    const { password_hash, ...rest } = user;
    return { ...rest, permissions: getPermissionsForRole(user.role) };
}

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        const user = await db.getUserByEmail(email);
        if (!user || !verifyPassword(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        req.session.user = { id: user.id, email: user.email, role: user.role, resident_id: user.resident_id };
        res.json(safeUser(user));
    } catch (err) { next(err); }
});

router.post('/logout', requireAuth, (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    res.json(req.user);
});

// Only admins can create users (self-registration is off by default)
router.post('/register', requirePermission('users:write'), async (req, res, next) => {
    try {
        const { email, password, resident_id, role } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        const existing = await db.getUserByEmail(email);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }
        const user = {
            id: uuidv4(),
            email,
            password_hash: hashPassword(password),
            resident_id: resident_id || null,
            role: role || 'resident',
        };
        await db.storeUser(user);
        res.status(201).json(safeUser(user));
    } catch (err) { next(err); }
});

router.get('/users', requirePermission('users:read'), async (req, res, next) => {
    try {
        res.json(await db.getUsers());
    } catch (err) { next(err); }
});

router.put('/users/:id', requirePermission('users:write'), async (req, res, next) => {
    try {
        const updates = {};
        if (req.body.role) updates.role = req.body.role;
        if (req.body.email) updates.email = req.body.email;
        if (req.body.password) updates.password_hash = hashPassword(req.body.password);
        if (req.body.resident_id !== undefined) updates.resident_id = req.body.resident_id;
        await db.updateUser(req.params.id, updates);
        res.json({ id: req.params.id, ...updates });
    } catch (err) { next(err); }
});

router.delete('/users/:id', requirePermission('users:write'), async (req, res, next) => {
    try {
        await db.removeUser(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

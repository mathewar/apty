const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

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
        const { password_hash, ...safeUser } = user;
        req.session.user = safeUser;
        res.json(safeUser);
    } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

router.get('/me', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json(req.session.user);
});

router.post('/register', async (req, res, next) => {
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
        const { password_hash, ...safeUser } = user;
        res.status(201).json(safeUser);
    } catch (err) { next(err); }
});

// ── User management (admin) ──

router.get('/users', async (req, res, next) => {
    try {
        const users = await db.getUsers();
        res.json(users);
    } catch (err) { next(err); }
});

router.put('/users/:id', async (req, res, next) => {
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

router.delete('/users/:id', async (req, res, next) => {
    try {
        await db.removeUser(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('waitlists:read'), async (req, res, next) => {
    try {
        res.json(await db.getWaitlist(req.query.type));
    } catch (err) { next(err); }
});

router.post('/', requirePermission('waitlists:write'), async (req, res, next) => {
    try {
        const entry = { id: uuidv4(), ...req.body };
        await db.storeWaitlistEntry(entry);
        res.status(201).json(entry);
    } catch (err) { next(err); }
});

router.put('/:id', requirePermission('waitlists:write'), async (req, res, next) => {
    try {
        await db.updateWaitlistEntry(req.params.id, req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('waitlists:write'), async (req, res, next) => {
    try {
        await db.removeWaitlistEntry(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

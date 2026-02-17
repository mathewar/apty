const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('announcements:read'), async (req, res, next) => {
    try {
        res.json(await db.getAnnouncements());
    } catch (err) { next(err); }
});

router.get('/:id', requirePermission('announcements:read'), async (req, res, next) => {
    try {
        const a = await db.getAnnouncement(req.params.id);
        if (!a) return res.status(404).json({ error: 'Announcement not found' });
        res.json(a);
    } catch (err) { next(err); }
});

router.post('/', requirePermission('announcements:write'), async (req, res, next) => {
    try {
        const a = { id: uuidv4(), ...req.body };
        await db.storeAnnouncement(a);
        res.status(201).json(a);
    } catch (err) { next(err); }
});

router.put('/:id', requirePermission('announcements:write'), async (req, res, next) => {
    try {
        await db.updateAnnouncement(req.params.id, req.body);
        res.json(await db.getAnnouncement(req.params.id));
    } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('announcements:write'), async (req, res, next) => {
    try {
        await db.removeAnnouncement(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

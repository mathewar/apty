const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res, next) => {
    try {
        const announcements = await db.getAnnouncements();
        res.json(announcements);
    } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const announcement = await db.getAnnouncement(req.params.id);
        if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
        res.json(announcement);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const announcement = { id: uuidv4(), ...req.body };
        await db.storeAnnouncement(announcement);
        res.status(201).json(announcement);
    } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
    try {
        await db.updateAnnouncement(req.params.id, req.body);
        const announcement = await db.getAnnouncement(req.params.id);
        res.json(announcement);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await db.removeAnnouncement(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

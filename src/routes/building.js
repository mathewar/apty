const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res, next) => {
    try {
        const building = await db.getBuilding();
        if (!building) return res.status(404).json({ error: 'Building not configured' });
        res.json(building);
    } catch (err) { next(err); }
});

router.put('/', async (req, res, next) => {
    try {
        const b = req.body;
        if (!b.id) b.id = uuidv4();
        const result = await db.upsertBuilding(b);
        res.json(result);
    } catch (err) { next(err); }
});

module.exports = router;

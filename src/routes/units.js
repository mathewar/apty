const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res, next) => {
    try {
        const units = await db.getUnits(req.query.building_id);
        res.json(units);
    } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const unit = await db.getUnit(req.params.id);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });
        res.json(unit);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const unit = { id: uuidv4(), ...req.body };
        await db.storeUnit(unit);
        res.status(201).json(unit);
    } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
    try {
        await db.updateUnit(req.params.id, req.body);
        const unit = await db.getUnit(req.params.id);
        res.json(unit);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await db.removeUnit(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

router.get('/:id/residents', async (req, res, next) => {
    try {
        const residents = await db.getResidents({ unit_id: req.params.id });
        res.json(residents);
    } catch (err) { next(err); }
});

module.exports = router;

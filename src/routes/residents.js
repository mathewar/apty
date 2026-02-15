const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res, next) => {
    try {
        const residents = await db.getResidents({
            unit_id: req.query.unit_id,
            role: req.query.role,
        });
        res.json(residents);
    } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const resident = await db.getResident(req.params.id);
        if (!resident) return res.status(404).json({ error: 'Resident not found' });
        res.json(resident);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const resident = { id: uuidv4(), ...req.body };
        await db.storeResident(resident);
        res.status(201).json(resident);
    } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
    try {
        await db.updateResident(req.params.id, req.body);
        const resident = await db.getResident(req.params.id);
        res.json(resident);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await db.removeResident(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

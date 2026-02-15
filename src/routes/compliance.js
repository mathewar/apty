const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');

// ── Compliance Items ──

router.get('/', async (req, res, next) => {
    try {
        const items = await db.getComplianceItems();
        res.json(items);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const item = { id: uuidv4(), ...req.body };
        await db.storeComplianceItem(item);
        res.status(201).json(item);
    } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
    try {
        await db.updateComplianceItem(req.params.id, req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await db.removeComplianceItem(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

// ── Violations ──

router.get('/violations', async (req, res, next) => {
    try {
        const violations = await db.getViolations();
        res.json(violations);
    } catch (err) { next(err); }
});

router.post('/violations', async (req, res, next) => {
    try {
        const violation = { id: uuidv4(), ...req.body };
        await db.storeViolation(violation);
        res.status(201).json(violation);
    } catch (err) { next(err); }
});

router.put('/violations/:id', async (req, res, next) => {
    try {
        await db.updateViolation(req.params.id, req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (err) { next(err); }
});

router.delete('/violations/:id', async (req, res, next) => {
    try {
        await db.removeViolation(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

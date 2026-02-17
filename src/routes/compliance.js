const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('compliance:read'), async (req, res, next) => {
    try {
        res.json(await db.getComplianceItems());
    } catch (err) { next(err); }
});

router.post('/', requirePermission('compliance:write'), async (req, res, next) => {
    try {
        const item = { id: uuidv4(), ...req.body };
        await db.storeComplianceItem(item);
        res.status(201).json(item);
    } catch (err) { next(err); }
});

router.put('/:id', requirePermission('compliance:write'), async (req, res, next) => {
    try {
        await db.updateComplianceItem(req.params.id, req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('compliance:write'), async (req, res, next) => {
    try {
        await db.removeComplianceItem(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

router.get('/violations', requirePermission('compliance:read'), async (req, res, next) => {
    try {
        res.json(await db.getViolations());
    } catch (err) { next(err); }
});

router.post('/violations', requirePermission('compliance:write'), async (req, res, next) => {
    try {
        const violation = { id: uuidv4(), ...req.body };
        await db.storeViolation(violation);
        res.status(201).json(violation);
    } catch (err) { next(err); }
});

router.put('/violations/:id', requirePermission('compliance:write'), async (req, res, next) => {
    try {
        await db.updateViolation(req.params.id, req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (err) { next(err); }
});

router.delete('/violations/:id', requirePermission('compliance:write'), async (req, res, next) => {
    try {
        await db.removeViolation(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('vendors:read'), async (req, res, next) => {
    try {
        res.json(await db.getVendors());
    } catch (err) { next(err); }
});

router.post('/', requirePermission('vendors:write'), async (req, res, next) => {
    try {
        const vendor = { id: uuidv4(), ...req.body };
        await db.storeVendor(vendor);
        res.status(201).json(vendor);
    } catch (err) { next(err); }
});

router.put('/:id', requirePermission('vendors:write'), async (req, res, next) => {
    try {
        await db.updateVendor(req.params.id, req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('vendors:write'), async (req, res, next) => {
    try {
        await db.removeVendor(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

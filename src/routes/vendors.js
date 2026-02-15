const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res, next) => {
    try {
        const vendors = await db.getVendors();
        res.json(vendors);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const vendor = { id: uuidv4(), ...req.body };
        await db.storeVendor(vendor);
        res.status(201).json(vendor);
    } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
    try {
        await db.updateVendor(req.params.id, req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await db.removeVendor(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

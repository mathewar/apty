const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res, next) => {
    try {
        const packages = await db.getPackages({
            unit_id: req.query.unit_id,
            status: req.query.status,
            source: req.query.source,
        });
        res.json(packages);
    } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const pkg = await db.getPackage(req.params.id);
        if (!pkg) return res.status(404).json({ error: 'Package not found' });
        res.json(pkg);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const pkg = { id: uuidv4(), ...req.body };
        await db.storePackage(pkg);
        res.status(201).json(pkg);
    } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
    try {
        await db.updatePackage(req.params.id, req.body);
        const pkg = await db.getPackage(req.params.id);
        res.json(pkg);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await db.removePackage(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

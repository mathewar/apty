const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('applications:read'), async (req, res, next) => {
    try {
        const applications = await db.getApplications({
            status: req.query.status,
            type: req.query.type,
            unit_id: req.query.unit_id,
        });
        res.json(applications);
    } catch (err) { next(err); }
});

router.get('/:id', requirePermission('applications:read'), async (req, res, next) => {
    try {
        const application = await db.getApplication(req.params.id);
        if (!application) return res.status(404).json({ error: 'Application not found' });
        res.json(application);
    } catch (err) { next(err); }
});

router.post('/', requirePermission('applications:write'), async (req, res, next) => {
    try {
        const application = { id: uuidv4(), ...req.body };
        await db.storeApplication(application);
        res.status(201).json(application);
    } catch (err) { next(err); }
});

router.put('/:id', requirePermission('applications:write'), async (req, res, next) => {
    try {
        await db.updateApplication(req.params.id, req.body);
        res.json(await db.getApplication(req.params.id));
    } catch (err) { next(err); }
});

module.exports = router;

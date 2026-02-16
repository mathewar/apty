const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res, next) => {
    try {
        const requests = await db.getMaintenanceRequests({
            status: req.query.status,
            unit_id: req.query.unit_id,
            submitted_by: req.query.submitted_by,
            priority: req.query.priority,
        });
        res.json(requests);
    } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
    try {
        const request = await db.getMaintenanceRequest(req.params.id);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        res.json(request);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        const request = { id: uuidv4(), ...req.body };
        await db.storeMaintenanceRequest(request);
        res.status(201).json(request);
    } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
    try {
        await db.updateMaintenanceRequest(req.params.id, req.body);
        const request = await db.getMaintenanceRequest(req.params.id);
        res.json(request);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    try {
        await db.removeMaintenanceRequest(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

// Comments on a request
router.get('/:id/comments', async (req, res, next) => {
    try {
        const comments = await db.getRequestComments(req.params.id);
        res.json(comments);
    } catch (err) { next(err); }
});

router.post('/:id/comments', async (req, res, next) => {
    try {
        const comment = { id: uuidv4(), request_id: req.params.id, ...req.body };
        await db.storeRequestComment(comment);
        res.status(201).json(comment);
    } catch (err) { next(err); }
});

module.exports = router;

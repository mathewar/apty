const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const { requirePermission } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const { triageRequest } = require('../services/maintenanceTriage');

router.get('/', requirePermission('maintenance:read'), async (req, res, next) => {
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

router.get('/:id', requirePermission('maintenance:read'), async (req, res, next) => {
    try {
        const request = await db.getMaintenanceRequest(req.params.id);
        if (!request) return res.status(404).json({ error: 'Request not found' });
        res.json(request);
    } catch (err) { next(err); }
});

router.post('/', requirePermission('maintenance:write'), async (req, res, next) => {
    try {
        const request = { id: uuidv4(), ...req.body };
        await db.storeMaintenanceRequest(request);
        if (process.env.GEMINI_API_KEY && (request.title || request.description)) {
            triageRequest({ title: request.title, description: request.description, location: request.location })
                .then(t => db.updateMaintenanceRequest(request.id, { triage_json: JSON.stringify(t) }))
                .catch(err => console.error('[triage]', request.id, err.message));
        }
        res.status(201).json(request);
    } catch (err) { next(err); }
});

// Updating status / assigning requires manage permission
router.put('/:id', requirePermission('maintenance:manage'),
    auditLog('UPDATE', 'maintenance', (req) => req.params.id, (req) => `Updated maintenance request ${req.params.id}`),
    async (req, res, next) => {
        try {
            await db.updateMaintenanceRequest(req.params.id, req.body);
            res.json(await db.getMaintenanceRequest(req.params.id));
        } catch (err) { next(err); }
    });

router.delete('/:id', requirePermission('maintenance:manage'), async (req, res, next) => {
    try {
        await db.removeMaintenanceRequest(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

router.get('/:id/comments', requirePermission('maintenance:read'), async (req, res, next) => {
    try {
        res.json(await db.getRequestComments(req.params.id));
    } catch (err) { next(err); }
});

router.post('/:id/comments', requirePermission('maintenance:write'), async (req, res, next) => {
    try {
        const comment = { id: uuidv4(), request_id: req.params.id, ...req.body };
        await db.storeRequestComment(comment);
        res.status(201).json(comment);
    } catch (err) { next(err); }
});

module.exports = router;

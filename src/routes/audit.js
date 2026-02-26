const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('users:read'), async (req, res, next) => {
    try {
        const entries = await db.getAuditLog({
            resource_type: req.query.resource_type || null,
            limit: req.query.limit ? parseInt(req.query.limit) : 100,
        });
        res.json(entries);
    } catch (err) { next(err); }
});

router.get('/:resource_id', requirePermission('users:read'), async (req, res, next) => {
    try {
        const entries = await db.getAuditLog({
            resource_id: req.params.resource_id,
            limit: 50,
        });
        res.json(entries);
    } catch (err) { next(err); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('staff:read'), async (req, res, next) => {
    try {
        res.json(await db.getStaff());
    } catch (err) { next(err); }
});

router.post('/', requirePermission('staff:write'), async (req, res, next) => {
    try {
        const member = { id: uuidv4(), ...req.body };
        await db.storeStaffMember(member);
        res.status(201).json(member);
    } catch (err) { next(err); }
});

router.put('/:id', requirePermission('staff:write'), async (req, res, next) => {
    try {
        await db.updateStaffMember(req.params.id, req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('staff:write'), async (req, res, next) => {
    try {
        await db.removeStaffMember(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

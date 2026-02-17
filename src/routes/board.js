const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const { requirePermission } = require('../middleware/auth');

router.get('/', requirePermission('board:read'), async (req, res, next) => {
    try {
        const activeOnly = req.query.active !== 'false';
        const members = await db.getBoardMembers(activeOnly);
        res.json(members);
    } catch (err) { next(err); }
});

router.post('/', requirePermission('board:write'), async (req, res, next) => {
    try {
        const member = { id: uuidv4(), ...req.body };
        await db.storeBoardMember(member);
        res.status(201).json(member);
    } catch (err) { next(err); }
});

router.put('/:id', requirePermission('board:write'), async (req, res, next) => {
    try {
        await db.updateBoardMember(req.params.id, req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (err) { next(err); }
});

router.delete('/:id', requirePermission('board:write'), async (req, res, next) => {
    try {
        await db.removeBoardMember(req.params.id);
        res.sendStatus(200);
    } catch (err) { next(err); }
});

module.exports = router;

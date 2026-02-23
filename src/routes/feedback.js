'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../persistence');
const { requireAuth, requirePermission } = require('../middleware/auth');

// POST /api/feedback — any logged-in user can submit
router.post('/', requireAuth, async (req, res, next) => {
    try {
        const { feedback_text, page, url, screenshot_data, user_agent, viewport } = req.body;
        if (!feedback_text || !feedback_text.trim()) {
            return res.status(400).json({ error: 'feedback_text is required' });
        }
        await db.storeFeedback({
            id: uuidv4(),
            user_id: req.user.id || null,
            user_email: req.user.email || null,
            user_role: req.user.role || null,
            page: page || null,
            url: url || null,
            feedback_text: feedback_text.trim(),
            screenshot_data: screenshot_data || null,
            user_agent: user_agent || null,
            viewport: viewport || null,
        });
        res.status(201).json({ ok: true });
    } catch (err) { next(err); }
});

// GET /api/feedback — admin only
router.get('/', requirePermission('users:read'), async (req, res, next) => {
    try {
        res.json(await db.getFeedback());
    } catch (err) { next(err); }
});

module.exports = router;

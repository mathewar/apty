const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const { requirePermission } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');

// ── Maintenance Charges ──

router.get('/maintenance-charges', requirePermission('finances:read'), async (req, res, next) => {
    try {
        const charges = await db.getMaintenanceCharges({
            unit_id: req.query.unit_id,
            period_year: req.query.period_year,
            period_month: req.query.period_month,
            status: req.query.status,
        });
        res.json(charges);
    } catch (err) { next(err); }
});

router.post('/maintenance-charges', requirePermission('finances:write'), async (req, res, next) => {
    try {
        const charge = { id: uuidv4(), ...req.body };
        await db.storeMaintenanceCharge(charge);
        res.status(201).json(charge);
    } catch (err) { next(err); }
});

router.post('/maintenance-charges/generate', requirePermission('finances:write'),
    auditLog('CREATE', 'finance', (req, body) => null, (req) => `Generated charges for ${req.body.period_month}/${req.body.period_year}`),
    async (req, res, next) => {
        try {
            const { period_month, period_year } = req.body;
            const units = await db.getUnits();
            const charges = [];
            for (const unit of units) {
                if (!unit.monthly_maintenance) continue;
                const charge = {
                    id: uuidv4(),
                    unit_id: unit.id,
                    period_month,
                    period_year,
                    amount: unit.monthly_maintenance,
                    status: 'pending',
                    due_date: `${period_year}-${String(period_month).padStart(2, '0')}-01`,
                };
                await db.storeMaintenanceCharge(charge);
                charges.push(charge);
            }
            res.status(201).json({ generated: charges.length, charges });
        } catch (err) { next(err); }
    });

router.put('/maintenance-charges/:id', requirePermission('finances:write'),
    auditLog('UPDATE', 'finance', (req) => req.params.id, (req, body) => `Updated charge ${req.params.id} to ${body && body.status}`),
    async (req, res, next) => {
        try {
            await db.updateMaintenanceCharge(req.params.id, req.body);
            res.json({ id: req.params.id, ...req.body });
        } catch (err) { next(err); }
    });

// ── Assessments ──

router.get('/assessments', requirePermission('finances:read'), async (req, res, next) => {
    try {
        res.json(await db.getAssessments());
    } catch (err) { next(err); }
});

router.post('/assessments', requirePermission('finances:write'), async (req, res, next) => {
    try {
        const assessment = { id: uuidv4(), ...req.body };
        await db.storeAssessment(assessment);
        res.status(201).json(assessment);
    } catch (err) { next(err); }
});

router.get('/assessments/:id/charges', requirePermission('finances:read'), async (req, res, next) => {
    try {
        res.json(await db.getAssessmentCharges(req.params.id));
    } catch (err) { next(err); }
});

router.post('/assessments/:id/generate', requirePermission('finances:write'), async (req, res, next) => {
    try {
        const assessments = await db.getAssessments();
        const assessment = assessments.find(a => a.id === req.params.id);
        if (!assessment) return res.status(404).json({ error: 'Assessment not found' });

        const units = await db.getUnits();
        const totalShares = units.reduce((sum, u) => sum + (u.shares || 0), 0);
        if (totalShares === 0) return res.status(400).json({ error: 'No shares allocated' });

        const charges = [];
        for (const unit of units) {
            if (!unit.shares) continue;
            const amount = parseFloat(
                ((unit.shares / totalShares) * assessment.total_amount).toFixed(2),
            );
            const charge = {
                id: uuidv4(),
                assessment_id: req.params.id,
                unit_id: unit.id,
                amount,
                status: 'pending',
            };
            await db.storeAssessmentCharge(charge);
            charges.push(charge);
        }
        res.status(201).json({ generated: charges.length, charges });
    } catch (err) { next(err); }
});

router.put('/assessment-charges/:id', requirePermission('finances:write'), async (req, res, next) => {
    try {
        await db.updateAssessmentCharge(req.params.id, req.body);
        res.json({ id: req.params.id, ...req.body });
    } catch (err) { next(err); }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requirePermission } = require('../middleware/auth');
const { analyzeDocument } = require('../services/documentAnalysis');
const { auditLog } = require('../middleware/auditLog');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../data/documents');

function ensureUploadDir() {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureUploadDir();
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const unique = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, unique);
    },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/documents - Fetch documents by optional category filter
router.get('/', requirePermission('documents:read'), async (req, res, next) => {
    try {
        res.json(await db.getDocuments(req.query.category));
    } catch (err) { next(err); }
});

// POST /api/documents/upload - Upload a file and analyze if PDF
router.post('/upload', requirePermission('documents:write'), upload.single('file'), async (req, res, next) => {
    try {
        ensureUploadDir();
        const id = uuidv4();
        const isPdf = req.file && req.file.mimetype === 'application/pdf';

        const doc = {
            id,
            title: req.body.title || (req.file ? req.file.originalname : 'Untitled'),
            category: req.body.category || 'general',
            file_path: req.file ? req.file.filename : null,
            file_size: req.file ? req.file.size : null,
            mime_type: req.file ? req.file.mimetype : null,
            uploaded_by: req.body.uploaded_by || null,
            analysis_json: null,
        };

        await db.storeDocument(doc);

        // Run analysis for PDFs asynchronously so we can return the doc immediately
        if (isPdf && process.env.GEMINI_API_KEY) {
            const filePath = path.join(UPLOAD_DIR, req.file.filename);
            analyzeDocument(filePath)
                .then(analysis => db.updateDocument(id, { analysis_json: JSON.stringify(analysis) }))
                .catch(err => console.error('[documentAnalysis] error for', id, err.message));
        }

        res.status(201).json(doc);
    } catch (err) { next(err); }
});

// GET /api/documents/:id - Fetch single document
router.get('/:id', requirePermission('documents:read'), async (req, res, next) => {
    try {
        const doc = await db.getDocument(req.params.id);
        if (!doc) return res.sendStatus(404);
        res.json(doc);
    } catch (err) { next(err); }
});

// GET /api/documents/:id/analysis - Return parsed analysis JSON
router.get('/:id/analysis', requirePermission('documents:read'), async (req, res, next) => {
    try {
        const doc = await db.getDocument(req.params.id);
        if (!doc) return res.sendStatus(404);
        if (!doc.analysis_json) return res.status(404).json({ error: 'No analysis available' });
        res.json(JSON.parse(doc.analysis_json));
    } catch (err) { next(err); }
});

// POST /api/documents/:id/analyze - Re-run analysis on demand
router.post('/:id/analyze', requirePermission('documents:write'), async (req, res, next) => {
    try {
        const doc = await db.getDocument(req.params.id);
        if (!doc) return res.sendStatus(404);
        if (!doc.file_path) return res.status(400).json({ error: 'No file associated with this document' });
        if (doc.mime_type && doc.mime_type !== 'application/pdf') {
            return res.status(400).json({ error: 'Analysis only supported for PDF files' });
        }
        if (!process.env.GEMINI_API_KEY) {
            return res.status(503).json({ error: 'GEMINI_API_KEY not configured' });
        }
        const filePath = path.join(UPLOAD_DIR, doc.file_path);
        const analysis = await analyzeDocument(filePath);
        await db.updateDocument(doc.id, { analysis_json: JSON.stringify(analysis) });
        res.json(analysis);
    } catch (err) { next(err); }
});

// GET /api/documents/:id/file - Stream raw file for download
router.get('/:id/file', requirePermission('documents:read'), async (req, res, next) => {
    try {
        const doc = await db.getDocument(req.params.id);
        if (!doc || !doc.file_path) return res.sendStatus(404);
        const filePath = path.join(UPLOAD_DIR, doc.file_path);
        if (!fs.existsSync(filePath)) return res.sendStatus(404);
        res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.title)}.pdf"`);
        fs.createReadStream(filePath).pipe(res);
    } catch (err) { next(err); }
});

// POST /api/documents - Create new document (metadata only, legacy)
router.post('/', requirePermission('documents:write'), async (req, res, next) => {
    try {
        ensureUploadDir();
        const doc = { id: uuidv4(), ...req.body };
        await db.storeDocument(doc);
        res.status(201).json(doc);
    } catch (err) { next(err); }
});

// DELETE /api/documents/:id - Delete document and remove file
router.delete('/:id', requirePermission('documents:write'),
    auditLog('DELETE', 'document', (req) => req.params.id, (req) => `Deleted document ${req.params.id}`),
    async (req, res, next) => {
        try {
            const doc = await db.removeDocument(req.params.id);
            if (doc && doc.file_path) {
                const fullPath = path.join(UPLOAD_DIR, doc.file_path);
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            }
            res.sendStatus(200);
        } catch (err) { next(err); }
    });

module.exports = router;

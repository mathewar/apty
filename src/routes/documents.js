const express = require('express');
const router = express.Router();
const db = require('../persistence');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../data/documents');

function ensureUploadDir() {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
}

router.get('/', async (req, res, next) => {
    try {
        const documents = await db.getDocuments(req.query.category);
        res.json(documents);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    try {
        ensureUploadDir();
        const doc = { id: uuidv4(), ...req.body };
        await db.storeDocument(doc);
        res.status(201).json(doc);
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
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

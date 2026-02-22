'use strict';

// Unit tests for src/routes/documents.js
// Tests the route logic in isolation by mocking the DB and file-system dependencies.

const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../src/persistence', () => ({
    getDocuments: jest.fn(),
    getDocument: jest.fn(),
    storeDocument: jest.fn(),
    updateDocument: jest.fn(),
    removeDocument: jest.fn(),
}));

jest.mock('../../src/services/documentAnalysis', () => ({
    analyzeDocument: jest.fn(),
}));

jest.mock('../../src/middleware/auth', () => ({
    requirePermission: () => (req, res, next) => next(),
}));

// Silence multer by mocking it out
jest.mock('multer', () => {
    const multer = () => ({
        single: () => (req, res, next) => {
            // Simulate a successful file upload
            req.file = req._mockFile || null;
            next();
        },
    });
    multer.diskStorage = () => ({});
    return multer;
});

jest.mock('fs', () => ({
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    unlinkSync: jest.fn(),
    createReadStream: jest.fn(() => ({ pipe: jest.fn() })),
    readFileSync: jest.fn(() => Buffer.from('fake pdf content')),
}));

const db = require('../../src/persistence');
const { analyzeDocument } = require('../../src/services/documentAnalysis');

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.sendStatus = jest.fn(() => res);
    res.setHeader = jest.fn(() => res);
    return res;
}

// ── Tests: GET / ─────────────────────────────────────────────────────────────

describe('GET /api/documents', () => {
    test('returns documents from db', async () => {
        const docs = [{ id: '1', title: 'Budget' }];
        db.getDocuments.mockResolvedValue(docs);

        const router = require('../../src/routes/documents');
        // Find the GET / handler by inspecting router stack
        const layer = router.stack.find(l => l.route && l.route.path === '/' && l.route.methods.get);
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const req = { query: {} };
        const res = mockRes();
        await handler(req, res, jest.fn());

        expect(db.getDocuments).toHaveBeenCalledWith(undefined);
        expect(res.json).toHaveBeenCalledWith(docs);
    });

    test('passes category filter to db', async () => {
        db.getDocuments.mockResolvedValue([]);

        const router = require('../../src/routes/documents');
        const layer = router.stack.find(l => l.route && l.route.path === '/' && l.route.methods.get);
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const req = { query: { category: 'financial' } };
        const res = mockRes();
        await handler(req, res, jest.fn());

        expect(db.getDocuments).toHaveBeenCalledWith('financial');
    });
});

// ── Tests: POST /upload ───────────────────────────────────────────────────────

describe('POST /api/documents/upload', () => {
    beforeEach(() => {
        db.storeDocument.mockReset();
        db.updateDocument.mockReset();
        analyzeDocument.mockReset();
    });

    test('stores doc and returns 201 with correct fields', async () => {
        db.storeDocument.mockResolvedValue();
        analyzeDocument.mockResolvedValue({ title: 'test', charts: [] });

        const router = require('../../src/routes/documents');
        const layer = router.stack.find(l => l.route && l.route.path === '/upload' && l.route.methods.post);
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const req = {
            body: { title: 'Annual Budget', category: 'financial' },
            file: { filename: 'abc.pdf', originalname: 'budget.pdf', size: 1024, mimetype: 'application/pdf' },
        };
        const res = mockRes();
        const next = jest.fn();
        await handler(req, res, next);

        // If next was called with an error, surface it
        if (next.mock.calls.length > 0) throw next.mock.calls[0][0];

        expect(db.storeDocument).toHaveBeenCalledTimes(1);
        const stored = db.storeDocument.mock.calls[0][0];
        expect(stored.title).toBe('Annual Budget');
        expect(stored.category).toBe('financial');
        expect(stored.mime_type).toBe('application/pdf');
        expect(stored.file_size).toBe(1024);
        expect(stored.id).toBeTruthy();

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Annual Budget' }));
    });

    test('uses filename as title when no title provided', async () => {
        db.storeDocument.mockResolvedValue();

        const router = require('../../src/routes/documents');
        const layer = router.stack.find(l => l.route && l.route.path === '/upload' && l.route.methods.post);
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const req = {
            body: {},
            file: { filename: 'xyz.pdf', originalname: 'report.pdf', size: 512, mimetype: 'application/pdf' },
        };
        const res = mockRes();
        await handler(req, res, jest.fn());

        const stored = db.storeDocument.mock.calls[0][0];
        expect(stored.title).toBe('report.pdf');
    });

    test('non-PDF uploaded without triggering analysis', async () => {
        db.storeDocument.mockResolvedValue();
        process.env.GEMINI_API_KEY = 'test-key';

        const router = require('../../src/routes/documents');
        const layer = router.stack.find(l => l.route && l.route.path === '/upload' && l.route.methods.post);
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const req = {
            body: { title: 'Spreadsheet' },
            file: { filename: 'sheet.xlsx', originalname: 'sheet.xlsx', size: 200, mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        };
        const res = mockRes();
        await handler(req, res, jest.fn());

        // Give async fire-and-forget a tick to run (it shouldn't)
        await new Promise(r => setTimeout(r, 10));
        expect(analyzeDocument).not.toHaveBeenCalled();
    });
});

// ── Tests: GET /:id ───────────────────────────────────────────────────────────

describe('GET /api/documents/:id', () => {
    test('returns 404 when doc not found', async () => {
        db.getDocument.mockResolvedValue(null);

        const router = require('../../src/routes/documents');
        const layer = router.stack.find(l => l.route && l.route.path === '/:id' && l.route.methods.get);
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const req = { params: { id: 'missing' } };
        const res = mockRes();
        await handler(req, res, jest.fn());

        expect(res.sendStatus).toHaveBeenCalledWith(404);
    });

    test('returns doc when found', async () => {
        const doc = { id: 'abc', title: 'Test' };
        db.getDocument.mockResolvedValue(doc);

        const router = require('../../src/routes/documents');
        const layer = router.stack.find(l => l.route && l.route.path === '/:id' && l.route.methods.get);
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const req = { params: { id: 'abc' } };
        const res = mockRes();
        await handler(req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith(doc);
    });
});

// ── Tests: GET /:id/analysis ──────────────────────────────────────────────────

describe('GET /api/documents/:id/analysis', () => {
    test('returns 404 when no analysis_json', async () => {
        db.getDocument.mockResolvedValue({ id: 'abc', analysis_json: null });

        const router = require('../../src/routes/documents');
        const layer = router.stack.find(l => l.route && l.route.path === '/:id/analysis' && l.route.methods.get);
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const req = { params: { id: 'abc' } };
        const res = mockRes();
        await handler(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns parsed analysis when present', async () => {
        const analysis = { title: 'Budget', charts: [] };
        db.getDocument.mockResolvedValue({ id: 'abc', analysis_json: JSON.stringify(analysis) });

        const router = require('../../src/routes/documents');
        const layer = router.stack.find(l => l.route && l.route.path === '/:id/analysis' && l.route.methods.get);
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const req = { params: { id: 'abc' } };
        const res = mockRes();
        await handler(req, res, jest.fn());

        expect(res.json).toHaveBeenCalledWith(analysis);
    });
});

// ── Tests: DELETE /:id ────────────────────────────────────────────────────────

describe('DELETE /api/documents/:id', () => {
    test('removes doc and deletes file', async () => {
        const fs = require('fs');
        db.removeDocument.mockResolvedValue({ id: 'abc', file_path: 'file.pdf' });

        const router = require('../../src/routes/documents');
        const layer = router.stack.find(l => l.route && l.route.path === '/:id' && l.route.methods.delete);
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const req = { params: { id: 'abc' } };
        const res = mockRes();
        await handler(req, res, jest.fn());

        expect(db.removeDocument).toHaveBeenCalledWith('abc');
        expect(fs.unlinkSync).toHaveBeenCalled();
        expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
});

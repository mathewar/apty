'use strict';

/**
 * One-off integration test for the full PDF upload → analyze pipeline.
 * Uses the real PDF at data/250_254_W82nd_Street_Maintenance_Increase_2026.pdf
 * and a live GEMINI_API_KEY to verify end-to-end analysis.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { startServer, stopServer, getDb, PORT } = require('./helpers/server');
const { seedUsers } = require('./helpers/seed');

const BASE = `http://localhost:${PORT}`;
const PDF_PATH = path.join(__dirname, '../../data/250_254_W82nd_Street_Maintenance_Increase_2026.pdf');

// Helper: POST JSON, returns { status, body }
function postJSON(path, body, cookie) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost', port: PORT, path, method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                ...(cookie ? { Cookie: cookie } : {}),
            },
        }, (res) => {
            let raw = '';
            res.on('data', d => raw += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw), headers: res.headers }); }
                catch { resolve({ status: res.statusCode, body: raw, headers: res.headers }); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Helper: GET JSON, returns { status, body }
function getJSON(urlPath, cookie) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost', port: PORT, path: urlPath, method: 'GET',
            headers: { ...(cookie ? { Cookie: cookie } : {}) },
        }, (res) => {
            let raw = '';
            res.on('data', d => raw += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, body: raw }); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// Helper: multipart file upload using form-data package
function uploadFile(urlPath, filePath, fields, cookie) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        for (const [k, v] of Object.entries(fields)) form.append(k, v);
        form.append('file', fs.createReadStream(filePath));

        const headers = { ...form.getHeaders(), ...(cookie ? { Cookie: cookie } : {}) };
        const req = http.request({
            hostname: 'localhost', port: PORT, path: urlPath, method: 'POST', headers,
        }, (res) => {
            let raw = '';
            res.on('data', d => raw += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, body: raw }); }
            });
        });
        req.on('error', reject);
        form.pipe(req);
    });
}

let cookie;

beforeAll(async () => {
    if (!process.env.GEMINI_API_KEY) {
        console.warn('GEMINI_API_KEY not set — analysis assertions will be skipped');
    }
    await startServer();
    await seedUsers(getDb());

    // Login and capture session cookie
    const res = await postJSON('/api/auth/login', { email: 'admin@250w82.com', password: 'admin123' });
    expect(res.status).toBe(200);
    const raw = res.headers['set-cookie'];
    cookie = raw ? raw[0].split(';')[0] : null;
    expect(cookie).toBeTruthy();
}, 15000);

afterAll(async () => {
    await stopServer();
});

test('PDF file exists on disk', () => {
    expect(fs.existsSync(PDF_PATH)).toBe(true);
});

test('upload PDF returns 201 with correct metadata', async () => {
    const res = await uploadFile(
        '/api/documents/upload',
        PDF_PATH,
        { title: 'Maintenance Increase 2026', category: 'financial' },
        cookie,
    );
    console.log('[upload response]', res.status, JSON.stringify(res.body).slice(0, 200));
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.title).toBe('Maintenance Increase 2026');
    expect(res.body.mime_type).toBe('application/pdf');
    expect(res.body.file_size).toBeGreaterThan(0);
}, 15000);

test('analyze endpoint extracts text and returns structured JSON', async () => {
    if (!process.env.GEMINI_API_KEY) return;

    // Get the uploaded doc id
    const listRes = await getJSON('/api/documents', cookie);
    expect(listRes.status).toBe(200);
    const doc = listRes.body.find(d => d.title === 'Maintenance Increase 2026');
    expect(doc).toBeTruthy();

    console.log('[analyze] triggering analysis for doc', doc.id);
    const analyzeRes = await postJSON(`/api/documents/${doc.id}/analyze`, {}, cookie);
    console.log('[analyze response]', analyzeRes.status, JSON.stringify(analyzeRes.body).slice(0, 500));

    expect(analyzeRes.status).toBe(200);
    expect(analyzeRes.body.summary).toBeTruthy();
    expect(Array.isArray(analyzeRes.body.highlights)).toBe(true);
    expect(analyzeRes.body.highlights.length).toBeGreaterThan(0);
    expect(Array.isArray(analyzeRes.body.charts)).toBe(true);
}, 60000); // Gemini can take time

test('GET /:id/analysis returns the stored analysis', async () => {
    if (!process.env.GEMINI_API_KEY) return;

    const listRes = await getJSON('/api/documents', cookie);
    const doc = listRes.body.find(d => d.title === 'Maintenance Increase 2026');
    expect(doc).toBeTruthy();

    const res = await getJSON(`/api/documents/${doc.id}/analysis`, cookie);
    console.log('[analysis response]', res.status, JSON.stringify(res.body).slice(0, 300));
    expect(res.status).toBe(200);
    expect(res.body.summary).toBeTruthy();
    expect(Array.isArray(res.body.charts)).toBe(true);
}, 15000);

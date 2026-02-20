'use strict';

const { startServer, stopServer, getDb, PORT } = require('./helpers/server');
const { seedUsers } = require('./helpers/seed');
const http = require('http');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = `http://localhost:${PORT}`;

// Minimal valid single-page PDF
const MINIMAL_PDF = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj ' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
    '0000000058 00000 n\n0000000115 00000 n\n' +
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF',
);

// Helper: POST JSON and return { status, body }
function postJson(path, body, cookieHeader) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const opts = {
            hostname: 'localhost', port: PORT, path, method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
        };
        const req = http.request(opts, (res) => {
            let raw = '';
            res.on('data', (c) => (raw += c));
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

// Helper: multipart upload, returns { status, body, headers }
function uploadFile(formData, cookieHeader) {
    return new Promise((resolve, reject) => {
        const headers = {
            ...formData.getHeaders(),
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        };
        const opts = {
            hostname: 'localhost', port: PORT,
            path: '/api/documents/upload',
            method: 'POST',
            headers,
        };
        const req = http.request(opts, (res) => {
            let raw = '';
            res.on('data', (c) => (raw += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw), headers: res.headers }); }
                catch { resolve({ status: res.statusCode, body: raw, headers: res.headers }); }
            });
        });
        req.on('error', reject);
        formData.pipe(req);
    });
}

// Helper: GET with cookie
function getJson(path, cookieHeader) {
    return new Promise((resolve, reject) => {
        const opts = {
            hostname: 'localhost', port: PORT, path,
            headers: cookieHeader ? { Cookie: cookieHeader } : {},
        };
        http.get(opts, (res) => {
            let raw = '';
            res.on('data', (c) => (raw += c));
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(raw), headers: res.headers }); }
                catch { resolve({ status: res.statusCode, body: raw, headers: res.headers }); }
            });
        }).on('error', reject);
    });
}

let adminCookie;
let residentCookie;

beforeAll(async () => {
    await startServer();
    await seedUsers(getDb());

    // Log in as admin
    const adminLogin = await postJson('/api/auth/login', { email: 'admin@250w82.com', password: 'admin123' });
    adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];

    // Log in as resident
    const residentLogin = await postJson('/api/auth/login', { email: 'resident@test.com', password: 'resident123' });
    residentCookie = residentLogin.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => {
    await stopServer();
});

test('GET /api/documents returns empty array initially', async () => {
    const { status, body } = await getJson('/api/documents', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(0);
});

test('POST /api/documents/upload stores a PDF and returns doc record', async () => {
    const form = new FormData();
    form.append('title', 'Test Budget 2024');
    form.append('category', 'financial');
    form.append('file', MINIMAL_PDF, { filename: 'budget.pdf', contentType: 'application/pdf' });

    const { status, body } = await uploadFile(form, adminCookie);
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.title).toBe('Test Budget 2024');
    expect(body.category).toBe('financial');
    expect(body.mime_type).toBe('application/pdf');
    expect(body.file_size).toBeGreaterThan(0);
});

test('GET /api/documents lists the uploaded document', async () => {
    const { status, body } = await getJson('/api/documents', adminCookie);
    expect(status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe('Test Budget 2024');
});

test('GET /api/documents/:id returns the document', async () => {
    const list = await getJson('/api/documents', adminCookie);
    const id = list.body[0].id;
    const { status, body } = await getJson(`/api/documents/${id}`, adminCookie);
    expect(status).toBe(200);
    expect(body.id).toBe(id);
});

test('GET /api/documents/:id/file returns 200 with PDF content-type', async () => {
    const list = await getJson('/api/documents', adminCookie);
    const id = list.body[0].id;
    const { status, headers } = await getJson(`/api/documents/${id}/file`, adminCookie);
    expect(status).toBe(200);
    expect(headers['content-type']).toContain('application/pdf');
});

test('resident can read documents but cannot upload', async () => {
    // Resident can list
    const { status: listStatus } = await getJson('/api/documents', residentCookie);
    expect(listStatus).toBe(200);

    // Resident cannot upload
    const form = new FormData();
    form.append('title', 'Sneaky Upload');
    form.append('category', 'general');
    form.append('file', MINIMAL_PDF, { filename: 'sneaky.pdf', contentType: 'application/pdf' });
    const { status: uploadStatus } = await uploadFile(form, residentCookie);
    expect(uploadStatus).toBe(403);
});

test('unauthenticated upload returns 401', async () => {
    const form = new FormData();
    form.append('title', 'No auth');
    form.append('category', 'general');
    form.append('file', MINIMAL_PDF, { filename: 'noauth.pdf', contentType: 'application/pdf' });
    const { status } = await uploadFile(form, null);
    expect(status).toBe(401);
});

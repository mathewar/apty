'use strict';

const http = require('http');
const { v4: uuidv4 } = require('uuid');
const { startServer, stopServer, getDb, getPort } = require('./helpers/server');
const { seedUsers } = require('./helpers/seed');

let BASE_URL;

function request(method, path, body, cookieHeader) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'localhost', port: getPort(), path, method,
            headers: {
                ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
        };
        const req = http.request(opts, (res) => {
            let raw = '';
            res.on('data', c => (raw += c));
            res.on('end', () => {
                let parsed; try { parsed = JSON.parse(raw); } catch { parsed = raw; }
                resolve({ status: res.statusCode, body: parsed, headers: res.headers });
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}
const get  = (path, cookie) => request('GET',  path, null, cookie);
const post = (path, body, cookie) => request('POST', path, body, cookie);

let adminCookie;
let residentCookie;

beforeAll(async () => {
    await startServer();
    BASE_URL = `http://localhost:${getPort()}`;
    const db = getDb();
    await seedUsers(db);

    const adminLogin = await post('/api/auth/login', { email: 'admin@250w82.com', password: 'admin123' });
    adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];
    const resLogin = await post('/api/auth/login', { email: 'resident@test.com', password: 'resident123' });
    residentCookie = resLogin.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => { await stopServer(); });

// ── Dashboard data endpoints ─────────────────────────────────────────────────
// These are the endpoints polled by the dashboard stat cards and charts.

test('GET /api/finances/maintenance-charges returns array (requires auth)', async () => {
    const unauth = await get('/api/finances/maintenance-charges');
    expect(unauth.status).toBe(401);

    const { status, body } = await get('/api/finances/maintenance-charges', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

test('GET /api/compliance returns array', async () => {
    const { status, body } = await get('/api/compliance', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

test('GET /api/applications returns array', async () => {
    const { status, body } = await get('/api/applications', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

test('GET /api/packages returns array', async () => {
    const { status, body } = await get('/api/packages', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

test('GET /api/units returns array', async () => {
    const { status, body } = await get('/api/units', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

test('GET /api/audit?limit=5 returns at most 5 entries (dashboard feed)', async () => {
    const { status, body } = await get('/api/audit?limit=5', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeLessThanOrEqual(5);
});

test('resident cannot access /api/audit (dashboard feed is admin-only)', async () => {
    const { status } = await get('/api/audit', residentCookie);
    expect(status).toBe(403);
});

test('GET /api/maintenance returns array', async () => {
    const { status, body } = await get('/api/maintenance', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

test('GET /api/residents returns array', async () => {
    const { status, body } = await get('/api/residents', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

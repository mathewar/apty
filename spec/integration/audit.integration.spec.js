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
const get  = (path, cookie) => request('GET',    path, null, cookie);
const post = (path, body, cookie) => request('POST',   path, body, cookie);
const put  = (path, body, cookie) => request('PUT',    path, body, cookie);
const del  = (path, cookie) => request('DELETE', path, null, cookie);

let adminCookie;
let residentCookie;
let unitId;
let submitterId;

beforeAll(async () => {
    await startServer();
    BASE_URL = `http://localhost:${getPort()}`;
    const db = getDb();
    await seedUsers(db);

    const buildingId = uuidv4();
    await db.upsertBuilding({
        id: buildingId, name: 'Audit Test Building', address: '5 Audit Ln',
        city: 'New York', state: 'NY', zip: '10005',
        year_built: 1955, total_floors: 6, total_units: 20, building_type: 'coop',
    });
    unitId = uuidv4();
    await db.storeUnit({
        id: unitId, building_id: buildingId, unit_number: '5E', floor: 5,
        rooms: 3, square_feet: 900, shares: 100, monthly_maintenance: 1500, status: 'occupied',
    });
    submitterId = uuidv4();
    await db.storeResident({
        id: submitterId, unit_id: unitId,
        first_name: 'Audit', last_name: 'Seed',
        email: 'audit.seed@test.com',
        phone: null, role: 'shareholder', is_primary: 1,
        move_in_date: null, shares_held: 100,
    });

    const adminLogin = await post('/api/auth/login', { email: 'admin@250w82.com', password: 'admin123' });
    adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];
    const resLogin = await post('/api/auth/login', { email: 'resident@test.com', password: 'resident123' });
    residentCookie = resLogin.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => { await stopServer(); });

// ── Access control ──────────────────────────────────────────────────────────

test('GET /api/audit requires authentication', async () => {
    const { status } = await get('/api/audit');
    expect(status).toBe(401);
});

test('GET /api/audit requires admin permission — resident gets 403', async () => {
    const { status } = await get('/api/audit', residentCookie);
    expect(status).toBe(403);
});

test('GET /api/audit returns array for admin', async () => {
    const { status, body } = await get('/api/audit', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

// ── Resident mutations generate audit entries ───────────────────────────────

let residentId;

test('POST /api/residents writes a CREATE audit entry', async () => {
    const { status, body } = await post('/api/residents', {
        first_name: 'Alice', last_name: 'Audit',
        email: 'alice.audit@test.com', unit_id: unitId, role: 'shareholder',
    }, adminCookie);
    expect(status).toBe(201);
    residentId = body.id;

    const { body: entries } = await get('/api/audit', adminCookie);
    const entry = entries.find(e => e.resource_type === 'resident' && e.action === 'CREATE' && e.resource_id === residentId);
    expect(entry).toBeTruthy();
    expect(entry.user_email).toBe('admin@250w82.com');
    expect(entry.summary).toMatch(/Alice Audit/);
});

test('PUT /api/residents/:id writes an UPDATE audit entry', async () => {
    await put(`/api/residents/${residentId}`, {
        first_name: 'Alice', last_name: 'Updated',
        email: 'alice.audit@test.com', unit_id: unitId, role: 'shareholder',
        is_primary: 0, move_in_date: null, move_out_date: null, shares_held: null,
    }, adminCookie);

    const { body: entries } = await get('/api/audit', adminCookie);
    const entry = entries.find(e => e.resource_type === 'resident' && e.action === 'UPDATE' && e.resource_id === residentId);
    expect(entry).toBeTruthy();
});

test('DELETE /api/residents/:id writes a DELETE audit entry', async () => {
    await del(`/api/residents/${residentId}`, adminCookie);

    const { body: entries } = await get('/api/audit', adminCookie);
    const entry = entries.find(e => e.resource_type === 'resident' && e.action === 'DELETE' && e.resource_id === residentId);
    expect(entry).toBeTruthy();
});

// ── Document delete generates audit entry ───────────────────────────────────

test('DELETE /api/documents/:id writes a document DELETE audit entry', async () => {
    const doc = await post('/api/documents', {
        id: uuidv4(), title: 'Audit Doc', category: 'general',
    }, adminCookie);
    expect(doc.status).toBe(201);
    const docId = doc.body.id;

    await del(`/api/documents/${docId}`, adminCookie);

    const { body: entries } = await get('/api/audit?resource_type=document', adminCookie);
    const entry = entries.find(e => e.action === 'DELETE' && e.resource_id === docId);
    expect(entry).toBeTruthy();
});

// ── Finance mutations generate audit entries ────────────────────────────────

test('POST /api/finances/maintenance-charges/generate writes a CREATE audit entry', async () => {
    const { status } = await post('/api/finances/maintenance-charges/generate', {
        period_month: 4, period_year: 2026,
    }, adminCookie);
    expect(status).toBe(201);

    const { body: entries } = await get('/api/audit?resource_type=finance', adminCookie);
    const entry = entries.find(e => e.action === 'CREATE' && e.resource_type === 'finance');
    expect(entry).toBeTruthy();
    expect(entry.summary).toMatch(/4\/2026/);
});

test('PUT /api/finances/maintenance-charges/:id writes an UPDATE audit entry', async () => {
    const chargesRes = await get('/api/finances/maintenance-charges', adminCookie);
    const charge = chargesRes.body[0];
    expect(charge).toBeTruthy();

    await put(`/api/finances/maintenance-charges/${charge.id}`, {
        status: 'paid', paid_date: '2026-04-15',
    }, adminCookie);

    const { body: entries } = await get('/api/audit?resource_type=finance', adminCookie);
    const entry = entries.find(e => e.action === 'UPDATE' && e.resource_id === charge.id);
    expect(entry).toBeTruthy();
});

// ── Maintenance mutation generates audit entry ──────────────────────────────

test('PUT /api/maintenance/:id writes a maintenance UPDATE audit entry', async () => {
    const mr = await post('/api/maintenance', {
        title: 'Dripping faucet', description: 'Kitchen sink drips',
        unit_id: unitId, submitted_by: submitterId, priority: 'normal', status: 'open',
    }, adminCookie);
    expect(mr.status).toBe(201);
    const mrId = mr.body.id;

    await put(`/api/maintenance/${mrId}`, { status: 'in_progress' }, adminCookie);

    const { body: entries } = await get('/api/audit?resource_type=maintenance', adminCookie);
    const entry = entries.find(e => e.action === 'UPDATE' && e.resource_id === mrId);
    expect(entry).toBeTruthy();
});

// ── Filtering ───────────────────────────────────────────────────────────────

test('GET /api/audit?resource_type= filters results', async () => {
    const { status, body } = await get('/api/audit?resource_type=resident', adminCookie);
    expect(status).toBe(200);
    body.forEach(e => expect(e.resource_type).toBe('resident'));
});

test('GET /api/audit/:resource_id returns full trail for a resource', async () => {
    const r = await post('/api/residents', {
        first_name: 'Trail', last_name: 'Test',
        email: 'trail.test@test.com', unit_id: unitId, role: 'shareholder',
    }, adminCookie);
    const trailId = r.body.id;
    await del(`/api/residents/${trailId}`, adminCookie);

    const { status, body } = await get(`/api/audit/${trailId}`, adminCookie);
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThanOrEqual(2);
    body.forEach(e => expect(e.resource_id).toBe(trailId));
    expect(body.map(e => e.action)).toContain('CREATE');
    expect(body.map(e => e.action)).toContain('DELETE');
});

test('GET /api/audit?limit= caps the result set', async () => {
    const { status, body } = await get('/api/audit?limit=2', adminCookie);
    expect(status).toBe(200);
    expect(body.length).toBeLessThanOrEqual(2);
});

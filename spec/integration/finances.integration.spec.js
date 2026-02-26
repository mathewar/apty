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

let adminCookie;
let residentCookie;
let unitId;

beforeAll(async () => {
    await startServer();
    BASE_URL = `http://localhost:${getPort()}`;
    const db = getDb();
    await seedUsers(db);

    const buildingId = uuidv4();
    await db.upsertBuilding({
        id: buildingId, name: 'Finance Test Building', address: '4 Finance Blvd',
        city: 'New York', state: 'NY', zip: '10004',
        year_built: 1980, total_floors: 10, total_units: 50, building_type: 'coop',
    });

    unitId = uuidv4();
    await db.storeUnit({
        id: unitId, building_id: buildingId, unit_number: '4D', floor: 4,
        rooms: 3, square_feet: 950, shares: 120, monthly_maintenance: 1800, status: 'occupied',
    });

    const adminLogin = await post('/api/auth/login', { email: 'admin@250w82.com', password: 'admin123' });
    adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];

    const resLogin = await post('/api/auth/login', { email: 'resident@test.com', password: 'resident123' });
    residentCookie = resLogin.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => { await stopServer(); });

// ── Auth / permissions ──────────────────────────────────────────────────────

test('GET /api/finances/maintenance-charges requires authentication', async () => {
    const { status } = await get('/api/finances/maintenance-charges');
    expect(status).toBe(401);
});

test('resident cannot generate charges (403)', async () => {
    const { status } = await post('/api/finances/maintenance-charges/generate', {
        period_month: 1, period_year: 2026,
    }, residentCookie);
    expect(status).toBe(403);
});

// ── Maintenance Charges ─────────────────────────────────────────────────────

test('GET /api/finances/maintenance-charges returns empty array initially', async () => {
    const { status, body } = await get('/api/finances/maintenance-charges', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
});

test('POST /api/finances/maintenance-charges/generate creates charges for each unit', async () => {
    const { status, body } = await post('/api/finances/maintenance-charges/generate', {
        period_month: 3, period_year: 2026,
    }, adminCookie);
    expect(status).toBe(201);
    expect(body.generated).toBe(1); // one unit seeded
    expect(body.charges[0].amount).toBe(1800);
    expect(body.charges[0].period_month).toBe(3);
    expect(body.charges[0].period_year).toBe(2026);
    expect(body.charges[0].status).toBe('pending');
});

test('GET /api/finances/maintenance-charges lists generated charges', async () => {
    const { status, body } = await get('/api/finances/maintenance-charges', adminCookie);
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].unit_id).toBe(unitId);
});

test('GET /api/finances/maintenance-charges?unit_id= filters by unit', async () => {
    const { status, body } = await get(
        `/api/finances/maintenance-charges?unit_id=${unitId}`, adminCookie,
    );
    expect(status).toBe(200);
    expect(body.every(c => c.unit_id === unitId)).toBe(true);
});

let chargeId;
test('PUT /api/finances/maintenance-charges/:id marks a charge as paid', async () => {
    const list = await get('/api/finances/maintenance-charges', adminCookie);
    chargeId = list.body[0].id;

    const { status, body } = await put(`/api/finances/maintenance-charges/${chargeId}`, {
        status: 'paid', paid_date: '2026-03-10',
    }, adminCookie);
    expect(status).toBe(200);
    expect(body.status).toBe('paid');
    expect(body.paid_date).toBe('2026-03-10');
});

test('GET /api/finances/maintenance-charges?status= filters by status', async () => {
    const { status, body } = await get(
        '/api/finances/maintenance-charges?status=paid', adminCookie,
    );
    expect(status).toBe(200);
    expect(body.every(c => c.status === 'paid')).toBe(true);
});

// ── Assessments ─────────────────────────────────────────────────────────────

test('GET /api/finances/assessments returns empty array initially', async () => {
    const { status, body } = await get('/api/finances/assessments', adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

let assessmentId;
test('POST /api/finances/assessments creates an assessment', async () => {
    const { status, body } = await post('/api/finances/assessments', {
        title: 'Roof Repair 2026', total_amount: 50000,
        description: 'Emergency roof repair', per_share_amount: null, effective_date: '2026-04-01',
    }, adminCookie);
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.total_amount).toBe(50000);
    assessmentId = body.id;
});

test('POST /api/finances/assessments/:id/generate distributes assessment by shares', async () => {
    const { status, body } = await post(
        `/api/finances/assessments/${assessmentId}/generate`, {}, adminCookie,
    );
    expect(status).toBe(201);
    expect(body.generated).toBe(1);
    expect(body.charges[0].amount).toBeGreaterThan(0);
    expect(body.charges[0].unit_id).toBe(unitId);
});

test('GET /api/finances/assessments/:id/charges lists assessment charges', async () => {
    const { status, body } = await get(
        `/api/finances/assessments/${assessmentId}/charges`, adminCookie,
    );
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].assessment_id).toBe(assessmentId);
});

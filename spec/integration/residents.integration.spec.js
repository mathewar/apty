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
const get  = (path, cookie) => request('GET',    path, null,  cookie);
const post = (path, body, cookie) => request('POST',   path, body,  cookie);
const put  = (path, body, cookie) => request('PUT',    path, body,  cookie);
const del  = (path, cookie) => request('DELETE', path, null,  cookie);

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
        id: buildingId, name: 'Res Test Building', address: '2 Test Ave',
        city: 'New York', state: 'NY', zip: '10002',
        year_built: 1960, total_floors: 5, total_units: 10, building_type: 'coop',
    });

    unitId = uuidv4();
    await db.storeUnit({
        id: unitId, building_id: buildingId, unit_number: '2B', floor: 2,
        rooms: 4, square_feet: 1100, shares: 150, monthly_maintenance: 2000, status: 'occupied',
    });

    const adminLogin = await post('/api/auth/login', { email: 'admin@250w82.com', password: 'admin123' });
    adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];

    const resLogin = await post('/api/auth/login', { email: 'resident@test.com', password: 'resident123' });
    residentCookie = resLogin.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => { await stopServer(); });

// ── Auth / permissions ──────────────────────────────────────────────────────

test('GET /api/residents requires authentication', async () => {
    const { status } = await get('/api/residents');
    expect(status).toBe(401);
});

test('resident role can read residents', async () => {
    const { status, body } = await get('/api/residents', residentCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

test('resident role cannot create a resident (403)', async () => {
    const { status } = await post('/api/residents', {
        first_name: 'Forbidden', last_name: 'User',
        email: 'forbidden@test.com', unit_id: unitId, role: 'shareholder',
    }, residentCookie);
    expect(status).toBe(403);
});

// ── CRUD ────────────────────────────────────────────────────────────────────

let createdId;

test('POST /api/residents creates a resident and returns 201', async () => {
    const { status, body } = await post('/api/residents', {
        first_name: 'Jane', last_name: 'Doe',
        email: 'jane.doe@test.com', unit_id: unitId,
        role: 'shareholder', is_primary: 1,
        move_in_date: null, shares_held: 150, phone: null,
    }, adminCookie);
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.first_name).toBe('Jane');
    createdId = body.id;
});

test('GET /api/residents lists the created resident', async () => {
    const { status, body } = await get('/api/residents', adminCookie);
    expect(status).toBe(200);
    const found = body.find(r => r.id === createdId);
    expect(found).toBeTruthy();
    expect(found.last_name).toBe('Doe');
});

test('GET /api/residents/:id returns the resident', async () => {
    const { status, body } = await get(`/api/residents/${createdId}`, adminCookie);
    expect(status).toBe(200);
    expect(body.email).toBe('jane.doe@test.com');
});

test('GET /api/residents/:id returns 404 for unknown id', async () => {
    const { status } = await get(`/api/residents/${uuidv4()}`, adminCookie);
    expect(status).toBe(404);
});

test('PUT /api/residents/:id updates the resident', async () => {
    const { status, body } = await put(`/api/residents/${createdId}`, {
        first_name: 'Jane', last_name: 'Smith',
        email: 'jane.doe@test.com', unit_id: unitId,
        role: 'shareholder', is_primary: 1,
        move_in_date: null, move_out_date: null, shares_held: 150,
    }, adminCookie);
    expect(status).toBe(200);
    expect(body.last_name).toBe('Smith');
});

test('GET /api/residents?unit_id= filters by unit', async () => {
    const { status, body } = await get(`/api/residents?unit_id=${unitId}`, adminCookie);
    expect(status).toBe(200);
    expect(body.every(r => r.unit_id === unitId)).toBe(true);
    expect(body.some(r => r.id === createdId)).toBe(true);
});

test('DELETE /api/residents/:id removes the resident', async () => {
    const { status } = await del(`/api/residents/${createdId}`, adminCookie);
    expect(status).toBe(200);

    const { status: checkStatus } = await get(`/api/residents/${createdId}`, adminCookie);
    expect(checkStatus).toBe(404);
});

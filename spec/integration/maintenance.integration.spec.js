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
        id: buildingId, name: 'Maint Test Building', address: '3 Maint St',
        city: 'New York', state: 'NY', zip: '10003',
        year_built: 1970, total_floors: 8, total_units: 30, building_type: 'coop',
    });

    unitId = uuidv4();
    await db.storeUnit({
        id: unitId, building_id: buildingId, unit_number: '3C', floor: 3,
        rooms: 2, square_feet: 750, shares: 80, monthly_maintenance: 1200, status: 'occupied',
    });

    submitterId = uuidv4();
    await db.storeResident({
        id: submitterId, unit_id: unitId,
        first_name: 'Maint', last_name: 'Resident',
        email: 'maint.resident@test.com',
        phone: null, role: 'shareholder', is_primary: 1,
        move_in_date: null, shares_held: 80,
    });

    const adminLogin = await post('/api/auth/login', { email: 'admin@250w82.com', password: 'admin123' });
    adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];

    const resLogin = await post('/api/auth/login', { email: 'resident@test.com', password: 'resident123' });
    residentCookie = resLogin.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => { await stopServer(); });

// ── Auth / permissions ──────────────────────────────────────────────────────

test('GET /api/maintenance requires authentication', async () => {
    const { status } = await get('/api/maintenance');
    expect(status).toBe(401);
});

test('resident role can read maintenance requests', async () => {
    const { status, body } = await get('/api/maintenance', residentCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
});

test('resident role can create a maintenance request', async () => {
    const { status } = await post('/api/maintenance', {
        title: 'Squeaky door', description: 'Hinges squeak',
        unit_id: unitId, submitted_by: submitterId, priority: 'low',
    }, residentCookie);
    expect(status).toBe(201);
});

test('resident role cannot update (manage) a maintenance request (403)', async () => {
    const created = await post('/api/maintenance', {
        title: 'Temp request', description: 'For permission test',
        unit_id: unitId, submitted_by: submitterId, priority: 'normal',
    }, adminCookie);
    const mrId = created.body.id;

    const { status } = await put(`/api/maintenance/${mrId}`, { status: 'in_progress' }, residentCookie);
    expect(status).toBe(403);
});

// ── CRUD ────────────────────────────────────────────────────────────────────

let createdId;

test('POST /api/maintenance creates a request and returns 201', async () => {
    const { status, body } = await post('/api/maintenance', {
        title: 'Leaking faucet',
        description: 'Kitchen faucet drips constantly',
        unit_id: unitId,
        submitted_by: submitterId,
        priority: 'normal',
        status: 'open',
    }, adminCookie);
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.title).toBe('Leaking faucet');
    createdId = body.id;
});

test('GET /api/maintenance lists the created request', async () => {
    const { status, body } = await get('/api/maintenance', adminCookie);
    expect(status).toBe(200);
    const found = body.find(r => r.id === createdId);
    expect(found).toBeTruthy();
    expect(found.priority).toBe('normal');
});

test('GET /api/maintenance/:id returns the request', async () => {
    const { status, body } = await get(`/api/maintenance/${createdId}`, adminCookie);
    expect(status).toBe(200);
    expect(body.description).toBe('Kitchen faucet drips constantly');
    expect(body).toHaveProperty('triage_json'); // column exists
});

test('GET /api/maintenance/:id returns 404 for unknown id', async () => {
    const { status } = await get(`/api/maintenance/${uuidv4()}`, adminCookie);
    expect(status).toBe(404);
});

test('PUT /api/maintenance/:id updates status', async () => {
    const { status, body } = await put(`/api/maintenance/${createdId}`, {
        status: 'in_progress',
    }, adminCookie);
    expect(status).toBe(200);
    expect(body.status).toBe('in_progress');
});

test('GET /api/maintenance?status= filters by status', async () => {
    const { status, body } = await get('/api/maintenance?status=in_progress', adminCookie);
    expect(status).toBe(200);
    expect(body.every(r => r.status === 'in_progress')).toBe(true);
    expect(body.some(r => r.id === createdId)).toBe(true);
});

test('GET /api/maintenance?priority= filters by priority', async () => {
    const { status, body } = await get('/api/maintenance?priority=normal', adminCookie);
    expect(status).toBe(200);
    body.forEach(r => expect(r.priority).toBe('normal'));
});

test('POST /api/maintenance/:id/comments adds a comment', async () => {
    const { status, body } = await post(`/api/maintenance/${createdId}/comments`, {
        author_id: submitterId, body: 'Still leaking after initial inspection.',
    }, adminCookie);
    expect(status).toBe(201);
    expect(body.body).toBe('Still leaking after initial inspection.');
});

test('GET /api/maintenance/:id/comments returns comments', async () => {
    const { status, body } = await get(`/api/maintenance/${createdId}/comments`, adminCookie);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.some(c => c.body === 'Still leaking after initial inspection.')).toBe(true);
});

test('DELETE /api/maintenance/:id removes the request', async () => {
    const { status } = await del(`/api/maintenance/${createdId}`, adminCookie);
    expect(status).toBe(200);

    const { status: checkStatus } = await get(`/api/maintenance/${createdId}`, adminCookie);
    expect(checkStatus).toBe(404);
});

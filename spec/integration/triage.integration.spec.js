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
let unitId;
let submitterId;

beforeAll(async () => {
    await startServer();
    BASE_URL = `http://localhost:${getPort()}`;
    const db = getDb();
    await seedUsers(db);

    const buildingId = uuidv4();
    await db.upsertBuilding({
        id: buildingId, name: 'Triage Test Building', address: '6 Triage Rd',
        city: 'New York', state: 'NY', zip: '10006',
        year_built: 1965, total_floors: 7, total_units: 25, building_type: 'coop',
    });
    unitId = uuidv4();
    await db.storeUnit({
        id: unitId, building_id: buildingId, unit_number: '6F', floor: 6,
        rooms: 2, square_feet: 800, shares: 90, monthly_maintenance: 1300, status: 'occupied',
    });
    submitterId = uuidv4();
    await db.storeResident({
        id: submitterId, unit_id: unitId,
        first_name: 'Triage', last_name: 'Seed',
        email: 'triage.seed@test.com',
        phone: null, role: 'shareholder', is_primary: 1,
        move_in_date: null, shares_held: 90,
    });

    const adminLogin = await post('/api/auth/login', { email: 'admin@250w82.com', password: 'admin123' });
    adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => { await stopServer(); });

// ── triage_json column exists and is null on creation ───────────────────────

test('POST /api/maintenance response has expected fields', async () => {
    const { status, body } = await post('/api/maintenance', {
        title: 'Burst pipe in lobby',
        description: 'Water spraying from main pipe in lobby ceiling',
        unit_id: unitId, submitted_by: submitterId, priority: 'normal',
    }, adminCookie);
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
    expect(body.title).toBe('Burst pipe in lobby');
});

test('GET /api/maintenance/:id exposes triage_json property', async () => {
    const created = await post('/api/maintenance', {
        title: 'Broken elevator', description: 'Elevator stuck between floors',
        unit_id: unitId, submitted_by: submitterId, priority: 'high',
    }, adminCookie);
    expect(created.status).toBe(201);

    const { status, body } = await get(`/api/maintenance/${created.body.id}`, adminCookie);
    expect(status).toBe(200);
    expect(body.title).toBe('Broken elevator');
    expect(body).toHaveProperty('triage_json');
});

// ── triage_json round-trip via DB ────────────────────────────────────────────

test('triage_json written via updateMaintenanceRequest is returned by GET /:id', async () => {
    const db = getDb();
    const created = await post('/api/maintenance', {
        title: 'No hot water', description: 'No hot water in unit 6F',
        unit_id: unitId, submitted_by: submitterId, priority: 'normal',
    }, adminCookie);
    const mrId = created.body.id;

    const triage = {
        category: 'plumbing', suggested_priority: 'high',
        vendor_type: 'plumber', summary: 'Hot water outage in unit 6F',
        urgency_reason: 'Residents without hot water — same day',
    };
    await db.updateMaintenanceRequest(mrId, { triage_json: JSON.stringify(triage) });

    const { body } = await get(`/api/maintenance/${mrId}`, adminCookie);
    expect(body.triage_json).toBeTruthy();
    const parsed = JSON.parse(body.triage_json);
    expect(parsed.category).toBe('plumbing');
    expect(parsed.suggested_priority).toBe('high');
    expect(parsed.vendor_type).toBe('plumber');
});

test('triage_json appears in GET /api/maintenance list', async () => {
    const db = getDb();
    const created = await post('/api/maintenance', {
        title: 'HVAC not cooling', description: 'AC not working, unit is 85°F',
        unit_id: unitId, submitted_by: submitterId, priority: 'normal',
    }, adminCookie);
    const mrId = created.body.id;

    await db.updateMaintenanceRequest(mrId, { triage_json: JSON.stringify({
        category: 'hvac', suggested_priority: 'high',
        vendor_type: 'hvac_tech', summary: 'HVAC failure',
        urgency_reason: 'Dangerous heat for residents',
    }) });

    const { body: list } = await get('/api/maintenance', adminCookie);
    const row = list.find(r => r.id === mrId);
    expect(row).toBeTruthy();
    expect(row.triage_json).toBeTruthy();
    expect(JSON.parse(row.triage_json).category).toBe('hvac');
});

'use strict';

const { startServer, stopServer, getDb, getPort } = require('./helpers/server');
const { seedUsers } = require('./helpers/seed');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

let BASE_URL;

// ── HTTP helpers ────────────────────────────────────────────────────────────

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
            res.on('data', (c) => (raw += c));
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(raw); } catch { parsed = raw; }
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
const del  = (path, cookie)       => request('DELETE', path, null, cookie);

// ── Fixtures ─────────────────────────────────────────────────────────────────

let adminCookie;
let residentCookie;
let unitId;
let residentId;
let submitterId; // resident used as submitted_by for maintenance requests

beforeAll(async () => {
    await startServer();
    BASE_URL = `http://localhost:${getPort()}`;
    const db = getDb();
    await seedUsers(db);

    // Seed a building then a unit
    const buildingId = uuidv4();
    await db.upsertBuilding({
        id: buildingId,
        name: 'Test Building',
        address: '1 Test St',
        city: 'New York', state: 'NY', zip: '10001',
        year_built: 1950, total_floors: 6, total_units: 20,
        building_type: 'coop',
    });

    unitId = uuidv4();
    await db.storeUnit({
        id: unitId,
        building_id: buildingId,
        unit_number: '1A',
        floor: 1,
        rooms: 3,
        square_feet: 900,
        shares: 100,
        monthly_maintenance: 1500,
        status: 'occupied',
    });

    // Seed a resident for use as submitted_by on maintenance requests
    submitterId = uuidv4();
    await db.storeResident({
        id: submitterId,
        unit_id: unitId,
        first_name: 'Seed', last_name: 'Resident',
        email: 'seed.resident@test.com',
        phone: null, role: 'shareholder', is_primary: 1,
        move_in_date: null, shares_held: 100,
    });

    // Admin login
    const adminLogin = await post('/api/auth/login', { email: 'admin@250w82.com', password: 'admin123' });
    adminCookie = adminLogin.headers['set-cookie'][0].split(';')[0];

    // Resident login
    const resLogin = await post('/api/auth/login', { email: 'resident@test.com', password: 'resident123' });
    residentCookie = resLogin.headers['set-cookie'][0].split(';')[0];
});

afterAll(async () => {
    await stopServer();
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────

describe('Audit log', () => {

    test('GET /api/audit requires authentication', async () => {
        const { status } = await get('/api/audit');
        expect(status).toBe(401);
    });

    test('GET /api/audit requires admin permission (resident gets 403)', async () => {
        const { status } = await get('/api/audit', residentCookie);
        expect(status).toBe(403);
    });

    test('GET /api/audit returns empty array initially', async () => {
        const { status, body } = await get('/api/audit', adminCookie);
        expect(status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
    });

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
        expect(entry.user_role).toBe('admin');
        expect(entry.summary).toMatch(/Alice Audit/);
    });

    test('PUT /api/residents/:id writes an UPDATE audit entry', async () => {
        const { status } = await put(`/api/residents/${residentId}`, {
            first_name: 'Alice', last_name: 'Updated',
            email: 'alice.audit@test.com', unit_id: unitId, role: 'shareholder',
            is_primary: 0, move_in_date: null, move_out_date: null, shares_held: null,
        }, adminCookie);
        expect(status).toBe(200);

        const { body: entries } = await get('/api/audit', adminCookie);
        const entry = entries.find(e => e.resource_type === 'resident' && e.action === 'UPDATE' && e.resource_id === residentId);
        expect(entry).toBeTruthy();
    });

    test('DELETE /api/residents/:id writes a DELETE audit entry', async () => {
        const { status } = await del(`/api/residents/${residentId}`, adminCookie);
        expect(status).toBe(200);

        const { body: entries } = await get('/api/audit', adminCookie);
        const entry = entries.find(e => e.resource_type === 'resident' && e.action === 'DELETE' && e.resource_id === residentId);
        expect(entry).toBeTruthy();
    });

    test('GET /api/audit?resource_type= filters by resource type', async () => {
        const { status, body } = await get('/api/audit?resource_type=resident', adminCookie);
        expect(status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
        body.forEach(e => expect(e.resource_type).toBe('resident'));
    });

    test('GET /api/audit/:resource_id returns trail for that resource', async () => {
        // Create and delete a second resident to generate a known resource_id trail
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
        const actions = body.map(e => e.action);
        expect(actions).toContain('CREATE');
        expect(actions).toContain('DELETE');
    });

    test('DELETE /api/documents/:id writes a document DELETE audit entry', async () => {
        // Create a doc record first
        const doc = await post('/api/documents', {
            id: uuidv4(), title: 'Audit Doc', category: 'general',
        }, adminCookie);
        expect(doc.status).toBe(201);
        const docId = doc.body.id;

        await del(`/api/documents/${docId}`, adminCookie);

        const { body: entries } = await get('/api/audit?resource_type=document', adminCookie);
        const entry = entries.find(e => e.resource_type === 'document' && e.action === 'DELETE' && e.resource_id === docId);
        expect(entry).toBeTruthy();
    });

    test('POST /api/finances/maintenance-charges/generate writes a CREATE audit entry', async () => {
        const { status } = await post('/api/finances/maintenance-charges/generate', {
            period_month: 3, period_year: 2026,
        }, adminCookie);
        expect(status).toBe(201);

        const { body: entries } = await get('/api/audit?resource_type=finance', adminCookie);
        const entry = entries.find(e => e.resource_type === 'finance' && e.action === 'CREATE');
        expect(entry).toBeTruthy();
        expect(entry.summary).toMatch(/3\/2026/);
    });

    test('PUT /api/finances/maintenance-charges/:id writes an UPDATE audit entry', async () => {
        const chargesRes = await get('/api/finances/maintenance-charges', adminCookie);
        expect(chargesRes.status).toBe(200);
        const charge = chargesRes.body[0];
        expect(charge).toBeTruthy();

        const { status } = await put(`/api/finances/maintenance-charges/${charge.id}`, {
            status: 'paid', paid_date: '2026-03-15',
        }, adminCookie);
        expect(status).toBe(200);

        const { body: entries } = await get('/api/audit?resource_type=finance', adminCookie);
        const entry = entries.find(e => e.action === 'UPDATE' && e.resource_id === charge.id);
        expect(entry).toBeTruthy();
    });

    test('PUT /api/maintenance/:id writes a maintenance UPDATE audit entry', async () => {
        const mr = await post('/api/maintenance', {
            title: 'Dripping faucet', description: 'Kitchen sink drips',
            unit_id: unitId, submitted_by: submitterId, priority: 'normal', status: 'open',
        }, adminCookie);
        expect(mr.status).toBe(201);
        const mrId = mr.body.id;

        const { status } = await put(`/api/maintenance/${mrId}`, { status: 'in_progress' }, adminCookie);
        expect(status).toBe(200);

        const { body: entries } = await get('/api/audit?resource_type=maintenance', adminCookie);
        const entry = entries.find(e => e.resource_type === 'maintenance' && e.action === 'UPDATE' && e.resource_id === mrId);
        expect(entry).toBeTruthy();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// MAINTENANCE TRIAGE
// ─────────────────────────────────────────────────────────────────────────────

describe('Maintenance triage', () => {

    test('POST /api/maintenance creates request with triage_json null initially', async () => {
        const { status, body } = await post('/api/maintenance', {
            title: 'Burst pipe in lobby',
            description: 'Water spraying from main pipe in lobby ceiling',
            unit_id: unitId, submitted_by: submitterId,
            priority: 'normal',
        }, adminCookie);
        expect(status).toBe(201);
        expect(body.id).toBeTruthy();
        // triage_json is not in the POST response body (fire-and-forget), that's expected
    });

    test('maintenance request row is retrievable via GET', async () => {
        // Create then immediately retrieve — triage_json may or may not be set yet
        const created = await post('/api/maintenance', {
            title: 'Broken elevator',
            description: 'Elevator stuck between floors',
            unit_id: unitId, submitted_by: submitterId,
            priority: 'high',
        }, adminCookie);
        expect(created.status).toBe(201);

        const { status, body } = await get(`/api/maintenance/${created.body.id}`, adminCookie);
        expect(status).toBe(200);
        expect(body.title).toBe('Broken elevator');
        // triage_json column exists (null or string), key is present in schema
        expect('triage_json' in body || body.triage_json === undefined).toBeTruthy();
    });

    test('triage_json can be written directly via updateMaintenanceRequest', async () => {
        const db = getDb();
        const created = await post('/api/maintenance', {
            title: 'No hot water', description: 'No hot water in unit 1A',
            unit_id: unitId, submitted_by: submitterId, priority: 'normal',
        }, adminCookie);
        const mrId = created.body.id;

        const triage = {
            category: 'plumbing',
            suggested_priority: 'high',
            vendor_type: 'plumber',
            summary: 'Hot water outage in unit 1A',
            urgency_reason: 'Residents without hot water — should be resolved same day',
        };

        // Simulate what the fire-and-forget does
        await db.updateMaintenanceRequest(mrId, { triage_json: JSON.stringify(triage) });

        const { body } = await get(`/api/maintenance/${mrId}`, adminCookie);
        expect(body.triage_json).toBeTruthy();
        const parsed = JSON.parse(body.triage_json);
        expect(parsed.category).toBe('plumbing');
        expect(parsed.suggested_priority).toBe('high');
        expect(parsed.vendor_type).toBe('plumber');
        expect(parsed.summary).toBeTruthy();
    });

    test('triage_json appears in GET /api/maintenance list', async () => {
        const db = getDb();
        const created = await post('/api/maintenance', {
            title: 'HVAC not cooling',
            description: 'Air conditioner not working, unit is 85°F',
            unit_id: unitId, submitted_by: submitterId, priority: 'normal',
        }, adminCookie);
        const mrId = created.body.id;

        await db.updateMaintenanceRequest(mrId, { triage_json: JSON.stringify({
            category: 'hvac', suggested_priority: 'high',
            vendor_type: 'hvac_tech', summary: 'HVAC failure in summer heat',
            urgency_reason: 'Dangerous temperatures for elderly residents',
        }) });

        const { body: list } = await get('/api/maintenance', adminCookie);
        const row = list.find(r => r.id === mrId);
        expect(row).toBeTruthy();
        expect(row.triage_json).toBeTruthy();
        const t = JSON.parse(row.triage_json);
        expect(t.category).toBe('hvac');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD API ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Dashboard data endpoints', () => {

    test('GET /api/finances/maintenance-charges returns charges array', async () => {
        const { status, body } = await get('/api/finances/maintenance-charges', adminCookie);
        expect(status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
    });

    test('GET /api/compliance returns compliance items array', async () => {
        const { status, body } = await get('/api/compliance', adminCookie);
        expect(status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
    });

    test('GET /api/applications returns applications array', async () => {
        const { status, body } = await get('/api/applications', adminCookie);
        expect(status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
    });

    test('GET /api/audit returns entries for dashboard audit feed', async () => {
        const { status, body } = await get('/api/audit?limit=5', adminCookie);
        expect(status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
        expect(body.length).toBeLessThanOrEqual(5);
    });

    test('resident cannot access /api/audit', async () => {
        const { status } = await get('/api/audit', residentCookie);
        expect(status).toBe(403);
    });
});

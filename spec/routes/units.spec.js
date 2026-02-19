const request = require('supertest');
const { createTestDb, seedAdmin, seedResident, login } = require('../helpers/setup');

let testDb, db, app, adminCookie, residentCookie, buildingId;

beforeAll(async () => {
    testDb = createTestDb();
    jest.resetModules();
    db = require('../../src/persistence');
    await db.init();
    app = require('../../src/app');

    const adminCreds = await seedAdmin(db);
    const residentCreds = await seedResident(db);
    adminCookie = await login(request, app, adminCreds.email, adminCreds.password);
    residentCookie = await login(request, app, residentCreds.email, residentCreds.password);

    // Seed a building for unit association
    const { v4: uuidv4 } = require('uuid');
    buildingId = uuidv4();
    await db.upsertBuilding({
        id: buildingId,
        name: 'Test Building',
        address: '123 Test St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        year_built: 2000,
        total_floors: 3,
        total_units: 6,
        building_type: 'coop',
    });
});

afterAll(async () => {
    await db.teardown();
    testDb.cleanup();
});

describe('GET /api/units', () => {
    it('returns 401 without auth', async () => {
        const res = await request(app).get('/api/units');
        expect(res.status).toBe(401);
    });

    it('returns empty array initially', async () => {
        const res = await request(app)
            .get('/api/units')
            .set('Cookie', residentCookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('POST /api/units', () => {
    it('creates a unit', async () => {
        const res = await request(app)
            .post('/api/units')
            .set('Cookie', adminCookie)
            .send({
                building_id: buildingId,
                unit_number: '1A',
                floor: 1,
                rooms: 3,
                square_feet: 850,
                shares: 350,
                monthly_maintenance: 1275.00,
            });
        expect(res.status).toBe(201);
        expect(res.body.unit_number).toBe('1A');
        expect(res.body.id).toBeDefined();
    });
});

describe('GET /api/units/:id', () => {
    let unitId;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/units')
            .set('Cookie', adminCookie)
            .send({
                building_id: buildingId,
                unit_number: '2A',
                floor: 2,
                rooms: 2,
                shares: 270,
                monthly_maintenance: 985.00,
            });
        unitId = res.body.id;
    });

    it('returns a specific unit', async () => {
        const res = await request(app)
            .get(`/api/units/${unitId}`)
            .set('Cookie', residentCookie);
        expect(res.status).toBe(200);
        expect(res.body.unit_number).toBe('2A');
    });

    it('returns 404 for nonexistent unit', async () => {
        const res = await request(app)
            .get('/api/units/nonexistent-id')
            .set('Cookie', residentCookie);
        expect(res.status).toBe(404);
    });
});

describe('PUT /api/units/:id', () => {
    let unitId;

    beforeAll(async () => {
        const res = await request(app)
            .post('/api/units')
            .set('Cookie', adminCookie)
            .send({
                building_id: buildingId,
                unit_number: '3A',
                floor: 3,
                rooms: 4,
                shares: 400,
                monthly_maintenance: 1500.00,
            });
        unitId = res.body.id;
    });

    it('updates unit fields', async () => {
        const res = await request(app)
            .put(`/api/units/${unitId}`)
            .set('Cookie', adminCookie)
            .send({
                unit_number: '3A',
                floor: 3,
                rooms: 4.5,
                shares: 420,
                monthly_maintenance: 1600.00,
                status: 'occupied',
            });
        expect(res.status).toBe(200);
        expect(res.body.rooms).toBe(4.5);
        expect(res.body.shares).toBe(420);
    });
});

describe('DELETE /api/units/:id', () => {
    it('deletes a unit', async () => {
        const createRes = await request(app)
            .post('/api/units')
            .set('Cookie', adminCookie)
            .send({
                building_id: buildingId,
                unit_number: 'DEL',
                floor: 1,
                rooms: 1,
                shares: 100,
                monthly_maintenance: 500.00,
            });
        const unitId = createRes.body.id;

        const res = await request(app)
            .delete(`/api/units/${unitId}`)
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);

        const getRes = await request(app)
            .get(`/api/units/${unitId}`)
            .set('Cookie', adminCookie);
        expect(getRes.status).toBe(404);
    });
});

describe('GET /api/units/:id/residents', () => {
    it('returns residents for a unit', async () => {
        const unitRes = await request(app)
            .post('/api/units')
            .set('Cookie', adminCookie)
            .send({
                building_id: buildingId,
                unit_number: '4A',
                floor: 4,
                rooms: 2,
                shares: 300,
                monthly_maintenance: 1000.00,
            });

        const res = await request(app)
            .get(`/api/units/${unitRes.body.id}/residents`)
            .set('Cookie', residentCookie);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

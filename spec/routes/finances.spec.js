const request = require('supertest');
const { createTestDb, seedAdmin, login } = require('../helpers/setup');

let testDb, db, app, adminCookie;

beforeAll(async () => {
    testDb = createTestDb();
    jest.resetModules();
    db = require('../../src/persistence');
    await db.init();
    app = require('../../src/app');

    const adminCreds = await seedAdmin(db);
    adminCookie = await login(request, app, adminCreds.email, adminCreds.password);

    // Seed building and units for charge generation
    const { v4: uuidv4 } = require('uuid');
    const buildingId = uuidv4();
    await db.upsertBuilding({
        id: buildingId, name: 'Test', address: '1 Test', city: 'NY',
        state: 'NY', zip: '10001', year_built: 2000, total_floors: 1,
        total_units: 2, building_type: 'coop',
    });
    await db.storeUnit({
        id: uuidv4(), building_id: buildingId, unit_number: '1A', floor: 1,
        rooms: 3, square_feet: 800, shares: 350, monthly_maintenance: 1200,
        status: 'occupied',
    });
    await db.storeUnit({
        id: uuidv4(), building_id: buildingId, unit_number: '1B', floor: 1,
        rooms: 2, square_feet: 600, shares: 250, monthly_maintenance: 900,
        status: 'occupied',
    });
});

afterAll(async () => {
    await db.teardown();
    testDb.cleanup();
});

describe('Finances API', () => {
    it('GET /api/finances/maintenance-charges returns empty initially', async () => {
        const res = await request(app)
            .get('/api/finances/maintenance-charges')
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('POST /api/finances/maintenance-charges/generate creates charges for all units', async () => {
        const res = await request(app)
            .post('/api/finances/maintenance-charges/generate')
            .set('Cookie', adminCookie)
            .send({ period_month: 3, period_year: 2026 });
        expect(res.status).toBe(201);
        expect(res.body.generated).toBe(2);
        expect(res.body.charges.length).toBe(2);
    });

    it('GET /api/finances/maintenance-charges returns generated charges', async () => {
        const res = await request(app)
            .get('/api/finances/maintenance-charges')
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body[0].status).toBe('pending');
    });

    it('PUT /api/finances/maintenance-charges/:id marks charge as paid', async () => {
        const charges = await request(app)
            .get('/api/finances/maintenance-charges')
            .set('Cookie', adminCookie);
        const chargeId = charges.body[0].id;

        const res = await request(app)
            .put(`/api/finances/maintenance-charges/${chargeId}`)
            .set('Cookie', adminCookie)
            .send({ status: 'paid', paid_date: '2026-03-05' });
        expect(res.status).toBe(200);
    });

    it('POST /api/finances/assessments creates an assessment', async () => {
        const res = await request(app)
            .post('/api/finances/assessments')
            .set('Cookie', adminCookie)
            .send({
                title: 'Lobby renovation',
                description: 'Complete lobby overhaul',
                total_amount: 100000,
                per_share_amount: 16.67,
                effective_date: '2026-04-01',
            });
        expect(res.status).toBe(201);
        expect(res.body.title).toBe('Lobby renovation');
    });
});

const request = require('supertest');
const { createTestDb, seedAdmin, login } = require('../helpers/setup');
const { v4: uuidv4 } = require('uuid');

let testDb, db, app, adminCookie, residentId;

beforeAll(async () => {
    testDb = createTestDb();
    jest.resetModules();
    db = require('../../src/persistence');
    await db.init();
    app = require('../../src/app');

    const adminCreds = await seedAdmin(db);
    adminCookie = await login(request, app, adminCreds.email, adminCreds.password);

    // Seed a building, unit, and resident for FK constraints
    const buildingId = uuidv4();
    await db.upsertBuilding({
        id: buildingId, name: 'Test', address: '1 Test', city: 'NY',
        state: 'NY', zip: '10001', year_built: 2000, total_floors: 1,
        total_units: 1, building_type: 'coop',
    });
    const unitId = uuidv4();
    await db.storeUnit({
        id: unitId, building_id: buildingId, unit_number: '1A', floor: 1,
        rooms: 3, square_feet: 800, shares: 350, monthly_maintenance: 1200,
        status: 'occupied',
    });
    residentId = uuidv4();
    await db.storeResident({
        id: residentId, unit_id: unitId, first_name: 'Test', last_name: 'User',
        email: 'test@example.com', phone: '555-0000', role: 'shareholder',
        is_primary: true, move_in_date: '2022-01-01', shares_held: 350,
    });
});

afterAll(async () => {
    await db.teardown();
    testDb.cleanup();
});

describe('Maintenance Requests API', () => {
    let requestId;

    it('GET /api/maintenance returns empty list initially', async () => {
        const res = await request(app)
            .get('/api/maintenance')
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('POST /api/maintenance creates a request', async () => {
        const res = await request(app)
            .post('/api/maintenance')
            .set('Cookie', adminCookie)
            .send({
                submitted_by: residentId,
                title: 'Leaky faucet',
                description: 'Kitchen faucet dripping',
                location: 'Kitchen',
                priority: 'normal',
            });
        expect(res.status).toBe(201);
        expect(res.body.title).toBe('Leaky faucet');
        expect(res.body.id).toBeDefined();
        requestId = res.body.id;
    });

    it('GET /api/maintenance/:id returns the request', async () => {
        const res = await request(app)
            .get(`/api/maintenance/${requestId}`)
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Leaky faucet');
    });

    it('PUT /api/maintenance/:id updates status', async () => {
        const res = await request(app)
            .put(`/api/maintenance/${requestId}`)
            .set('Cookie', adminCookie)
            .send({ status: 'in_progress', assigned_to: 'Super Mike' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('in_progress');
    });

    it('GET /api/maintenance?status= filters by status', async () => {
        const res = await request(app)
            .get('/api/maintenance?status=in_progress')
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
    });

    it('POST /api/maintenance/:id/comments adds a comment', async () => {
        const res = await request(app)
            .post(`/api/maintenance/${requestId}/comments`)
            .set('Cookie', adminCookie)
            .send({ author_id: residentId, body: 'Plumber scheduled for tomorrow' });
        expect(res.status).toBe(201);
        expect(res.body.body).toBe('Plumber scheduled for tomorrow');
    });

    it('GET /api/maintenance/:id/comments returns comments', async () => {
        const res = await request(app)
            .get(`/api/maintenance/${requestId}/comments`)
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
    });

    it('DELETE /api/maintenance/:id removes request and comments', async () => {
        const res = await request(app)
            .delete(`/api/maintenance/${requestId}`)
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);

        const getRes = await request(app)
            .get(`/api/maintenance/${requestId}`)
            .set('Cookie', adminCookie);
        expect(getRes.status).toBe(404);
    });
});

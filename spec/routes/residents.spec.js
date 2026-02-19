const request = require('supertest');
const { createTestDb, seedAdmin, login } = require('../helpers/setup');

let testDb, db, app, adminCookie, buildingId, unitId;

beforeAll(async () => {
    testDb = createTestDb();
    jest.resetModules();
    db = require('../../src/persistence');
    await db.init();
    app = require('../../src/app');

    const adminCreds = await seedAdmin(db);
    adminCookie = await login(request, app, adminCreds.email, adminCreds.password);

    // Seed building and unit for resident association
    const { v4: uuidv4 } = require('uuid');
    buildingId = uuidv4();
    await db.upsertBuilding({
        id: buildingId, name: 'Test', address: '1 Test', city: 'NY',
        state: 'NY', zip: '10001', year_built: 2000, total_floors: 1,
        total_units: 1, building_type: 'coop',
    });
    unitId = uuidv4();
    await db.storeUnit({
        id: unitId, building_id: buildingId, unit_number: '1A', floor: 1,
        rooms: 3, square_feet: 800, shares: 350, monthly_maintenance: 1200,
        status: 'occupied',
    });
});

afterAll(async () => {
    await db.teardown();
    testDb.cleanup();
});

describe('Residents API', () => {
    let residentId;

    it('POST /api/residents creates a resident', async () => {
        const res = await request(app)
            .post('/api/residents')
            .set('Cookie', adminCookie)
            .send({
                unit_id: unitId,
                first_name: 'Jane',
                last_name: 'Doe',
                email: 'jane@example.com',
                phone: '212-555-1234',
                role: 'shareholder',
                is_primary: true,
                move_in_date: '2022-01-15',
                shares_held: 350,
            });
        expect(res.status).toBe(201);
        expect(res.body.first_name).toBe('Jane');
        residentId = res.body.id;
    });

    it('GET /api/residents returns all residents', async () => {
        const res = await request(app)
            .get('/api/residents')
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
        expect(res.body.some(r => r.first_name === 'Jane')).toBe(true);
    });

    it('GET /api/residents?unit_id= filters by unit', async () => {
        const res = await request(app)
            .get(`/api/residents?unit_id=${unitId}`)
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].unit_id).toBe(unitId);
    });

    it('PUT /api/residents/:id updates a resident', async () => {
        const res = await request(app)
            .put(`/api/residents/${residentId}`)
            .set('Cookie', adminCookie)
            .send({
                unit_id: unitId,
                first_name: 'Jane',
                last_name: 'Smith',
                email: 'jane.smith@example.com',
                phone: '212-555-4321',
                role: 'shareholder',
                is_primary: true,
                move_in_date: '2022-01-15',
                shares_held: 350,
            });
        expect(res.status).toBe(200);
    });

    it('DELETE /api/residents/:id removes a resident', async () => {
        const res = await request(app)
            .delete(`/api/residents/${residentId}`)
            .set('Cookie', adminCookie);
        expect(res.status).toBe(200);

        const listRes = await request(app)
            .get('/api/residents')
            .set('Cookie', adminCookie);
        expect(listRes.body.some(r => r.id === residentId)).toBe(false);
    });
});

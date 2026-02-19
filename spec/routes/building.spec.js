const request = require('supertest');
const { createTestDb, seedAdmin, seedResident, login } = require('../helpers/setup');

let testDb, db, app, adminCookie, residentCookie;

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
});

afterAll(async () => {
    await db.teardown();
    testDb.cleanup();
});

describe('Building API', () => {
    it('GET /api/building returns 404 when no building exists', async () => {
        const res = await request(app)
            .get('/api/building')
            .set('Cookie', residentCookie);
        expect(res.status).toBe(404);
    });

    it('PUT /api/building creates or updates building info', async () => {
        const res = await request(app)
            .put('/api/building')
            .set('Cookie', adminCookie)
            .send({
                name: '250 West 82nd Street',
                address: '250 W 82nd St',
                city: 'New York',
                state: 'NY',
                zip: '10024',
                year_built: 1926,
                total_floors: 6,
                total_units: 24,
                building_type: 'coop',
            });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('250 West 82nd Street');
    });

    it('GET /api/building returns building after creation', async () => {
        const res = await request(app)
            .get('/api/building')
            .set('Cookie', residentCookie);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('250 West 82nd Street');
        expect(res.body.building_type).toBe('coop');
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/building');
        expect(res.status).toBe(401);
    });
});

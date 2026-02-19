const request = require('supertest');
const { createTestDb, seedAdmin, seedResident, login } = require('../helpers/setup');

let testDb, db, app, adminCreds, residentCreds;

beforeAll(async () => {
    testDb = createTestDb();
    // Re-require persistence with fresh SQLITE_DB
    jest.resetModules();
    db = require('../../src/persistence');
    await db.init();
    app = require('../../src/app');
    adminCreds = await seedAdmin(db);
    residentCreds = await seedResident(db);
});

afterAll(async () => {
    await db.teardown();
    testDb.cleanup();
});

describe('POST /api/auth/login', () => {
    it('returns user on valid credentials', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: adminCreds.email, password: adminCreds.password });
        expect(res.status).toBe(200);
        expect(res.body.email).toBe(adminCreds.email);
        expect(res.body.role).toBe('admin');
        expect(res.body.password_hash).toBeUndefined();
    });

    it('returns 401 on wrong password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: adminCreds.email, password: 'wrong' });
        expect(res.status).toBe(401);
    });

    it('returns 401 on unknown email', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@test.com', password: 'x' });
        expect(res.status).toBe(401);
    });

    it('returns 400 when email or password missing', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: adminCreds.email });
        expect(res.status).toBe(400);
    });
});

describe('GET /api/auth/me', () => {
    it('returns 401 when not authenticated', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });

    it('returns user when authenticated', async () => {
        const cookie = await login(request, app, adminCreds.email, adminCreds.password);
        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body.email).toBe(adminCreds.email);
    });
});

describe('POST /api/auth/logout', () => {
    it('destroys session', async () => {
        const cookie = await login(request, app, adminCreds.email, adminCreds.password);
        const logoutRes = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', cookie);
        expect(logoutRes.status).toBe(200);

        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Cookie', cookie);
        expect(meRes.status).toBe(401);
    });
});

describe('POST /api/auth/register (admin-only)', () => {
    it('returns 401 when not authenticated', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'new@test.com', password: 'pass123' });
        expect(res.status).toBe(401);
    });

    it('returns 403 when resident tries to register a user', async () => {
        const cookie = await login(request, app, residentCreds.email, residentCreds.password);
        const res = await request(app)
            .post('/api/auth/register')
            .set('Cookie', cookie)
            .send({ email: 'new@test.com', password: 'pass123' });
        expect(res.status).toBe(403);
    });

    it('allows admin to create a new user', async () => {
        const cookie = await login(request, app, adminCreds.email, adminCreds.password);
        const res = await request(app)
            .post('/api/auth/register')
            .set('Cookie', cookie)
            .send({ email: 'created@test.com', password: 'pass123', role: 'resident' });
        expect(res.status).toBe(201);
        expect(res.body.email).toBe('created@test.com');
        expect(res.body.role).toBe('resident');
        expect(res.body.password_hash).toBeUndefined();
    });

    it('rejects duplicate email', async () => {
        const cookie = await login(request, app, adminCreds.email, adminCreds.password);
        const res = await request(app)
            .post('/api/auth/register')
            .set('Cookie', cookie)
            .send({ email: adminCreds.email, password: 'pass123' });
        expect(res.status).toBe(409);
    });

    it('defaults invalid roles to resident', async () => {
        const cookie = await login(request, app, adminCreds.email, adminCreds.password);
        const res = await request(app)
            .post('/api/auth/register')
            .set('Cookie', cookie)
            .send({ email: 'norole@test.com', password: 'pass123', role: 'superadmin' });
        expect(res.status).toBe(201);
        expect(res.body.role).toBe('resident');
    });
});

describe('GET /api/auth/users (admin-only)', () => {
    it('returns 403 for resident', async () => {
        const cookie = await login(request, app, residentCreds.email, residentCreds.password);
        const res = await request(app)
            .get('/api/auth/users')
            .set('Cookie', cookie);
        expect(res.status).toBe(403);
    });

    it('returns user list for admin', async () => {
        const cookie = await login(request, app, adminCreds.email, adminCreds.password);
        const res = await request(app)
            .get('/api/auth/users')
            .set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
});

describe('DELETE /api/auth/users/:id (admin-only)', () => {
    it('allows admin to delete a user', async () => {
        const cookie = await login(request, app, adminCreds.email, adminCreds.password);
        // Create a user to delete
        const createRes = await request(app)
            .post('/api/auth/register')
            .set('Cookie', cookie)
            .send({ email: 'deleteme@test.com', password: 'pass123' });
        const userId = createRes.body.id;

        const res = await request(app)
            .delete(`/api/auth/users/${userId}`)
            .set('Cookie', cookie);
        expect(res.status).toBe(200);
    });
});

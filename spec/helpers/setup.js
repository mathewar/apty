const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Creates a temporary SQLite database for a test suite.
 * Returns { dbPath, cleanup } - call cleanup() in afterAll.
 */
function createTestDb() {
    const dbPath = path.join(
        os.tmpdir(),
        `apty-test-${crypto.randomBytes(6).toString('hex')}.db`,
    );
    process.env.SQLITE_DB = dbPath;
    return {
        dbPath,
        cleanup() {
            try { fs.unlinkSync(dbPath); } catch (_) {}
            try { fs.unlinkSync(dbPath + '-wal'); } catch (_) {}
            try { fs.unlinkSync(dbPath + '-shm'); } catch (_) {}
        },
    };
}

/**
 * Seeds a minimal admin user and returns credentials.
 */
async function seedAdmin(db) {
    const { v4: uuidv4 } = require('uuid');
    const crp = require('crypto');
    const salt = crp.randomBytes(16).toString('hex');
    const hash = crp.pbkdf2Sync('admin123', salt, 10000, 64, 'sha512').toString('hex');
    const user = {
        id: uuidv4(),
        email: 'admin@test.com',
        password_hash: `${salt}:${hash}`,
        resident_id: null,
        role: 'admin',
    };
    await db.storeUser(user);
    return { email: 'admin@test.com', password: 'admin123', id: user.id };
}

/**
 * Seeds a resident user and returns credentials.
 */
async function seedResident(db) {
    const { v4: uuidv4 } = require('uuid');
    const crp = require('crypto');
    const salt = crp.randomBytes(16).toString('hex');
    const hash = crp.pbkdf2Sync('resident123', salt, 10000, 64, 'sha512').toString('hex');
    const user = {
        id: uuidv4(),
        email: 'resident@test.com',
        password_hash: `${salt}:${hash}`,
        resident_id: null,
        role: 'resident',
    };
    await db.storeUser(user);
    return { email: 'resident@test.com', password: 'resident123', id: user.id };
}

/**
 * Logs in via the API and returns the session cookie.
 */
async function login(request, app, email, password) {
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password });
    const cookies = res.headers['set-cookie'];
    return cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';
}

module.exports = { createTestDb, seedAdmin, seedResident, login };

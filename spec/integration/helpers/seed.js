'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

async function seedUsers(db) {
    await db.storeUser({
        id: uuidv4(),
        email: 'admin@250w82.com',
        password_hash: hashPassword('admin123'),
        resident_id: null,
        role: 'admin',
    });

    await db.storeUser({
        id: uuidv4(),
        email: 'resident@test.com',
        password_hash: hashPassword('resident123'),
        resident_id: null,
        role: 'resident',
    });
}

module.exports = { seedUsers };

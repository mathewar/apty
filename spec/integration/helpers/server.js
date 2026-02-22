'use strict';

const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '..', '..', '..', 'data', 'test.db');
const PORT = 3001;

let server;
let dbRef;

async function startServer() {
    // Point SQLite at a clean test database before requiring any app code
    process.env.SQLITE_DB = TEST_DB_PATH;

    // Remove stale test DB so each run starts from scratch
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }

    // resetModules: true in jest.integration.json ensures sqlite.js re-reads SQLITE_DB
    const { app, db } = require('../../../src/index');
    dbRef = db;

    await db.init();

    return new Promise((resolve) => {
        server = app.listen(PORT, () => resolve());
    });
}

async function stopServer() {
    await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
    });
    if (dbRef) await dbRef.teardown();
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
}

function getDb() {
    return dbRef;
}

module.exports = { startServer, stopServer, getDb, PORT };

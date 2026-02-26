'use strict';

const path = require('path');
const fs = require('fs');

// Unique DB per worker so suites can run in parallel
const TEST_DB_PATH = path.join(
    __dirname, '..', '..', '..', 'data',
    `test-${process.pid}-${Date.now()}.db`,
);

let server;
let dbRef;
let actualPort;

async function startServer() {
    // Point SQLite at a clean test database before requiring any app code
    process.env.SQLITE_DB = TEST_DB_PATH;

    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }

    // resetModules: true in jest.integration.json ensures sqlite.js re-reads SQLITE_DB
    const { app, db } = require('../../../src/index');
    dbRef = db;

    await db.init();

    return new Promise((resolve) => {
        // Port 0 → OS assigns a free port, eliminating conflicts between parallel workers
        server = app.listen(0, () => {
            actualPort = server.address().port;
            resolve();
        });
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

function getPort() {
    return actualPort;
}

module.exports = { startServer, stopServer, getDb, getPort };

'use strict';

const { startServer, stopServer, getDb, PORT } = require('./helpers/server');
const { seedUsers } = require('./helpers/seed');
const { launchBrowser, newPage, closeBrowser } = require('./helpers/browser');
const { loginAs, logout } = require('./helpers/login');
const http = require('http');

const BASE_URL = `http://localhost:${PORT}`;

beforeAll(async () => {
    await startServer();
    await seedUsers(getDb());
    await launchBrowser();
});

afterAll(async () => {
    await closeBrowser();
    await stopServer();
});

test('valid admin login shows navbar and user email', async () => {
    const page = await newPage();
    await loginAs(page, BASE_URL, 'admin@250w82.com', 'admin123');
    await page.waitForSelector('nav.navbar.navbar-dark');
    const navbarText = await page.$eval('nav.navbar.navbar-dark', (el) => el.textContent);
    expect(navbarText).toContain('admin@250w82.com');
    await page.close();
});

test('invalid credentials shows alert-danger and stays on login page', async () => {
    const page = await newPage();
    await loginAs(page, BASE_URL, 'admin@250w82.com', 'wrongpassword');
    await page.waitForSelector('.alert-danger');
    const alertText = await page.$eval('.alert-danger', (el) => el.textContent);
    expect(alertText).toBeTruthy();
    await page.waitForSelector('.login-card');
    await page.close();
});

test('logout redirects back to login card', async () => {
    const page = await newPage();
    await loginAs(page, BASE_URL, 'admin@250w82.com', 'admin123');
    await page.waitForSelector('nav.navbar.navbar-dark');
    await logout(page);
    await page.waitForSelector('.login-card');
    await page.close();
});

test('session persists after page reload', async () => {
    const page = await newPage();
    await loginAs(page, BASE_URL, 'admin@250w82.com', 'admin123');
    await page.waitForSelector('nav.navbar.navbar-dark');
    await page.reload();
    await page.waitForSelector('nav.navbar.navbar-dark');
    await page.close();
});

test('GET /api/auth/me unauthenticated returns 401', async () => {
    const status = await new Promise((resolve, reject) => {
        http.get(`${BASE_URL}/api/auth/me`, (res) => resolve(res.statusCode)).on('error', reject);
    });
    expect(status).toBe(401);
});

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { startServer, stopServer, getDb, getPort } = require('./helpers/server');
const { seedUsers } = require('./helpers/seed');
const { launchBrowser, newPage, closeBrowser } = require('./helpers/browser');
const { loginAs } = require('./helpers/login');

let BASE_URL;
const UI_TIMEOUT = 60000;

const MINIMAL_PDF = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj ' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
    '0000000058 00000 n\n0000000115 00000 n\n' +
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF',
);

// Shared pages — create once, reuse across tests to avoid repeated Babel compilation
let adminPage;
let residentPage;

async function navigateToDocuments(page) {
    const clicked = await page.evaluate(() => {
        const links = [...document.querySelectorAll('.sidebar .nav-link')];
        const link = links.find(l => l.textContent.includes('Documents'));
        if (link) { link.click(); return true; }
        return false;
    });
    if (!clicked) throw new Error('Documents nav link not found');
}

beforeAll(async () => {
    await startServer();
    BASE_URL = `http://localhost:${getPort()}`;
    await seedUsers(getDb());
    await launchBrowser();

    // Helper: obtain a session cookie via API (no browser needed), then load the SPA
    async function loginViaApi(page, email, password) {
        // Get session cookie by calling the login API directly
        const cookie = await new Promise((resolve, reject) => {
            const body = JSON.stringify({ email, password });
            const req = http.request({
                hostname: 'localhost', port: getPort(), path: '/api/auth/login', method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            }, (res) => {
                const raw = res.headers['set-cookie'];
                resolve(raw ? raw[0].split(';')[0] : null);
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
        if (!cookie) throw new Error('Login failed — no session cookie');

        // Inject the cookie, navigate to the SPA, wait for the app to mount
        const [name, value] = cookie.split('=');
        await page.setCookie({ name, value, domain: 'localhost', path: '/' });
        await page.goto(BASE_URL);
        await page.waitForSelector('.sidebar', { timeout: UI_TIMEOUT });
    }

    // Admin page — load once, keep open
    adminPage = await newPage();
    adminPage.setDefaultTimeout(UI_TIMEOUT);
    await loginViaApi(adminPage, 'admin@250w82.com', 'admin123');

    // Resident page — reuse the already-warm browser; inject cookie instead of full login flow
    residentPage = await newPage();
    residentPage.setDefaultTimeout(UI_TIMEOUT);
    await loginViaApi(residentPage, 'resident@test.com', 'resident123');
}, UI_TIMEOUT * 4);

afterAll(async () => {
    await closeBrowser();
    await stopServer();
});

test('Documents link appears in admin sidebar', async () => {
    const sidebarText = await adminPage.$eval('.sidebar', el => el.textContent);
    expect(sidebarText).toContain('Documents');
}, UI_TIMEOUT);

test('clicking Documents shows page header and Upload button for admin', async () => {
    await navigateToDocuments(adminPage);
    // Brief settle for React to re-render
    await new Promise(r => setTimeout(r, 500));
    const snap = await adminPage.evaluate(() => ({
        h4s: [...document.querySelectorAll('h4')].map(h => h.textContent),
        buttons: [...document.querySelectorAll('button')].map(b => b.textContent.trim()).slice(0, 5),
    }));
    console.log('[AFTER CLICK SNAP]', JSON.stringify(snap));
    await adminPage.waitForFunction(
        () => [...document.querySelectorAll('h4')].some(h => h.textContent.includes('Documents')),
        { timeout: UI_TIMEOUT, polling: 200 },
    );
    const buttons = await adminPage.$$eval('button', els => els.map(e => e.textContent.trim()));
    expect(buttons.some(t => t.includes('Upload Document'))).toBe(true);
}, UI_TIMEOUT);

test('Upload modal opens with file input when Upload Document clicked', async () => {
    // Click the Upload Document button via evaluate (avoids JSHandle.click issues)
    await adminPage.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Upload Document'));
        if (btn) btn.click();
    });
    await adminPage.waitForSelector('input[type="file"]', { timeout: UI_TIMEOUT });
    const fileInput = await adminPage.$('input[type="file"]');
    expect(fileInput).not.toBeNull();
}, UI_TIMEOUT);

test('uploading a PDF adds a doc card to the list', async () => {
    // Ensure the title input is visible (modal should be open from previous test)
    await adminPage.waitForSelector('input[placeholder="e.g. Annual Budget 2024"]', { visible: true, timeout: UI_TIMEOUT });

    // Fill in title
    await adminPage.evaluate(() => {
        const input = document.querySelector('input[placeholder="e.g. Annual Budget 2024"]');
        if (input) { input.value = ''; }
    });
    await adminPage.type('input[placeholder="e.g. Annual Budget 2024"]', 'Test Financial Report');

    // Write PDF to a temp file (puppeteer 22 requires a real file path)
    const tmpPdf = path.join(os.tmpdir(), 'test-report.pdf');
    fs.writeFileSync(tmpPdf, MINIMAL_PDF);
    const fileInput = await adminPage.$('input[type="file"]');
    await fileInput.uploadFile(tmpPdf);

    // Wait for React state to update (Upload button becomes enabled)
    await adminPage.waitForFunction(
        () => {
            const btns = [...document.querySelectorAll('.modal-footer button')];
            const upload = btns.find(b => b.textContent.trim() === 'Upload');
            return upload && !upload.disabled;
        },
        { timeout: UI_TIMEOUT },
    );

    // Click Upload via evaluate
    await adminPage.evaluate(() => {
        const btn = [...document.querySelectorAll('.modal-footer button')].find(b => b.textContent.trim() === 'Upload');
        if (btn) btn.click();
    });

    // Wait for doc card
    await adminPage.waitForSelector('.doc-card', { timeout: UI_TIMEOUT });
    const cardText = await adminPage.$eval('.doc-card', el => el.textContent);
    expect(cardText).toContain('Test Financial Report');
}, UI_TIMEOUT);

test('resident sees Documents in sidebar but no Upload button', async () => {
    const sidebarText = await residentPage.$eval('.sidebar', el => el.textContent);
    expect(sidebarText).toContain('Documents');

    await navigateToDocuments(residentPage);
    await residentPage.waitForFunction(
        () => document.querySelector('h4') && document.querySelector('h4').textContent.includes('Documents'),
        { timeout: UI_TIMEOUT },
    );

    const buttons = await residentPage.$$eval('button', els => els.map(e => e.textContent.trim()));
    expect(buttons.some(t => t.includes('Upload Document'))).toBe(false);
}, UI_TIMEOUT);

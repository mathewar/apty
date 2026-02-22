'use strict';

async function loginAs(page, baseUrl, email, password) {
    await page.goto(baseUrl);
    await page.waitForSelector('.login-card');
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
}

async function logout(page) {
    // Wait for the Sign Out button to be visible then click it
    await page.waitForSelector('button', { visible: true });
    const buttons = await page.$$('button');
    for (const btn of buttons) {
        const text = await page.evaluate((el) => el.textContent.trim(), btn);
        if (text === 'Sign Out') {
            await btn.click();
            return;
        }
    }
    throw new Error('Sign Out button not found');
}

module.exports = { loginAs, logout };

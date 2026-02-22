'use strict';

const puppeteer = require('puppeteer');

let browser;

async function launchBrowser() {
    browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
}

async function newPage() {
    return browser.newPage();
}

async function closeBrowser() {
    if (browser) await browser.close();
}

module.exports = { launchBrowser, newPage, closeBrowser };

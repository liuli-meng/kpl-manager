// Shared playwright helper for kpl-manager playthrough agents
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
const CHROME = CHROME_PATHS.find(p => fs.existsSync(p)) || CHROME_PATHS[0];

const PLAYWRIGHT_PATHS = [
  path.join(ROOT, '..', '.workbuddy', 'tmp', 'node_modules', 'playwright-core'),
  path.join(ROOT, 'node_modules', 'playwright-core')
];
const PW_DIR = PLAYWRIGHT_PATHS.find(p => fs.existsSync(p));
const { chromium } = PW_DIR ? require(PW_DIR) : {};

const BASE = process.env.KPL_BASE || 'http://127.0.0.1:8931';
const SHOT_DIR = process.env.SHOT_DIR || path.join(ROOT, '..', 'gui-test-screenshots');

async function launch(opts = {}) {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 900 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[console.error]', msg.text());
  });
  await page.goto(BASE + '/game.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(400);
  return { browser, context, page };
}

async function clearAndStart(page) {
  await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
}

async function shot(page, name) {
  const file = path.join(SHOT_DIR, name.endsWith('.png') ? name : name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  console.log('SHOT', file);
  return file;
}

/** Call a game global in one evaluate. Prefer this over multi-step locators. */
async function call(page, fnBody) {
  return page.evaluate((body) => {
    // eslint-disable-next-line no-new-func
    return new Function(body)();
  }, fnBody);
}

module.exports = { launch, clearAndStart, shot, call, BASE, CHROME, SHOT_DIR };

import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

// Production DOM/input flow only: no inspection hook and no simulation access.
const url = process.env.BURROW_URL ?? 'http://127.0.0.1:5175';
const output = process.env.BURROW_AUDIT_DIR ?? 'artifacts/oasis-production-smoke';
assert(process.env.BURROW_PROFILE, 'Supply an earned/restored between-hunt profile via BURROW_PROFILE');
const profile = JSON.parse(await readFile(process.env.BURROW_PROFILE, 'utf8'));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.setDefaultTimeout(120000);
await page.addInitScript(({ profile }) => {
  localStorage.setItem('burrow.settings', JSON.stringify({ sensitivity: 1, invert: false, volume: 0, quality: 'low' }));
  if (!sessionStorage.getItem('qa-profile-restored')) {
    localStorage.setItem('burrow.campaign.v1', JSON.stringify(profile));
    sessionStorage.setItem('qa-profile-restored', '1');
  }
}, { profile });
const errors = [], requests = [], steps = [];
let status = 'running', failure = null;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => requests.push({ url: request.url(), failure: request.failure() }));
async function screen(name) { await page.locator(`#interface[data-screen="${name}"]`).waitFor(); steps.push(name); }
try {
  await page.goto(url); await screen('title');
  assert.equal(await page.evaluate(() => typeof window.__BURROW__), 'undefined');
  await page.locator('[data-panel="title"] [data-action="expedition"]').click();
  await page.locator('[data-action="hunt"]').filter({ visible: true }).waitFor(); steps.push('expedition');
  await page.waitForTimeout(900); await page.screenshot({ path: `${output}/expedition.png` });
  await page.locator('[data-action="select-hunt-2"]').filter({ visible: true }).click();
  await page.locator('[data-action="hunt"]').filter({ visible: true }).click(); await screen('play');
  await page.waitForFunction(() => /CARGO|PLANE/i.test(document.querySelector('#hunt-objective')?.textContent ?? ''));
  assert.match(await page.locator('#hunt-objective').textContent(), /CARGO|PLANE/i);
  await page.keyboard.down('w');
  await page.waitForFunction(() => Number(document.querySelector('#bites').textContent) > 0, null, { polling: 100 });
  await page.keyboard.up('w');
  await page.locator('#hunt-hud').waitFor();
  const initialBars = {};
  for (const name of ['health', 'hunger', 'growth', 'heat']) {
    const value = Number(await page.locator(`#hunt-${name}`).getAttribute('aria-valuenow'));
    assert(Number.isFinite(value) && value >= 0 && value <= 100); initialBars[name] = value;
  }
  await page.screenshot({ path: `${output}/opening-hunt.png` });
  await page.keyboard.press('Escape'); await screen('pause');
  const paused = await page.locator('#clock').textContent(); await page.waitForTimeout(700);
  assert.equal(await page.locator('#clock').textContent(), paused);
  await page.locator('[data-panel="pause"] [data-action="settings"]').click(); await screen('settings');
  await page.keyboard.press('Escape'); await screen('pause');
  await page.locator('[data-panel="pause"] [data-action="resume"]').click(); await screen('play');
  await page.keyboard.press('Escape'); await screen('pause');
  await page.locator('[data-panel="pause"] [data-action="finish"]').click(); await screen('report');
  await page.getByRole('button', { name: 'HUNT AGAIN' }).waitFor();
  assert.equal(await page.locator('[data-panel="report"]').getAttribute('data-mode'), 'hunt');
  assert.equal(await page.locator('[data-panel="report"]').getAttribute('data-result'), 'lost');
  await page.waitForTimeout(900); await page.screenshot({ path: `${output}/retired-report.png` });
  await page.getByRole('button', { name: 'HUNT AGAIN' }).click(); await screen('play');
  await page.waitForFunction(() => document.querySelector('#bites').textContent === '00', null, { polling: 50 });
  await page.keyboard.press('Escape'); await screen('pause');
  await page.locator('[data-panel="pause"] [data-action="finish"]').click(); await screen('report');
  await page.locator('[data-panel="report"] [data-action="title"]').click(); await screen('title');
  assert.deepEqual(errors, []); assert.deepEqual(requests, []); status = 'passed';
  console.log('PASS production restored Oasis expedition→mission→human-scale bite→pause/settings→retire report→retry→title.');
} catch (error) { status = 'failed'; failure = String(error); throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ status, failure, url, browser: await browser.version(), renderer: 'SwiftShader; 1280×800; low quality', steps, errors, requests }, null, 2));
  await browser.close();
}

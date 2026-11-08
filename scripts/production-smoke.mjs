import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.BURROW_URL ?? 'http://127.0.0.1:5175';
const output = process.env.BURROW_AUDIT_DIR ?? 'artifacts/production-smoke';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.setDefaultTimeout(90000);
await page.addInitScript(() => {
  localStorage.setItem('burrow.settings', JSON.stringify({ sensitivity: 1, invert: false, volume: 0, quality: 'low' }));
});
const errors = [], requests = [], steps = [];
let status = 'running', failure = null, firstBiteClock = null;
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('requestfailed', request => requests.push({ url: request.url(), failure: request.failure() }));
async function screen(name) { await page.locator(`#interface[data-screen="${name}"]`).waitFor(); steps.push(name); }
try {
  await page.goto(url); await screen('title');
  assert.equal(await page.evaluate(() => typeof window.__BURROW__), 'undefined', 'Production excludes inspection hook');
  await page.waitForTimeout(900); await page.screenshot({ path: `${output}/title.png` });
  await page.locator('[data-panel="title"] [data-action="guide"]').click(); await screen('guide');
  await page.keyboard.press('Escape'); await screen('title');
  await page.locator('[data-panel="title"] [data-action="settings"]').click(); await screen('settings');
  await page.getByRole('button', { name: 'ALL SET' }).click(); await screen('title');
  await page.getByRole('button', { name: 'ENTER THE DUNES' }).click(); await screen('play');
  await page.keyboard.down('w');
  await page.waitForFunction(() => Number(document.querySelector('#bites').textContent) > 0, null, { polling: 100 });
  await page.keyboard.up('w');
  firstBiteClock = await page.locator('#clock').textContent();
  await page.keyboard.press('Escape'); await screen('pause');
  const pauseClock = await page.locator('#clock').textContent(); await page.waitForTimeout(600);
  assert.equal(await page.locator('#clock').textContent(), pauseClock);
  await page.locator('[data-panel="pause"] [data-action="guide"]').click(); await screen('guide');
  await page.keyboard.press('Escape'); await screen('pause');
  await page.locator('[data-panel="pause"] [data-action="resume"]').click(); await screen('play');
  await page.keyboard.press('Escape'); await screen('pause');
  await page.getByRole('button', { name: 'END OUTING' }).click(); await screen('report');
  await page.waitForTimeout(900); await page.screenshot({ path: `${output}/report.png` });
  await page.getByRole('button', { name: 'STILL HUNGRY' }).click(); await screen('play');
  // Screen state changes synchronously; the HUD refreshes on the next render.
  await page.waitForFunction(() => document.querySelector('#bites').textContent === '00', null, { polling: 50 });
  assert.equal(await page.locator('#bites').textContent(), '00');
  await page.keyboard.press('Escape'); await screen('pause');
  await page.getByRole('button', { name: 'END OUTING' }).click(); await screen('report');
  await page.getByRole('button', { name: 'BACK TO TITLE' }).click(); await screen('title');
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  status = 'passed';
  console.log(`PASS production title→guide/settings→play→first bite (${firstBiteClock})→pause/resume→report→reset→title; no debug hook/errors/failed requests.`);
} catch (error) { status = 'failed'; failure = String(error); throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ status, failure, url, browser: await browser.version(), renderer: 'SwiftShader; software; 1280×800; low quality', firstBiteClock, steps, errors, requests }, null, 2));
  await browser.close();
}

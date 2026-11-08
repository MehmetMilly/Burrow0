import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.env.BURROW_URL ?? 'http://127.0.0.1:5173';
const directory = 'artifacts/playtest';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: directory, size: { width: 1280, height: 800 } } });
// Software-rendered cloud Chrome is for correctness/visual QA, not target GPU certification.
await context.addInitScript(() => localStorage.setItem('burrow.settings', JSON.stringify({ sensitivity: 1, invert: false, volume: 0, quality: 'low' })));
const page = await context.newPage(); page.setDefaultTimeout(120000);
const errors = [], steps = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const snapshot = () => page.evaluate(() => window.__BURROW__.snapshot());
async function capture(name) {
  const s = await snapshot(); const { prey, ...summary } = s;
  steps.push({ name, ...summary });
  if (['01-title', '06-settings', '07-report'].includes(name)) await page.waitForTimeout(900);
  await page.screenshot({ path: `${directory}/${name}.png` });
  console.log(name, JSON.stringify(summary));
  return s;
}
async function until(predicate) { await page.waitForFunction(predicate, null, { polling: 100 }); }
async function seconds(n) { const before = (await snapshot()).stats.time; await page.waitForFunction(t => window.__BURROW__.snapshot().stats.time >= t, before + n, { polling: 100 }); }
try {
  await page.goto(url); await page.waitForFunction(() => window.__BURROW__); await page.waitForTimeout(700);
  await capture('01-title');
  await page.getByRole('button', { name: 'FIELD GUIDE' }).first().click();
  assert.equal((await snapshot()).screen, 'guide');
  await page.getByRole('button', { name: 'GOT AN APPETITE' }).click();
  await page.getByRole('button', { name: 'ENTER THE DUNES' }).click();
  await page.keyboard.down('w');
  await until(() => window.__BURROW__.snapshot().stats.bites > 0);
  await capture('02-first-bite');
  await page.keyboard.down('Space');
  await until(() => window.__BURROW__.snapshot().deep && window.__BURROW__.snapshot().depth > 10);
  await seconds(.6); await capture('03-tremor-sense');
  await page.keyboard.up('Space');
  await until(() => window.__BURROW__.snapshot().state === 'air');
  await seconds(.65); const air = await capture('04-breach'); assert(air.stats.bestAir > 12);
  await page.mouse.down(); await seconds(.15); await page.mouse.up();
  await page.keyboard.down('Space');
  await until(() => window.__BURROW__.snapshot().stats.slams > 0);
  await page.keyboard.up('Space'); await page.keyboard.up('w');
  await capture('05-slam');
  assert.equal((await snapshot()).deep, false);
  // Real relative mouse input: the camera turns first and the worm follows.
  const beforeYaw = (await snapshot()).yaw;
  await page.mouse.move(840, 400); await page.mouse.move(1040, 400, { steps: 5 });
  await seconds(1);
  assert(Math.abs((await snapshot()).yaw - beforeYaw) > .05, 'Mouse must steer the worm');
  // A/D supplies useful steering even when pointer lock is unavailable.
  await page.keyboard.down('d'); await seconds(1); await page.keyboard.up('d');
  await page.keyboard.press('Escape'); await until(() => window.__BURROW__.snapshot().screen === 'pause');
  const paused = (await snapshot()).stats.time; await page.waitForTimeout(500); assert.equal((await snapshot()).stats.time, paused);
  await page.getByRole('button', { name: 'SETTINGS', exact: false }).filter({ visible: true }).click();
  await page.locator('#volume').focus(); await page.keyboard.press('Home');
  for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowRight');
  await page.locator('#sensitivity').focus(); await page.keyboard.press('Home');
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('burrow.settings')).sensitivity), 1.4);
  await capture('06-settings');
  await page.getByRole('button', { name: 'ALL SET' }).click();
  await page.getByRole('button', { name: 'BACK BENEATH' }).click(); await seconds(.3);
  await page.keyboard.press('Escape'); await until(() => window.__BURROW__.snapshot().screen === 'pause');
  await page.getByRole('button', { name: 'END OUTING' }).click(); await capture('07-report');
  await page.getByRole('button', { name: 'STILL HUNGRY' }).click();
  const reset = await snapshot(); assert.equal(reset.stats.bites, 0); assert.equal(reset.stats.slams, 0);
  await seconds(.2); await page.keyboard.press('Escape'); await until(() => window.__BURROW__.snapshot().screen === 'pause');
  await page.getByRole('button', { name: 'END OUTING' }).click();
  await page.getByRole('button', { name: 'BACK TO TITLE' }).click(); assert.equal((await snapshot()).screen, 'title');
  assert.deepEqual(errors, []);
  console.log('PASS: title, guide, first bite, deep camera, run-up breach, lunge, slam, mouse/keyboard steering, pause, persisted settings, report, replay, title.');
} finally {
  await writeFile(`${directory}/report.json`, JSON.stringify({ url, browser: await browser.version(), renderer: 'SwiftShader (software)', errors, steps }, null, 2));
  await context.close(); await browser.close();
}

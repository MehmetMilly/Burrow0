import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Independent real-input endurance/edge-case audit. No game state is modified.
// Use low software-rendered graphics by default; this does not certify target-GPU fps.
const url = process.env.BURROW_URL ?? 'http://127.0.0.1:5173';
const output = process.env.BURROW_AUDIT_DIR ?? 'artifacts/quality-audit';
const recordVideo = process.env.BURROW_RECORD_VIDEO === '1';
const cycles = Number(process.env.BURROW_AUDIT_CYCLES ?? 10);
const roamSeconds = Number(process.env.BURROW_AUDIT_ROAM_SECONDS ?? 45);
let status = 'running', failure = null;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 800, height: 500 },
  ...(recordVideo ? { recordVideo: { dir: output, size: { width: 800, height: 500 } } } : {}) });
await context.addInitScript(() => {
  if (!localStorage.getItem('burrow.settings')) localStorage.setItem('burrow.settings', JSON.stringify({ sensitivity: 1, invert: false, volume: 0, quality: 'low' }));
});
const page = await context.newPage(); page.setDefaultTimeout(180000);
const errors = [], samples = [], cycleResults = [], navigation = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('framenavigated', f => { if (f === page.mainFrame()) navigation.push({ url: f.url(), at: Date.now() }); });
const snap = () => page.evaluate(() => window.__BURROW__.snapshot());
const until = fn => page.waitForFunction(fn, null, { polling: 100 });
async function simSeconds(seconds) { const before = (await snap()).stats.time; await page.waitForFunction(t => window.__BURROW__.snapshot().stats.time >= t, before + seconds, { polling: 100 }); }
const cdp = await context.newCDPSession(page); await cdp.send('Performance.enable');
async function sample(label) {
  await cdp.send('HeapProfiler.collectGarbage');
  const metrics = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const s = await snap(); const { prey, ...summary } = s;
  samples.push({ label, ...summary, preyAlive: prey.length, heapBytes: metrics.JSHeapUsedSize, documents: metrics.Documents, nodes: metrics.Nodes, listeners: metrics.JSEventListeners });
  console.log(label, JSON.stringify(samples.at(-1)));
  return s;
}
try {
  await page.goto(url); await until(() => window.__BURROW__);
  await page.getByRole('button', { name: 'ENTER THE DUNES' }).click();
  await page.keyboard.down('w'); await simSeconds(2); await sample('warm');
  for (let i = 0; i < cycles; i++) {
    await page.keyboard.down('Space');
    await until(() => { const s = window.__BURROW__.snapshot(); return s.deep && s.depth >= 11; });
    await page.keyboard.up('Space');
    await until(() => window.__BURROW__.snapshot().state === 'air');
    const air = await snap(); assert.equal(air.deep, false);
    await simSeconds(.5);
    await page.keyboard.down('Space');
    await page.waitForFunction(n => window.__BURROW__.snapshot().stats.slams > n, i, { polling: 100 });
    await page.keyboard.up('Space');
    const landed = await snap(); assert.equal(landed.deep, false); assert(Number.isFinite(landed.y));
    cycleResults.push({ cycle: i + 1, time: landed.stats.time, bestAir: landed.stats.bestAir, slams: landed.stats.slams, x: landed.x, z: landed.z });
    if (i === 0 || i === cycles - 1) { await simSeconds(.6); await page.screenshot({ path: `${output}/cycle-${i + 1}.png` }); }
    if ((i + 1) % 5 === 0 || i === cycles - 1) await sample(`cycle-${i + 1}`);
    // Continuous motion with real turning visits different world and boundary positions.
    await page.keyboard.down(i % 2 ? 'a' : 'd'); await simSeconds(.65); await page.keyboard.up(i % 2 ? 'a' : 'd');
  }
  await page.keyboard.down('d'); await simSeconds(roamSeconds); await page.keyboard.up('d');
  await sample('continuous-roaming');
  await page.keyboard.up('w'); await page.keyboard.down('Escape');
  await until(() => window.__BURROW__.snapshot().screen === 'pause');
  await page.keyboard.down('Escape'); await page.waitForTimeout(200);
  assert.equal((await snap()).screen, 'pause', 'Held Escape must not oscillate pause/resume');
  await page.keyboard.up('Escape');
  const paused = await snap(); await page.waitForTimeout(700); assert.equal((await snap()).stats.time, paused.stats.time);
  // Pausing while dive is held must not leave it stuck after return.
  await page.getByRole('button', { name: 'BACK BENEATH' }).click(); await page.keyboard.down('Space'); await simSeconds(.35);
  await page.keyboard.press('Escape'); await until(() => window.__BURROW__.snapshot().screen === 'pause');
  await page.keyboard.up('Space');
  await page.locator('[data-panel="pause"] [data-action="settings"]').click();
  for (const quality of ['high', 'medium', 'low', 'high', 'low']) await page.locator('#quality').selectOption(quality);
  await page.locator('#invert').check();
  await page.locator('#sensitivity').focus(); await page.keyboard.press('End');
  await page.keyboard.press('Escape'); await until(() => window.__BURROW__.snapshot().screen === 'pause');
  await page.getByRole('button', { name: 'BACK BENEATH' }).click(); await simSeconds(2);
  assert((await snap()).depth < 1, 'Pausing clears a held dive');
  await sample('after-settings');
  await page.keyboard.press('Escape'); await until(() => window.__BURROW__.snapshot().screen === 'pause');
  await page.getByRole('button', { name: 'END OUTING' }).click();
  await page.waitForTimeout(900); await page.screenshot({ path: `${output}/report.png` });
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'STILL HUNGRY' }).click();
    const reset = await snap(); assert.equal(reset.stats.bites, 0); assert.equal(reset.stats.slams, 0); assert.equal(reset.deep, false);
    await simSeconds(.2); await page.keyboard.press('Escape');
    await until(() => window.__BURROW__.snapshot().screen === 'pause');
    await page.getByRole('button', { name: 'END OUTING' }).click();
  }
  await sample('four-resets');
  await page.getByRole('button', { name: 'BACK TO TITLE' }).click();
  // Persisted invert/sensitivity/graphics must survive a normal reload.
  await page.reload(); await until(() => window.__BURROW__);
  await page.locator('[data-panel="title"] [data-action="settings"]').click();
  assert.equal(await page.locator('#sensitivity').inputValue(), '2.5');
  assert.equal(await page.locator('#invert').isChecked(), true);
  assert.equal(await page.locator('#quality').inputValue(), 'low');
  assert.deepEqual(errors, []);
  // Three.js uploads geometry lazily as new scenery comes into view; record the
  // plateau after roaming rather than comparing against the first warm frame.
  const settled = samples.find(s => s.label === 'continuous-roaming');
  const reset = samples.find(s => s.label === 'four-resets');
  assert(reset.render.geometries <= settled.render.geometries + 16, 'Resets must not create unbounded geometry growth');
  assert(samples.every(s => s.preyAlive <= 92), 'World population stays bounded');
  status = 'passed';
  console.log('PASS: repeated camera cycles, bounded resources, pause-held-input, quality changes, four resets, settings persistence.');
} catch (error) {
  status = 'failed'; failure = String(error); throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ status, failure, url, browser: await browser.version(), renderer: 'SwiftShader; software; 800×500; low quality', recordVideo, cycles: cycleResults, samples, navigation, errors }, null, 2));
  await context.close(); await browser.close();
}

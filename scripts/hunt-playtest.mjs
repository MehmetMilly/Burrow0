import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Goal-driven Hunt 1 QA. Reads telemetry, but acts exclusively through real input.
// Run only after the integrated Hunt 1 build is stable. No teleports/state writes.
const url = process.env.BURROW_URL ?? 'http://127.0.0.1:5174';
const output = process.env.BURROW_AUDIT_DIR ?? 'artifacts/hunt-playtest';
const scenario = process.env.BURROW_HUNT_SCENARIO ?? 'win';
const budget = Number(process.env.BURROW_HUNT_BUDGET ?? 420);
const recordVideo = process.env.BURROW_RECORD_VIDEO === '1';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 800, height: 500 }, ...(recordVideo ? { recordVideo: { dir: output, size: { width: 800, height: 500 } } } : {}) });
await context.addInitScript(() => {
  if (!localStorage.getItem('burrow.settings')) localStorage.setItem('burrow.settings', JSON.stringify({ sensitivity: 1, invert: false, volume: 0, quality: 'low' }));
});
const page = await context.newPage(); page.setDefaultTimeout(180000);
const errors = [], samples = [], transitions = [], targets = [], held = new Set();
let status = 'running', failure = null, lastStage = -1, lastSecond = -1;
let mouseHeld = false, mouseX = 400, mouseY = 250;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const snap = () => page.evaluate(() => window.__BURROW__.snapshot());
const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
const heading = (s, p) => Math.atan2(p.x - s.x, s.z - p.z);
const distance = (s, p) => Math.hypot(p.x - s.x, p.z - s.z);
async function controls(wanted) {
  const next = new Set(wanted);
  for (const key of held) if (!next.has(key)) { await page.keyboard.up(key); held.delete(key); }
  for (const key of next) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
}
async function lunge(active) {
  if (active === mouseHeld) return;
  if (active) await page.mouse.down(); else await page.mouse.up(); mouseHeld = active;
}
async function aim(s, targetYaw) {
  // Relative real mouse motion sets camera direction; the worm retains its turn lag.
  const delta = angle(targetYaw - s.cameraYaw);
  const pixels = Math.max(-260, Math.min(260, delta / .0025));
  mouseX += pixels;
  await page.mouse.move(mouseX, mouseY);
}
async function tick(s, amount = .16) {
  await page.waitForFunction(({ time }) => {
    const current = window.__BURROW__?.snapshot();
    return current && (current.stats.time >= time || current.hunt.status !== 'active' || current.screen !== 'play');
  }, { time: s.stats.time + amount }, { polling: 100 });
  return snap();
}
function summarize(s) {
  return { time: s.stats.time, screen: s.screen, mode: s.mode, state: s.state, x: s.x, z: s.z, altitude: s.altitude, depth: s.depth, speed: s.speed,
    stats: s.stats, hunt: s.hunt, markers: s.markers, digestion: s.digestion, render: s.render, frames: s.frames };
}
async function capture(name, s = null) {
  if (s) transitions.push({ name, ...summarize(s) });
  await page.screenshot({ path: `${output}/${name}.png` });
}
async function observe(s) {
  const second = Math.floor(s.stats.time);
  if (second > lastSecond) { lastSecond = second; samples.push(summarize(s)); }
  if (s.hunt.stage !== lastStage) {
    lastStage = s.hunt.stage;
    console.log('GROWTH', JSON.stringify(summarize(s)));
    await capture(`stage-${lastStage}`, s);
  }
}
function chooseFood(s) {
  const edible = s.prey.filter(p => p.alive !== false && p.canEat && !['balloon', 'helicopter'].includes(p.kind) && Math.hypot(p.x, p.z) < 180);
  // Prefer an achievable forward intercept over endlessly circling the nearest prey.
  return edible.map(p => {
    const growth = { rabbit: 12, chicken: 13, crate: 2, urn: 1, goat: 22, militia: 18, jeep: 30, pickup: 35 };
    const value = (growth[p.kind] ?? 6) * (s.hunt.stage === 1 && ['rabbit', 'chicken'].includes(p.kind) ? .5 : 1);
    const routeCost = distance(s, p) + Math.abs(angle(heading(s, p) - s.yaw)) * Math.max(5, s.speed * 1.7);
    return { p, cost: routeCost / Math.pow(value / 12, .65) };
  })
    .sort((a, b) => a.cost - b.cost)[0]?.p;
}
function intercept(s, prey, previous) {
  const d = distance(s, prey), seconds = Math.min(2, d / Math.max(10, s.speed));
  const dt = previous ? s.stats.time - previous.time : 0;
  const vx = dt > 0 ? (prey.x - previous.x) / dt : prey.vx ?? 0;
  const vz = dt > 0 ? (prey.z - previous.z) / dt : prey.vz ?? 0;
  return { ...prey, x: prey.x + vx * seconds, z: prey.z + vz * seconds };
}
async function huntWin(initial) {
  let s = initial, targetId = null, previousPrey = null, apexPhase = 'setup';
  let previousHunger = s.hunt.hunger, sawHungerDrain = false, peakHeat = s.hunt.heat;
  const visitedStages = new Set([s.hunt.stage]);
  while (s.hunt.status === 'active' && s.stats.time < budget) {
    assert.equal(s.screen, 'play', 'Active hunt remains in play until a deliberate pause/result');
    await observe(s); visitedStages.add(s.hunt.stage);
    if (s.hunt.hunger < previousHunger - .01) sawHungerDrain = true;
    previousHunger = s.hunt.hunger; peakHeat = Math.max(peakHeat, s.hunt.heat);
    if (!s.hunt.apexReady) {
      let prey = s.prey.find(p => p.id === targetId && p.canEat && p.alive !== false);
      if (!prey || distance(s, prey) > 75) { prey = chooseFood(s); previousPrey = null; }
      if (!prey) { await controls(['w', 'd']); await lunge(false); s = await tick(s); continue; }
      if (prey.id !== targetId) { targetId = prey.id; targets.push({ time: s.stats.time, id: prey.id, kind: prey.kind }); }
      const prediction = intercept(s, prey, previousPrey);
      const yaw = heading(s, prediction), error = Math.abs(angle(yaw - s.yaw));
      await aim(s, yaw);
      // Tight turns need lurking; surging straight through contact is rewarding.
      await controls(error > .7 ? ['s'] : error > .25 && distance(s, prey) < 18 ? [] : ['w']);
      await lunge(error < .45 && distance(s, prey) < 17);
      previousPrey = { time: s.stats.time, x: prey.x, z: prey.z };
    } else {
      const apex = s.prey.find(p => p.kind === 'balloon' && p.alive !== false);
      assert(apex, 'Ready hunt exposes a live balloon');
      const d = distance(s, apex), yaw = heading(s, apex), error = Math.abs(angle(yaw - s.yaw));
      // Route to a real run-up line near the basin center; circling under the
      // balloon is intentionally insufficient for a useful jump.
      if (apexPhase === 'setup') {
        const radial = Math.hypot(apex.x, apex.z) || 1;
        const anchor = { x: apex.x - apex.x / radial * 103, z: apex.z - apex.z / radial * 103 };
        const setupYaw = heading(s, anchor), setupError = Math.abs(angle(setupYaw - s.yaw));
        await aim(s, setupYaw); await controls(setupError > .5 ? ['s'] : ['w']); await lunge(false);
        if (distance(s, anchor) < 12) apexPhase = 'approach';
      } else if (apexPhase === 'approach') {
        await aim(s, yaw); await lunge(false);
        if (error > .45) await controls(['s']);
        else {
          await controls(['w']);
          if (d < 100 && d > 64 && s.speed > 24) apexPhase = 'dive';
          else if (d < 61) apexPhase = 'setup';
        }
      } else if (apexPhase === 'dive') {
        await aim(s, yaw); await controls(['w', 'Space']);
        if (s.depth >= 10.5) {
          apexPhase = 'rise'; await controls(['w']);
          transitions.push({ name: 'apex-release', distance: d, ...summarize(s) });
        }
      } else if (apexPhase === 'rise') {
        await aim(s, yaw); await controls(['w']);
        if (s.state === 'air') { apexPhase = 'air'; await capture('apex-breach', s); }
      } else if (apexPhase === 'air') {
        if (d > 8) await aim(s, yaw); await controls(['w']);
        await lunge(d < 18 && s.altitude > 12);
        if (s.state !== 'air') { apexPhase = 'setup'; await lunge(false); }
      }
    }
    s = await tick(s);
  }
  await controls([]); await lunge(false); await observe(s);
  assert.equal(s.hunt.status, 'won', `Bot must legitimately eat apex; last snapshot: ${JSON.stringify(summarize(s))}`);
  assert.equal(s.hunt.apexEaten, true);
  assert.equal(s.hunt.stage, 2);
  assert(visitedStages.has(1) && visitedStages.has(2), 'Real food causes both growth transitions');
  assert(sawHungerDrain, 'Hunger exerts ongoing pressure');
  assert(peakHeat > 5, 'Visible hunting provokes heat');
  assert(samples.some(sample => sample.digestion?.length > 0), 'Food visibly digests before growth');
  return s;
}
async function huntLoss(initial) {
  let s = initial, initialHealth = s.hunt.health, warningTime = null, damageTime = null;
  // Slow deep hiding is the deliberate bad strategy this hunt must punish.
  await controls(['s', 'Space', 'd']);
  while (s.hunt.status === 'active' && s.stats.time < budget) {
    assert.equal(s.screen, 'play', 'Active hunt remains in play until a deliberate pause/result');
    await observe(s);
    const seismic = s.markers.find(marker => marker.kind === 'seismic');
    if (seismic && warningTime === null) {
      assert(seismic.time > 0 && seismic.duration >= 1.5, 'Seismic strike has a meaningful warning before impact');
      warningTime = s.stats.time; await capture('seismic-warning', s);
    }
    if (s.hunt.health < initialHealth - 1 && damageTime === null) {
      damageTime = s.stats.time; await capture('seismic-damage', s);
    }
    s = await tick(s, .3);
  }
  await controls([]);
  assert.equal(s.hunt.status, 'lost', 'Deep camping eventually produces a real loss');
  assert(warningTime !== null && damageTime !== null && warningTime < damageTime, 'Seismic warning precedes the first damage');
  assert(s.hunt.health < initialHealth, 'Threats/starvation reduce health');
  return s;
}
async function huntWarning(initial) {
  let s = initial;
  await controls(['s', 'Space', 'd']);
  while (s.hunt.status === 'active' && s.stats.time < 20) {
    await observe(s);
    if (s.markers.some(marker => marker.kind === 'seismic' && marker.time > 0)) {
      await page.waitForFunction(() => document.querySelector('#lesson-title')?.textContent.includes('SEISMIC'), null, { polling: 50 });
      s = await snap();
      assert.equal(s.hunt.health, initial.hunt.health, 'Warning is visible before damage');
      await capture('seismic-warning', s); await controls([]); return s;
    }
    s = await tick(s, .2);
  }
  assert.fail('Deep camping must expose a clear seismic warning');
}
try {
  await page.goto(url); await page.waitForFunction(() => window.__BURROW__);
  await page.locator('[data-panel="title"] [data-action="expedition"]').click();
  await page.locator('[data-action="hunt"]').filter({ visible: true }).click();
  await page.waitForFunction(() => window.__BURROW__.snapshot().mode === 'hunt' && window.__BURROW__.snapshot().screen === 'play');
  const initial = await snap(); assert.equal(initial.hunt.status, 'active');
  assert(initial.prey.some(p => typeof p.canEat === 'boolean'), 'Bot requires read-only canEat telemetry');
  assert(Array.isArray(initial.markers) && Array.isArray(initial.digestion), 'Hunt telemetry exposes markers/digestion arrays');
  const final = scenario === 'warning' ? await huntWarning(initial) : scenario === 'loss' ? await huntLoss(initial) : await huntWin(initial);
  if (scenario === 'warning') {
    await page.keyboard.press('Escape');
    await page.locator('[data-panel="pause"] [data-action="finish"]').click();
  }
  await page.waitForFunction(() => window.__BURROW__.snapshot().screen === 'report');
  await page.waitForTimeout(900);
  assert.equal(await page.locator('[data-panel="report"]').getAttribute('data-mode'), 'hunt');
  assert.equal(await page.locator('[data-panel="report"]').getAttribute('data-result'), scenario === 'win' ? 'won' : 'lost');
  await capture(`${scenario}-report`, final);
  await page.getByRole('button', { name: 'HUNT AGAIN' }).click();
  const retry = await snap(); assert.equal(retry.hunt.status, 'active'); assert.equal(retry.hunt.stage, 0); assert.equal(retry.mode, 'hunt');
  assert.equal(retry.stats.bites, 0); assert(retry.hunt.health >= 99);
  await controls([]); await page.keyboard.press('Escape');
  await page.locator('[data-panel="pause"] [data-action="finish"]').click();
  await page.getByRole('button', { name: 'BACK TO TITLE' }).click();
  assert.equal((await snap()).screen, 'title');
  assert.deepEqual(errors, []); status = 'passed';
  console.log(`PASS Hunt1 ${scenario}: legitimate real input, mission report, retry and title.`);
} catch (error) {
  status = 'failed'; failure = String(error);
  try { await capture('failure', await snap()); } catch { /* Navigation/HMR may remove the hook. */ }
  throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ status, failure, url, scenario, browser: await browser.version(), renderer: 'SwiftShader; 800×500; low quality', recordVideo, samples, transitions, targets, errors }, null, 2));
  await context.close(); await browser.close();
}

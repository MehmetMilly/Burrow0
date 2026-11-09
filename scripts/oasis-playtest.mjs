import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

// Bounded real-input campaign/Oasis QA; telemetry is read only.
// Default starts without campaign storage and earns Hunt 2 through a real Hunt 1 win.
// Restored-profile runs require BURROW_PROFILE pointing to a previously earned campaign JSON.
const url = process.env.BURROW_URL ?? 'http://127.0.0.1:5174';
const output = process.env.BURROW_AUDIT_DIR ?? 'artifacts/oasis-playtest';
const scenario = process.env.BURROW_OASIS_SCENARIO ?? 'continuity';
const budget = Number(process.env.BURROW_HUNT_BUDGET ?? 240);
const recordVideo = process.env.BURROW_RECORD_VIDEO === '1';
const restoredProfile = process.env.BURROW_PROFILE ? JSON.parse(await readFile(process.env.BURROW_PROFILE, 'utf8')) : null;
if (scenario !== 'continuity') assert(restoredProfile, 'Isolated scenarios require an explicitly supplied restored campaign profile');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 800, height: 500 }, ...(recordVideo ? { recordVideo: { dir: output, size: { width: 800, height: 500 } } } : {}) });
await context.addInitScript(({ profile }) => {
  if (!sessionStorage.getItem('qa-initialized')) {
    localStorage.removeItem('burrow.campaign.v1');
    if (profile) localStorage.setItem('burrow.campaign.v1', JSON.stringify(profile));
    sessionStorage.setItem('qa-initialized', '1');
  }
  if (!localStorage.getItem('burrow.settings')) localStorage.setItem('burrow.settings', JSON.stringify({ sensitivity: 1, invert: false, volume: 0, quality: 'low' }));
}, { profile: restoredProfile });
const page = await context.newPage(); page.setDefaultTimeout(180000);
const errors = [], requests = [], samples = [], transitions = [], targets = [], held = new Set();
let status = 'running', failure = null, lastStage = -1, lastSecond = -1;
let mouseHeld = false, mouseX = 400, mouseY = 250;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('requestfailed', request => requests.push({ url: request.url(), failure: request.failure() }));
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
  }, { time: s.stats.time + amount }, { polling: 100, timeout: 30000 });
  return snap();
}
function summarize(s) {
  return { time: s.stats.time, screen: s.screen, mode: s.mode, state: s.state, x: s.x, z: s.z, altitude: s.altitude, depth: s.depth, speed: s.speed,
    inWater: s.inWater, charge: s.charge, campaign: s.campaign, selectedHunt: s.selectedHunt, stats: s.stats, hunt: s.hunt, markers: s.markers, digestion: s.digestion, apex: s.prey?.find(p => p.kind === (s.hunt.index === 2 ? 'plane' : 'balloon')), render: s.render, frames: s.frames };
}
async function capture(name, s = null) {
  if (s) transitions.push({ name, ...summarize(s) });
  await page.screenshot({ path: `${output}/${name}.png` });
}
async function observe(s) {
  const second = Math.floor(s.stats.time);
  if (second > lastSecond) {
    lastSecond = second; samples.push(summarize(s));
    if (second % 10 === 0) console.log('PROGRESS', JSON.stringify(summarize(s)));
  }
  if (s.hunt.stage !== lastStage) {
    lastStage = s.hunt.stage;
    console.log('GROWTH', JSON.stringify(summarize(s)));
    await capture(`hunt-${s.hunt.index ?? 1}-stage-${lastStage}`, s);
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

async function route(s, destination, options = {}) {
  const started = s.stats.time;
  while (distance(s, destination) > (options.radius ?? 5)) {
    assert(s.hunt.status === 'active' && s.stats.time - started < 35, `Route remains achievable: ${JSON.stringify({ destination, s: summarize(s) })}`);
    await observe(s);
    const yaw = heading(s, destination), error = Math.abs(angle(yaw - s.yaw));
    await aim(s, yaw); await lunge(false);
    await controls(error > .35 ? ['s'] : typeof options.keys === 'function' ? options.keys(s) : options.keys ?? ['w']);
    s = await tick(s, .12);
    if (options.observe) await options.observe(s);
  }
  return s;
}

async function waterRoutes(s) {
  // The north dry causeway deliberately interrupts the canal at z=65.
  s = await route(s, { x: -45, z: 65 });
  let drySamples = 0;
  s = await route(s, { x: 0, z: 65 }, { observe: sample => {
    if (sample.x > -34 && sample.x < -7) { assert.equal(sample.inWater, false, 'Causeway permits dry burrowing'); drySamples++; }
  } });
  assert(drySamples > 0, 'Actual dry-causeway crossing sampled');
  await capture('dry-causeway', s);
  s = await route(s, { x: 0, z: 92 });
  let wet = false, wetDiveSamples = 0;
  s = await route(s, { x: -42, z: 92 }, { keys: sample => sample.inWater ? ['w', 'Space'] : ['w'], observe: async sample => {
    if (sample.inWater && sample.state !== 'air') {
      wet = true; wetDiveSamples++;
      assert(sample.depth <= .2, 'Water holds the worm at its surface');
      assert(sample.charge <= .01, 'Water blocks launch charging');
      if (wetDiveSamples === 1) await capture('water-restriction', sample);
    }
  } });
  assert(wet && wetDiveSamples > 0, 'An actual surface canal crossing exercised dive restriction');
  await controls([]); s = await tick(s, .2);
  assert.equal(s.inWater, false, 'Dry bank restores sand travel');
  s = await route(s, { x: -100, z: 92 });
  const crossingStart = s.stats.time;
  let phase = 'align', airborneWater = false, restoredDive = false;
  while (s.x < 2 && s.stats.time - crossingStart < 20) {
    await aim(s, Math.PI / 2); await lunge(false);
    if (phase === 'align') {
      await controls(['s']);
      if (Math.abs(angle(s.yaw - Math.PI / 2)) < .12) phase = 'dive';
    } else if (phase === 'dive') {
      await controls(['w', 'Space']);
      if (s.depth >= 10.5) { restoredDive = true; phase = 'air'; await controls(['w']); }
    } else await controls(['w']);
    s = await tick(s, .1); await observe(s);
    if (s.surfaceY === 1.2 && s.state === 'air') {
      assert.equal(s.inWater, false, 'Airborne canal crossing preserves the arc');
      if (!airborneWater) await capture('air-water-crossing', s);
      airborneWater = true;
    }
  }
  assert(restoredDive, 'Dry bank restores deep diving and launch charge');
  assert(airborneWater, 'A real breach crossed above canal water');
  return s;
}

function oasisFood(s) {
  return s.prey.filter(p => p.alive !== false && p.canEat && ['civilian', 'marketCart', 'militia', 'goat'].includes(p.kind))
    .map(p => ({ p, cost: (distance(s, p) + Math.abs(angle(heading(s, p) - s.yaw)) * Math.max(6, s.speed * 1.6)) / (p.kind === 'marketCart' ? 1.4 : 1) }))
    .sort((a, b) => a.cost - b.cost)[0]?.p;
}

async function oasisWin(initial) {
  let s = initial, targetId = null, previousPrey = null, phase = 'setup', airCrossing = false;
  const stages = new Set([s.hunt.stage]);
  let peakHeat = s.hunt.heat, hungerDrained = false, previousHunger = s.hunt.hunger, digested = false;
  while (s.hunt.status === 'active' && s.stats.time < budget) {
    await observe(s); stages.add(s.hunt.stage);
    peakHeat = Math.max(peakHeat, s.hunt.heat); digested ||= s.digestion.length > 0;
    hungerDrained ||= s.hunt.hunger < previousHunger - .01; previousHunger = s.hunt.hunger;
    if (!s.hunt.apexReady) {
      let prey = s.prey.find(p => p.id === targetId && p.canEat && p.alive !== false);
      if (!prey || distance(s, prey) > 75) { prey = oasisFood(s); previousPrey = null; }
      assert(prey, 'Oasis supplies useful human-scale food');
      if (prey.id !== targetId) { targetId = prey.id; targets.push({ time: s.stats.time, id: prey.id, kind: prey.kind }); }
      const yaw = heading(s, intercept(s, prey, previousPrey)), error = Math.abs(angle(yaw - s.yaw));
      await aim(s, yaw); await controls(error > .6 ? ['s'] : ['w']);
      await lunge(error < .4 && distance(s, prey) < 20);
      previousPrey = { time: s.stats.time, x: prey.x, z: prey.z };
    } else {
      const plane = s.prey.find(p => p.kind === 'plane' && p.alive !== false);
      assert(plane, 'Apex-ready Oasis retains a live cargo plane');
      if (phase === 'setup') {
        if (!plane.airborne && Math.abs(plane.vz) < .1 && distance(s, plane) > 100) s = await route(s, { x: 96, z: 5 }, { radius: 6 });
        s = await route(s, { x: 96, z: -25 }, { radius: 6 }); phase = 'wait'; continue;
      }
      if (phase === 'wait') {
        // Pursuing the anchor at lurking speed naturally circles within the
        // worm's turning radius; a pure tangent would slowly drift away.
        await aim(s, heading(s, { x: 96, z: -25 })); await controls(['s']); await lunge(false);
        if ((plane.z > 100 && plane.vx < -3) || (plane.airborne && Math.abs(plane.x - 96) < 8 && plane.vz < -10 && plane.z > s.z + 75)) phase = 'align';
      } else if (phase === 'align') {
        const alignYaw = Math.abs(s.x - 96) > 4 ? heading(s, { x: 96, z: s.z + 14 }) : Math.PI;
        await aim(s, alignYaw); await controls(['s']); await lunge(false);
        const separation = plane.z - s.z;
        if (plane.airborne && Math.abs(angle(s.yaw - Math.PI)) < .15 && Math.abs(plane.x - s.x) < 10 && plane.vz < -10 && separation > 75 && separation < 100) phase = 'dive';
        else if (separation < 45 && plane.vz < -10) phase = 'wait';
      } else if (phase === 'dive') {
        await aim(s, Math.PI); await controls(['w', 'Space']); await lunge(false);
        if (s.depth >= 8) { phase = 'rise'; await controls(['w']); transitions.push({ name: 'plane-release', plane, ...summarize(s) }); }
      } else if (phase === 'rise') {
        await aim(s, heading(s, intercept(s, plane))); await controls(['w']);
        if (s.state === 'air') { phase = 'air'; await capture('cargo-breach', s); }
      } else {
        const predicted = intercept(s, plane), d = distance(s, plane);
        await aim(s, heading(s, predicted)); await controls(['w']);
        await lunge(d < 26 && s.altitude > 3);
        if (s.state !== 'air') { phase = 'setup'; await lunge(false); }
      }
    }
    s = await tick(s, .12);
    // inWater is the wetted surface restriction; the surface value separately
    // identifies an airborne route above canal water without forcing a landing.
    if (s.state === 'air' && s.surfaceY === 1.2 && !s.inWater) {
      if (!airCrossing) await capture('air-water-crossing', s);
      airCrossing = true;
    }
  }
  await controls([]); await lunge(false); await observe(s);
  assert.equal(s.hunt.status, 'won', `Actual inputs must catch cargo plane: ${JSON.stringify(summarize(s))}`);
  assert(s.hunt.apexEaten && stages.has(1) && stages.has(2), 'Human-scale food grew through both Oasis stages before the plane catch');
  assert(targets.some(p => p.kind === 'civilian' || p.kind === 'marketCart'), 'Oasis growth route ate its new food');
  assert(peakHeat > 5 && hungerDrained && digested, 'Oasis preserves heat, hunger drain and delayed food digestion');
  return s;
}

async function oasisLoss(initial) {
  let s = initial, warning = null, damage = null;
  await controls(['s', 'Space', 'd']);
  while (s.hunt.status === 'active' && s.stats.time < budget) {
    await observe(s);
    if (warning === null && s.markers.some(p => p.kind === 'seismic' && p.time > 0)) { warning = s.stats.time; await capture('oasis-warning', s); }
    if (damage === null && s.hunt.health < initial.hunt.health - 1) { damage = s.stats.time; await capture('oasis-damage', s); }
    s = await tick(s, .2);
  }
  await controls([]);
  assert.equal(s.hunt.status, 'lost', 'Actual deep camping can lose Oasis');
  assert(warning !== null && damage !== null && warning < damage, 'Readable warning precedes threat damage');
  return s;
}

async function startSelected(index) {
  await page.locator(`[data-action="select-hunt-${index}"]`).filter({ visible: true }).click();
  await page.locator('[data-action="hunt"]').filter({ visible: true }).click();
  await page.waitForFunction(index => { const s = window.__BURROW__?.snapshot(); return s?.screen === 'play' && s.hunt.index === index; }, index);
  return snap();
}

try {
  await page.goto(url); await page.waitForFunction(() => window.__BURROW__);
  await page.locator('[data-panel="title"] [data-action="expedition"]').click();
  let initial;
  if (scenario === 'continuity') {
    assert.equal(await page.locator('[data-action="select-hunt-2"]').isDisabled(), true);
    initial = await startSelected(1);
    const won = await huntWin(initial);
    await page.waitForFunction(() => window.__BURROW__.snapshot().screen === 'report');
    await capture('first-light-earned-unlock', won);
    const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('burrow.campaign.v1')));
    assert(profile, 'Hunt 1 win persists the between-hunt campaign');
    assert.equal(profile.unlocked, 2); assert.equal(profile.selected, 2);
    assert(profile.completed.includes(1) && profile.records[1].exitScale >= won.hunt.scale, 'The earned apex win banks its medal and growth');
    await writeFile(`${output}/earned-campaign.json`, JSON.stringify(profile, null, 2));
    await page.locator('[data-panel="report"] [data-action="continue"]').click();
    await page.locator('[data-action="hunt"]').filter({ visible: true }).click();
    initial = await snap(); assert.equal(initial.hunt.index, 2);
    assert(initial.hunt.scale >= won.hunt.scale, 'Growth carries into Oasis');
    await capture('continued-noon-oasis', initial);
    await controls([]); await lunge(false); await page.reload();
    await page.waitForFunction(() => window.__BURROW__?.snapshot().screen === 'title');
    await page.locator('[data-panel="title"] [data-action="continue"]').click();
    await page.locator('[data-action="hunt"]').filter({ visible: true }).click();
    await page.waitForFunction(() => window.__BURROW__.snapshot().screen === 'play');
    initial = await snap(); assert.equal(initial.hunt.index, 2); assert(initial.hunt.scale >= won.hunt.scale);
    assert.equal(initial.selectedHunt, 2); assert(initial.campaign.completed.includes(1));
    lastStage = -1; lastSecond = -1;
  } else initial = await startSelected(2);
  assert.equal(initial.hunt.index, 2); const entryScale = initial.hunt.scale;
  let final;
  if (scenario === 'water') {
    initial = await waterRoutes(initial); await controls([]);
    await page.keyboard.press('Escape'); await page.locator('[data-panel="pause"] [data-action="finish"]').click(); final = await snap();
  } else final = scenario === 'loss' ? await oasisLoss(initial) : await oasisWin(initial);
  await page.waitForFunction(() => window.__BURROW__.snapshot().screen === 'report');
  assert.equal(await page.locator('[data-panel="report"]').getAttribute('data-mode'), 'hunt');
  assert.equal(await page.locator('[data-panel="report"]').getAttribute('data-result'), final.hunt.status);
  await capture(`oasis-${scenario}-report`, final);
  if (final.hunt.status === 'won') {
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('burrow.campaign.v1')));
    assert(saved.completed.includes(2) && saved.records[2].score > 0, 'Oasis victory persists its score/medal');
    await writeFile(`${output}/completed-campaign.json`, JSON.stringify(saved, null, 2));
  }
  await page.getByRole('button', { name: 'HUNT AGAIN' }).click();
  const retry = await snap(); assert.equal(retry.hunt.index, 2); assert.equal(retry.hunt.stage, 0);
  assert.equal(retry.hunt.scale, entryScale, 'Retry uses carried entry size rather than failed/final size');
  assert.equal(retry.stats.bites, 0); assert.equal(retry.hunt.status, 'active');
  await controls([]); await lunge(false); await page.keyboard.press('Escape');
  await page.locator('[data-panel="pause"] [data-action="finish"]').click();
  await page.locator('[data-panel="report"] [data-action="title"]').click();
  assert.equal((await snap()).screen, 'title');
  assert.deepEqual(errors, []); assert.deepEqual(requests, []); status = 'passed';
  console.log(`PASS Oasis ${scenario}: actual input, campaign continuity, cargo/loss result, carried-size retry.`);
} catch (error) {
  status = 'failed'; failure = String(error);
  try { await capture('failure', await snap()); } catch { /* Missing hook after a navigation failure. */ }
  throw error;
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ status, failure, url, scenario, restoredProfile: Boolean(restoredProfile), browser: await browser.version(), renderer: 'SwiftShader; 800×500; low quality', recordVideo, samples, transitions, targets, errors, requests }, null, 2));
  await context.close(); await browser.close();
}

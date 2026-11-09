import './style.css';
import { Simulation } from './game/Simulation';
import type { Input, HuntState, Stats } from './game/Simulation';
import { clamp } from './game/math';
import type { HuntIndex } from './game/biomes';
import { loadCampaign, saveCampaign, recordVictory, entryScale } from './game/campaign';
import { Sound } from './game/Audio';
import { GameRenderer } from './render/Renderer';
import { UI } from './UI';
import type { Screen } from './UI';

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const root = document.querySelector<HTMLElement>('#interface')!;
const sim = new Simulation();
let campaign = loadCampaign();
let selectedHunt: HuntIndex = campaign.selected;
let currentHuntEntry = entryScale(campaign, selectedHunt);
const sound = new Sound();
let render: GameRenderer;
try { render = new GameRenderer(canvas, sim); }
catch (error) {
  console.error(error);
  root.innerHTML = '<div class="error-screen"><h1>THE SAND IS STILL.</h1><p>Burrow needs WebGL 2. Enable graphics acceleration in Chrome, then come back to the dunes.</p><button class="primary" onclick="location.reload()">TRY AGAIN ↗</button></div>';
  throw error;
}
const ui = new UI(root, sound);
function refreshCampaign() { ui.setCampaign({ unlocked: campaign.unlocked, selected: selectedHunt, completed: [...campaign.completed] }); }
function selectHunt(index: HuntIndex) {
  if (index > campaign.unlocked) return;
  selectedHunt = index; campaign.selected = index; saveCampaign(campaign); refreshCampaign();
}
refreshCampaign();
render.setQuality(ui.settings.quality); sound.setVolume(ui.settings.volume);
const keys = new Set<string>();
let leftMouse = false, rightMouse = false, locked = false;
let accumulator = 0, last = performance.now(), pausedByVisibility = false;
let demoTime = 0, wasPlay = false, guideOrigin: Screen = 'title';
const timings: number[] = [];
let hitStop = 0, slowMotion = 0, resultDelay = 0;
let pendingReport: { stats: Stats; hunt: HuntState } | undefined;
function clearOutcome() { hitStop = 0; slowMotion = 0; resultDelay = 0; pendingReport = undefined; }
function clearInput() { keys.clear(); leftMouse = false; rightMouse = false; accumulator = 0; }
function releaseMouse() { clearInput(); if (document.pointerLockElement) document.exitPointerLock(); }
function takeMouse() {
  try {
    const result = canvas.requestPointerLock();
    if (result) result.catch(() => { /* Relative mouse fallback still steers without lock. */ });
  } catch { /* Browser/embedded preview can deny pointer lock. */ }
}
function demo() {
  sim.reset(); sim.x = 0; sim.z = -10; sim.state = 'air'; sim.y = sim.surface(0, -10) + 14; sim.vy = 10;
  sim.speed = 16; sim.yaw = -.6;
  sim.history = Array.from({ length: 220 }, (_, i) => ({ x: sim.x + i * .08, y: sim.y - Math.pow(i * .08, 2) * .11, z: sim.z + i * .14 }));
  render.reset(sim, true); demoTime = 0;
}
function start() {
  clearOutcome(); clearInput(); sim.reset(); render.reset(sim); ui.reset(); ui.show('play');
  void sound.start().catch(() => {}); sound.pause(false); takeMouse();
}
function startHunt() {
  clearOutcome(); clearInput(); currentHuntEntry = entryScale(campaign, selectedHunt); sim.startHunt(selectedHunt, currentHuntEntry); refreshCampaign(); render.reset(sim); ui.reset(); ui.show('play');
  void sound.start().catch(() => {}); sound.pause(false); takeMouse();
}
function pause() {
  if (ui.screen !== 'play') return;
  ui.show('pause'); sim.clearControlState(); releaseMouse(); sound.pause(true);
}
function resume() { ui.show('play'); clearInput(); sound.pause(false); takeMouse(); }
ui.onSettings = s => { render.setQuality(s.quality); sound.setVolume(s.volume); };
ui.onAction = action => {
  if (action === 'start') start();
  else if (action === 'hunt') startHunt();
  else if (action === 'select-hunt-1') selectHunt(1);
  else if (action === 'select-hunt-2') selectHunt(2);
  else if (action === 'continue') { clearOutcome(); releaseMouse(); selectHunt(campaign.unlocked); ui.show('expedition'); void sound.start().catch(() => {}); }
  else if (action === 'expedition') { clearOutcome(); releaseMouse(); ui.show('expedition'); void sound.start().catch(() => {}); }
  else if (action === 'resume') resume();
  else if (action === 'finish') {
    clearOutcome(); releaseMouse(); sound.pause(true);
    if (sim.mode === 'hunt') { sim.abandonHunt(); sim.events.length = 0; ui.report({ ...sim.stats }, { ...sim.hunt }); }
    else ui.report({ ...sim.stats });
  }
  else if (action === 'title') { clearOutcome(); releaseMouse(); selectedHunt = campaign.selected; refreshCampaign(); demo(); ui.show('title'); sound.pause(true); }
  else if (action === 'settings' || action === 'guide') {
    guideOrigin = ui.screen; ui.backScreen = guideOrigin; ui.show(action); releaseMouse();
    if (guideOrigin === 'title' || guideOrigin === 'expedition') void sound.start().catch(() => {});
  } else if (action === 'back') { ui.show(guideOrigin); }
};
window.addEventListener('keydown', e => {
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && ui.screen === 'play') e.preventDefault();
  if (e.code === 'Escape') {
    if (e.repeat) return;
    if (ui.screen === 'play') pause();
    else if (ui.screen === 'pause') resume();
    else if (ui.screen === 'settings' || ui.screen === 'guide') ui.show(guideOrigin);
    else if (ui.screen === 'expedition') ui.show('title');
    return;
  }
  if (ui.screen === 'play') keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('mousedown', e => {
  if (ui.screen !== 'play') return;
  if (e.button === 0) leftMouse = true; if (e.button === 2) rightMouse = true;
  if (!locked) takeMouse();
});
window.addEventListener('mouseup', e => { if (e.button === 0) leftMouse = false; if (e.button === 2) rightMouse = false; });
window.addEventListener('contextmenu', e => { if (ui.screen === 'play') e.preventDefault(); });
window.addEventListener('mousemove', e => {
  if (ui.screen !== 'play') return;
  const sensitivity = ui.settings.sensitivity * .0025;
  render.yaw += e.movementX * sensitivity;
  render.pitch = clamp(render.pitch + e.movementY * sensitivity * (ui.settings.invert ? -1 : 1), -.35, .75);
});
document.addEventListener('pointerlockchange', () => {
  const hadLock = locked; locked = document.pointerLockElement === canvas;
  if (hadLock && !locked && ui.screen === 'play') pause();
});
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pausedByVisibility = true; pause(); }
  else { last = performance.now(); accumulator = 0; pausedByVisibility = false; }
});
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault(); pause();
  root.innerHTML = '<div class="error-screen"><h1>BACK TO THE SURFACE.</h1><p>The graphics connection was interrupted. Reload to return to the dunes.</p><button class="primary" onclick="location.reload()">RETURN ↗</button></div>';
});
function inputs(): Input {
  if (pendingReport) return { surge: false, lurk: false, dive: false, lunge: false, turn: 0, yaw: render.yaw };
  return { surge: keys.has('KeyW') || keys.has('ArrowUp'), lurk: keys.has('KeyS') || keys.has('ArrowDown'),
    dive: keys.has('Space') || rightMouse, lunge: leftMouse,
    turn: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), yaw: render.yaw };
}
function frame(now: number) {
  requestAnimationFrame(frame);
  const rawElapsed = (now - last) / 1000; const elapsed = Math.min(rawElapsed, .1); last = now;
  if (pausedByVisibility) return;
  const playing = ui.screen === 'play'; const isDemo = ui.screen === 'title' || ui.screen === 'expedition' || (['guide', 'settings'].includes(ui.screen) && (guideOrigin === 'title' || guideOrigin === 'expedition'));
  hitStop = Math.max(0, hitStop - elapsed); slowMotion = Math.max(0, slowMotion - elapsed);
  const gameElapsed = playing ? elapsed * (hitStop > 0 ? 0 : slowMotion > 0 ? .38 : 1) : elapsed;
  if (playing || isDemo) {
    accumulator += gameElapsed;
    const input = inputs();
    while (accumulator >= 1 / 120) {
      if (isDemo) {
        demoTime += 1 / 120; const cycle = demoTime % 7;
        sim.step(1 / 120, { surge: true, lurk: false, dive: cycle > 3 && cycle < 3.6, lunge: false, turn: 0, yaw: Math.sin(demoTime * .09) * 2 - .6 });
      } else {
        if (input.turn) { render.yaw += input.turn * 1.4 / 120; input.yaw = render.yaw; }
        sim.step(1 / 120, input);
      }
      for (const e of sim.events.splice(0)) {
        render.event(e, sim);
        if (playing) {
          sound.event(e, sim.chain, sim); ui.event(e, sim);
          if (e.type === 'eat') { hitStop = Math.max(hitStop, .035); if (e.power >= 3) slowMotion = Math.max(slowMotion, .35); }
          if (e.type === 'slam') { hitStop = Math.max(hitStop, .055); slowMotion = Math.max(slowMotion, .18); }
          if (e.type === 'grow') { hitStop = Math.max(hitStop, .09); slowMotion = Math.max(slowMotion, 1.05); }
          if (e.type === 'win') { campaign = recordVictory(campaign, sim.hunt, sim.stats, currentHuntEntry); saveCampaign(campaign); refreshCampaign(); }
          if ((e.type === 'win' || e.type === 'lose') && !pendingReport) {
            pendingReport = { stats: { ...sim.stats }, hunt: { ...sim.hunt } }; resultDelay = e.type === 'win' ? 2.3 : 1.4;
            slowMotion = e.type === 'win' ? 1.8 : .7; sim.clearControlState();
          }
        }
      }
      accumulator -= 1 / 120;
      if (hitStop > 0) { accumulator = 0; break; }
    }
  } else accumulator = 0;
  render.update(sim, playing || isDemo ? gameElapsed : 0, isDemo || ui.screen === 'report');
  sound.update(sim, elapsed); ui.update(sim, elapsed, render.deep); ui.target(render.apexHint);
  if (playing && pendingReport) {
    resultDelay -= elapsed;
    if (resultDelay <= 0) {
      const report = pendingReport; pendingReport = undefined; releaseMouse(); sound.pause(true); ui.report(report.stats, report.hunt);
    }
  }
  if (playing && wasPlay && elapsed > 0) { timings.push(rawElapsed * 1000); if (timings.length > 1800) timings.shift(); }
  wasPlay = playing;
}
// Inspection is available only on Vite's development server, never in deployed play.
if (import.meta.env.DEV) {
  Object.assign(window, { __BURROW__: {
    snapshot: () => ({ screen: ui.screen, selectedHunt, campaign: JSON.parse(JSON.stringify(campaign)), inWater: sim.inWater, surfaceY: sim.surface(sim.x, sim.z), mode: sim.mode, hunt: { ...sim.hunt }, markers: sim.markers.map(m => ({ ...m })), digestion: sim.digestion.map(d => ({ ...d })), charge: sim.charge, vy: sim.vy, altitude: sim.y - sim.surface(sim.x, sim.z), state: sim.state, depth: sim.depth, deep: sim.deep, speed: sim.speed, x: sim.x, y: sim.y, z: sim.z, yaw: sim.yaw, cameraYaw: render.yaw,
      stats: { ...sim.stats }, prey: sim.prey.filter(p => p.alive).map(p => ({ ...p, canEat: sim.canEat(p) })), render: { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles, geometries: render.renderer.info.memory.geometries },
      frames: timings.length ? { count: timings.length, meanMs: timings.reduce((a, b) => a + b) / timings.length, p95Ms: [...timings].sort((a, b) => a - b)[Math.floor(timings.length * .95)] } : null })
  } });
}
demo(); ui.show('title'); requestAnimationFrame(frame);

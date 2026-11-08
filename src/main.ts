import './style.css';
import { Simulation } from './game/Simulation';
import type { Input } from './game/Simulation';
import { clamp, ground } from './game/math';
import { Sound } from './game/Audio';
import { GameRenderer } from './render/Renderer';
import { UI } from './UI';
import type { Screen } from './UI';

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const root = document.querySelector<HTMLElement>('#interface')!;
const sim = new Simulation();
const sound = new Sound();
let render: GameRenderer;
try { render = new GameRenderer(canvas, sim); }
catch (error) {
  console.error(error);
  root.innerHTML = '<div class="error-screen"><h1>THE SAND IS STILL.</h1><p>Burrow needs WebGL 2. Enable graphics acceleration in Chrome, then come back to the dunes.</p><button class="primary" onclick="location.reload()">TRY AGAIN ↗</button></div>';
  throw error;
}
const ui = new UI(root, sound);
render.setQuality(ui.settings.quality); sound.setVolume(ui.settings.volume);
const keys = new Set<string>();
let leftMouse = false, rightMouse = false, locked = false;
let accumulator = 0, last = performance.now(), pausedByVisibility = false;
let demoTime = 0, wasPlay = false, guideOrigin: Screen = 'title';
const timings: number[] = [];
function clearInput() { keys.clear(); leftMouse = false; rightMouse = false; accumulator = 0; }
function releaseMouse() { clearInput(); if (document.pointerLockElement) document.exitPointerLock(); }
function takeMouse() {
  try {
    const result = canvas.requestPointerLock();
    if (result) result.catch(() => { /* Relative mouse fallback still steers without lock. */ });
  } catch { /* Browser/embedded preview can deny pointer lock. */ }
}
function demo() {
  sim.reset(); sim.x = 0; sim.z = -10; sim.state = 'air'; sim.y = ground(0, -10) + 14; sim.vy = 10;
  sim.speed = 16; sim.yaw = -.6;
  sim.history = Array.from({ length: 220 }, (_, i) => ({ x: sim.x + i * .08, y: sim.y - Math.pow(i * .08, 2) * .11, z: sim.z + i * .14 }));
  render.reset(sim, true); demoTime = 0;
}
function start() {
  clearInput(); sim.reset(); render.reset(sim); ui.reset(); ui.show('play');
  void sound.start().catch(() => {}); sound.pause(false); takeMouse();
}
function pause() {
  if (ui.screen !== 'play') return;
  ui.show('pause'); releaseMouse(); sound.pause(true);
}
function resume() { ui.show('play'); clearInput(); sound.pause(false); takeMouse(); }
ui.onSettings = s => { render.setQuality(s.quality); sound.setVolume(s.volume); };
ui.onAction = action => {
  if (action === 'start') start();
  else if (action === 'resume') resume();
  else if (action === 'finish') { releaseMouse(); sound.pause(true); ui.report({ ...sim.stats }); }
  else if (action === 'title') { releaseMouse(); demo(); ui.show('title'); sound.pause(true); }
  else if (action === 'settings' || action === 'guide') {
    guideOrigin = ui.screen; ui.backScreen = guideOrigin; ui.show(action); releaseMouse();
    if (guideOrigin === 'title') void sound.start().catch(() => {});
  } else if (action === 'back') { ui.show(guideOrigin); }
};
window.addEventListener('keydown', e => {
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && ui.screen === 'play') e.preventDefault();
  if (e.code === 'Escape') {
    if (ui.screen === 'play') pause();
    else if (ui.screen === 'pause') resume();
    else if (ui.screen === 'settings' || ui.screen === 'guide') ui.show(guideOrigin);
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
  return { surge: keys.has('KeyW') || keys.has('ArrowUp'), lurk: keys.has('KeyS') || keys.has('ArrowDown'),
    dive: keys.has('Space') || rightMouse, lunge: leftMouse,
    turn: (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), yaw: render.yaw };
}
function frame(now: number) {
  requestAnimationFrame(frame);
  const rawElapsed = (now - last) / 1000; const elapsed = Math.min(rawElapsed, .1); last = now;
  if (pausedByVisibility) return;
  const playing = ui.screen === 'play'; const isDemo = ui.screen === 'title' || (['guide', 'settings'].includes(ui.screen) && guideOrigin === 'title');
  if (playing || isDemo) {
    accumulator += elapsed;
    const input = inputs();
    while (accumulator >= 1 / 120) {
      if (isDemo) {
        demoTime += 1 / 120; const cycle = demoTime % 10;
        sim.step(1 / 120, { surge: true, lurk: false, dive: cycle > 3 && cycle < 5, lunge: false, turn: 0, yaw: Math.sin(demoTime * .09) * 2 - .6 });
      } else {
        if (input.turn) { render.yaw += input.turn * 1.4 / 120; input.yaw = render.yaw; }
        sim.step(1 / 120, input);
      }
      for (const e of sim.events.splice(0)) {
        render.event(e);
        if (playing) { sound.event(e, sim.chain); ui.event(e, sim); }
      }
      accumulator -= 1 / 120;
    }
  } else accumulator = 0;
  render.update(sim, playing || isDemo ? elapsed : 0, isDemo || ui.screen === 'report');
  sound.update(sim, elapsed); ui.update(sim, elapsed, render.deep);
  if (playing && wasPlay && elapsed > 0) { timings.push(rawElapsed * 1000); if (timings.length > 1800) timings.shift(); }
  wasPlay = playing;
}
// Inspection is available only on Vite's development server, never in deployed play.
if (import.meta.env.DEV) {
  Object.assign(window, { __BURROW__: {
    snapshot: () => ({ screen: ui.screen, state: sim.state, depth: sim.depth, deep: sim.deep, speed: sim.speed, x: sim.x, y: sim.y, z: sim.z, yaw: sim.yaw, cameraYaw: render.yaw,
      stats: { ...sim.stats }, prey: sim.prey.filter(p => p.alive).map(p => ({ ...p })), render: { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles, geometries: render.renderer.info.memory.geometries },
      frames: timings.length ? { count: timings.length, meanMs: timings.reduce((a, b) => a + b) / timings.length, p95Ms: [...timings].sort((a, b) => a - b)[Math.floor(timings.length * .95)] } : null })
  } });
}
demo(); ui.show('title'); requestAnimationFrame(frame);

import { describe, expect, it } from 'vitest';
import { Simulation } from './Simulation';
import { launchPower, ground } from './math';
import type { Input } from './Simulation';
const idle: Input = { surge: false, lurk: false, dive: false, lunge: false, turn: 0, yaw: 0 };
function drive(sim: Simulation, seconds: number, input: Partial<Input> = {}) {
  for (let t = 0; t < seconds; t += 1 / 120) sim.step(1 / 120, { ...idle, ...input });
}
describe('the dive / breach / slam loop', () => {
  it('rewards a real run-up rather than camping at depth', () => {
    expect(launchPower(12, 30)).toBeGreaterThan(launchPower(12, 4) * 3);
    const fast = new Simulation(), slow = new Simulation();
    drive(fast, 2, { surge: true, dive: true }); drive(slow, 3, { lurk: true, dive: true });
    drive(fast, 3, { surge: true }); drive(slow, 3, { lurk: true });
    expect(fast.stats.bestAir).toBeGreaterThan(slow.stats.bestAir * 3);
  });
  it('lands safely through ten cycles and exits tremor view', () => {
    const sim = new Simulation();
    for (let i = 0; i < 10; i++) {
      drive(sim, 1.6, { dive: true, surge: true }); drive(sim, 1.1, { surge: true });
      drive(sim, .5, { dive: true, surge: true }); drive(sim, 4);
      expect(sim.state).toBe('sand'); expect(sim.deep).toBe(false);
      expect(sim.y).toBeCloseTo(ground(sim.x, sim.z) - .8, 1);
      expect(Number.isFinite(sim.yaw)).toBe(true);
    }
    expect(sim.stats.slams).toBe(10);
  });
  it('does not hop without a deliberate dive, and reset clears an outing', () => {
    const sim = new Simulation(); drive(sim, 20, { surge: true });
    expect(sim.stats.breaches).toBe(0); expect(sim.state).toBe('sand');
    sim.mouth = 1;
    sim.reset(); expect(sim.stats.time).toBe(0); expect(sim.stats.bites).toBe(0);
    expect(sim.events.length).toBe(0); expect(sim.frame).toBe(0); expect(sim.mouth).toBe(0);
  });
  it('consumes a held slam until release instead of launching another breach on key-up', () => {
    const sim = new Simulation();
    drive(sim, 1.6, { dive: true, surge: true }); drive(sim, .8, { surge: true });
    expect(sim.state).toBe('air'); expect(sim.stats.breaches).toBe(1);
    drive(sim, 2, { dive: true, surge: true });
    expect(sim.stats.slams).toBe(1); expect(sim.state).toBe('sand');
    expect(sim.depth).toBeCloseTo(.8);
    drive(sim, 1, { surge: true });
    expect(sim.stats.breaches).toBe(1);
    // Releasing and pressing again must still start a fresh, deliberate dive.
    drive(sim, 1.6, { dive: true, surge: true }); drive(sim, .8, { surge: true });
    expect(sim.stats.breaches).toBe(2);
  });
  it('keeps a committed slam falling when the player lunges for a final correction', () => {
    const sim = new Simulation();
    sim.state = 'air'; sim.depth = 0; sim.y = ground(sim.x, sim.z) + 25; sim.vy = 10;
    drive(sim, 1 / 120, { dive: true });
    drive(sim, 1 / 120, { dive: true, lunge: true, yaw: .5 });
    expect(sim.slam).toBe(true); expect(sim.vy).toBeLessThan(-40);
    expect(sim.airLunge).toBe(true);
    expect(sim.events.filter(e => e.type === 'lunge')).toHaveLength(1);
  });
  it.each([false, true])('defuses a paused dive without breaching on resume (already rising: %s)', rising => {
    const sim = new Simulation();
    drive(sim, 1.6, { dive: true, surge: true });
    if (rising) drive(sim, .1, { surge: true });
    const pausedDepth = sim.depth;
    sim.clearControlState();
    expect(sim.depth).toBe(pausedDepth);
    drive(sim, 1.5);
    expect(sim.stats.breaches).toBe(0); expect(sim.state).toBe('sand');
    expect(sim.depth).toBeCloseTo(.8, 1); expect(sim.deep).toBe(false);
  });
  it('throws and breaks nearby props with a committed slam', () => {
    const sim = new Simulation(); const p = sim.prey.find(p => p.kind === 'crate')!;
    sim.x = p.x; sim.z = p.z; sim.state = 'air'; sim.y = p.y + 1; sim.vy = -30;
    drive(sim, .1, { dive: true });
    expect(sim.stats.slams).toBe(1); expect(sim.stats.broken).toBeGreaterThan(0);
    expect(sim.events.some(e => e.type === 'break')).toBe(true);
  });
});

describe('First Light hunt', () => {
  function isolated() {
    const sim = new Simulation(); sim.startHunt();
    for (const p of sim.prey) { p.alive = false; p.respawn = Infinity; }
    return sim;
  }
  function offer(sim: Simulation, kind: 'rabbit' | 'goat' | 'balloon') {
    const prey = sim.prey.find(p => p.kind === kind)!;
    prey.alive = true; prey.x = sim.x + Math.sin(sim.yaw); prey.z = sim.z - Math.cos(sim.yaw); prey.y = sim.y;
    return prey;
  }
  it('preserves stable pools and excludes hunt species from the toy', () => {
    const sim = new Simulation(), ids = sim.prey.map(p => `${p.id}:${p.kind}`);
    expect(sim.prey.filter(p => ['goat', 'militia', 'pickup', 'helicopter', 'balloon'].includes(p.kind)).every(p => !p.alive)).toBe(true);
    drive(sim, 50);
    expect(sim.prey.find(p => p.kind === 'balloon')!.alive).toBe(false);
    sim.startHunt(); expect(sim.prey.map(p => `${p.id}:${p.kind}`)).toEqual(ids);
    expect(sim.prey.find(p => p.kind === 'balloon')!.alive).toBe(true);
  });
  it('feeds hunger immediately, but pays growth only after digestion reaches the tail', () => {
    const sim = isolated(); sim.hunt.hunger = 30; sim.hunt.health = 60;
    offer(sim, 'rabbit'); drive(sim, .02);
    expect(sim.stats.bites).toBe(1); expect(sim.hunt.hunger).toBeGreaterThan(40);
    expect(sim.hunt.health).toBeCloseTo(60); expect(sim.hunt.growth).toBe(0); expect(sim.digestion.length).toBe(1);
    drive(sim, 3.2);
    expect(sim.hunt.growth).toBe(12); expect(sim.digestion).toHaveLength(0);
  });
  it('keeps hunger distinct from health and makes starvation a real loss', () => {
    const sim = isolated(); sim.hunt.hunger = 80; sim.hunt.health = 50;
    drive(sim, 2); expect(sim.hunt.health).toBeGreaterThan(50); expect(sim.hunt.hunger).toBeLessThan(80);
    sim.hunt.hunger = 0; sim.hunt.health = 2; drive(sim, 1);
    expect(sim.hunt.status).toBe('lost'); expect(sim.events.some(e => e.type === 'lose')).toBe(true);
  });
  it('gates angry goats and the balloon by size, and winning banks score once', () => {
    const sim = isolated(); const goat = offer(sim, 'goat'); drive(sim, .02);
    expect(goat.alive).toBe(true); expect(sim.canEat(goat)).toBe(false);
    const balloon = offer(sim, 'balloon'); expect(sim.canEat(balloon)).toBe(false);
    sim.hunt.stage = 2; sim.hunt.scale = 1.5; sim.hunt.apexReady = true;
    // Catch at the basket with real swept-mouth contact in an airborne arc.
    sim.state = 'air'; sim.depth = 0; sim.y = ground(70, -92) + 20; sim.vy = 0; sim.x = 70; sim.z = -92;
    balloon.x = sim.x; balloon.z = sim.z; balloon.y = sim.y;
    drive(sim, .08);
    expect(sim.hunt.status).toBe('won'); expect(sim.hunt.apexEaten).toBe(true); expect(sim.hunt.score).toBeGreaterThanOrEqual(5000);
    const score = sim.hunt.score; drive(sim, 2); expect(sim.hunt.score).toBe(score);
    expect(sim.events.filter(e => e.type === 'win')).toHaveLength(1);
  });
  it('warns a deep camper before damaging it, while a moving deep line is safe', () => {
    const camper = isolated();
    for (let t = 0; t < 10.3; t += 1 / 120) camper.step(1 / 120, { ...idle, lurk: true, dive: true, yaw: t * 1.4 });
    expect(camper.markers.some(m => m.kind === 'seismic')).toBe(true);
    expect(camper.hunt.health).toBe(100);
    for (let t = 10.3; t < 13; t += 1 / 120) camper.step(1 / 120, { ...idle, lurk: true, dive: true, yaw: t * 1.4 });
    expect(camper.hunt.health).toBeLessThan(100);
    const mobile = isolated(); drive(mobile, 15, { surge: true, dive: true });
    expect(mobile.markers).toHaveLength(0); expect(mobile.hunt.health).toBe(100);
  });
});

describe('telegraphed shell response', () => {
  function incoming() {
    const sim = new Simulation(); sim.startHunt();
    const patrol = sim.prey.find(p => p.kind === 'militia')!;
    for (const p of sim.prey) { p.alive = p === patrol; p.respawn = Infinity; }
    sim.x = patrol.x; sim.z = patrol.z + 15; sim.y = ground(sim.x, sim.z) - .8;
    sim.age = 20; sim.speed = 30; sim.hunt.heat = 20;
    for (let t = 0; t < 15 && !sim.markers.length; t += 1 / 120) sim.step(1 / 120, { ...idle, surge: true, yaw: t });
    expect(sim.markers.length).toBeGreaterThan(0); expect(sim.hunt.health).toBe(100);
    return sim;
  }
  it('hits an unchanged surge line, while a course change clears the marked blast', () => {
    const straight = incoming(), dodge = incoming();
    drive(straight, 1.5, { surge: true, yaw: straight.yaw });
    drive(dodge, 1.5, { surge: true, yaw: dodge.yaw + Math.PI / 2 });
    expect(straight.hunt.health).toBeLessThan(100);
    expect(dodge.hunt.health).toBe(100);
  });
});

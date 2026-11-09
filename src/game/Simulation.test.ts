import { describe, expect, it } from 'vitest';
import { Simulation } from './Simulation';
import { launchPower, ground } from './math';
import { isWater, OASIS_HOMES } from './biomes';
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

describe('Oasis hunt', () => {
  function isolated(carriedScale?: number) {
    const sim = new Simulation(); sim.startHunt(2, carriedScale);
    for (const p of sim.prey) { p.alive = false; p.respawn = Infinity; }
    return sim;
  }
  function moveTo(sim: Simulation, x: number, z: number, yaw = 0) {
    sim.x = x; sim.z = z; sim.yaw = yaw; sim.y = sim.surface(x, z) - sim.depth;
  }
  it('keeps the same species pools in the toy and both hunts, with a populated town and visible cargo apex', () => {
    const sim = new Simulation(), pools = sim.prey.map(p => `${p.id}:${p.kind}`);
    const oasisKinds = ['civilian', 'marketCart', 'building', 'sonarDrone', 'plane'];
    expect(sim.prey.filter(p => oasisKinds.includes(p.kind)).every(p => !p.alive)).toBe(true);
    sim.startHunt(); expect(sim.prey.map(p => `${p.id}:${p.kind}`)).toEqual(pools);
    expect(sim.prey.filter(p => oasisKinds.includes(p.kind)).every(p => !p.alive)).toBe(true);
    sim.startHunt(2); expect(sim.prey.map(p => `${p.id}:${p.kind}`)).toEqual(pools);
    expect(sim.hunt.index).toBe(2); expect(sim.hunt.scale).toBe(1.5);
    expect(sim.prey.filter(p => p.kind === 'building' && p.alive)).toHaveLength(OASIS_HOMES.length);
    expect(sim.prey.filter(p => p.kind === 'civilian' && p.alive)).toHaveLength(32);
    expect(sim.prey.find(p => p.kind === 'plane')!.alive).toBe(true);
    expect(sim.prey.filter(p => ['rabbit', 'chicken', 'balloon', 'sonarDrone'].includes(p.kind)).every(p => !p.alive)).toBe(true);
  });
  it('forces water travel to the surface with drag and warnings, then restores charging on a dry bank', () => {
    const sim = isolated(); moveTo(sim, -62, 10);
    sim.speed = 30; sim.depth = 10; sim.charge = 30; sim.state = 'rise';
    drive(sim, 1.5, { surge: true, dive: true });
    expect(sim.inWater).toBe(true); expect(sim.state).toBe('sand'); expect(sim.depth).toBe(0);
    expect(sim.charge).toBe(0); expect(sim.deep).toBe(false); expect(sim.speed).toBeLessThan(14);
    expect(sim.y).toBeCloseTo(sim.surface(sim.x, sim.z) - .25);
    expect(sim.ground(sim.x, sim.z)).toBeLessThan(sim.surface(sim.x, sim.z) - 3);
    expect(sim.events.some(e => e.type === 'water')).toBe(true); expect(sim.events.some(e => e.type === 'splash')).toBe(true);
    expect(sim.hunt.health).toBe(100);
    moveTo(sim, -105, 10); drive(sim, .8, { surge: true, dive: true });
    expect(sim.inWater).toBe(false); expect(sim.depth).toBeGreaterThan(3); expect(sim.charge).toBeGreaterThan(0);
  });
  it('preserves ballistic air crossings and permits a deep, quiet crossing on a dry causeway', () => {
    const air = isolated(); moveTo(air, -42, 90, Math.PI / 2);
    air.state = 'air'; air.depth = 0; air.speed = 30; air.y = air.surface(air.x, air.z) + 20; air.vy = 5;
    drive(air, .7, { surge: true, yaw: Math.PI / 2 });
    expect(isWater(air.x, air.z, 2)).toBe(true); expect(air.inWater).toBe(false); expect(air.state).toBe('air');
    expect(air.vy).toBeCloseTo(5 - 23 * .7); expect(air.speed).toBeCloseTo(30);
    drive(air, .4, { surge: true, yaw: Math.PI / 2 });
    expect(isWater(air.x, air.z, 2)).toBe(false); expect(air.events.some(e => e.type === 'water')).toBe(false);
    const quiet = isolated(); moveTo(quiet, -32, 65, Math.PI / 2);
    drive(quiet, 2, { surge: true, dive: true, yaw: Math.PI / 2 });
    expect(quiet.inWater).toBe(false); expect(quiet.depth).toBe(12); expect(quiet.charge).toBeGreaterThan(25);
    expect(quiet.events.some(e => e.type === 'water')).toBe(false);
  });
  it('carries campaign size as a minimum, grows through Oasis stages, and retries at the supplied entry size', () => {
    const sim = isolated(1.8);
    expect(sim.hunt.scale).toBe(1.8);
    sim.digestion.push({ id: 1, kind: 'marketCart', growth: 100, progress: 1 }); drive(sim, .02);
    expect(sim.hunt.stage).toBe(1); expect(sim.hunt.scale).toBe(2.05);
    sim.digestion.push({ id: 2, kind: 'civilian', growth: 100, progress: 1 }); drive(sim, .02);
    expect(sim.hunt.stage).toBe(2); expect(sim.hunt.scale).toBe(2.65); expect(sim.hunt.apexReady).toBe(true);
    sim.abandonHunt(); sim.startHunt(2, 1.8);
    expect(sim.hunt.scale).toBe(1.8); expect(sim.hunt.stage).toBe(0); expect(sim.hunt.apexReady).toBe(false);
    sim.startHunt(2, 3.1); sim.digestion.push({ id: 3, kind: 'marketCart', growth: 200, progress: 1 }); drive(sim, .02);
    expect(sim.hunt.scale).toBe(3.1); expect(sim.hunt.stage).toBe(2);
  });
  it('eats people and food carts from entry size, while slams leave destroyed houses and physical flying props', () => {
    const sim = isolated(); moveTo(sim, 45, 90); sim.hunt.hunger = 20;
    const human = sim.prey.find(p => p.kind === 'civilian')!;
    human.alive = true; human.x = sim.x; human.z = sim.z - 1; human.y = sim.surface(human.x, human.z);
    expect(sim.canEat(human)).toBe(true); drive(sim, .02);
    expect(human.alive).toBe(false); expect(sim.hunt.hunger).toBeGreaterThan(35);
    const cart = sim.prey.find(p => p.kind === 'marketCart')!;
    cart.alive = true; cart.x = sim.x; cart.z = sim.z - 1; cart.y = sim.surface(cart.x, cart.z);
    drive(sim, .02); expect(cart.alive).toBe(false); drive(sim, 3.2); expect(sim.hunt.growth).toBe(38);
    const house = sim.prey.find(p => p.kind === 'building')!, jeep = sim.prey.find(p => p.kind === 'jeep')!;
    house.alive = true; house.x = sim.x + 8; house.z = sim.z; house.y = sim.surface(house.x, house.z);
    jeep.alive = true; jeep.x = sim.x + 10; jeep.z = sim.z; jeep.y = sim.surface(jeep.x, jeep.z);
    sim.state = 'air'; sim.y = sim.surface(sim.x, sim.z) + 1; sim.vy = -30; sim.depth = 0;
    drive(sim, .05, { dive: true });
    expect(house.alive).toBe(false); expect(house.respawn).toBe(Infinity);
    expect(jeep.airborne).toBe(true); expect(jeep.flipped).toBe(true);
    expect(sim.events.some(e => e.type === 'break' && e.label === 'building')).toBe(true);
  });
  it('rewards quiet hiding and telegraphs sonar pressure against heated deep travel', () => {
    const loud = isolated(), quiet = isolated();
    moveTo(loud, 96, 100); moveTo(quiet, 96, 100); loud.hunt.heat = quiet.hunt.heat = 55;
    drive(loud, 5.5, { surge: true, dive: true }); drive(quiet, 5.5, { lurk: true, dive: true });
    expect(quiet.hunt.heat).toBeLessThan(loud.hunt.heat - 10);
    expect(loud.events.some(e => e.label?.includes('SONAR DRONE'))).toBe(true);
    expect(loud.markers.some(m => m.kind === 'seismic')).toBe(true); expect(loud.hunt.health).toBe(100);
    expect(quiet.markers).toHaveLength(0);
    drive(loud, 1, { surge: true });
    expect(loud.state === 'air' || loud.depth <= 2.8).toBe(true); expect(loud.hunt.health).toBe(100);
  });
  it('gates the plane by final stage and an airborne intercept, then banks its win exactly once', () => {
    const sim = isolated(); const plane = sim.prey.find(p => p.kind === 'plane')!;
    plane.alive = true; moveTo(sim, 96, 95);
    expect(sim.canEat(plane)).toBe(false); drive(sim, 1);
    expect(plane.z).toBe(98); expect(sim.hunt.status).toBe('active');
    sim.hunt.stage = 2; sim.hunt.scale = 2.65; sim.hunt.apexReady = true;
    expect(sim.canEat(plane)).toBe(true); drive(sim, .02);
    expect(sim.hunt.status).toBe('active'); expect(plane.airborne).toBe(false);
    // Follow real takeoff timing; a ground mouth cannot eat the parked/taxiing target.
    moveTo(sim, 96, -25, Math.PI); sim.speed = 4;
    for (let t = 0; t < 12 && plane.z > 70; t += 1 / 120) sim.step(1 / 120, { ...idle, lurk: true, yaw: Math.PI });
    // The aircraft crosses a generous swept mouth during an actual charged ballistic breach.
    moveTo(sim, 96, -45, Math.PI);
    for (let t = 0; t < 2 && sim.depth < 8; t += 1 / 120) sim.step(1 / 120, { ...idle, surge: true, dive: true, yaw: Math.PI });
    drive(sim, 2, { surge: true, yaw: Math.PI });
    expect(sim.stats.breaches).toBeGreaterThan(0); expect(sim.hunt.status).toBe('won');
    expect(sim.hunt.apexEaten).toBe(true); expect(sim.hunt.biggestMeal).toBe('Cargo plane');
    expect(sim.hunt.score).toBeGreaterThanOrEqual(8000);
    const score = sim.hunt.score; drive(sim, 2); expect(sim.hunt.score).toBe(score);
    expect(sim.events.filter(e => e.type === 'win')).toHaveLength(1);
  });
  it('makes missed takeoffs a continuous go-around, never an escaped-apex loss', () => {
    const sim = isolated(); const plane = sim.prey.find(p => p.kind === 'plane')!;
    plane.alive = true; sim.hunt.stage = 2; sim.hunt.scale = 2.65; sim.hunt.apexReady = true;
    moveTo(sim, 50, 90); let previous = { x: plane.x, y: plane.y, z: plane.z }, returns = 0, wasReturning = false;
    for (let t = 0; t < 80; t += 1 / 120) {
      sim.step(1 / 120, { ...idle, lurk: true, yaw: t });
      expect(Math.hypot(plane.x - previous.x, plane.y - previous.y, plane.z - previous.z)).toBeLessThan(.3);
      const returning = plane.airborne && Math.abs(plane.x - 96) < 1 && plane.z > 30 && plane.vz < -20;
      if (returning && !wasReturning) returns++;
      wasReturning = returning; previous = { x: plane.x, y: plane.y, z: plane.z };
    }
    expect(returns).toBeGreaterThanOrEqual(2); expect(plane.alive).toBe(true); expect(sim.hunt.status).toBe('active');
  });
});

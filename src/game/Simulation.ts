import { angleDiff, clamp, damp, launchPower, random, sweptDistance } from './math';
import { isWater, OASIS_HOMES, OASIS_RUNWAY, OASIS_SPAWN, surfaceHeight, terrainHeight } from './biomes';
import type { HuntIndex } from './biomes';
export type { HuntIndex } from './biomes';

export type PreyKind = 'rabbit' | 'chicken' | 'crate' | 'urn' | 'jeep' | 'goat' | 'militia' | 'pickup' | 'helicopter' | 'balloon' | 'civilian' | 'marketCart' | 'building' | 'sonarDrone' | 'plane';
export interface Prey {
  id: number; kind: PreyKind; x: number; y: number; z: number; yaw: number;
  vx: number; vy: number; vz: number; spin: number; radius: number;
  alive: boolean; respawn: number; airborne: boolean; flipped: boolean; seed: number;
}
export interface Input { surge: boolean; lurk: boolean; dive: boolean; lunge: boolean; turn: number; yaw: number; }
export interface Stats { bites: number; slams: number; breaches: number; bestAir: number; distance: number; time: number; bestChain: number; broken: number; }
export interface HuntState {
  index: HuntIndex;
  status: 'active' | 'won' | 'lost'; health: number; hunger: number; heat: number;
  growth: number; stage: 0 | 1 | 2; scale: number; score: number;
  medal: 'none' | 'bronze' | 'silver' | 'gold'; apexReady: boolean; apexEaten: boolean;
  damageFlash: number; growthFlash: number; kills: number; biggestMeal: string;
}
export interface Marker { id: number; x: number; z: number; radius: number; time: number; duration: number; kind: 'shell' | 'seismic'; }
export interface Digestion { id: number; progress: number; growth: number; kind: PreyKind; }
export type Event = { type: 'breach' | 'land' | 'slam' | 'eat' | 'break' | 'lunge' | 'hurt' | 'grow' | 'shot' | 'win' | 'lose' | 'water' | 'splash'; x: number; y: number; z: number; power: number; label?: string; };

const STAGE_SCALES = [.7, 1.05, 1.5] as const;
const OASIS_SCALES = [1.5, 2.05, 2.65] as const;
const HUNT_KINDS = new Set<PreyKind>(['goat', 'militia', 'pickup', 'helicopter', 'balloon']);
const OASIS_KINDS = new Set<PreyKind>(['civilian', 'marketCart', 'building', 'sonarDrone', 'plane']);
const MEALS: Record<PreyKind, { food: number; growth: number; score: number; name: string }> = {
  rabbit: { food: 12, growth: 12, score: 100, name: 'Rabbit' },
  chicken: { food: 14, growth: 13, score: 110, name: 'Chicken' },
  crate: { food: 0, growth: 2, score: 45, name: 'Supply crate' },
  urn: { food: 0, growth: 1, score: 35, name: 'Clay pot' },
  goat: { food: 23, growth: 22, score: 260, name: 'Angry goat' },
  militia: { food: 19, growth: 18, score: 240, name: 'Militia patrol' },
  jeep: { food: 28, growth: 30, score: 450, name: 'Off-road jeep' },
  pickup: { food: 32, growth: 35, score: 600, name: 'Armed pickup' },
  helicopter: { food: 42, growth: 45, score: 900, name: 'Attack helicopter' },
  balloon: { food: 100, growth: 0, score: 5000, name: 'Rally leader' },
  civilian: { food: 16, growth: 13, score: 260, name: 'Townsperson' },
  marketCart: { food: 27, growth: 25, score: 420, name: 'Market cart' },
  building: { food: 0, growth: 0, score: 160, name: 'Town house' },
  sonarDrone: { food: 30, growth: 28, score: 800, name: 'Sonar drone' },
  plane: { food: 100, growth: 0, score: 8000, name: 'Cargo plane' },
};
export class Simulation {
  x = 0; y = 0; z = 36; yaw = 0; pitch = 0; depth = 0.8; speed = 14;
  vy = 0; state: 'sand' | 'rise' | 'air' = 'sand'; charge = 0; airLunge = false;
  lungeCooldown = 0; lungeBoost = 0; slam = false; deep = false; mouth = 0;
  chain = 0; chainTime = 0; age = 0; frame = 0;
  stats: Stats = this.emptyStats();
  mode: 'toy' | 'hunt' = 'toy';
  hunt: HuntState = this.emptyHunt();
  prey: Prey[] = []; events: Event[] = [];
  markers: Marker[] = []; digestion: Digestion[] = [];
  history: { x: number; y: number; z: number }[] = [];
  private diving = false; private slamInputConsumed = false; private hold = 0; private risePower = 0;
  private rng = random(9327);
  private previous = { x: 0, y: 0, z: 36 };
  private homes = new Map<number, { x: number; z: number; yaw: number }>();
  private attackTimers = new Map<number, number>(); private flipTimers = new Map<number, number>();
  private markerDamage = new Map<number, number>(); private nextMarker = 0; private nextDigestion = 0;
  private damageCooldown = 0; private regenDelay = 0; private pendingScore = 0; private biggestMealScore = 0;
  private campTime = 0; private seismicCooldown = 0; private campAnchor = { x: 0, z: 36 };
  private entryScale = .7; private wet = false; private waterWarningCooldown = 0;
  private planeTime = -1;
  constructor() { this.reset(); }
  emptyStats(): Stats { return { bites: 0, slams: 0, breaches: 0, bestAir: 0, distance: 0, time: 0, bestChain: 0, broken: 0 }; }
  private emptyHunt(): HuntState {
    return { index: 1, status: 'active', health: 100, hunger: 90, heat: 0, growth: 0, stage: 0, scale: .7,
      score: 0, medal: 'none', apexReady: false, apexEaten: false, damageFlash: 0, growthFlash: 0, kills: 0, biggestMeal: 'Nothing yet' };
  }
  reset() {
    this.mode = 'toy'; this.hunt = this.emptyHunt();
    this.entryScale = .7; this.wet = false; this.waterWarningCooldown = 0; this.planeTime = -1;
    this.markers.length = 0; this.digestion.length = 0; this.homes.clear(); this.attackTimers.clear(); this.flipTimers.clear(); this.markerDamage.clear();
    this.nextMarker = 0; this.nextDigestion = 0; this.damageCooldown = 0; this.regenDelay = 0; this.pendingScore = 0; this.biggestMealScore = 0;
    this.campTime = 0; this.seismicCooldown = 0; this.campAnchor = { x: 0, z: 36 };
    this.x = 0; this.z = 36; this.depth = .8; this.y = this.ground(this.x, this.z) - this.depth;
    this.yaw = 0; this.pitch = 0; this.speed = 14; this.vy = 0; this.state = 'sand'; this.charge = 0;
    this.deep = false; this.slam = false; this.airLunge = false; this.diving = false; this.slamInputConsumed = false; this.hold = 0; this.risePower = 0;
    this.lungeCooldown = 0; this.lungeBoost = 0; this.mouth = 0; this.chain = 0; this.chainTime = 0; this.age = 0; this.frame = 0;
    this.stats = this.emptyStats(); this.events.length = 0; this.rng = random(9327); this.prey.length = 0;
    this.previous = { x: this.x, y: this.y, z: this.z };
    this.history = Array.from({ length: 180 }, (_, i) => ({ x: this.x, y: this.y, z: this.z + i * .16 }));
    // An immediately readable first meal, then a line of tempting little silhouettes.
    for (const [x, z] of [[0, 22], [2, 9], [-3, 6], [4, -7], [-3, -10], [2, -20]]) this.add('rabbit', x, z);
    for (let i = 0; i < 50; i++) {
      const a = this.rng() * Math.PI * 2, r = 20 + this.rng() * 155;
      this.add(i % 4 === 0 ? 'chicken' : 'rabbit', Math.sin(a) * r, Math.cos(a) * r);
    }
    for (const [cx, cz] of [[23, -25], [-54, -25], [68, 67], [-74, 80], [20, -115], [116, -44]]) {
      for (let i = 0; i < 5; i++) this.add(i % 2 ? 'urn' : 'crate', cx + (i % 3 - 1) * 3.8, cz + Math.floor(i / 3) * 4.5);
      this.add('jeep', cx + 8, cz + 1);
    }
    // Allocate every species in both modes so the renderer's instance pools never change shape.
    for (const [x, z] of [[-16, -30], [21, -34], [27, -31], [19, -37], [-40, -35], [-55, -22], [-59, -29], [57, 55], [72, 65], [16, -111], [28, -120], [108, -38]]) this.add('goat', x, z, false);
    for (const [cx, cz] of [[23, -25], [-54, -25], [68, 67], [-74, 80], [20, -115], [116, -44]]) {
      this.add('militia', cx - 5, cz - 5, false); this.add('militia', cx + 5, cz + 7, false);
    }
    for (const [x, z] of [[72, 68], [-56, -34], [120, -40]]) this.add('pickup', x, z, false);
    this.add('helicopter', 0, -30, false); this.add('balloon', 70, -96, false);
    for (let i = 0; i < 32; i++) {
      const [x, z] = OASIS_HOMES[Math.floor(i / 2)];
      const home = this.drySpot(x + (i % 2 ? 8 : -8), z + 7);
      this.add('civilian', home.x, home.z, false);
    }
    for (let i = 0; i < 12; i++) {
      const [x, z] = OASIS_HOMES[i]; const home = this.drySpot(x - 9, z - 9);
      this.add('marketCart', home.x, home.z, false);
    }
    for (const [x, z] of OASIS_HOMES) this.add('building', x, z, false);
    for (const [x, z] of [[-35, 24], [30, 60], [64, -58]]) this.add('sonarDrone', x, z, false);
    this.add('plane', OASIS_RUNWAY.x, OASIS_RUNWAY.startZ - 14, false);
  }
  startHunt(index: HuntIndex = 1, carriedScale?: number) {
    this.reset(); this.mode = 'hunt'; this.hunt.index = index;
    this.entryScale = Math.max(index === 2 ? 1.5 : .7, Number.isFinite(carriedScale) ? carriedScale! : 0);
    this.hunt.scale = this.entryScale;
    if (index === 2) {
      this.x = OASIS_SPAWN.x; this.z = OASIS_SPAWN.z; this.y = this.surface(this.x, this.z) - .8;
      this.previous = { x: this.x, y: this.y, z: this.z }; this.campAnchor = { x: this.x, z: this.z };
      this.history = Array.from({ length: 280 }, (_, i) => ({ x: this.x, y: this.y, z: this.z + i * .16 }));
    }
    for (const p of this.prey) {
      if (index === 1) {
        if (HUNT_KINDS.has(p.kind) && p.kind !== 'helicopter') p.alive = true;
      } else {
        p.alive = OASIS_KINDS.has(p.kind) && p.kind !== 'sonarDrone';
        if (p.kind === 'goat' || p.kind === 'militia' || p.kind === 'pickup' || p.kind === 'jeep') {
          const [hx, hz] = OASIS_HOMES[p.id % OASIS_HOMES.length];
          const home = this.drySpot(hx + 10, hz - 11);
          p.x = home.x; p.z = home.z; p.alive = true;
          this.homes.set(p.id, { x: p.x, z: p.z, yaw: p.yaw });
        }
        if (!p.alive) p.respawn = Infinity;
      }
      p.y = this.surface(p.x, p.z) + (p.kind === 'balloon' ? 20 : p.kind === 'plane' ? 4.3 : p.kind === 'sonarDrone' ? 9 : 0);
      if (p.kind === 'plane') p.yaw = 0;
    }
  }
  ground(x: number, z: number) { return terrainHeight(x, z, this.mode === 'hunt' ? this.hunt.index : 1); }
  surface(x: number, z: number) { return surfaceHeight(x, z, this.mode === 'hunt' ? this.hunt.index : 1); }
  get inWater() { return this.mode === 'hunt' && this.hunt.index === 2 && isWater(this.x, this.z, 2) && this.state !== 'air'; }
  private drySpot(x: number, z: number) {
    for (let i = 0; i < 12 && isWater(x, z, 2); i++) x += 4;
    return { x, z };
  }
  abandonHunt() { this.finishHunt(false, 'EXPEDITION WITHDRAWN'); }
  canEat(p: Prey): boolean {
    if (!p.alive) return false;
    if (this.mode === 'toy') return !HUNT_KINDS.has(p.kind) && !OASIS_KINDS.has(p.kind) && (p.kind !== 'jeep' || p.flipped);
    if (this.hunt.status !== 'active') return false;
    if (p.kind === 'building') return false;
    if (this.hunt.index === 2) {
      if (p.kind === 'balloon') return false;
      if (p.kind === 'plane') return this.hunt.stage === 2 && this.hunt.apexReady;
      if (p.kind === 'helicopter') return this.hunt.stage >= 1;
      if (p.kind === 'pickup') return p.flipped || this.hunt.stage === 2;
      if (p.kind === 'jeep') return p.flipped || this.hunt.stage >= 1;
      return true;
    }
    if (OASIS_KINDS.has(p.kind)) return false;
    if (p.kind === 'balloon' || p.kind === 'helicopter') return this.hunt.stage === 2;
    if (p.kind === 'goat' || p.kind === 'militia') return this.hunt.stage >= 1;
    if (p.kind === 'jeep' || p.kind === 'pickup') return this.hunt.stage >= 1 && p.flipped;
    return true;
  }
  private add(kind: PreyKind, x: number, z: number, alive = true) {
    const radius = kind === 'plane' ? 7 : kind === 'building' ? 5.5 : kind === 'marketCart' ? 1.8 : kind === 'sonarDrone' ? 1.7 : kind === 'civilian' ? .8 : kind === 'balloon' ? 5.2 : kind === 'helicopter' ? 3.1 : kind === 'pickup' ? 2.6 : kind === 'jeep' ? 2.3 : kind === 'goat' ? .95 : kind === 'militia' ? .65 : kind === 'crate' ? 1 : kind === 'urn' ? .65 : .55;
    this.prey.push({ id: this.prey.length, kind, x, z, y: this.ground(x, z), yaw: this.rng() * 6.28,
      vx: 0, vy: 0, vz: 0, spin: 0, radius, alive, respawn: alive ? 0 : Infinity, airborne: false, flipped: false, seed: this.rng() * 100 });
    const p = this.prey[this.prey.length - 1];
    this.homes.set(p.id, { x, z, yaw: p.yaw }); this.attackTimers.set(p.id, 3 + p.seed * .015);
  }
  emit(type: Event['type'], power: number, label?: string, p?: { x: number; y: number; z: number }) {
    this.events.push({ type, power, label, x: p?.x ?? this.x, y: p?.y ?? this.surface(this.x, this.z), z: p?.z ?? this.z });
  }
  clearControlState() {
    this.diving = false; this.hold = 0; this.risePower = 0; this.charge = 0; this.slamInputConsumed = false;
    if (this.state === 'rise') this.state = 'sand';
  }
  step(dt: number, input: Input) {
    if (dt <= 0 || !Number.isFinite(dt)) return;
    if (!input.dive) this.slamInputConsumed = false;
    const dive = input.dive && !this.slamInputConsumed;
    this.age += dt; this.stats.time += dt; this.frame++;
    this.waterWarningCooldown = Math.max(0, this.waterWarningCooldown - dt);
    this.lungeCooldown = Math.max(0, this.lungeCooldown - dt);
    this.lungeBoost = damp(this.lungeBoost, 0, 4, dt); this.mouth = damp(this.mouth, 0, 5, dt);
    const targetSpeed = this.inWater ? input.lurk ? 3.5 : input.surge ? 12 : 8 : input.lurk ? 4 : input.surge ? 30 : 16;
    this.speed = damp(this.speed, targetSpeed + this.lungeBoost, input.surge ? 1.7 : 2.4, dt);
    let targetYaw = input.yaw + input.turn * .7;
    const distance = Math.hypot(this.x, this.z);
    if (distance > 176) {
      const toCenter = Math.atan2(-this.x, this.z);
      targetYaw += angleDiff(targetYaw, toCenter) * clamp((distance - 176) / 32);
    }
    const size = this.mode === 'hunt' ? this.hunt.scale : 1;
    const turnRate = (this.state === 'air' ? .9 : input.lurk ? 2.5 : 1.8) / (this.mode === 'hunt' ? 1 + (size - .7) * .65 : 1);
    this.yaw += clamp(angleDiff(this.yaw, targetYaw), -turnRate * dt, turnRate * dt);
    const oldY = this.y;
    this.previous.x = this.x; this.previous.y = this.y; this.previous.z = this.z;
    this.x += Math.sin(this.yaw) * this.speed * dt; this.z -= Math.cos(this.yaw) * this.speed * dt;
    this.stats.distance += this.speed * dt;
    const floor = this.surface(this.x, this.z);
    if (input.lunge && this.lungeCooldown <= 0 && (this.state !== 'air' || !this.airLunge)) {
      this.lungeCooldown = 1.4; this.lungeBoost = 19; this.mouth = 1;
      if (this.state === 'air') {
        this.airLunge = true;
        if (!this.slam) this.vy = Math.max(this.vy, 3) + 5;
        this.yaw += angleDiff(this.yaw, input.yaw) * .75;
      }
      this.emit('lunge', 1);
    }
    if (this.inWater) {
      // The water is a slow, exposed route, never an invisible wall or a launch battery.
      this.state = 'sand'; this.depth = 0; this.y = floor - .25; this.vy = 0;
      this.charge = 0; this.hold = 0; this.risePower = 0; this.diving = false; this.deep = false;
      this.speed = damp(this.speed, targetSpeed + this.lungeBoost * .2, 6, dt);
      if (dive && this.waterWarningCooldown <= 0) {
        this.emit('water', 1, 'WATER — SURFACE ONLY · BREACH FROM A DRY BANK'); this.waterWarningCooldown = 8;
      }
    } else if (this.state !== 'air') {
      if (dive) {
        this.hold += dt; this.state = 'sand'; this.depth = Math.min(12, this.depth + (4.5 + this.speed * .11) * dt);
        this.charge = launchPower(this.depth, this.speed);
      } else if (this.diving && this.hold > .16 && this.depth > 1.5) {
        this.state = 'rise'; this.risePower = launchPower(this.depth, this.speed); this.hold = 0;
      }
      if (this.state === 'rise') {
        this.depth -= (8 + this.risePower * .48) * dt;
        if (this.depth <= .3) {
          this.state = 'air'; this.depth = 0; this.y = floor + .4; this.vy = this.risePower;
          this.airLunge = false; this.slam = false; this.stats.breaches++;
          this.emit('breach', this.risePower); this.mouth = .7;
        }
      } else if (!dive) { this.depth = damp(this.depth, .8, 6, dt); this.charge = damp(this.charge, 0, 3, dt); }
      if (this.state !== 'air') this.y = floor - this.depth;
    } else {
      if (input.dive && !this.diving) {
        this.slam = true; this.vy = Math.min(this.vy, -44);
        // The slam press ends at impact; holding it must not prime a second breach.
        this.slamInputConsumed = true;
      }
      this.vy -= 23 * dt; this.y += this.vy * dt;
      const altitude = this.y - floor;
      this.stats.bestAir = Math.max(this.stats.bestAir, altitude);
      if (this.y < floor + .2 && this.vy < 0) {
        const power = Math.abs(this.vy); this.emit(this.slam ? 'slam' : 'land', power);
        if (this.slam) { this.stats.slams++; this.shockwave(power); }
        this.state = 'sand'; this.depth = .8; this.y = floor - .8; this.vy = 0; this.charge = 0;
        this.slam = false; this.hold = 0;
        if (this.inWater) { this.depth = 0; this.y = floor - .25; this.emit('splash', Math.min(3, power / 20)); }
      }
    }
    if (this.inWater && !this.wet) {
      this.emit('splash', 1.4);
      if (this.waterWarningCooldown <= 0) {
        this.emit('water', 1, 'WATER — EXPOSED & SLOWED · FIND A DRY BANK'); this.waterWarningCooldown = 8;
      }
    }
    this.wet = this.inWater;
    this.diving = input.dive && !this.wet;
    if (this.depth > 5.4 && this.state !== 'air') this.deep = true;
    if (this.depth < 3.2 || this.state === 'air') this.deep = false;
    const vertical = (this.y - oldY) / dt;
    this.pitch = damp(this.pitch, Math.atan2(vertical, this.speed), this.state === 'air' ? 7 : 4, dt);
    const head = { x: this.x, y: this.y, z: this.z }, anchor = this.history[1] ?? this.history[0];
    // Retain distance rather than frames: the grown tail must survive slow stalking.
    if (!anchor || Math.hypot(head.x - anchor.x, head.y - anchor.y, head.z - anchor.z) > .16) this.history.unshift(head);
    else this.history[0] = head;
    if (this.history.length > 280) this.history.pop();
    this.updatePrey(dt);
    this.chainTime -= dt;
    if (this.state === 'air') this.chainTime = Math.max(this.chainTime, .9);
    if (this.chainTime <= 0) { this.bankScore(); this.chain = 0; }
    if (this.mode === 'hunt' && this.hunt.status === 'active') this.updateHunt(dt, input);
  }
  private shockwave(power: number) {
    if (this.mode === 'hunt' && this.hunt.status !== 'active') return;
    const radius = (12 + Math.min(power / 6, 6)) * (this.mode === 'hunt' ? .8 + this.hunt.scale * .25 : 1);
    if (this.mode === 'hunt') this.hunt.heat = clamp(this.hunt.heat + 5, 0, 100);
    for (const p of this.prey) {
      if (!p.alive || p.kind === 'balloon' || p.kind === 'plane' || p.kind === 'helicopter' || p.y > this.surface(p.x, p.z) + 6) continue;
      const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
      if (d < radius) {
        if (p.kind === 'building') { this.stats.broken++; this.eat(p, true); continue; }
        const force = (1 - d / radius) * 20 + 6;
        p.airborne = true; p.vy = force * .9; p.vx = dx / (d || 1) * force; p.vz = dz / (d || 1) * force;
        p.spin = force * .28; p.flipped = p.kind === 'jeep' || p.kind === 'pickup';
        if (p.flipped) this.flipTimers.set(p.id, 20);
        if (p.kind === 'crate' || p.kind === 'urn') { this.stats.broken++; this.eat(p, true); }
      }
    }
  }
  private eat(p: Prey, broken = false) {
    p.alive = false; p.respawn = p.kind === 'balloon' || p.kind === 'plane' || p.kind === 'building' ? Infinity : (p.kind === 'pickup' || p.kind === 'helicopter' || p.kind === 'sonarDrone' ? 38 : 14) + this.rng() * 12;
    if (broken) {
      this.emit('break', p.radius, p.kind, p);
      if (this.mode === 'hunt') { this.hunt.score += p.kind === 'building' ? 160 : 30; this.hunt.heat = clamp(this.hunt.heat + (p.kind === 'building' ? 7 : 1), 0, 100); }
      return;
    }
    this.stats.bites++; this.chain++; this.chainTime = 4.5; this.stats.bestChain = Math.max(this.stats.bestChain, this.chain);
    this.mouth = 1;
    const label = p.kind === 'plane' ? 'CARGO PLANE — SPECIAL DELIVERY' : p.kind === 'civilian' ? 'LUNCH RUSH' : p.kind === 'marketCart' ? 'ALL YOU CAN EAT' : p.kind === 'sonarDrone' ? 'SIGNAL LOST' : p.kind === 'balloon' ? 'THE SKY IS DINNER' : p.kind === 'helicopter' ? 'AIR SUPERIORITY' : p.kind === 'pickup' ? 'EXTRA CRUNCH' : p.kind === 'goat' ? 'WHO’S THE GOAT NOW?' : p.kind === 'militia' ? 'PATROL LUNCH' : p.kind === 'jeep' ? 'OFF-ROAD SNACK' : p.kind === 'crate' ? 'CRUNCHY' : p.kind === 'urn' ? 'POT LUCK' : this.chain >= 3 ? `${this.chain} IN A ROW` : p.kind === 'rabbit' ? 'FAST FOOD' : 'TASTES LIKE CHICKEN';
    if (this.mode === 'hunt') {
      const meal = MEALS[p.kind];
      this.hunt.hunger = Math.min(100, this.hunt.hunger + meal.food);
      if (meal.food > 0) this.hunt.kills++;
      this.hunt.heat = clamp(this.hunt.heat + (this.speed < 9 ? 1 : meal.food > 20 ? 9 : 3), 0, 100);
      this.pendingScore += Math.round(meal.score * Math.min(4, 1 + Math.floor((this.chain - 1) / 3) * .5) * (this.state === 'air' ? 1.25 : 1));
      if (meal.score > this.biggestMealScore) { this.biggestMealScore = meal.score; this.hunt.biggestMeal = meal.name; }
      if (p.kind !== 'balloon' && p.kind !== 'plane') {
        const tinyMeal = p.kind === 'rabbit' || p.kind === 'chicken';
        const growth = this.hunt.stage === 2 || this.hunt.index === 2 && tinyMeal ? 0 : meal.growth * (this.hunt.stage === 1 && tinyMeal ? .5 : 1);
        if (this.digestion.length < 32) this.digestion.push({ id: this.nextDigestion++, progress: 0, growth, kind: p.kind });
        else this.digestion[this.digestion.length - 1].growth += growth;
      }
    }
    this.emit('eat', p.kind === 'plane' ? 9 : p.kind === 'balloon' ? 6 : p.kind === 'helicopter' || p.kind === 'pickup' || p.kind === 'jeep' || p.kind === 'sonarDrone' ? 4 : 1, label, p);
    if (this.mode === 'hunt' && (p.kind === 'balloon' || p.kind === 'plane')) {
      this.hunt.apexEaten = true; this.finishHunt(true, p.kind === 'plane' ? 'CARGO PLANE DOWN — OASIS COMPLETE' : 'FIRST LIGHT — HUNT COMPLETE', p);
    }
  }
  get chainScore() { return this.pendingScore; }
  private bankScore() { if (this.mode === 'hunt') this.hunt.score += this.pendingScore; this.pendingScore = 0; }
  private finishHunt(won: boolean, label: string, position?: { x: number; y: number; z: number }) {
    if (this.mode !== 'hunt' || this.hunt.status !== 'active') return;
    this.bankScore(); this.hunt.status = won ? 'won' : 'lost';
    this.hunt.medal = !won ? 'none' : this.stats.time <= 210 && this.hunt.score >= 8500 ? 'gold' : this.stats.time <= 300 ? 'silver' : 'bronze';
    this.markers.length = 0; this.markerDamage.clear();
    this.emit(won ? 'win' : 'lose', 1, label, position);
  }
  private hurt(amount: number, label: string) {
    if (this.hunt.status !== 'active' || this.damageCooldown > 0) return;
    this.hunt.health = Math.max(0, this.hunt.health - amount); this.hunt.damageFlash = 1;
    this.damageCooldown = .85; this.regenDelay = 4;
    this.emit('hurt', clamp(amount / 12, .3, 1.5), label);
    if (this.hunt.health <= 0) this.finishHunt(false, 'THE DESERT BITES BACK');
  }
  private addMarker(kind: Marker['kind'], x: number, z: number, radius: number, duration: number, damage: number) {
    if (this.markers.length >= 10) return;
    const marker: Marker = { id: this.nextMarker++, kind, x, z, radius, time: duration, duration };
    this.markers.push(marker); this.markerDamage.set(marker.id, damage);
    this.emit('shot', kind === 'seismic' ? 1.2 : .65, kind === 'seismic' ? 'SEISMIC SWEEP — MOVE OR SURFACE' : 'INCOMING — KEEP MOVING', { x, y: this.surface(x, z), z });
  }
  private updateHunt(dt: number, input: Input) {
    const h = this.hunt;
    h.damageFlash = Math.max(0, h.damageFlash - dt * 2.5); h.growthFlash = Math.max(0, h.growthFlash - dt * .65);
    this.damageCooldown = Math.max(0, this.damageCooldown - dt); this.regenDelay = Math.max(0, this.regenDelay - dt);
    h.hunger = Math.max(0, h.hunger - (.45 + h.stage * .13) * dt);
    if (h.hunger > 55 && this.regenDelay <= 0) h.health = Math.min(100, h.health + 1.8 * dt);
    if (h.hunger <= 0) {
      h.health = Math.max(0, h.health - 3.2 * dt);
      if (this.damageCooldown <= 0) { h.damageFlash = .45; this.damageCooldown = 1.5; this.emit('hurt', .3, 'STARVING — FIND FOOD'); }
      if (h.health <= 0) { this.finishHunt(false, 'THE DESERT NEVER GOES HUNGRY'); return; }
    }
    for (let i = this.digestion.length - 1; i >= 0; i--) {
      const food = this.digestion[i]; food.progress += dt / (3 + h.stage * .35);
      if (food.progress < 1) continue;
      this.digestion.splice(i, 1);
      if (h.stage < 2) h.growth += food.growth;
      while (h.growth >= 100 && h.stage < 2) {
        h.growth -= 100; h.stage = (h.stage + 1) as 1 | 2;
        h.scale = Math.max(this.entryScale, (h.index === 2 ? OASIS_SCALES : STAGE_SCALES)[h.stage]);
        h.growthFlash = 1; h.health = Math.min(100, h.health + 15); this.damageCooldown = 1.5;
        h.apexReady = h.stage === 2;
        if (h.apexReady) h.growth = 100;
        this.emit('grow', h.stage, h.index === 2 ? h.stage === 1 ? 'OASIS DEVOURER' : 'RUNWAY COLOSSUS' : h.stage === 1 ? 'DUNE STALKER' : 'SAND TYRANT');
      }
    }
    const hiding = this.depth > 5.4 && this.state !== 'air' && input.lurk && this.speed < 9 && !this.inWater;
    h.heat = clamp(h.heat + (this.inWater ? 1.1 : hiding ? h.index === 2 ? -4.8 : -2.8 : -.12) * dt, 0, 100);
    this.seismicCooldown = Math.max(0, this.seismicCooldown - dt);
    if (this.depth > 5.4 && this.state !== 'air') {
      if (Math.hypot(this.x - this.campAnchor.x, this.z - this.campAnchor.z) > 22) {
        this.campAnchor = { x: this.x, z: this.z }; this.campTime = 0;
      }
      this.campTime += dt;
      if (this.campTime > 8.5 && this.seismicCooldown <= 0) {
        this.addMarker('seismic', this.x + Math.sin(this.yaw) * this.speed * 1.8, this.z - Math.cos(this.yaw) * this.speed * 1.8, 10, 1.8, 16);
        this.seismicCooldown = 5.5; h.heat = Math.max(h.heat, 22);
      }
    } else { this.campTime = 0; this.campAnchor = { x: this.x, z: this.z }; }
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i]; m.time -= dt;
      if (m.time > 0) continue;
      const damage = this.markerDamage.get(m.id) ?? 0; this.markers.splice(i, 1); this.markerDamage.delete(m.id);
      this.emit('shot', m.kind === 'seismic' ? 1.5 : 1, m.kind === 'seismic' ? 'SEISMIC IMPACT' : 'SAND IMPACT', { x: m.x, y: this.surface(m.x, m.z), z: m.z });
      const exposed = m.kind === 'seismic' ? this.depth > 2 && this.state !== 'air' : this.depth < 2.8 && this.y < this.surface(this.x, this.z) + 5;
      if (exposed && Math.hypot(this.x - m.x, this.z - m.z) < m.radius) this.hurt(damage, m.kind === 'seismic' ? 'SEISMIC HIT — BREAK YOUR CIRCLE' : 'HIT — DIVE OR CHANGE COURSE');
      if (h.status !== 'active') return;
    }
    for (const p of this.prey) {
      if (h.index === 2 && p.kind === 'sonarDrone') {
        const droneIndex = p.id - this.prey.find(q => q.kind === 'sonarDrone')!.id;
        if (!p.alive && p.respawn === Infinity && h.heat >= 34 + droneIndex * 12) {
          p.alive = true; p.x = this.x + (droneIndex - 1) * 24; p.z = this.z - 28;
          p.y = this.surface(p.x, p.z) + 9; this.attackTimers.set(p.id, 4 + droneIndex * 2);
          this.emit('shot', .65, 'SONAR DRONE — SURFACE OR EAT IT', p);
        }
        if (!p.alive || h.heat < 24 || this.depth <= 2.8 || this.state === 'air' || hiding) continue;
        const cooldown = (this.attackTimers.get(p.id) ?? 4) - dt; this.attackTimers.set(p.id, cooldown);
        if (cooldown > 0 || Math.hypot(p.x - this.x, p.z - this.z) > 95 || this.markers.filter(m => m.kind === 'seismic').length >= 2) continue;
        this.addMarker('seismic', this.x + Math.sin(this.yaw) * this.speed * 1.9, this.z - Math.cos(this.yaw) * this.speed * 1.9, 11, 2.1, 13);
        this.attackTimers.set(p.id, 7 + droneIndex * 1.5);
        continue;
      }
      if (p.kind === 'helicopter' && !p.alive && p.respawn === Infinity && (h.heat >= 48 || this.age > 75 || h.stage === 2)) {
        p.alive = true; p.y = this.surface(p.x, p.z) + 25; this.attackTimers.set(p.id, 5);
        this.emit('shot', .5, 'AIR SUPPORT INBOUND', p);
      }
      if (!p.alive || p.flipped || (p.kind !== 'militia' && p.kind !== 'pickup' && p.kind !== 'helicopter')) continue;
      const ready = p.kind === 'militia' ? this.age > 18 && h.heat >= 8 : p.kind === 'pickup' ? this.age > 45 && h.heat >= 24 : this.age > 25;
      if (!ready) continue;
      const cooldown = (this.attackTimers.get(p.id) ?? 3) - dt; this.attackTimers.set(p.id, cooldown);
      const distance = Math.hypot(p.x - this.x, p.z - this.z), range = p.kind === 'militia' ? 45 : 80;
      if (cooldown > 0 || distance > range || this.depth > 2.8 || this.markers.filter(m => m.kind === 'shell').length >= 3) continue;
      const duration = p.kind === 'militia' ? 1.35 : 1.8, prediction = duration * .9;
      this.emit('shot', .7, p.kind === 'militia' ? 'RIFLE' : 'ROCKET', p);
      this.addMarker('shell', this.x + Math.sin(this.yaw) * this.speed * prediction, this.z - Math.cos(this.yaw) * this.speed * prediction,
        p.kind === 'militia' ? 4.5 : 6.5, duration, p.kind === 'militia' ? 6 : p.kind === 'pickup' ? 10 : 12);
      this.attackTimers.set(p.id, p.kind === 'militia' ? 7 + p.seed * .025 : p.kind === 'pickup' ? 8 : 9);
    }
  }
  private updatePrey(dt: number) {
    const hunting = this.mode === 'hunt', size = hunting ? this.hunt.scale : 1;
    for (const p of this.prey) {
      if (!p.alive) {
        p.respawn -= dt;
        const allowed = !HUNT_KINDS.has(p.kind) && !OASIS_KINDS.has(p.kind) || hunting && (OASIS_KINDS.has(p.kind) ? this.hunt.index === 2 : p.kind !== 'balloon' || this.hunt.index === 1);
        if (p.respawn <= 0 && Math.hypot(p.x - this.x, p.z - this.z) > 38 && allowed) {
          const home = this.homes.get(p.id)!;
          p.alive = true; p.flipped = false; p.airborne = false; p.x = home.x; p.z = home.z;
          p.y = this.surface(p.x, p.z) + (p.kind === 'helicopter' ? 25 : p.kind === 'sonarDrone' ? 9 : 0);
        }
        continue;
      }
      const oldX = p.x, oldZ = p.z, dx = p.x - this.x, dz = p.z - this.z, distance = Math.hypot(dx, dz);
      const home = this.homes.get(p.id)!;
      if (p.flipped) {
        const remaining = (this.flipTimers.get(p.id) ?? 20) - dt; this.flipTimers.set(p.id, remaining);
        if (remaining <= 0 && !p.airborne) { p.flipped = false; this.flipTimers.delete(p.id); }
      }
      if (p.kind === 'plane') {
        this.updatePlane(p, dt);
      } else if (p.airborne) {
        p.vy -= 22 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; p.yaw += p.spin * dt;
        const floor = this.surface(p.x, p.z);
        if (p.y < floor) { p.y = floor; p.airborne = false; p.vy = 0; p.vx = 0; p.vz = 0; }
      } else if (p.kind === 'rabbit' || p.kind === 'chicken') {
        const scared = distance < 17 && this.depth < 3 && this.speed > 9;
        const targetYaw = Math.hypot(p.x, p.z) > 178 ? Math.atan2(-p.x, p.z) : scared ? Math.atan2(dx, -dz) : p.seed + Math.sin(this.age * .23 + p.seed) * 2;
        p.yaw += angleDiff(p.yaw, targetYaw) * dt * 4;
        const speed = scared ? 6.5 : 1.1;
        p.x += Math.sin(p.yaw) * speed * dt; p.z -= Math.cos(p.yaw) * speed * dt;
        p.y = this.surface(p.x, p.z) + (scared ? Math.abs(Math.sin(this.age * 12 + p.seed)) * .4 : 0);
      } else if (p.kind === 'goat' || p.kind === 'militia' || p.kind === 'civilian') {
        const alert = distance < 26 && this.depth < 3.5;
        const charging = p.kind === 'goat' && this.hunt.index === 1 && this.hunt.stage === 0 && alert;
        const tooFar = Math.hypot(p.x - home.x, p.z - home.z) > 24 || Math.hypot(p.x, p.z) > 180;
        const targetYaw = charging ? Math.atan2(-dx, dz) : tooFar ? Math.atan2(home.x - p.x, p.z - home.z) : alert ? Math.atan2(dx, -dz) : home.yaw + Math.sin(this.age * .3 + p.seed);
        p.yaw += clamp(angleDiff(p.yaw, targetYaw), -dt * 3, dt * 3);
        const speed = alert ? charging ? 7 : 4.3 : 1.1;
        p.x += Math.sin(p.yaw) * speed * dt; p.z -= Math.cos(p.yaw) * speed * dt;
        p.y = this.surface(p.x, p.z) + Math.abs(Math.sin(this.age * (alert ? 12 : 5) + p.seed)) * (alert ? .15 : .03);
        if (charging && distance < 2 && this.depth < 1.8 && this.state !== 'air') { this.hurt(7, 'ANGRY GOAT — GROW FIRST'); this.speed = Math.max(4, this.speed - 4); }
      } else if (p.kind === 'pickup' && !p.flipped) {
        const active = this.hunt.heat > 23 && distance < 110;
        const target = active ? Math.atan2(-dx, dz) + (distance < 28 ? Math.PI * .62 : .55) : home.yaw + Math.sin(this.age * .1 + p.seed);
        p.yaw += clamp(angleDiff(p.yaw, target), -dt * 1.2, dt * 1.2);
        const speed = active ? 8.5 : 2.2;
        p.x += Math.sin(p.yaw) * speed * dt; p.z -= Math.cos(p.yaw) * speed * dt;
        if (Math.hypot(p.x, p.z) > 185) p.yaw += angleDiff(p.yaw, Math.atan2(-p.x, p.z)) * dt * 2;
        p.y = this.surface(p.x, p.z);
      } else if (p.kind === 'helicopter') {
        const orbit = this.age * .15 + p.seed;
        p.x = damp(p.x, this.x + Math.sin(orbit) * 32, .7, dt); p.z = damp(p.z, this.z + Math.cos(orbit) * 32, .7, dt);
        p.y = damp(p.y, this.surface(p.x, p.z) + 22 + Math.sin(this.age * .7) * 2, 2, dt);
        p.yaw = Math.atan2(this.x - p.x, p.z - this.z);
      } else if (p.kind === 'balloon') {
        p.x = home.x + Math.sin(this.age * .11) * 5; p.z = home.z + Math.cos(this.age * .11) * 4;
        p.y = this.surface(p.x, p.z) + 20 + Math.sin(this.age * .45) * .6; p.yaw = Math.sin(this.age * .15) * .1;
      } else if (p.kind === 'sonarDrone') {
        const orbit = this.age * .4 + p.seed;
        const tracking = this.hunt.heat >= 24;
        p.x = damp(p.x, tracking ? this.x + Math.sin(orbit) * 25 : home.x, .8, dt);
        p.z = damp(p.z, tracking ? this.z + Math.cos(orbit) * 25 : home.z, .8, dt);
        p.y = damp(p.y, this.surface(p.x, p.z) + 9 + Math.sin(this.age * 1.7 + p.seed), 3, dt);
        p.yaw = Math.atan2(this.x - p.x, p.z - this.z);
      }
      // People and vehicles turn at the banks, keeping all food recoverable on dry routes.
      if (hunting && this.hunt.index === 2 && !p.airborne && p.kind !== 'sonarDrone' && isWater(p.x, p.z, 2)) {
        p.x = oldX; p.z = oldZ; p.yaw += Math.PI * .65; p.y = this.surface(p.x, p.z);
      }
      if (!p.airborne || p.kind === 'plane') { p.vx = (p.x - oldX) / dt; p.vz = (p.z - oldZ) / dt; }
      if (this.canEat(p) && this.depth < 2.1 * Math.max(1, size)) {
        if (p.kind === 'plane' && (!p.airborne || this.state !== 'air')) continue;
        const mouthX = this.x + Math.sin(this.yaw) * 1.1 * size, mouthZ = this.z - Math.cos(this.yaw) * 1.1 * size;
        const range = p.radius + (this.lungeCooldown > 1 ? 3.3 : 2.3) * size;
        const preyHeight = p.kind === 'balloon' || p.kind === 'helicopter' || p.kind === 'plane' || p.kind === 'sonarDrone' ? 0 : p.radius * .6;
        if (sweptDistance(this.previous.x, this.previous.y + .8 * size, this.previous.z, mouthX, this.y + .8 * size, mouthZ, p.x, p.y + preyHeight, p.z) < range) this.eat(p);
      }
    }
  }
  private updatePlane(p: Prey, dt: number) {
    if (this.hunt.status !== 'active') return;
    if (this.planeTime < 0) {
      if (!this.hunt.apexReady || Math.hypot(this.x - p.x, this.z - p.z) > 105) return;
      this.planeTime = 0;
      this.emit('shot', 1.2, 'CARGO PLANE TAKING OFF — LINE UP THE RUNWAY', p);
    }
    this.planeTime += dt;
    const t = this.planeTime, runway = OASIS_RUNWAY;
    let altitude = 4.3;
    if (t <= 11) {
      const roll = clamp(t - 3, 0, 8);
      p.x = runway.x; p.z = runway.startZ - 14 - 4 * roll - 1.125 * roll * roll; p.yaw = 0;
      altitude += clamp((35 - p.z) / 90) * 13.7;
      p.airborne = p.z < 35;
    } else {
      // A continuous stadium route returns low over the same runway every thirty seconds.
      // There is no escaped-plane state: a missed jump is another run-up, not a failed hunt.
      const firstStraight = 106, radius = 32, straight = runway.startZ - runway.endZ;
      const turn = Math.PI * radius, circuit = 2 * straight + 2 * turn;
      let travel = (t - 11) * 22;
      p.airborne = true;
      if (travel < firstStraight) {
        p.x = runway.x; p.z = -6 - travel; p.yaw = 0;
        altitude += clamp((35 - p.z) / 90) * 13.7;
      } else {
        travel = (travel - firstStraight) % circuit;
        altitude = 18;
        if (travel < turn) {
          const a = travel / radius;
          p.x = runway.x + radius - radius * Math.cos(a); p.z = runway.endZ - radius * Math.sin(a); p.yaw = a;
        } else if (travel < turn + straight) {
          p.x = runway.x + radius * 2; p.z = runway.endZ + travel - turn; p.yaw = Math.PI;
        } else if (travel < 2 * turn + straight) {
          const a = (travel - turn - straight) / radius;
          p.x = runway.x + radius + radius * Math.cos(a); p.z = runway.startZ + radius * Math.sin(a); p.yaw = Math.PI + a;
        } else {
          p.x = runway.x; p.z = runway.startZ - (travel - 2 * turn - straight); p.yaw = Math.PI * 2;
          altitude = p.z > 40 ? 8 + clamp((p.z - 40) / 72) * 10 : p.z > -35 ? 8 : 8 + clamp((-35 - p.z) / 77) * 10;
        }
      }
    }
    p.y = this.surface(runway.x, p.z) + altitude;
  }
}

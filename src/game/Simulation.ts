import { angleDiff, clamp, damp, ground, launchPower, random, sweptDistance } from './math';

export type PreyKind = 'rabbit' | 'chicken' | 'crate' | 'urn' | 'jeep';
export interface Prey {
  id: number; kind: PreyKind; x: number; y: number; z: number; yaw: number;
  vx: number; vy: number; vz: number; spin: number; radius: number;
  alive: boolean; respawn: number; airborne: boolean; flipped: boolean; seed: number;
}
export interface Input { surge: boolean; lurk: boolean; dive: boolean; lunge: boolean; turn: number; yaw: number; }
export interface Stats { bites: number; slams: number; breaches: number; bestAir: number; distance: number; time: number; bestChain: number; broken: number; }
export type Event = { type: 'breach' | 'land' | 'slam' | 'eat' | 'break' | 'lunge'; x: number; y: number; z: number; power: number; label?: string; };
export class Simulation {
  x = 0; y = 0; z = 36; yaw = 0; pitch = 0; depth = 0.8; speed = 14;
  vy = 0; state: 'sand' | 'rise' | 'air' = 'sand'; charge = 0; airLunge = false;
  lungeCooldown = 0; lungeBoost = 0; slam = false; deep = false; mouth = 0;
  chain = 0; chainTime = 0; age = 0; frame = 0;
  stats: Stats = this.emptyStats();
  prey: Prey[] = []; events: Event[] = [];
  history: { x: number; y: number; z: number }[] = [];
  private diving = false; private hold = 0; private risePower = 0;
  private rng = random(9327);
  private previous = { x: 0, y: 0, z: 36 };
  constructor() { this.reset(); }
  emptyStats(): Stats { return { bites: 0, slams: 0, breaches: 0, bestAir: 0, distance: 0, time: 0, bestChain: 0, broken: 0 }; }
  reset() {
    this.x = 0; this.z = 36; this.depth = .8; this.y = ground(this.x, this.z) - this.depth;
    this.yaw = 0; this.pitch = 0; this.speed = 14; this.vy = 0; this.state = 'sand'; this.charge = 0;
    this.deep = false; this.slam = false; this.airLunge = false; this.diving = false; this.hold = 0;
    this.lungeCooldown = 0; this.lungeBoost = 0; this.chain = 0; this.chainTime = 0; this.age = 0;
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
  }
  private add(kind: PreyKind, x: number, z: number) {
    const radius = kind === 'jeep' ? 2.3 : kind === 'crate' ? 1 : kind === 'urn' ? .65 : .55;
    this.prey.push({ id: this.prey.length, kind, x, z, y: ground(x, z), yaw: this.rng() * 6.28,
      vx: 0, vy: 0, vz: 0, spin: 0, radius, alive: true, respawn: 0, airborne: false, flipped: false, seed: this.rng() * 100 });
  }
  emit(type: Event['type'], power: number, label?: string, p?: { x: number; y: number; z: number }) {
    this.events.push({ type, power, label, x: p?.x ?? this.x, y: p?.y ?? ground(this.x, this.z), z: p?.z ?? this.z });
  }
  step(dt: number, input: Input) {
    this.age += dt; this.stats.time += dt; this.frame++;
    this.lungeCooldown = Math.max(0, this.lungeCooldown - dt);
    this.lungeBoost = damp(this.lungeBoost, 0, 4, dt); this.mouth = damp(this.mouth, 0, 5, dt);
    const targetSpeed = input.lurk ? 4 : input.surge ? 30 : 16;
    this.speed = damp(this.speed, targetSpeed + this.lungeBoost, input.surge ? 1.7 : 2.4, dt);
    let targetYaw = input.yaw + input.turn * .7;
    const distance = Math.hypot(this.x, this.z);
    if (distance > 176) {
      const toCenter = Math.atan2(-this.x, this.z);
      targetYaw += angleDiff(targetYaw, toCenter) * clamp((distance - 176) / 32);
    }
    const turnRate = this.state === 'air' ? .9 : input.lurk ? 2.5 : 1.8;
    this.yaw += clamp(angleDiff(this.yaw, targetYaw), -turnRate * dt, turnRate * dt);
    const oldY = this.y;
    this.previous.x = this.x; this.previous.y = this.y; this.previous.z = this.z;
    this.x += Math.sin(this.yaw) * this.speed * dt; this.z -= Math.cos(this.yaw) * this.speed * dt;
    this.stats.distance += this.speed * dt;
    const floor = ground(this.x, this.z);
    if (input.lunge && this.lungeCooldown <= 0 && (this.state !== 'air' || !this.airLunge)) {
      this.lungeCooldown = 1.4; this.lungeBoost = 19; this.mouth = 1;
      if (this.state === 'air') { this.airLunge = true; this.vy = Math.max(this.vy, 3) + 5; this.yaw += angleDiff(this.yaw, input.yaw) * .75; }
      this.emit('lunge', 1);
    }
    if (this.state !== 'air') {
      if (input.dive) {
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
      } else if (!input.dive) { this.depth = damp(this.depth, .8, 6, dt); this.charge = damp(this.charge, 0, 3, dt); }
      if (this.state !== 'air') this.y = floor - this.depth;
    } else {
      if (input.dive && !this.diving) { this.slam = true; this.vy = Math.min(this.vy, -44); }
      this.vy -= 23 * dt; this.y += this.vy * dt;
      const altitude = this.y - floor;
      this.stats.bestAir = Math.max(this.stats.bestAir, altitude);
      if (this.y < floor + .2 && this.vy < 0) {
        const power = Math.abs(this.vy); this.emit(this.slam ? 'slam' : 'land', power);
        if (this.slam) { this.stats.slams++; this.shockwave(power); }
        this.state = 'sand'; this.depth = .8; this.y = floor - .8; this.vy = 0; this.charge = 0;
        this.slam = false; this.hold = 0;
      }
    }
    this.diving = input.dive;
    if (this.depth > 5.4 && this.state !== 'air') this.deep = true;
    if (this.depth < 3.2 || this.state === 'air') this.deep = false;
    const vertical = (this.y - oldY) / dt;
    this.pitch = damp(this.pitch, Math.atan2(vertical, this.speed), this.state === 'air' ? 7 : 4, dt);
    this.history.unshift({ x: this.x, y: this.y, z: this.z }); if (this.history.length > 220) this.history.pop();
    this.updatePrey(dt);
    this.chainTime -= dt;
    if (this.state === 'air') this.chainTime = Math.max(this.chainTime, .9);
    if (this.chainTime <= 0) this.chain = 0;
  }
  private shockwave(power: number) {
    const radius = 12 + Math.min(power / 6, 6);
    for (const p of this.prey) {
      if (!p.alive) continue;
      const dx = p.x - this.x, dz = p.z - this.z, d = Math.hypot(dx, dz);
      if (d < radius) {
        const force = (1 - d / radius) * 20 + 6;
        p.airborne = true; p.vy = force * .9; p.vx = dx / (d || 1) * force; p.vz = dz / (d || 1) * force;
        p.spin = force * .28; p.flipped = p.kind === 'jeep';
        if (p.kind === 'crate' || p.kind === 'urn') { this.stats.broken++; this.eat(p, true); }
      }
    }
  }
  private eat(p: Prey, broken = false) {
    p.alive = false; p.respawn = 14 + this.rng() * 12;
    if (broken) { this.emit('break', p.radius, p.kind, p); return; }
    this.stats.bites++; this.chain++; this.chainTime = 4.5; this.stats.bestChain = Math.max(this.stats.bestChain, this.chain);
    this.mouth = 1;
    const label = p.kind === 'jeep' ? 'OFF-ROAD SNACK' : p.kind === 'crate' ? 'CRUNCHY' : p.kind === 'urn' ? 'POT LUCK' : this.chain >= 3 ? `${this.chain} IN A ROW` : p.kind === 'rabbit' ? 'FAST FOOD' : 'TASTES LIKE CHICKEN';
    this.emit('eat', p.kind === 'jeep' ? 4 : 1, label, p);
  }
  private updatePrey(dt: number) {
    for (const p of this.prey) {
      if (!p.alive) {
        p.respawn -= dt;
        if (p.respawn <= 0 && Math.hypot(p.x - this.x, p.z - this.z) > 38) {
          p.alive = true; p.flipped = false; p.airborne = false; p.y = ground(p.x, p.z);
        }
        continue;
      }
      const dx = p.x - this.x, dz = p.z - this.z, distance = Math.hypot(dx, dz);
      if (p.airborne) {
        p.vy -= 22 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
        p.yaw += p.spin * dt;
        const floor = ground(p.x, p.z);
        if (p.y < floor) { p.y = floor; p.airborne = false; p.vy = 0; p.vx = 0; p.vz = 0; }
      } else if (p.kind === 'rabbit' || p.kind === 'chicken') {
        const scared = distance < 17 && this.depth < 3 && this.speed > 9;
        const targetYaw = scared ? Math.atan2(dx, -dz) : p.seed + Math.sin(this.age * .23 + p.seed) * 2;
        p.yaw += angleDiff(p.yaw, targetYaw) * dt * 4;
        const speed = scared ? 6.5 : 1.1;
        p.x += Math.sin(p.yaw) * speed * dt; p.z -= Math.cos(p.yaw) * speed * dt;
        if (Math.hypot(p.x, p.z) > 180) p.yaw += Math.PI * dt;
        p.y = ground(p.x, p.z) + (scared ? Math.abs(Math.sin(this.age * 12 + p.seed)) * .4 : 0);
      }
      const edible = p.kind !== 'jeep' || p.flipped;
      if (edible && this.depth < 2.1) {
        const mouthX = this.x + Math.sin(this.yaw) * 1.1, mouthZ = this.z - Math.cos(this.yaw) * 1.1;
        const range = p.radius + (this.lungeCooldown > 1 ? 3.3 : 2.3);
        if (sweptDistance(this.previous.x, this.previous.y + .8, this.previous.z, mouthX, this.y + .8, mouthZ, p.x, p.y + p.radius * .6, p.z) < range) this.eat(p);
      }
    }
  }
}

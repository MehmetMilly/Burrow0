import * as THREE from 'three';
import { colors, geo, mat } from './palette';
import { random } from '../game/math';
import { isWater, surfaceHeight, terrainHeight } from '../game/biomes';
import type { HuntIndex } from '../game/biomes';
import type { Event, Simulation } from '../game/Simulation';
interface Piece { object: THREE.Object3D; vx: number; vy: number; vz: number; life: number; spin: number; water: boolean; debris: boolean; }
interface Fragment { object: THREE.Object3D; vx: number; vy: number; vz: number; life: number; phase: number; metal: boolean; }
interface Ring { mesh: THREE.Mesh; life: number; max: number; speed: number; water: boolean; }
interface Dust { sprite: THREE.Sprite; life: number; max: number; vx: number; vz: number; size: number; }
function radialTexture(dust: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!; const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  if (dust) {
    gradient.addColorStop(0, 'rgba(235,190,139,0.6)'); gradient.addColorStop(.35, 'rgba(235,190,139,0.3)'); gradient.addColorStop(1, 'rgba(235,190,139,0)');
  } else {
    gradient.addColorStop(0, 'rgba(74,49,36,0.12)'); gradient.addColorStop(.65, 'rgba(74,49,36,0.1)'); gradient.addColorStop(.82, 'rgba(74,49,36,0.4)'); gradient.addColorStop(1, 'rgba(74,49,36,0)');
  }
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}
export class Effects {
  pieces: Piece[] = []; rings: Ring[] = []; dust: Dust[] = []; scars: THREE.Mesh[] = [];
  group = new THREE.Group(); rng = random(124);
  private biome: HuntIndex = 1; private wakeTime = 0; private rippleTime = 0;
  private cursor = 0; private ringCursor = 0; private dustCursor = 0; private scarCursor = 0;
  private fragments: Fragment[] = []; private fragmentMesh: THREE.InstancedMesh;
  private particles: THREE.InstancedMesh; private color = new THREE.Color();
  private tracerGeometry = new THREE.BufferGeometry();
  private tracerPositions = new Float32Array(24 * 6);
  private tracerLife = new Float32Array(24); private tracerCursor = 0;
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  constructor(scene: THREE.Scene) {
    // One draw for the bounded sand, water and small breakaway particle pool.
    this.particles = new THREE.InstancedMesh(geo.ico, mat(0xffffff), 360);
    this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.particles.frustumCulled = false;
    for (let i = 0; i < 360; i++) {
      this.particles.setMatrixAt(i, this.hidden); this.particles.setColorAt(i, this.color.setHex(colors.sand));
      this.pieces.push({ object: new THREE.Object3D(), vx: 0, vy: 0, vz: 0, life: 0, spin: 0, water: false, debris: false });
    }
    this.group.add(this.particles);
    // Cloth and heavy aircraft panels share one fixed breakaway draw. Their
    // thickness, silhouettes, colors and motion distinguish the two materials.
    this.fragmentMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(0xffffff, .64, .18), 64);
    this.fragmentMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.fragmentMesh.frustumCulled = false; this.fragmentMesh.visible = false;
    for (let i = 0; i < 64; i++) {
      this.fragmentMesh.setMatrixAt(i, this.hidden); this.fragmentMesh.setColorAt(i, this.color.setHex(i % 3 ? colors.ivory : colors.rust));
      this.fragments.push({ object: new THREE.Object3D(), vx: 0, vy: 0, vz: 0, life: 0, phase: 0, metal: false });
    }
    this.group.add(this.fragmentMesh);
    const ringGeometry = new THREE.RingGeometry(.9, 1, 64);
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: colors.ivory, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.visible = false; this.group.add(mesh);
      this.rings.push({ mesh, life: 0, max: 1, speed: 1, water: false });
    }
    const dustTexture = radialTexture(true);
    for (let i = 0; i < 24; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTexture, transparent: true, opacity: .25, depthWrite: false }));
      sprite.visible = false; this.group.add(sprite); this.dust.push({ sprite, life: 0, max: 1, vx: 0, vz: 0, size: 1 });
    }
    const scarMaterial = new THREE.MeshBasicMaterial({ map: radialTexture(false), transparent: true, depthWrite: false, opacity: .7, polygonOffset: true, polygonOffsetFactor: -1 });
    for (let i = 0; i < 8; i++) {
      const geometry = new THREE.PlaneGeometry(1, 1, 16, 16); geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, scarMaterial); mesh.visible = false; this.group.add(mesh); this.scars.push(mesh);
    }
    this.tracerGeometry.setAttribute('position', new THREE.BufferAttribute(this.tracerPositions, 3).setUsage(THREE.DynamicDrawUsage));
    const tracers = new THREE.LineSegments(this.tracerGeometry, new THREE.LineBasicMaterial({ color: 0xffc77a, transparent: true, opacity: .65, depthWrite: false, blending: THREE.AdditiveBlending }));
    tracers.frustumCulled = false; this.group.add(tracers);
    scene.add(this.group);
  }
  setBiome(index: HuntIndex) {
    if (this.biome === index) return;
    this.biome = index; this.clear();
  }
  burst(x: number, y: number, z: number, count: number, power: number, debris = false, tint?: number) {
    const water = !debris && tint === undefined && isWater(x, z, this.biome) && y <= surfaceHeight(x, z, this.biome) + .5;
    this.emit(x, water ? surfaceHeight(x, z, this.biome) : y, z, count, power, debris, tint, water);
  }
  private emit(x: number, y: number, z: number, count: number, power: number, debris = false, tint?: number, water = false) {
    const amount = Math.min(this.pieces.length, Math.max(0, Math.floor(count)));
    for (let i = 0; i < amount; i++) {
      const index = this.cursor++ % this.pieces.length, p = this.pieces[index], a = this.rng() * Math.PI * 2, v = (this.rng() * .7 + .3) * power;
      p.object.position.set(x + Math.sin(a) * .8, y + .1 + this.rng() * (water ? .3 : 1), z + Math.cos(a) * .8);
      p.vx = Math.sin(a) * v; p.vz = Math.cos(a) * v; p.vy = this.rng() * power * (water ? .7 : .9) + (water ? 2 : 3);
      p.water = water; p.debris = debris;
      p.life = water ? .65 + this.rng() * .65 : debris ? 6 : 1.1 + this.rng() * 1.1; p.spin = this.rng() * 10;
      this.particles.setColorAt(index, this.color.setHex(water ? (i % 3 ? 0x9de4dc : 0xe0fff1) : tint ?? (debris ? (i % 2 ? colors.rust : 0xa16d45) : i % 3 ? colors.sand : colors.ivory)));
      p.object.scale.setScalar(debris ? .2 + this.rng() * .45 : water ? .055 + this.rng() * .09 : .035 + this.rng() * .09);
      if (debris) p.object.scale.x *= 1.8;
      if (water) p.object.scale.y *= 1.9;
    }
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
    if (!water && amount >= 20) for (let i = 0; i < 4; i++) {
      const p = this.dust[this.dustCursor++ % this.dust.length]; const a = this.rng() * Math.PI * 2;
      p.sprite.position.set(x + Math.sin(a) * 2, y + .8, z + Math.cos(a) * 2);
      p.vx = Math.sin(a) * power * .22; p.vz = Math.cos(a) * power * .22; p.life = p.max = 1.6 + this.rng(); p.size = 3 + power * .22; p.sprite.visible = true;
    }
  }
  ring(x: number, z: number, power: number) {
    const r = this.rings[this.ringCursor++ % this.rings.length];
    r.water = isWater(x, z, this.biome);
    r.mesh.position.set(x, surfaceHeight(x, z, this.biome) + (r.water ? .04 : .13), z);
    (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(r.water ? 0xb8f1e8 : colors.ivory);
    r.mesh.scale.setScalar(1); r.life = r.max = r.water ? 1.6 : 1.1; r.speed = r.water ? power * .62 : power; r.mesh.visible = true;
  }
  private scar(x: number, z: number, radius: number) {
    const mesh = this.scars[this.scarCursor % this.scars.length]; const attr = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    // A shoreline impact can still splash; never paint a sand crater over water.
    for (let n = 0; n < attr.count; n++) {
      if (isWater(x + (uv.getX(n) - .5) * radius * 2, z - (uv.getY(n) - .5) * radius * 2, this.biome)) return;
    }
    this.scarCursor++;
    for (let n = 0; n < attr.count; n++) {
      const px = x + (uv.getX(n) - .5) * radius * 2, pz = z - (uv.getY(n) - .5) * radius * 2;
      attr.setXYZ(n, px, terrainHeight(px, pz, this.biome) + .08, pz);
    }
    attr.needsUpdate = true; mesh.geometry.computeBoundingSphere(); mesh.visible = true;
  }
  private splash(x: number, z: number, count: number, power: number) {
    this.emit(x, surfaceHeight(x, z, this.biome), z, count, power, false, undefined, true);
    this.ring(x, z, power * 1.15);
  }
  event(e: Event, target?: { x: number; y: number; z: number }, sim?: Simulation) {
    if (sim) this.setBiome(sim.mode === 'hunt' ? sim.hunt.index : 1);
    const wet = isWater(e.x, e.z, this.biome), plane = /PLANE/i.test(e.label ?? '');
    if (e.type === 'splash') this.splash(e.x, e.z, e.power > 20 ? 90 : 38, Math.min(24, 7 + e.power * .3));
    if (e.type === 'water') this.splash(e.x, e.z, 20, 6);
    if (e.type === 'breach') {
      if (wet) this.splash(e.x, e.z, 85, e.power * .4);
      else { this.burst(e.x, e.y, e.z, 85, e.power * .45); this.ring(e.x, e.z, 14); }
    }
    if (e.type === 'slam' || e.type === 'land') {
      if (wet) this.splash(e.x, e.z, e.type === 'slam' ? 140 : 65, e.type === 'slam' ? 21 : 12);
      else { this.burst(e.x, e.y, e.z, e.type === 'slam' ? 140 : 65, e.type === 'slam' ? 21 : 12); this.ring(e.x, e.z, e.type === 'slam' ? 24 : 14); this.scar(e.x, e.z, e.type === 'slam' ? 12 : 6); }
    }
    if (e.type === 'eat') this.burst(e.x, e.y, e.z, 16, 5);
    if (e.type === 'break') this.burst(e.x, e.y, e.z, 20, 13, true, plane ? 0x8ca5a5 : undefined);
    if (e.type === 'shot' && (e.label === 'RIFLE' || e.label === 'ROCKET')) {
      this.burst(e.x, e.y + 1, e.z, 3, 3, false, 0xffce76);
      if (target) {
        const index = this.tracerCursor++ % this.tracerLife.length, n = index * 6;
        this.tracerPositions.set([e.x, e.y + 1, e.z, target.x, target.y + .5, target.z], n); this.tracerLife[index] = .11;
      }
    }
    if (e.type === 'shot' && e.label?.includes('IMPACT')) {
      if (wet) this.splash(e.x, e.z, 45, 11);
      else { this.burst(e.x, e.y, e.z, 45, 11); this.ring(e.x, e.z, 10); this.scar(e.x, e.z, 4); }
    }
    if (e.type === 'hurt') this.burst(e.x, e.y + .8, e.z, 16, 7, false, 0xce704f);
    if (e.type === 'grow') { this.burst(e.x, e.y, e.z, 110, 13, false, colors.ivory); this.ring(e.x, e.z, 26); }
    if (e.type === 'win') {
      this.burst(e.x, e.y, e.z, plane ? 65 : 18, plane ? 20 : 12, true, plane ? 0x778f99 : 0x89613e); this.ring(e.x, e.z, 35);
      const material = this.fragmentMesh.material as THREE.MeshStandardMaterial;
      material.metalness = plane ? .24 : 0; material.roughness = plane ? .54 : .9;
      this.fragments.forEach((p, i) => {
        const a = this.rng() * Math.PI * 2, speed = 3 + this.rng() * (plane ? 16 : 7);
        p.metal = plane;
        p.object.position.set(e.x + Math.sin(a) * this.rng() * (plane ? 8 : 4), e.y + (plane ? 1 : 4) + this.rng() * (plane ? 5 : 12), e.z + Math.cos(a) * this.rng() * 4);
        p.object.rotation.set(this.rng() * 6, this.rng() * 6, this.rng() * 6);
        if (plane) {
          // Long wing panels, narrow propeller blades, then riveted skin slabs.
          if (i < 6) p.object.scale.set(3 + this.rng() * 3, .16 + this.rng() * .15, 1.3 + this.rng() * 1.6);
          else if (i < 18) p.object.scale.set(.23, .18, 2.2 + this.rng() * 2.2);
          else p.object.scale.set(.5 + this.rng() * 1.8, .12 + this.rng() * .23, .5 + this.rng() * 1.4);
        } else p.object.scale.set(.4 + this.rng() * .8, .035, .5 + this.rng() * 1.7);
        this.fragmentMesh.setColorAt(i, this.color.setHex(plane ? (i < 18 ? (i < 6 ? 0xb7c5bf : 0x364851) : i % 4 ? 0x7c999f : colors.rust) : i % 3 ? colors.ivory : colors.rust));
        p.vx = Math.sin(a) * speed; p.vz = Math.cos(a) * speed; p.vy = 4 + this.rng() * (plane ? 12 : 6); p.life = plane ? 7 : 5; p.phase = this.rng() * 6;
      });
      if (this.fragmentMesh.instanceColor) this.fragmentMesh.instanceColor.needsUpdate = true;
      this.fragmentMesh.visible = true;
    }
  }
  update(dt: number, sim?: Simulation) {
    if (sim) {
      this.setBiome(sim.mode === 'hunt' ? sim.hunt.index : 1);
      this.wakeTime += dt; this.rippleTime += dt;
      if (sim.inWater && this.wakeTime >= .075) {
        this.wakeTime = 0;
        const scale = sim.mode === 'hunt' ? sim.hunt.scale : 1, side = this.rng() > .5 ? 1 : -1;
        this.emit(sim.x + Math.cos(sim.yaw) * side * scale, sim.surface(sim.x, sim.z), sim.z + Math.sin(sim.yaw) * side * scale, 4, 1.5 + sim.speed * .15, false, undefined, true);
        if (this.rippleTime > .28) { this.rippleTime = 0; this.ring(sim.x, sim.z, 3 + sim.speed * .22); }
      }
    }
    for (let i = 0; i < this.tracerLife.length; i++) if (this.tracerLife[i] > 0) {
      this.tracerLife[i] -= dt;
      if (this.tracerLife[i] <= 0) this.tracerPositions.fill(0, i * 6, i * 6 + 6);
    }
    this.tracerGeometry.attributes.position.needsUpdate = true;
    let fragmentsAlive = false;
    this.fragments.forEach((p, i) => {
      if (p.life <= 0) return;
      p.life -= dt;
      if (p.life <= 0) { this.fragmentMesh.setMatrixAt(i, this.hidden); return; }
      fragmentsAlive = true; p.vy -= (p.metal ? 18 : 5) * dt; p.vx *= Math.exp(-dt * (p.metal ? .12 : .5)); p.vz *= Math.exp(-dt * (p.metal ? .12 : .5));
      p.object.position.x += (p.vx + (p.metal ? 0 : Math.sin(p.life * 4 + p.phase) * .8)) * dt; p.object.position.z += p.vz * dt; p.object.position.y += p.vy * dt;
      p.object.rotation.x += dt * (p.metal ? 1.4 + p.phase * .3 : 2.3); p.object.rotation.z += (p.metal ? 1 + p.phase * .3 : Math.sin(p.life * 3 + p.phase) * 3) * dt;
      const floor = (p.metal ? terrainHeight(p.object.position.x, p.object.position.z, this.biome) : surfaceHeight(p.object.position.x, p.object.position.z, this.biome)) + .05;
      if (p.object.position.y < floor) { p.object.position.y = floor; p.vy *= p.metal ? -.23 : 0; p.vx *= .8; p.vz *= .8; }
      if (p.life < .6) p.object.scale.multiplyScalar(Math.exp(-dt * 5));
      p.object.updateMatrix(); this.fragmentMesh.setMatrixAt(i, p.object.matrix);
    });
    this.fragmentMesh.visible = fragmentsAlive; this.fragmentMesh.instanceMatrix.needsUpdate = true;
    this.pieces.forEach((p, i) => {
      if (p.life <= 0) return;
      p.life -= dt;
      if (p.life <= 0) { this.particles.setMatrixAt(i, this.hidden); return; }
      p.vy -= 18 * dt; p.object.position.x += p.vx * dt; p.object.position.y += p.vy * dt; p.object.position.z += p.vz * dt;
      p.object.rotation.x += p.spin * dt; p.object.rotation.z += p.spin * dt * .7;
      const x = p.object.position.x, z = p.object.position.z, water = isWater(x, z, this.biome);
      const floor = (p.debris ? terrainHeight(x, z, this.biome) : surfaceHeight(x, z, this.biome)) + .07;
      if (p.object.position.y < floor) {
        if (p.water || (water && !p.debris)) { p.life = 0; this.particles.setMatrixAt(i, this.hidden); return; }
        p.object.position.y = floor; p.vy *= -.25; p.vx *= .85; p.vz *= .85;
      }
      if (p.life < .5) p.object.scale.multiplyScalar(Math.exp(-dt * 5));
      p.object.updateMatrix(); this.particles.setMatrixAt(i, p.object.matrix);
    });
    this.particles.instanceMatrix.needsUpdate = true;
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt; r.mesh.visible = r.life > 0; r.mesh.scale.setScalar(1 + (r.max - r.life) * r.speed);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, r.life / r.max) * (r.water ? .45 : .33);
    }
    for (const p of this.dust) {
      if (p.life <= 0) continue;
      p.life -= dt; p.sprite.visible = p.life > 0;
      p.sprite.position.x += p.vx * dt; p.sprite.position.z += p.vz * dt; p.sprite.position.y += .8 * dt;
      p.sprite.scale.setScalar(p.size * (1 + (p.max - p.life) * .8));
      p.sprite.material.opacity = Math.sin(Math.max(0, p.life / p.max) * Math.PI) * .3;
    }
  }
  clear() {
    this.wakeTime = 0; this.rippleTime = 0;
    this.fragments.forEach((p, i) => { p.life = 0; this.fragmentMesh.setMatrixAt(i, this.hidden); }); this.fragmentMesh.visible = false; this.fragmentMesh.instanceMatrix.needsUpdate = true;
    this.tracerPositions.fill(0); this.tracerLife.fill(0); this.tracerGeometry.attributes.position.needsUpdate = true;
    this.pieces.forEach((p, i) => { p.life = 0; this.particles.setMatrixAt(i, this.hidden); }); this.particles.instanceMatrix.needsUpdate = true;
    for (const r of this.rings) { r.life = 0; r.mesh.visible = false; }
    for (const p of this.dust) { p.life = 0; p.sprite.visible = false; }
    for (const s of this.scars) s.visible = false;
  }
}

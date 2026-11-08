import * as THREE from 'three';
import { colors, geo, mat } from './palette';
import { ground, random } from '../game/math';
import type { Event } from '../game/Simulation';
interface Piece { mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number; max: number; spin: number; }
interface Ring { mesh: THREE.Mesh; life: number; max: number; speed: number; }
export class Effects {
  pieces: Piece[] = [];
  rings: Ring[] = [];
  group = new THREE.Group();
  rng = random(124);
  private cursor = 0; private ringCursor = 0;
  constructor(scene: THREE.Scene) {
    for (let i = 0; i < 360; i++) {
      const mesh = new THREE.Mesh(i % 4 === 0 ? geo.box : geo.ico, mat(i % 4 === 0 ? colors.rust : i % 3 ? colors.sand : colors.ivory));
      mesh.visible = false; mesh.castShadow = i < 100; this.group.add(mesh);
      this.pieces.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, max: 1, spin: 0 });
    }
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(.89, 1, 64), new THREE.MeshBasicMaterial({ color: colors.ivory, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.visible = false; this.group.add(mesh);
      this.rings.push({ mesh, life: 0, max: 1, speed: 1 });
    }
    scene.add(this.group);
  }
  burst(x: number, y: number, z: number, count: number, power: number, debris = false) {
    for (let i = 0; i < count; i++) {
      const p = this.pieces[this.cursor++ % this.pieces.length];
      const a = this.rng() * Math.PI * 2, v = (this.rng() * .7 + .3) * power;
      p.mesh.position.set(x + Math.sin(a) * .8, y + .1 + this.rng(), z + Math.cos(a) * .8);
      p.vx = Math.sin(a) * v; p.vz = Math.cos(a) * v; p.vy = this.rng() * power * .9 + 3;
      p.life = p.max = debris ? 3.4 : 1.1 + this.rng() * 1.1; p.spin = this.rng() * 10;
      p.mesh.scale.setScalar(debris ? .25 + this.rng() * .6 : .07 + this.rng() * .18);
      p.mesh.visible = true;
    }
  }
  ring(x: number, z: number, power: number) {
    const r = this.rings[this.ringCursor++ % this.rings.length];
    r.mesh.position.set(x, ground(x, z) + .13, z); r.life = r.max = 1.1; r.speed = power; r.mesh.visible = true;
  }
  event(e: Event) {
    if (e.type === 'breach') { this.burst(e.x, e.y, e.z, 85, e.power * .45); this.ring(e.x, e.z, 14); }
    if (e.type === 'slam' || e.type === 'land') {
      this.burst(e.x, e.y, e.z, e.type === 'slam' ? 140 : 65, e.type === 'slam' ? 21 : 12); this.ring(e.x, e.z, e.type === 'slam' ? 24 : 14);
    }
    if (e.type === 'eat') this.burst(e.x, e.y, e.z, 16, 5);
    if (e.type === 'break') this.burst(e.x, e.y, e.z, 20, 13, true);
  }
  update(dt: number) {
    for (const p of this.pieces) {
      if (p.life <= 0) continue;
      p.life -= dt; p.mesh.visible = p.life > 0;
      p.vy -= 18 * dt; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += p.spin * dt; p.mesh.rotation.z += p.spin * dt * .7;
      const floor = ground(p.mesh.position.x, p.mesh.position.z) + .12;
      if (p.mesh.position.y < floor) { p.mesh.position.y = floor; p.vy *= -.25; p.vx *= .85; p.vz *= .85; }
      if (p.life < .5) p.mesh.scale.multiplyScalar(Math.exp(-dt * 5));
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt; r.mesh.visible = r.life > 0;
      r.mesh.scale.setScalar(1 + (r.max - r.life) * r.speed);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, r.life / r.max) * .33;
    }
  }
  clear() { for (const p of this.pieces) { p.life = 0; p.mesh.visible = false; } for (const r of this.rings) { r.life = 0; r.mesh.visible = false; } }
}

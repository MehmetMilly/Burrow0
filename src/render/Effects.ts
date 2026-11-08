import * as THREE from 'three';
import { colors, geo, mat } from './palette';
import { ground, random } from '../game/math';
import type { Event } from '../game/Simulation';
interface Piece { object: THREE.Object3D; vx: number; vy: number; vz: number; life: number; spin: number; }
interface Ring { mesh: THREE.Mesh; life: number; max: number; speed: number; }
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
  private cursor = 0; private ringCursor = 0; private dustCursor = 0; private scarCursor = 0;
  private particles: THREE.InstancedMesh; private color = new THREE.Color();
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  constructor(scene: THREE.Scene) {
    // One draw for the entire bounded particle pool, including colored breakaway chunks.
    this.particles = new THREE.InstancedMesh(geo.ico, mat(0xffffff), 360);
    this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.particles.frustumCulled = false;
    for (let i = 0; i < 360; i++) {
      this.particles.setMatrixAt(i, this.hidden); this.particles.setColorAt(i, this.color.setHex(colors.sand));
      this.pieces.push({ object: new THREE.Object3D(), vx: 0, vy: 0, vz: 0, life: 0, spin: 0 });
    }
    this.group.add(this.particles);
    const ringGeometry = new THREE.RingGeometry(.9, 1, 64);
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ color: colors.ivory, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.visible = false; this.group.add(mesh);
      this.rings.push({ mesh, life: 0, max: 1, speed: 1 });
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
    scene.add(this.group);
  }
  burst(x: number, y: number, z: number, count: number, power: number, debris = false) {
    for (let i = 0; i < count; i++) {
      const index = this.cursor++ % this.pieces.length, p = this.pieces[index], a = this.rng() * Math.PI * 2, v = (this.rng() * .7 + .3) * power;
      p.object.position.set(x + Math.sin(a) * .8, y + .1 + this.rng(), z + Math.cos(a) * .8);
      p.vx = Math.sin(a) * v; p.vz = Math.cos(a) * v; p.vy = this.rng() * power * .9 + 3;
      p.life = debris ? 6 : 1.1 + this.rng() * 1.1; p.spin = this.rng() * 10;
      this.particles.setColorAt(index, this.color.setHex(debris ? (i % 2 ? colors.rust : 0xa16d45) : i % 3 ? colors.sand : colors.ivory));
      p.object.scale.setScalar(debris ? .2 + this.rng() * .45 : .035 + this.rng() * .09);
      if (debris) p.object.scale.x *= 1.8;
    }
    if (this.particles.instanceColor) this.particles.instanceColor.needsUpdate = true;
    if (count >= 20) for (let i = 0; i < 4; i++) {
      const p = this.dust[this.dustCursor++ % this.dust.length]; const a = this.rng() * Math.PI * 2;
      p.sprite.position.set(x + Math.sin(a) * 2, y + .8, z + Math.cos(a) * 2);
      p.vx = Math.sin(a) * power * .22; p.vz = Math.cos(a) * power * .22; p.life = p.max = 1.6 + this.rng(); p.size = 3 + power * .22; p.sprite.visible = true;
    }
  }
  ring(x: number, z: number, power: number) {
    const r = this.rings[this.ringCursor++ % this.rings.length];
    r.mesh.position.set(x, ground(x, z) + .13, z); r.life = r.max = 1.1; r.speed = power; r.mesh.visible = true;
  }
  private scar(x: number, z: number, radius: number) {
    const mesh = this.scars[this.scarCursor++ % this.scars.length]; const attr = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (let n = 0; n < attr.count; n++) {
      const px = x + (uv.getX(n) - .5) * radius * 2, pz = z - (uv.getY(n) - .5) * radius * 2;
      attr.setXYZ(n, px, ground(px, pz) + .08, pz);
    }
    attr.needsUpdate = true; mesh.geometry.computeBoundingSphere(); mesh.visible = true;
  }
  event(e: Event) {
    if (e.type === 'breach') { this.burst(e.x, e.y, e.z, 85, e.power * .45); this.ring(e.x, e.z, 14); }
    if (e.type === 'slam' || e.type === 'land') {
      this.burst(e.x, e.y, e.z, e.type === 'slam' ? 140 : 65, e.type === 'slam' ? 21 : 12); this.ring(e.x, e.z, e.type === 'slam' ? 24 : 14);
      this.scar(e.x, e.z, e.type === 'slam' ? 12 : 6);
    }
    if (e.type === 'eat') this.burst(e.x, e.y, e.z, 16, 5);
    if (e.type === 'break') this.burst(e.x, e.y, e.z, 20, 13, true);
  }
  update(dt: number) {
    this.pieces.forEach((p, i) => {
      if (p.life <= 0) return;
      p.life -= dt;
      if (p.life <= 0) { this.particles.setMatrixAt(i, this.hidden); return; }
      p.vy -= 18 * dt; p.object.position.x += p.vx * dt; p.object.position.y += p.vy * dt; p.object.position.z += p.vz * dt;
      p.object.rotation.x += p.spin * dt; p.object.rotation.z += p.spin * dt * .7;
      const floor = ground(p.object.position.x, p.object.position.z) + .07;
      if (p.object.position.y < floor) { p.object.position.y = floor; p.vy *= -.25; p.vx *= .85; p.vz *= .85; }
      if (p.life < .5) p.object.scale.multiplyScalar(Math.exp(-dt * 5));
      p.object.updateMatrix(); this.particles.setMatrixAt(i, p.object.matrix);
    });
    this.particles.instanceMatrix.needsUpdate = true;
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt; r.mesh.visible = r.life > 0; r.mesh.scale.setScalar(1 + (r.max - r.life) * r.speed);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, r.life / r.max) * .33;
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
    this.pieces.forEach((p, i) => { p.life = 0; this.particles.setMatrixAt(i, this.hidden); }); this.particles.instanceMatrix.needsUpdate = true;
    for (const r of this.rings) { r.life = 0; r.mesh.visible = false; }
    for (const p of this.dust) { p.life = 0; p.sprite.visible = false; }
    for (const s of this.scars) s.visible = false;
  }
}

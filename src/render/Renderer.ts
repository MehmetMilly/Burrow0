import * as THREE from 'three';
import { World } from './World';
import { Worm } from './Worm';
import { Effects } from './Effects';
import { ground, damp, clamp } from '../game/math';
import type { Simulation, Event } from '../game/Simulation';

export class GameRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, .15, 2000);
  world: World; worm: Worm; effects: Effects;
  shake = 0; deep = 0; yaw = 0; pitch = .2; menuAge = 0;
  cameraTarget = new THREE.Vector3(); cameraPosition = new THREE.Vector3();
  apexHint: { x: number; y: number; angle: number; distance: number; onScreen: boolean; ready: boolean } | null = null;
  private projected = new THREE.Vector3();
  lastFrameMs = 0; frames: number[] = []; quality = 'high';
  private look = new THREE.Vector3(); private desired = new THREE.Vector3();
  private wakeTime = 0; private shadowTime = 0; private heroScale = 1;
  constructor(canvas: HTMLCanvasElement, sim: Simulation) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.world = new World(this.scene, sim); this.worm = new Worm(this.scene); this.effects = new Effects(this.scene);
    const shadow = new THREE.Mesh(this.world.terrain.geometry, new THREE.ShadowMaterial({ color: 0x493d37, opacity: .22 }));
    shadow.position.y = .045; shadow.receiveShadow = true; this.scene.add(shadow); shadow.userData.groundShadow = true;
    this.cameraPosition.set(5, 14, 59); this.cameraTarget.set(0, 2, 25);
    window.addEventListener('resize', () => this.resize());
  }
  resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); }
  setQuality(q: string) {
    this.quality = q; this.renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'high' ? 1.65 : q === 'medium' ? 1.25 : 1));
    this.renderer.shadowMap.enabled = q !== 'low';
  }
  event(e: Event, sim?: Simulation) {
    this.effects.event(e, sim ? { x: sim.x, y: sim.y, z: sim.z } : undefined);
    if (e.type === 'slam') this.shake = .7;
    else if (e.type === 'land' || e.type === 'breach') this.shake = .24;
    else if (e.type === 'eat') this.shake = .09;
    else if (e.type === 'hurt') this.shake = .42;
    else if (e.type === 'grow' || e.type === 'win') this.shake = .58;
  }
  reset(sim: Simulation, menu = false) {
    this.effects.clear(); this.heroScale = sim.mode === 'hunt' ? sim.hunt.scale : 1; this.world.underground = 0; this.yaw = sim.yaw; this.pitch = .2; this.deep = 0;
    this.cameraPosition.set(sim.x + 3, ground(sim.x, sim.z) + 10 * this.heroScale, sim.z + 21 * this.heroScale);
    this.cameraTarget.set(sim.x, sim.y + 2, sim.z - 8); this.shake = 0;
    if (menu) {
      const fx = Math.sin(sim.yaw), fz = -Math.cos(sim.yaw), rx = Math.cos(sim.yaw), rz = Math.sin(sim.yaw);
      this.cameraPosition.set(sim.x - fx * 5 - rx * 25, ground(sim.x, sim.z) + 9 + Math.max(0, sim.y - ground(sim.x, sim.z)) * .65, sim.z - fz * 5 - rz * 25);
      this.cameraTarget.set(sim.x - fx * 6, sim.y - 2, sim.z - fz * 6);
    }
  }
  update(sim: Simulation, dt: number, menu: boolean) {
    this.world.update(sim, dt); this.worm.update(sim, dt); this.effects.update(dt);
    this.heroScale = damp(this.heroScale, sim.mode === 'hunt' ? sim.hunt.scale : 1, 2.6, dt);
    const scale = this.heroScale;
    this.deep = damp(this.deep, sim.deep ? 1 : 0, sim.deep ? 3.5 : 7, dt);
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const floor = ground(sim.x, sim.z), altitude = Math.max(0, sim.y - floor);
    if (menu) {
      this.menuAge += dt;
      const rx = Math.cos(sim.yaw), rz = Math.sin(sim.yaw), center = this.worm.segments[9].position;
      this.desired.set(center.x - rx * 26 * scale, Math.max(floor + 8 * scale, center.y + 7 * scale), center.z - rz * 26 * scale);
      this.look.set(center.x, Math.max(floor + 1, center.y + 1), center.z);
      this.camera.setViewOffset(innerWidth, innerHeight, -innerWidth * .24, 0, innerWidth, innerHeight);
      this.camera.fov = damp(this.camera.fov, 48, 3, dt);
    } else {
      this.camera.clearViewOffset();
      const distance = (21 + sim.speed * .12) * scale + altitude * .18;
      this.desired.set(sim.x - f.x * distance, floor + 9 * scale + altitude * .68 + this.pitch * 13 * scale, sim.z - f.z * distance);
      this.look.set(sim.x + f.x * 8 * scale, floor + scale + altitude * .65 - this.pitch * 6 * scale, sim.z + f.z * 8 * scale);
      const underY = sim.y + 3.3 * scale, underLookY = sim.y + .8 * scale;
      this.desired.y = this.desired.y * (1 - this.deep) + underY * this.deep;
      this.look.y = this.look.y * (1 - this.deep) + underLookY * this.deep;
      if (this.deep < .35) this.desired.y = Math.max(this.desired.y, ground(this.desired.x, this.desired.z) + 3.6 * scale);
      this.camera.fov = damp(this.camera.fov, sim.lungeCooldown > 1.1 ? 66 : 56 + clamp((sim.speed - 16) / 20) * 6, 4, dt);
    }
    this.cameraPosition.lerp(this.desired, 1 - Math.exp(-dt * (sim.state === 'air' ? 4.5 : 6)));
    this.cameraTarget.lerp(this.look, 1 - Math.exp(-dt * 7)); this.camera.position.copy(this.cameraPosition);
    this.shake *= Math.exp(-dt * 8);
    this.camera.position.x += (Math.random() - .5) * this.shake; this.camera.position.y += (Math.random() - .5) * this.shake;
    this.camera.lookAt(this.cameraTarget); this.camera.updateProjectionMatrix();
    const sun = this.scene.userData.sun as THREE.DirectionalLight;
    this.shadowTime += dt;
    if (this.shadowTime > .2) { this.shadowTime = 0; sun.position.set(sim.x - 90, floor + 120, sim.z - 80); sun.target.position.set(sim.x, floor, sim.z); sun.target.updateMatrixWorld(); }
    this.wakeTime += dt;
    if (this.wakeTime > .075 && sim.depth < 2.7 && sim.state !== 'air' && this.quality !== 'low') {
      this.wakeTime = 0; this.effects.burst(sim.x, floor - .3, sim.z, 2, sim.speed * .07);
    }
    if (sim.state === 'air' && this.quality !== 'low' && Math.random() < dt * 35) {
      const tail = this.worm.segments[6].position; this.effects.burst(tail.x, tail.y, tail.z, 1, 1);
    }
    this.scene.children.forEach(o => { if (o.userData.groundShadow) o.visible = this.deep < .5 && this.quality !== 'low'; });
    const apex = sim.mode === 'hunt' && sim.hunt.status === 'active' && !sim.deep ? sim.prey.find(p => p.kind === 'balloon' && p.alive) : undefined;
    this.apexHint = null;
    if (apex) {
      this.projected.set(apex.x, apex.y + 1, apex.z).project(this.camera);
      let px = (this.projected.x * .5 + .5) * innerWidth, py = (-this.projected.y * .5 + .5) * innerHeight;
      const front = this.projected.z < 1;
      if (!front) { px = innerWidth - px; py = innerHeight - py; }
      this.apexHint = { x: clamp(px, 90, innerWidth - 90), y: clamp(py, 115, innerHeight - 130),
        angle: Math.atan2(py - innerHeight / 2, px - innerWidth / 2), onScreen: front && px > 60 && px < innerWidth - 60 && py > 90 && py < innerHeight - 80,
        distance: Math.hypot(apex.x - sim.x, apex.z - sim.z), ready: sim.hunt.apexReady };
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this.renderer.dispose(); }
}

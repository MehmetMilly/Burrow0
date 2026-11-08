import * as THREE from 'three';
import { colors, geo, mat, mesh } from './palette';
import { ground, damp } from '../game/math';
import type { Simulation } from '../game/Simulation';

const forward = new THREE.Vector3(0, 0, 1);
const point = new THREE.Vector3(), tangent = new THREE.Vector3();
export class Worm {
  group = new THREE.Group();
  segments: THREE.Group[] = [];
  jaws: THREE.Group[] = [];
  ghosts: THREE.Mesh[] = [];
  open = 0;
  constructor(scene: THREE.Scene) {
    const shell = new THREE.SphereGeometry(1, 18, 12);
    const collar = new THREE.TorusGeometry(.87, .16, 6, 20, Math.PI * 1.5);
    for (let i = 0; i < 23; i++) {
      const g = new THREE.Group();
      const taper = i < 3 ? 1 - i * .015 : Math.pow(1 - (i - 3) / 21, .65);
      const radius = (i === 0 ? 1.05 : .94) * taper;
      g.scale.setScalar(radius);
      mesh(g, shell, i % 3 === 0 ? colors.ink : colors.blue, [0, 0, 0], [1, .93, .72]);
      const c = mesh(g, collar, colors.ink, [0, .04, .25], [1, 1, 1]); c.rotation.z = -Math.PI * .25;
      mesh(g, geo.sphere, 0xbc9570, [0, -.5, .04], [.78, .4, .58]);
      if (i > 0) {
        mesh(g, geo.cone, colors.ivory, [0, 1, -.1], [.21, .65, .25], [-.3, 0, 0]);
        for (const sign of [-1, 1]) mesh(g, geo.cone, colors.ink, [sign * .82, .45, -.1], [.16, .45, .2], [0, 0, -sign * .7]);
      }
      this.group.add(g); this.segments.push(g);
      const ghost = new THREE.Mesh(geo.sphere, new THREE.MeshBasicMaterial({ color: colors.ink, transparent: true, opacity: .22, depthWrite: false }));
      ghost.scale.set(radius * .83, .08, radius * .8); this.group.add(ghost); this.ghosts.push(ghost);
    }
    const head = this.segments[0];
    const voidMaw = new THREE.Mesh(new THREE.CircleGeometry(.79, 28), mat(0x2e2026)); voidMaw.position.z = .72; head.add(voidMaw);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(.48, .1, 6, 24), mat(0xb45d44)); inner.position.z = .77; head.add(inner);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const pivot = new THREE.Group(); pivot.position.set(Math.sin(a) * .7, Math.cos(a) * .7, .47); pivot.rotation.z = -a;
      mesh(pivot, geo.sphere, colors.ink, [0, .13, .28], [.36, .32, .55]);
      mesh(pivot, geo.cone, colors.ivory, [0, -.05, .7], [.15, .52, .15], [Math.PI / 2 + .35, 0, 0]);
      head.add(pivot); this.jaws.push(pivot);
      const tooth = mesh(head, geo.cone, colors.ivory, [Math.sin(a) * .43, Math.cos(a) * .43, .8], [.07, .27, .07], [Math.PI / 2, 0, -a]); tooth.rotation.x = Math.PI / 2;
    }
    for (const sign of [-1, 1]) {
      mesh(head, geo.sphere, colors.coral, [sign * .87, .3, .4], [.12, .1, .1]);
      mesh(head, geo.cone, colors.ivory, [sign * .65, .91, -.1], [.18, .7, .16], [-.45, 0, -sign * .3]);
    }
    scene.add(this.group);
  }
  update(sim: Simulation, dt: number) {
    this.open = damp(this.open, Math.max(sim.mouth, sim.state === 'air' ? .55 : .05), 12, dt);
    this.jaws.forEach(j => { j.rotation.x = -.2 - this.open * .75; });
    let sample = 0, length = 0;
    const h = sim.history;
    for (let i = 0; i < this.segments.length; i++) {
      const wanted = i * .65;
      while (sample < h.length - 2) {
        const d = Math.hypot(h[sample + 1].x - h[sample].x, h[sample + 1].y - h[sample].y, h[sample + 1].z - h[sample].z);
        if (length + d >= wanted) break;
        length += d; sample++;
      }
      const a = h[sample], b = h[sample + 1] ?? a;
      const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1;
      const t = Math.min(1, Math.max(0, (wanted - length) / d));
      point.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
      const g = this.segments[i]; g.position.copy(point);
      if (i === 0) tangent.set(Math.sin(sim.yaw) * Math.cos(sim.pitch), Math.sin(sim.pitch), -Math.cos(sim.yaw) * Math.cos(sim.pitch));
      else tangent.set(a.x - b.x, a.y - b.y, a.z - b.z).normalize();
      if (tangent.lengthSq() > .01) g.quaternion.setFromUnitVectors(forward, tangent);
      const ghost = this.ghosts[i]; ghost.position.set(point.x, ground(point.x, point.z) + .06, point.z);
      const surface = ground(point.x, point.z), depth = surface - point.y;
      ghost.visible = !sim.deep && depth > .15 && depth < 4;
      (ghost.material as THREE.MeshBasicMaterial).opacity = .22 * Math.max(0, 1 - depth / 4);
      g.visible = depth < .9 || sim.deep;
    }
  }
}

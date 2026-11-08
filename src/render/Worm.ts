import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { colors, geo, mat, mesh } from './palette';
import { ground, damp } from '../game/math';
import type { Simulation } from '../game/Simulation';

const point = new THREE.Vector3(), tangent = new THREE.Vector3(), normal = new THREE.Vector3();
const transform = new THREE.Matrix4(), local = new THREE.Object3D();
const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
const bodyCount = 23, sides = 16;
type Attachment = { segment: number; local: THREE.Matrix4; jaw?: number };
type Batch = { mesh: THREE.InstancedMesh; attachments: Attachment[] };

// A cupped, thick carapace. Its narrow leading edge slides under the next plate;
// the bevel at the trailing edge catches the sun without an extra trim mesh.
function carapace() {
  const profile = [[.46, .79], [.25, .93], [-.10, 1.025], [-.31, 1.04], [-.38, 1.005], [-.31, .945], [.16, .86], [.41, .75]];
  const positions: number[] = [], indices: number[] = [], tint: number[] = [];
  const angular = 24, top = new THREE.Color(0x527378), flank = new THREE.Color(0x28454d), edge = new THREE.Color(0x80958c);
  for (let p = 0; p < profile.length; p++) {
    const [z, radius] = profile[p];
    for (let j = 0; j <= angular; j++) {
      const a = -2.55 + j / angular * 5.1;
      const flute = 1 + .025 * Math.cos(a * 6);
      positions.push(Math.sin(a) * radius * flute, Math.cos(a) * radius * .93, z + Math.cos(a * 2) * .045);
      const c = flank.clone().lerp(top, Math.max(0, Math.cos(a)) * .85);
      if (p === 3) c.lerp(edge, .8);
      if (p > 4) c.multiplyScalar(.66);
      tint.push(c.r, c.g, c.b);
    }
  }
  for (let p = 0; p < profile.length; p++) {
    const next = (p + 1) % profile.length;
    for (let j = 0; j < angular; j++) {
      const a = p * (angular + 1) + j, b = next * (angular + 1) + j;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  // Close the exposed edges beside the soft belly.
  for (const j of [0, angular]) for (let p = 1; p < profile.length - 1; p++) {
    const a = j, b = p * (angular + 1) + j, c = (p + 1) * (angular + 1) + j;
    indices.push(...(j === 0 ? [a, b, c] : [a, c, b]));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function sweptFin() {
  const shape = new THREE.Shape();
  shape.moveTo(-.48, .82); shape.lineTo(-.43, 1.43);
  shape.quadraticCurveTo(-.17, 1.37, -.02, 1.1); shape.lineTo(.35, .82); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .11, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 1, steps: 1, curveSegments: 4 });
  geometry.rotateY(-Math.PI / 2); geometry.translate(.055, 0, 0); return geometry;
}

// A curved ivory hook, with its root at the origin and its point toward the maw.
function tooth() {
  const positions: number[] = [], indices: number[] = [];
  const rings = 6, radial = 8;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, radius = .105 * Math.pow(1 - t, .8) + .002;
    for (let j = 0; j < radial; j++) {
      const a = j / radial * Math.PI * 2;
      positions.push(Math.cos(a) * radius, -.43 * t, .23 * t * t + Math.sin(a) * radius);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial;
    indices.push(a, b, a + radial, b, b + radial, a + radial);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

// Each petal has a hard outer face and a warm fleshy inner face, rather than
// eight unrelated spheres. The forward tip curls inward when the jaws close.
function petal() {
  const positions: number[] = [], tint: number[] = [], indices: number[] = [];
  const widths = [.25, .36, .40, .32, .17, .015], rings = widths.length, radial = 12;
  const shell = new THREE.Color(0x345860), ridge = new THREE.Color(0x698380), flesh = new THREE.Color(0xa05d48);
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1), center = .10 * Math.sin(t * Math.PI) - .34 * t * t * t;
    for (let j = 0; j < radial; j++) {
      const a = j / radial * Math.PI * 2, upper = Math.sin(a);
      positions.push(Math.cos(a) * widths[i], center + upper * (.12 * Math.sin(Math.PI * t) + .055), t * .98);
      const c = upper < -.1 ? flesh.clone().multiplyScalar(.86 + .14 * t) : shell.clone().lerp(ridge, Math.pow(Math.max(0, upper), 5) * .65);
      tint.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial;
    indices.push(a, b, a + radial, b, b + radial, a + radial);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function bake(source: THREE.Group) {
  source.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>(), result = new THREE.Group();
  source.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const material = o.material as THREE.Material;
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material)!.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
  });
  buckets.forEach((geometries, material) => {
    const part = new THREE.Mesh(mergeGeometries(geometries), material); part.castShadow = true; part.receiveShadow = true; result.add(part);
    geometries.forEach(g => g.dispose());
  });
  return result;
}

export class Worm {
  group = new THREE.Group();
  segments: THREE.Group[] = [];
  jaws: THREE.Group[] = [];
  open = 0;
  private batches: Batch[] = [];
  private radii: number[] = [];
  private skin: THREE.Mesh;
  private skinPositions: THREE.BufferAttribute;
  private skinNormals: THREE.BufferAttribute;
  private ghosts: THREE.InstancedMesh;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < bodyCount; i++) {
      const radius = i === 0 ? 1.12 : i < 4 ? 1.035 - i * .013 : .98 * Math.pow((bodyCount - 1 - i) / (bodyCount - 5), .7) + .035;
      const segment = new THREE.Group(); segment.scale.set(radius, radius, .86 + radius * .14);
      this.group.add(segment); this.segments.push(segment); this.radii.push(radius);
    }
    const plateMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .61, metalness: .08, side: THREE.DoubleSide });
    const plates = this.batch(carapace(), plateMaterial);
    const fins = this.batch(sweptFin(), mat(0x29434c, .62, .04));
    const belly = this.batch(geo.sphere, mat(0x9b7c61, .88));
    for (let i = 1; i < bodyCount; i++) {
      this.attach(plates, i);
      this.attach(belly, i, [0, -.61, -.01], [.79, .27, .43]);
      if (i < bodyCount - 2) this.attach(fins, i, [0, 0, -.04], [1, i < 5 ? 1 : .87, .92]);
    }

    // One continuous body under the sliding plates keeps tight bends and the
    // narrow tail watertight. Analytic normals avoid rebuilding them each frame.
    const geometry = new THREE.BufferGeometry(), positions = new Float32Array((bodyCount + 1) * (sides + 1) * 3);
    const normals = new Float32Array(positions.length), tint: number[] = [], indices: number[] = [];
    const upper = new THREE.Color(0x213b43), lower = new THREE.Color(0x99755c);
    for (let i = 0; i <= bodyCount; i++) for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2, c = upper.clone().lerp(lower, Math.max(0, -Math.cos(a)) * .9);
      tint.push(c.r, c.g, c.b);
      if (i < bodyCount && j < sides) {
        const v = i * (sides + 1) + j;
        indices.push(v, v + 1, v + sides + 1, v + 1, v + sides + 2, v + sides + 1);
      }
    }
    this.skinPositions = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.skinNormals = new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.skinPositions); geometry.setAttribute('normal', this.skinNormals);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3)); geometry.setIndex(indices);
    this.skin = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86 }));
    this.skin.castShadow = true; this.skin.receiveShadow = true; this.skin.frustumCulled = false; this.group.add(this.skin);

    const head = this.segments[0], sculpture = new THREE.Group();
    const headShell = new THREE.LatheGeometry([new THREE.Vector2(.86, -.74), new THREE.Vector2(1, -.35), new THREE.Vector2(1.015, -.02), new THREE.Vector2(.89, .38), new THREE.Vector2(.745, .68)], 32);
    headShell.rotateX(Math.PI / 2);
    mesh(sculpture, headShell, 0x2a4850, [0, 0, 0], [1, .96, 1]);
    const lip = new THREE.TorusGeometry(.745, .105, 8, 32);
    mesh(sculpture, lip, 0x7f4a3b, [0, 0, .68], [1, 1, 1]);
    mesh(sculpture, new THREE.TorusGeometry(.54, .052, 6, 32), 0x9c5e49, [0, 0, .43], [1, 1, 1]);
    mesh(sculpture, new THREE.TorusGeometry(.33, .038, 6, 24), 0x6e3d35, [0, 0, .17], [1, 1, 1]);
    for (const sign of [-1, 1]) {
      mesh(sculpture, geo.sphere, colors.dark, [sign * .88, .26, .20], [.15, .13, .27]);
      mesh(sculpture, geo.sphere, colors.coral, [sign * 1.005, .27, .24], [.035, .052, .13]);
      mesh(sculpture, geo.sphere, 0x4d6970, [sign * .79, .43, .10], [.25, .13, .41], [0, 0, sign * .35]);
      mesh(sculpture, geo.sphere, 0x42636b, [sign * .87, -.25, .04], [.21, .30, .39], [0, sign * .23, 0]);
    }
    head.add(bake(sculpture));
    const cavity = new THREE.LatheGeometry([new THREE.Vector2(.20, -.04), new THREE.Vector2(.34, .14), new THREE.Vector2(.55, .42), new THREE.Vector2(.745, .68)], 32);
    cavity.rotateX(Math.PI / 2);
    const throat = new THREE.Mesh(cavity, new THREE.MeshStandardMaterial({ color: 0x39262c, roughness: 1, side: THREE.BackSide })); head.add(throat);
    const darkness = new THREE.Mesh(new THREE.CircleGeometry(.22, 24), mat(0x160f16)); darkness.position.z = -.035; head.add(darkness);

    const hooks = this.batch(tooth(), mat(colors.ivory, .53));
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2;
      this.attach(hooks, 0, [Math.sin(a) * .66, Math.cos(a) * .66, .62], [.69, .73, .73], [0, 0, -a]);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i + .5) / 12 * Math.PI * 2;
      this.attach(hooks, 0, [Math.sin(a) * .43, Math.cos(a) * .43, .32], [.43, .49, .51], [0, 0, -a]);
    }
    const petals = this.batch(petal(), plateMaterial);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const pivot = new THREE.Group(); pivot.rotation.order = 'ZYX'; pivot.position.set(Math.sin(a) * .73, Math.cos(a) * .73, .30); pivot.rotation.z = -a;
      head.add(pivot); this.jaws.push(pivot);
      this.attach(petals, 0, [0, 0, 0], [1, 1, 1], [0, 0, 0], i);
      this.attach(hooks, 0, [0, -.12, .72], [1.2, 1.15, 1.1], [0, 0, 0], i);
      for (const side of [-1, 1]) this.attach(hooks, 0, [side * .23, -.035, .43], [.55, .69, .65], [0, 0, -side * .2], i);
    }
    // The crest grows out of the head armor, swept back with the body ridges.
    for (const sign of [-1, 1]) this.attach(fins, 0, [sign * .46, -.08, -.28], [.95, .9, 1.1], [0, 0, -sign * .3]);
    this.finishBatches();

    this.ghosts = new THREE.InstancedMesh(geo.sphere, new THREE.MeshBasicMaterial({ color: colors.ink, transparent: true, opacity: .26, depthWrite: false, depthTest: false }), bodyCount);
    this.ghosts.renderOrder = 2; this.ghosts.frustumCulled = false; this.ghosts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.ghosts);
    scene.add(this.group);
  }

  private batch(geometry: THREE.BufferGeometry, material: THREE.Material): Batch {
    // Allocate once after all attachments have been authored.
    const batch = { mesh: new THREE.InstancedMesh(geometry, material, 1), attachments: [] as Attachment[] };
    this.batches.push(batch); return batch;
  }
  private attach(batch: Batch, segment: number, position: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1], rotation: [number, number, number] = [0, 0, 0], jaw?: number) {
    local.position.set(...position); local.scale.set(...scale); local.rotation.set(...rotation); local.updateMatrix();
    batch.attachments.push({ segment, local: local.matrix.clone(), jaw });
  }
  private finishBatches() {
    for (const batch of this.batches) {
      const placeholder = batch.mesh;
      batch.mesh = new THREE.InstancedMesh(placeholder.geometry, placeholder.material, batch.attachments.length);
      placeholder.dispose(); batch.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.mesh.castShadow = true; batch.mesh.receiveShadow = true; batch.mesh.frustumCulled = false; this.group.add(batch.mesh);
    }
  }

  update(sim: Simulation, dt: number) {
    this.open = damp(this.open, Math.max(sim.mouth, sim.state === 'air' ? .62 : .10), 12, dt);
    this.jaws.forEach(j => { j.rotation.x = .04 - this.open * 1.03; j.updateMatrix(); });
    let sample = 0, length = 0;
    const h = sim.history;
    for (let i = 0; i < this.segments.length; i++) {
      const wanted = i * .63;
      while (sample < h.length - 2) {
        const d = Math.hypot(h[sample + 1].x - h[sample].x, h[sample + 1].y - h[sample].y, h[sample + 1].z - h[sample].z);
        if (length + d >= wanted) break;
        length += d; sample++;
      }
      const a = h[sample], b = h[sample + 1] ?? a;
      const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1;
      const t = Math.min(1, Math.max(0, (wanted - length) / d));
      this.segments[i].position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    }
    for (let i = 0; i < this.segments.length; i++) {
      const g = this.segments[i];
      if (i === 0) tangent.set(Math.sin(sim.yaw) * Math.cos(sim.pitch), Math.sin(sim.pitch), -Math.cos(sim.yaw) * Math.cos(sim.pitch));
      else tangent.subVectors(this.segments[Math.max(0, i - 1)].position, this.segments[Math.min(bodyCount - 1, i + 1)].position).normalize();
      if (tangent.lengthSq() > .01) {
        // Preserve a stable dorsal up direction through north-facing slopes.
        // The shortest +Z quaternion can roll the belly upward near -Z.
        g.rotation.set(-Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z)), Math.atan2(tangent.x, tangent.z), 0, 'YXZ');
      }
      g.updateMatrix();
      const surface = ground(g.position.x, g.position.z), depth = surface - g.position.y;
      g.visible = depth < 1.65 || sim.deep;
      if (!sim.deep && depth > .15 && depth < 4) {
        local.position.set(g.position.x, surface + .06, g.position.z); local.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
        local.scale.set(this.radii[i] * .92 * (1 - depth * .07), .045, .48); local.updateMatrix(); this.ghosts.setMatrixAt(i, local.matrix);
      } else this.ghosts.setMatrixAt(i, hidden);
    }
    for (const batch of this.batches) {
      batch.attachments.forEach((attachment, index) => {
        const g = this.segments[attachment.segment];
        if (!g.visible) { batch.mesh.setMatrixAt(index, hidden); return; }
        transform.copy(g.matrix);
        if (attachment.jaw !== undefined) transform.multiply(this.jaws[attachment.jaw].matrix);
        transform.multiply(attachment.local); batch.mesh.setMatrixAt(index, transform);
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    this.ghosts.instanceMatrix.needsUpdate = true;
    for (let i = 0; i <= bodyCount; i++) {
      const g = this.segments[Math.min(i, bodyCount - 1)], radius = i === bodyCount ? .004 : this.radii[i] * .86;
      for (let j = 0; j <= sides; j++) {
        const a = j / sides * Math.PI * 2, index = i * (sides + 1) + j;
        normal.set(Math.sin(a), Math.cos(a), 0).applyQuaternion(g.quaternion);
        point.set(Math.sin(a) * radius, Math.cos(a) * radius * .91, i === bodyCount ? -.5 : 0).applyQuaternion(g.quaternion).add(g.position);
        this.skinPositions.setXYZ(index, point.x, point.y, point.z); this.skinNormals.setXYZ(index, normal.x, normal.y, normal.z);
      }
    }
    this.skinPositions.needsUpdate = true; this.skinNormals.needsUpdate = true;
  }
}

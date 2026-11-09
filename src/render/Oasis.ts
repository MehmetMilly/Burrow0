import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { geo, mat, mesh, colors } from './palette';
import { random } from '../game/math';
import { BIOME_GLSL, isWater, OASIS_HOMES, OASIS_RUNWAY, OASIS_WATER_LEVEL, terrainHeight } from '../game/biomes';

export type OasisMotion = 'propeller' | 'cartWheel' | 'dish';

// Every sculpture is merged by material before it enters the scene.
function bake(source: THREE.Group) {
  source.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  source.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const material = o.material as THREE.Material;
    if (!buckets.has(material)) buckets.set(material, []);
    const geometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    buckets.get(material)!.push(geometry.applyMatrix4(o.matrixWorld));
  });
  const out = new THREE.Group();
  buckets.forEach((geometries, material) => {
    const part = new THREE.Mesh(mergeGeometries(geometries), material);
    part.castShadow = !material.transparent; part.receiveShadow = true; out.add(part);
    geometries.forEach(g => g.dispose());
  });
  return out;
}
function animate(out: THREE.Group, source: THREE.Group, motion: string, pivot: [number, number, number], phase = 0) {
  for (const part of bake(source).children as THREE.Mesh[]) {
    part.geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
    part.userData = { motion, pivot, phase }; out.add(part);
  }
}
function spar(parent: THREE.Group, color: number, a: [number, number, number], b: [number, number, number], width: number) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  const part = new THREE.Mesh(geo.cylinder, mat(color)); part.position.copy(start.add(end).multiplyScalar(.5));
  part.scale.set(width, delta.length(), width); part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); parent.add(part);
}
function arch(width: number, height: number, depth: number) {
  const s = new THREE.Shape(), r = width / 2;
  s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, height - r); s.absarc(0, height - r, r, 0, Math.PI, false); s.lineTo(-r, 0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
}
function wing(points: number[][], thickness: number) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 1 });
  geometry.rotateX(Math.PI / 2); return geometry;
}

export function oasisPreyModel(kind: string): THREE.Group | undefined {
  if (!['civilian', 'marketCart', 'building', 'sonarDrone', 'plane'].includes(kind)) return;
  const body = new THREE.Group(), moving: { group: THREE.Group; motion: string; pivot: [number, number, number]; phase: number }[] = [];
  const limb = (motion: string, pivot: [number, number, number], phase = 0) => {
    const group = new THREE.Group(); moving.push({ group, motion, pivot, phase }); return group;
  };
  if (kind === 'civilian') {
    mesh(body, geo.cone, 0xe7dcc3, [0, 1.05, 0], [.48, 1.2, .36]);
    mesh(body, geo.sphere, 0xd0a078, [0, 1.96, -.02], [.28, .34, .27]);
    mesh(body, geo.sphere, 0xf1e8cb, [0, 2.19, .01], [.35, .2, .34]);
    mesh(body, geo.cylinder, 0xf1e8cb, [0, 2.12, 0], [.36, .12, .35]);
    mesh(body, geo.box, 0x43867d, [0, 1.5, -.25], [.72, .19, .12], [0, 0, -.2]);
    mesh(body, geo.box, 0xb77a53, [.32, 1.02, .23], [.29, .5, .23], [0, 0, -.2]);
    for (const s of [-1, 1]) {
      mesh(body, geo.sphere, colors.dark, [s * .11, 2.02, -.27], [.04, .04, .025]);
      const leg = limb('personLeg', [s * .2, .83, 0], s);
      mesh(leg, geo.cylinder, 0x766c54, [s * .2, .47, 0], [.12, .72, .12]);
      mesh(leg, geo.box, 0x5e4c3f, [s * .2, .12, -.09], [.28, .2, .41]);
      const arm = limb('personArm', [s * .4, 1.54, 0], s);
      mesh(arm, geo.cylinder, 0xe7dcc3, [s * .46, 1.2, 0], [.14, .65, .14], [0, 0, s * .12]);
      mesh(arm, geo.sphere, 0xd0a078, [s * .51, .85, 0], [.14, .16, .13]);
    }
  } else if (kind === 'marketCart') {
    mesh(body, geo.box, 0x77523e, [0, .95, 0], [2.5, .3, 3.5]);
    mesh(body, geo.box, 0xb17b50, [0, 1.3, .15], [2.45, .5, 2.65]);
    for (const s of [-1, 1]) {
      const wheel = limb('cartWheel', [s * 1.36, .68, .55]);
      mesh(wheel, geo.cylinder, 0x4d4940, [s * 1.36, .68, .55], [.69, .22, .69], [0, 0, Math.PI / 2]);
      mesh(wheel, geo.cylinder, 0xcfa875, [s * 1.49, .68, .55], [.52, .03, .52], [0, 0, Math.PI / 2]);
      for (const a of [0, Math.PI / 3, -Math.PI / 3]) mesh(wheel, geo.box, 0x77523e, [s * 1.52, .68, .55], [.04, .98, .09], [a, 0, 0]);
      spar(body, 0x77523e, [s * .9, 1, -.9], [s * .9, .6, -2.9], .08);
      for (const z of [-1.3, 1.45]) mesh(body, geo.cylinder, 0x80644b, [s * 1.1, 2.04, z], [.07, 2.4, .07]);
    }
    for (let i = 0; i < 8; i++) mesh(body, geo.box, i % 2 ? 0xf0dfba : 0xc96142, [-1.2 + i * .34, 3.32, .1], [.35, .12, 3.35], [.08, 0, 0]);
    for (let i = 0; i < 8; i++) mesh(body, geo.box, i % 2 ? 0xf0dfba : 0xc96142, [-1.2 + i * .34, 3.12, -1.58], [.35, .38, .09]);
    for (let i = 0; i < 12; i++) mesh(body, geo.sphere, i % 3 ? 0xd3a24b : 0x7b924c, [((i % 3) - 1) * .65, 1.7 + Math.floor(i / 9) * .22, -.8 + (Math.floor(i / 3) % 3) * .72], [.29, .26, .29]);
  } else if (kind === 'building') {
    // The entire house is the interactive entity, including its awning and roof furniture.
    mesh(body, geo.box, 0xe3cfa5, [0, 3.25, 0], [9.2, 6.5, 8]);
    mesh(body, geo.box, 0xf0dfbc, [0, .35, 0], [9.6, .7, 8.4]);
    mesh(body, geo.box, 0xd1ae82, [0, 6.48, 0], [9.65, .28, 8.45]);
    for (const s of [-1, 1]) {
      mesh(body, geo.box, 0xefe1c1, [s * 4.55, 6.98, 0], [.28, .86, 8.4]);
      mesh(body, geo.box, 0xefe1c1, [0, 6.98, s * 4.02], [9.3, .86, .28]);
      for (const z of [-2.3, 1.8]) {
        mesh(body, geo.box, 0x92714e, [s * 4.64, 3.8, z], [.12, 1.8, 1.4]);
        mesh(body, geo.box, 0x376d68, [s * 4.72, 3.8, z], [.09, 1.52, 1.15]);
        for (let k = 0; k < 4; k++) mesh(body, geo.box, 0xc3bda0, [s * 4.78, 3.27 + k * .34, z], [.07, .08, 1.23]);
      }
      mesh(body, geo.box, 0xd4b58a, [s * 3.1, 2.4, -4.08], [1.65, 2.4, .16]);
      mesh(body, geo.box, 0x44857b, [s * 3.1, 2.55, -4.19], [1.25, 1.5, .12]);
      mesh(body, geo.cylinder, 0x80644b, [s * 3.2, 1.8, -6.2], [.075, 3.6, .075]);
    }
    const door = new THREE.Mesh(arch(1.8, 3.4, .12), mat(0x275955)); door.position.set(0, .1, -4.16); door.rotation.y = Math.PI; body.add(door);
    mesh(body, geo.box, 0xcea774, [0, .22, -4.6], [2.6, .44, 1.2]);
    for (let i = 0; i < 10; i++) mesh(body, geo.box, i % 2 ? 0xf0dfbc : 0x438d84, [-3.33 + i * .74, 3.55, -5.1], [.75, .13, 2.65], [-.12, 0, 0]);
    for (let i = 0; i < 10; i++) mesh(body, geo.box, i % 2 ? 0xf0dfbc : 0x438d84, [-3.33 + i * .74, 3.18, -6.4], [.75, .5, .09]);
    mesh(body, geo.box, 0xd5b88e, [2.2, 7.48, 1.6], [2.4, 1.75, 2.6]);
    mesh(body, geo.box, 0xe8d4ad, [2.2, 8.43, 1.6], [2.65, .23, 2.85]);
    mesh(body, geo.cylinder, 0x9f6849, [-2.6, 7.2, 2], [.52, 1.2, .52]);
    mesh(body, geo.cylinder, 0xe8d4ad, [-2.6, 7.82, 2], [.61, .13, .61]);
    for (let i = 0; i < 5; i++) mesh(body, geo.box, 0x9e7754, [-3.5 + i * 1.75, 5.8, -4.25], [.2, .27, .9]);
  } else if (kind === 'sonarDrone') {
    mesh(body, geo.sphere, 0xe8dfbd, [0, 0, 0], [1.25, .6, 1.25]);
    mesh(body, geo.cylinder, 0x37575a, [0, -.45, 0], [.8, .35, .8]);
    mesh(body, geo.sphere, 0x63c6bf, [0, -.74, 0], [.43, .35, .43]);
    mesh(body, geo.box, 0xc06b43, [0, .5, 0], [.75, .3, 1.45]);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, x = Math.sin(a) * 2.5, z = Math.cos(a) * 2.5;
      spar(body, colors.dark, [0, 0, 0], [x, .1, z], .13);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.95, .09, 5, 20), mat(0xd9cfb0)); ring.rotation.x = Math.PI / 2; ring.position.set(x, .1, z); body.add(ring);
      const rotor = limb('rotor', [x, .1, z]);
      for (const r of [0, Math.PI / 2]) mesh(rotor, geo.box, colors.dark, [x, .12, z], [1.65, .055, .11], [0, r, 0]);
      mesh(body, geo.sphere, i ? 0xd76443 : 0x77ccbc, [x, .32, z], [.13, .13, .13]);
    }
    const dish = limb('dish', [0, .7, 0]);
    mesh(dish, geo.sphere, 0x788d7d, [0, .88, 0], [.65, .17, .85], [.4, 0, 0]);
    spar(dish, colors.dark, [0, .7, 0], [0, 1.42, -.35], .045);
  } else if (kind === 'plane') {
    // Four-engined desert freighter. Local origin is the fuselage catch center.
    const profile = [[0, -12.4], [1.3, -11.9], [2.05, -10.3], [2.6, -6.5], [2.65, 3.5], [2.05, 7.5], [1.05, 10.5], [.15, 12.1], [0, 12.3]].map(([r, z]) => new THREE.Vector2(r, z));
    const fuselage = new THREE.LatheGeometry(profile, 24); fuselage.rotateX(Math.PI / 2);
    mesh(body, fuselage, 0xe8dfc4, [0, 0, 0], [1, 1, 1]);
    mesh(body, geo.sphere, 0x3b626c, [0, .88, -9.35], [1.96, 1.12, 2.1]);
    mesh(body, geo.box, 0xe8dfc4, [0, 1.36, -10.45], [.18, 1.75, .2], [-.6, 0, 0]);
    mesh(body, geo.sphere, 0xc36743, [0, -.72, -10.85], [1.4, .72, 1.2]);
    mesh(body, geo.box, 0xba6745, [0, -1.22, 1.2], [3.95, .55, 15.5]);
    const wings = wing([[-16.5, 3], [-16.1, -.1], [-4, -2.6], [4, -2.6], [16.1, -.1], [16.5, 3], [4, 3.7], [-4, 3.7]], .4);
    mesh(body, wings, 0xddd8ba, [0, 1.15, 0], [1, 1, 1]);
    for (const s of [-1, 1]) {
      mesh(body, geo.box, 0xc36743, [s * 15.9, 1.0, 1.3], [.85, .55, 3.25]);
      mesh(body, geo.box, 0x7d8e84, [s * 8.5, 1.35, 3.1], [10.6, .15, .54]);
      for (const x of [s * 5.3, s * 10.5]) {
        mesh(body, geo.cylinder, 0xc4c3a9, [x, .4, -.85], [.91, 4.6, .91], [Math.PI / 2, 0, 0]);
        mesh(body, geo.cylinder, 0x3e5355, [x, .4, -3.2], [.87, .22, .87], [Math.PI / 2, 0, 0]);
        const prop = limb('propeller', [x, .4, -3.55]);
        mesh(prop, geo.sphere, 0xe3d7b9, [x, .4, -3.55], [.36, .36, .55]);
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2 + .25;
          mesh(prop, geo.box, colors.dark, [x + Math.sin(a) * 1.13, .4 + Math.cos(a) * 1.13, -3.55], [.29, 2.1, .1], [0, 0, -a]);
          mesh(prop, geo.box, 0xf1d59c, [x + Math.sin(a) * 2.04, .4 + Math.cos(a) * 2.04, -3.55], [.31, .3, .12], [0, 0, -a]);
        }
      }
      for (const z of [-5.2, -3.5, -1.8]) mesh(body, geo.sphere, 0x365c65, [s * 2.57, .65, z], [.075, .3, .32]);
      mesh(body, geo.box, 0x798d83, [s * 2.58, 0, 4.3], [.12, 3.05, 3.55]);
      mesh(body, geo.box, 0xddd8ba, [s * 2.66, 0, 4.3], [.08, 2.72, 3.25]);
      for (let i = 0; i < 4; i++) mesh(body, geo.box, 0xba6745, [s * 2.72, -.95, 3.15 + i * .7], [.04, .3, .35], [Math.PI / 4, 0, 0]);
      spar(body, 0x6a7771, [s * 1.75, -1.4, 3.5], [s * 2.2, -3.35, 3.5], .16);
      for (const z of [2.9, 4.1]) mesh(body, geo.cylinder, colors.dark, [s * 2.2, -3.35, z], [.78, .52, .78], [0, 0, Math.PI / 2]);
      mesh(body, geo.cylinder, 0xc8c4ab, [s * 2.49, -3.35, 2.9], [.35, .05, .35], [0, 0, Math.PI / 2]);
    }
    spar(body, 0x6a7771, [0, -1.3, -7.4], [0, -3.38, -7.4], .15);
    for (const s of [-1, 1]) mesh(body, geo.cylinder, colors.dark, [s * .34, -3.38, -7.4], [.65, .36, .65], [0, 0, Math.PI / 2]);
    mesh(body, wing([[-6.3, 10.9], [-6.1, 8.7], [-1.2, 7.5], [1.2, 7.5], [6.1, 8.7], [6.3, 10.9]], .25), 0xe3d8b9, [0, 1.1, 0], [1, 1, 1]);
    const fin = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 7), new THREE.Vector2(2, 7.25), new THREE.Vector2(5, 0)]);
    const finGeometry = new THREE.ExtrudeGeometry(fin, { depth: .35, bevelEnabled: true, bevelSize: .08, bevelThickness: .05, bevelSegments: 1 });
    finGeometry.rotateY(Math.PI / 2);
    mesh(body, finGeometry, 0xc36743, [-.17, 1.25, 11.2], [1, 1, 1]);
    mesh(body, geo.box, 0xe8dfc4, [0, 5.95, 9.6], [.42, .48, 2.65]);
    for (const side of [-1, 1]) {
      mesh(body, geo.cylinder, 0xf0dfb4, [side * .23, 5.05, 9.5], [.76, .035, .76], [0, 0, Math.PI / 2]);
      mesh(body, geo.box, 0x975139, [side * .26, 5.05, 9.5], [.035, .66, .66], [Math.PI / 4, 0, 0]);
      mesh(body, geo.box, 0xf0dfb4, [side * .28, 5.05, 9.5], [.035, .12, .67]);
      mesh(body, geo.sphere, side < 0 ? 0xb94833 : 0x5a917b, [side * 16.45, 1.32, .6], [.17, .14, .27]);
    }
    mesh(body, geo.sphere, 0xe2ba6d, [0, 2.69, .5], [.16, .16, .16]);
  }
  const out = bake(body); moving.forEach(p => animate(out, p.group, p.motion, p.pivot, p.phase)); return out;
}

const waterVertex = `varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const waterFragment = `${BIOME_GLSL}
  uniform float time; varying vec3 vWorld;
  void main(){
    vec2 p=vWorld.xz; if(!oasisWater(p))discard;
    float waves=sin(p.x*1.2+p.y*.65+time*1.7)*sin(p.y*.93-p.x*.45-time*1.3);
    float bands=sin(p.x*.16+p.y*.23+sin(p.y*.12)+time*.32);
    float caustic=pow(max(0.,sin(p.x*2.3+sin(p.y*1.8)+time*.7)*sin(p.y*2.8-p.x*.6-time*.5)),14.);
    float shore=(!oasisWater(p+vec2(.45,0.))||!oasisWater(p-vec2(.45,0.))||!oasisWater(p+vec2(0.,.45))||!oasisWater(p-vec2(0.,.45)))?1.:0.;
    vec3 c=mix(vec3(.025,.38,.40),vec3(.09,.65,.61),.55+bands*.13);
    c+=waves*.026+caustic*vec3(.11,.18,.12); c=mix(c,vec3(.59,.81,.66),shore*.45);
    float glint=pow(max(0.,waves),38.); c+=vec3(.65,.76,.63)*glint*.28;
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function palm() {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(.12, 3, 0), new THREE.Vector3(.6, 6, .2), new THREE.Vector3(1.3, 9.2, .45)]);
  mesh(g, new THREE.TubeGeometry(curve, 12, .27, 7, false), 0x92734f, [0, 0, 0], [1, 1, 1]);
  for (let k = 1; k < 14; k++) {
    const t = k / 14, p = curve.getPoint(t);
    mesh(g, geo.cylinder, k % 2 ? 0xb59a6c : 0x7a6547, [p.x, p.y, p.z], [.29 - t * .07, .13, .29 - t * .07]);
  }
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9, positions: number[] = [], indices: number[] = [];
    for (let k = 0; k < 11; k++) {
      const t = k / 10, r = t * 5.25, y = 9.25 + Math.sin(t * Math.PI) * 1.8 - t * 1.8;
      const width = Math.sin(t * Math.PI) * .72;
      for (const s of [-1, 1]) positions.push(1.3 + Math.sin(a) * r + Math.cos(a) * width * s, y - Math.abs(s) * width * .26, .45 + Math.cos(a) * r - Math.sin(a) * width * s);
      if (k < 10) { const n = k * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
    }
    const leaf = new THREE.BufferGeometry(); leaf.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); leaf.setIndex(indices); leaf.computeVertexNormals();
    const material = mat(i % 3 ? 0x527a52 : 0x769259); material.side = THREE.DoubleSide;
    const m = new THREE.Mesh(leaf, material); g.add(m);
    spar(g, 0x7b955c, [1.3, 9.25, .45], [1.3 + Math.sin(a) * 3.3, 9.5, .45 + Math.cos(a) * 3.3], .045);
  }
  for (let i = 0; i < 3; i++) mesh(g, geo.sphere, 0x84613d, [1.3 + Math.sin(i * 2.1) * .4, 8.85, .45 + Math.cos(i * 2.1) * .4], [.26, .35, .26]);
  return g;
}

export class Oasis {
  group = new THREE.Group();
  waterMaterial = new THREE.ShaderMaterial({ vertexShader: waterVertex, fragmentShader: waterFragment, uniforms: { time: { value: 0 } }, side: THREE.DoubleSide });
  private windsock = new THREE.Group();
  constructor() {
    const rng = random(218), structures = new THREE.Group();
    // A masked triangulated union keeps the visible water boundary identical to isWater.
    const vertices: number[] = [], step = 1.6;
    for (let z = -126; z < 126; z += step) for (let x = -94; x < 77; x += step) {
      if (![isWater(x, z, 2), isWater(x + step, z, 2), isWater(x, z + step, 2), isWater(x + step, z + step, 2), isWater(x + step / 2, z + step / 2, 2)].some(Boolean)) continue;
      vertices.push(x, OASIS_WATER_LEVEL, z, x, OASIS_WATER_LEVEL, z + step, x + step, OASIS_WATER_LEVEL, z, x + step, OASIS_WATER_LEVEL, z, x, OASIS_WATER_LEVEL, z + step, x + step, OASIS_WATER_LEVEL, z + step);
    }
    const waterGeometry = new THREE.BufferGeometry(); waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); waterGeometry.computeVertexNormals();
    const water = new THREE.Mesh(waterGeometry, this.waterMaterial); water.renderOrder = 1; this.group.add(water);
    // March the union's real shoreline, including the dry causeways. Thick limestone banks
    // hide the coarse terrain interpolation and make the crossing rule legible at speed.
    const dryHeight = (x: number, z: number) => 2.1 + Math.sin(x * .021) * .45 + Math.sin(z * .018) * .35;
    for (let z = -127; z < 127; z += step) for (let x = -95; x < 79; x += step) {
      const points = [[x, z], [x + step, z], [x + step, z + step], [x, z + step]], crossings: number[][] = [];
      for (let k = 0; k < 4; k++) {
        const a = points[k], b = points[(k + 1) % 4]; if (isWater(a[0], a[1], 2) === isWater(b[0], b[1], 2)) continue;
        let low = 0, high = 1;
        for (let n = 0; n < 9; n++) { const t = (low + high) / 2; if (isWater(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 2) === isWater(a[0], a[1], 2)) low = t; else high = t; }
        crossings.push([a[0] + (b[0] - a[0]) * (low + high) / 2, a[1] + (b[1] - a[1]) * (low + high) / 2]);
      }
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const a = crossings[k], b = crossings[k + 1], cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2, h = dryHeight(cx, cz);
        mesh(structures, geo.box, 0xd5c9a0, [cx, h - .55, cz], [.62, 1.5, Math.hypot(a[0] - b[0], a[1] - b[1]) + .1], [0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0]);
        mesh(structures, geo.box, 0xf1e4c2, [cx, h + .18, cz], [.86, .19, Math.hypot(a[0] - b[0], a[1] - b[1]) + .1], [0, Math.atan2(b[0] - a[0], b[1] - a[1]), 0]);
      }
    }
    // The old river road passes two broad, unambiguous solid causeways.
    for (const z of [-55, 65]) {
      const x = -20 + 7 * Math.sin(z * .035), y = terrainHeight(x, z, 2);
      mesh(structures, geo.box, 0xc2aa80, [x, y + .08, z], [29, .16, 17]);
      for (const side of [-1, 1]) for (let k = 0; k < 6; k++) mesh(structures, geo.box, 0xf1e4c2, [x - 12 + k * 4.8, y + .32, z + side * 8.35], [3.9, .62, .5]);
    }
    // Pale paved streets and little shop forecourts stay on the dry ground.
    const road = (x: number, z: number, w: number, d: number) => mesh(structures, geo.box, 0xd6bf94, [x, terrainHeight(x, z, 2) + .04, z], [w, .08, d]);
    const pave = (ax: number, az: number, bx: number, bz: number, width: number, color = 0xc9b38b) => {
      const length = Math.hypot(bx - ax, bz - az), n = Math.ceil(length / 2), nx = (bz - az) / length * width / 2, nz = -(bx - ax) / length * width / 2;
      const vertex = (x: number, z: number) => [x, terrainHeight(x, z, 2) + .075, z];
      const positions: number[] = [];
      for (let k = 0; k < n; k++) {
        const a = k / n, b = (k + 1) / n, x0 = ax + (bx - ax) * a, z0 = az + (bz - az) * a, x1 = ax + (bx - ax) * b, z1 = az + (bz - az) * b;
        if ([isWater(x0 + nx, z0 + nz, 2), isWater(x0 - nx, z0 - nz, 2), isWater(x1 + nx, z1 + nz, 2), isWater(x1 - nx, z1 - nz, 2)].some(Boolean)) continue;
        positions.push(...vertex(x0 + nx, z0 + nz), ...vertex(x0 - nx, z0 - nz), ...vertex(x1 + nx, z1 + nz), ...vertex(x1 + nx, z1 + nz), ...vertex(x0 - nx, z0 - nz), ...vertex(x1 - nx, z1 - nz));
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
      // Standard material sculptures have uv; add one so merging remains uniform.
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
      const part = new THREE.Mesh(geometry, mat(color)); part.receiveShadow = true; structures.add(part);
    };
    for (const [ax, az, bx, bz] of [[-70, 104, 48, 84], [-83, 44, -84, 102], [9, 91, 51, 24], [51, 24, 60, -13], [26, -5, 25, -19], [28, -61, 58, -72], [58, -72, 9, -96], [-47, -94, -80, -64], [-80, -64, 28, -61]]) pave(ax, az, bx, bz, 5.5);
    for (const [x, z] of OASIS_HOMES) {
      road(x, z - 8, 12.5, 5.5);
      for (const side of [-1, 1]) {
        const px = x + side * 6.5, pz = z - 6;
        if (!isWater(px, pz, 2)) {
          mesh(structures, geo.cylinder, 0xb17a50, [px, terrainHeight(px, pz, 2) + .55, pz], [.5, 1.1, .5]);
          mesh(structures, geo.sphere, 0x64824f, [px, terrainHeight(px, pz, 2) + 1.4, pz], [.6, .7, .6]);
        }
      }
    }
    // Runway aligned to the shared physical route, with end bars, a centerline and apron.
    pave(OASIS_RUNWAY.x, OASIS_RUNWAY.startZ, OASIS_RUNWAY.x, OASIS_RUNWAY.endZ, OASIS_RUNWAY.halfWidth * 2, 0x8e9383);
    pave(130, 101, 130, 42, 38, 0xb6aa8a);
    for (let z = -101; z < 105; z += 16) mesh(structures, geo.box, 0xeee1b9, [96, terrainHeight(96, z, 2) + .1, z], [.7, .025, 8]);
    for (const end of [-1, 1]) for (let i = 0; i < 6; i++) mesh(structures, geo.box, 0xeee1b9, [86 + i * 4, terrainHeight(86 + i * 4, end * 101, 2) + .1, end * 101], [1.6, .025, 10]);
    for (let z = -110; z <= 110; z += 20) for (const side of [-1, 1]) {
      mesh(structures, geo.cylinder, 0xd4b67f, [96 + side * 16.5, terrainHeight(96, z, 2) + .3, z], [.13, .6, .13]);
      mesh(structures, geo.sphere, 0x7eb8b2, [96 + side * 16.5, terrainHeight(96, z, 2) + .65, z], [.22, .13, .22]);
    }
    // A low utility shelter and control tower supply a believable airfield silhouette.
    mesh(structures, geo.box, 0xd7c79e, [139, 4.1, 68], [13, 4, 16]);
    mesh(structures, geo.box, 0x5a766f, [132.35, 4, 68], [.12, 2.8, 11.5]);
    mesh(structures, geo.box, 0xe1d8b3, [139, 6.3, 68], [14, .45, 17]);
    mesh(structures, geo.box, 0xd5bd92, [128, 6, 42], [4, 8, 4]);
    mesh(structures, geo.box, 0x46777b, [128, 10.65, 42], [5.8, 1.5, 5.8]);
    mesh(structures, geo.box, 0xeee0ba, [128, 11.6, 42], [6.4, .35, 6.4]);
    mesh(structures, geo.cylinder, 0x756b51, [119, 8, 95], [.11, 12, .11]);
    this.windsock.position.set(119, 13.4, 95);
    for (let i = 0; i < 5; i++) mesh(this.windsock, new THREE.CylinderGeometry(.55 - i * .075, .6 - i * .075, .66, 10, 1, true), i % 2 ? 0xefdfbc : 0xc36c44, [i * .62, -i * .12, 0], [1, 1, 1], [0, 0, -Math.PI / 2]);
    this.group.add(this.windsock);
    // Distant chalk escarpments anchor the green oasis inside the desert.
    for (let i = 0; i < 56; i++) {
      const a = i / 56 * Math.PI * 2, r = 270 + rng() * 190, x = Math.sin(a) * r, z = Math.cos(a) * r;
      const h = 9 + rng() ** 2 * 47;
      mesh(structures, geo.ico, i % 3 ? 0xd9c6a0 : 0xc4b394, [x, terrainHeight(x, z, 2) + h * .36, z], [12 + rng() * 18, h, 10 + rng() * 16], [0, rng() * 6, .1]);
    }
    const palms = new THREE.Group();
    const plantPalm = (x: number, z: number, scale: number) => {
      if (isWater(x, z, 2) || OASIS_HOMES.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 9)) return;
      const p = palm(); p.position.set(x, terrainHeight(x, z, 2), z); p.rotation.y = rng() * Math.PI * 2; p.scale.setScalar(scale); palms.add(p);
      mesh(structures, geo.cylinder, 0xbbaa7d, [x, terrainHeight(x, z, 2) + .1, z], [1.4, .2, 1.4]);
    };
    for (let i = 0; i < 23; i++) { const a = i / 23 * Math.PI * 2; plantPalm(-62 + Math.sin(a) * (34 + rng() * 8), 10 + Math.cos(a) * (46 + rng() * 6), .88 + rng() * .4); }
    for (let i = 0; i < 24; i++) { const z = -116 + i * 10, x = -20 + 7 * Math.sin(z * .035) + (i % 2 ? 14 : -14); plantPalm(x, z, .8 + rng() * .4); }
    for (const [x, z] of [[36, 68], [55, 56], [60, -52], [38, -89], [-72, 82], [114, 25]]) plantPalm(x, z, 1.1);
    this.group.add(bake(structures), bake(palms));
  }
  update(age: number) { this.waterMaterial.uniforms.time.value = age; this.windsock.rotation.y = .15 + Math.sin(age * .65) * .12; this.windsock.rotation.z = Math.sin(age * 2.8) * .055; }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { colors, geo, mat, mesh } from './palette';
import { ground, random, damp } from '../game/math';
import type { Simulation, Prey, PreyKind } from '../game/Simulation';

type Motion = 'goatLeg' | 'personLeg' | 'personArm' | 'turret' | 'barrel' | 'rotor' | 'tailRotor' | 'pennant' | 'flame';
type AnimatedPart = { motion?: Motion; pivot?: [number, number, number]; phase?: number };

// Bake a procedural sculpture into one draw per material; every animal shares it.
function bake(source: THREE.Group) {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>(); source.updateMatrixWorld(true);
  source.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const material = o.material as THREE.Material;
    if (!buckets.has(material)) buckets.set(material, []);
    buckets.get(material)!.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
  });
  const out = new THREE.Group();
  buckets.forEach((geometries, material) => {
    const m = new THREE.Mesh(mergeGeometries(geometries), material); m.castShadow = true; m.receiveShadow = true; out.add(m);
    geometries.forEach(g => g.dispose());
  });
  return out;
}
function preyModel(kind: PreyKind) {
  if (!['rabbit', 'chicken', 'crate', 'urn', 'jeep'].includes(kind)) return huntModel(kind);
  const g = new THREE.Group();
  if (kind === 'rabbit' || kind === 'chicken') {
    const chicken = kind === 'chicken', c = chicken ? colors.ivory : 0xcba486;
    mesh(g, geo.sphere, c, [0, .47, 0], [.36, .38, .57]);
    mesh(g, geo.sphere, c, [0, .77, -.4], [.3, .31, .29]);
    for (const s of [-1, 1]) {
      mesh(g, geo.sphere, c, [s * .25, .16, .1], [.17, .19, .3]);
      mesh(g, geo.sphere, colors.dark, [s * .24, .82, -.54], [.05, .06, .04]);
      if (!chicken) mesh(g, geo.sphere, c, [s * .15, 1.12, -.3], [.09, .45, .12], [-.2, 0, s * .12]);
      else mesh(g, geo.sphere, 0xd4b88e, [s * .34, .48, 0], [.14, .26, .34]);
    }
    mesh(g, geo.sphere, chicken ? colors.coral : colors.ivory, [0, .48, .51], [.22, .22, .2]);
    if (chicken) {
      mesh(g, geo.cone, colors.coral, [0, 1.08, -.36], [.12, .3, .2]);
      mesh(g, geo.cone, 0xd59742, [0, .72, -.73], [.12, .25, .12], [-Math.PI / 2, 0, 0]);
    }
  } else if (kind === 'crate') {
    mesh(g, geo.box, 0xa16d45, [0, .8, 0], [1.6, 1.6, 1.6]);
    for (const s of [-1, 1]) {
      mesh(g, geo.box, 0xe0bc85, [0, .8, s * .84], [1.6, .2, .08], [0, 0, .74]);
      mesh(g, geo.box, 0x714b36, [s * .58, .8, 0], [.12, 1.7, 1.72]);
    }
  } else if (kind === 'urn') {
    mesh(g, geo.sphere, colors.rust, [0, .64, 0], [.63, .72, .63]);
    mesh(g, geo.cylinder, 0xd6926d, [0, 1.25, 0], [.31, .32, .31]);
    mesh(g, geo.cylinder, colors.ivory, [0, .68, 0], [.65, .12, .65]);
  } else {
    mesh(g, geo.box, colors.olive, [0, .85, 0], [2, .65, 3.9]);
    mesh(g, geo.box, colors.olive, [0, 1.25, -1.15], [2, .38, 1.7]);
    mesh(g, geo.box, colors.dark, [0, 1.52, .03], [1.6, .35, 1.3]);
    mesh(g, geo.box, colors.ivory, [0, 2.25, .15], [2.1, .14, 1.9]);
    mesh(g, geo.box, 0x8faaa0, [0, 1.92, -.66], [1.77, .65, .1], [-.14, 0, 0]);
    for (const s of [-1, 1]) {
      for (const z of [-1.15, 1.2]) {
        mesh(g, geo.cylinder, colors.dark, [s * 1.05, .5, z], [.5, .32, .5], [0, 0, Math.PI / 2]);
        mesh(g, geo.cylinder, 0x92927c, [s * 1.23, .5, z], [.23, .04, .23], [0, 0, Math.PI / 2]);
      }
      mesh(g, geo.sphere, colors.ivory, [s * .65, 1.2, -2], [.21, .2, .08]);
      mesh(g, geo.box, colors.olive, [s * .92, 1.75, .76], [.12, .9, .12]);
    }
    mesh(g, geo.box, colors.dark, [0, .71, -2.1], [2.3, .21, .15]);
  }
  return bake(g);
}
function spar(parent: THREE.Group, color: number, a: [number, number, number], b: [number, number, number], radius = .045) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  const part = new THREE.Mesh(geo.cylinder, mat(color)); part.position.copy(start.add(end).multiplyScalar(.5));
  part.scale.set(radius, delta.length(), radius); part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); parent.add(part);
}
function animated(out: THREE.Group, source: THREE.Group, motion: Motion, pivot: [number, number, number], phase = 0) {
  const sculpture = bake(source);
  for (const part of sculpture.children as THREE.Mesh[]) {
    part.geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
    part.userData = { motion, pivot, phase }; out.add(part);
  }
}
function curvedHorn(side: number) {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(side * .2, 2.05, -.62), new THREE.Vector3(side * .34, 2.42, -.46), new THREE.Vector3(side * .4, 2.56, -.1), new THREE.Vector3(side * .39, 2.43, .05)]);
  const geometry = new THREE.TubeGeometry(curve, 10, .105, 6, false), attr = geometry.attributes.position;
  for (let i = 0; i < attr.count; i++) {
    const t = Math.floor(i / 7) / 10, center = curve.getPointAt(t), taper = 1 - t * .92;
    attr.setXYZ(i, center.x + (attr.getX(i) - center.x) * taper, center.y + (attr.getY(i) - center.y) * taper, center.z + (attr.getZ(i) - center.z) * taper);
  }
  geometry.computeVertexNormals(); return geometry;
}
function balloonEnvelope() {
  const profile = [[.65, 4.4], [1.05, 5.1], [2.4, 6.3], [3.7, 8.1], [4.4, 10.3], [4.3, 12.4], [3.5, 14.2], [2.25, 15.4], [.8, 16.1], [0, 16.25]].map(([x, y]) => new THREE.Vector2(x, y));
  const geometry = new THREE.LatheGeometry(profile, 48).toNonIndexed(), position = geometry.attributes.position;
  const color = new THREE.Color(), vertexColors: number[] = [];
  for (let i = 0; i < position.count; i += 3) {
    const x = (position.getX(i) + position.getX(i + 1) + position.getX(i + 2)) / 3, z = (position.getZ(i) + position.getZ(i + 1) + position.getZ(i + 2)) / 3;
    const y = (position.getY(i) + position.getY(i + 1) + position.getY(i + 2)) / 3;
    const panel = Math.floor((Math.atan2(x, z) + Math.PI) / (Math.PI / 6));
    color.setHex(y < 5.5 || y > 15.5 ? colors.ink : panel % 2 ? colors.ivory : colors.rust);
    for (let n = 0; n < 3; n++) vertexColors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3)); return geometry;
}
function huntModel(kind: PreyKind) {
  const body = new THREE.Group(), moving: { group: THREE.Group; motion: Motion; pivot: [number, number, number]; phase?: number }[] = [];
  const limb = (motion: Motion, pivot: [number, number, number], phase = 0) => {
    const group = new THREE.Group(); moving.push({ group, motion, pivot, phase }); return group;
  };
  if (kind === 'goat') {
    mesh(body, geo.sphere, 0xa87d57, [0, 1.15, .1], [.56, .62, .87]);
    mesh(body, geo.sphere, colors.ivory, [0, 1.2, -.4], [.48, .55, .45]);
    mesh(body, geo.sphere, 0xa87d57, [0, 1.77, -.66], [.31, .42, .37]);
    mesh(body, geo.sphere, 0x6b5140, [0, 1.59, -.97], [.3, .21, .28]);
    mesh(body, geo.cone, colors.dark, [0, 1.24, -.87], [.13, .5, .15], [Math.PI, 0, 0]);
    mesh(body, geo.sphere, colors.ivory, [0, 1.62, .83], [.15, .32, .18], [-.6, 0, 0]);
    for (const s of [-1, 1]) {
      mesh(body, geo.sphere, colors.ivory, [s * .4, 1.84, -.56], [.32, .09, .15], [0, 0, s * .3]);
      mesh(body, geo.sphere, colors.dark, [s * .29, 1.88, -.84], [.055, .075, .07]);
      const horn = new THREE.Mesh(curvedHorn(s), mat(colors.ivory)); body.add(horn);
      for (const z of [-.48, .59]) {
        const leg = limb('goatLeg', [s * .36, 1.02, z], s * (z > 0 ? 1 : -1));
        mesh(leg, geo.cylinder, 0x8c694d, [s * .36, .58, z], [.12, .86, .12]);
        mesh(leg, geo.box, colors.dark, [s * .36, .13, z - .04], [.26, .23, .34]);
      }
    }
  } else if (kind === 'militia') {
    mesh(body, geo.box, colors.olive, [0, 1.25, 0], [.69, .76, .42]);
    mesh(body, geo.box, 0x8b8b67, [0, 1.05, -.23], [.75, .17, .09]);
    mesh(body, geo.sphere, 0xd5a47b, [0, 1.91, -.03], [.28, .33, .27]);
    mesh(body, geo.sphere, 0xd5a47b, [0, 1.9, -.3], [.1, .11, .14]);
    mesh(body, geo.sphere, colors.olive, [0, 2.11, 0], [.34, .21, .33]);
    mesh(body, geo.box, 0x465d55, [0, 2.04, -.27], [.66, .09, .2]);
    mesh(body, geo.box, colors.rust, [0, 1.66, 0], [.48, .12, .44]);
    mesh(body, geo.box, colors.rust, [.22, 1.48, .26], [.18, .45, .05], [0, 0, -.25]);
    for (const s of [-1, 1]) {
      mesh(body, geo.sphere, colors.dark, [s * .11, 1.98, -.27], [.045, .05, .03]);
      const leg = limb('personLeg', [s * .2, .92, 0], s);
      mesh(leg, geo.box, 0xbbb18c, [s * .2, .53, 0], [.26, .8, .3]);
      mesh(leg, geo.box, colors.dark, [s * .2, .13, -.09], [.31, .24, .48]);
      const arm = limb('personArm', [s * .42, 1.51, 0], s);
      mesh(arm, geo.cylinder, colors.olive, [s * .46, 1.16, 0], [.13, .67, .13], [0, 0, s * .1]);
      mesh(arm, geo.sphere, 0xd5a47b, [s * .49, .83, 0], [.14, .15, .13]);
      if (s === 1) {
        mesh(arm, geo.box, colors.dark, [.54, 1.12, -.16], [.13, .14, .85], [-.12, 0, 0]);
        mesh(arm, geo.box, 0x8b6746, [.54, 1.1, .2], [.15, .21, .36]);
      }
    }
  } else if (kind === 'pickup') {
    mesh(body, geo.box, colors.dark, [0, .65, .1], [2.3, .4, 4.9]);
    mesh(body, geo.box, colors.olive, [0, 1.14, 0], [2.3, .72, 4.9]);
    mesh(body, geo.box, 0x7c8668, [0, 1.64, -1.3], [2.3, .37, 2.2]);
    mesh(body, geo.box, colors.dark, [0, 1.54, 1.32], [1.82, .12, 1.9]);
    mesh(body, geo.box, 0x7c8668, [0, 2.03, -.25], [2.05, 1.08, 1.55]);
    mesh(body, geo.box, 0x95b3ae, [0, 2.1, -1.04], [1.75, .68, .08], [-.12, 0, 0]);
    mesh(body, geo.box, colors.ivory, [0, 2.65, -.25], [2.18, .15, 1.72]);
    mesh(body, geo.box, 0x314842, [0, 1.2, -2.5], [1.45, .46, .07]);
    mesh(body, geo.box, colors.ivory, [0, .83, -2.6], [2.65, .23, .25]);
    for (const s of [-1, 1]) {
      mesh(body, geo.box, 0xa5a27a, [s * 1.15, 1.7, 1.45], [.19, .53, 2.1]);
      mesh(body, geo.sphere, colors.ivory, [s * .88, 1.4, -2.48], [.28, .2, .08]);
      mesh(body, geo.box, colors.coral, [s * .83, 1.3, 2.49], [.28, .18, .06]);
      mesh(body, geo.box, colors.dark, [s * 1.08, 1.15, -1.55], [.4, .5, 1.3]);
      mesh(body, geo.box, colors.dark, [s * 1.08, 1.15, 1.6], [.4, .5, 1.3]);
      for (const z of [-1.55, 1.6]) {
        mesh(body, geo.cylinder, colors.dark, [s * 1.19, .61, z], [.62, .39, .62], [0, 0, Math.PI / 2]);
        mesh(body, geo.cylinder, 0xa5a27a, [s * 1.4, .61, z], [.3, .06, .3], [0, 0, Math.PI / 2]);
      }
      spar(body, colors.dark, [s * .8, 1.6, .65], [s * .8, 2.85, .8], .065);
    }
    spar(body, colors.dark, [-.8, 2.85, .8], [.8, 2.85, .8], .065);
    const turret = limb('turret', [0, 1.7, 1.18]);
    mesh(turret, geo.cylinder, colors.dark, [0, 2.01, 1.18], [.13, .65, .13]);
    mesh(turret, geo.box, colors.olive, [0, 2.4, 1.18], [.72, .55, .8]);
    mesh(turret, geo.box, 0x9c9d75, [.47, 2.38, 1.22], [.22, .42, .5]);
    const barrel = limb('barrel', [0, 1.7, 1.18]);
    mesh(barrel, geo.cylinder, colors.dark, [0, 2.48, .23], [.1, 1.45, .1], [Math.PI / 2, 0, 0]);
    mesh(barrel, geo.cylinder, 0x717e72, [0, 2.48, -.49], [.14, .23, .14], [Math.PI / 2, 0, 0]);
  } else if (kind === 'helicopter') {
    mesh(body, geo.sphere, colors.olive, [0, .45, 0], [1.35, 1.36, 2.35]);
    mesh(body, geo.sphere, 0x83a7a9, [0, .64, -1.2], [1.25, 1.06, 1.32]);
    mesh(body, geo.box, colors.olive, [0, .7, -1.98], [.13, 1.62, .2], [-.4, 0, 0]);
    mesh(body, geo.box, colors.olive, [0, -.18, -2.05], [2.05, .17, .29]);
    mesh(body, geo.sphere, colors.dark, [0, 1.6, .3], [.85, .43, 1.55]);
    for (const s of [-1, 1]) {
      mesh(body, geo.cylinder, 0x4c5d51, [s * .67, 1.57, .8], [.3, 1.38, .3], [Math.PI / 2, 0, 0]);
      mesh(body, geo.box, colors.ivory, [s * 1.24, .45, .4], [.08, .35, .8]);
      mesh(body, geo.cylinder, colors.dark, [s * 1.35, -.98, .12], [.095, 3.75, .095], [Math.PI / 2, 0, 0]);
      for (const z of [-.95, 1]) spar(body, colors.dark, [s * .85, -.34, z], [s * 1.35, -.98, z], .075);
      mesh(body, geo.box, colors.olive, [s * 1.6, -.2, .15], [.85, .27, 1.7]);
      for (const x of [s * 1.4, s * 1.78]) mesh(body, geo.cylinder, colors.dark, [x, -.24, -.1], [.16, 1.7, .16], [Math.PI / 2, 0, 0]);
    }
    spar(body, colors.olive, [0, .55, 1.6], [0, 1.2, 6.2], .3);
    mesh(body, geo.box, colors.olive, [0, 1.8, 5.8], [.12, 2.1, 1.1], [.35, 0, 0]);
    mesh(body, geo.box, colors.ivory, [0, 1.15, 4.9], [2.35, .14, .7]);
    mesh(body, geo.cylinder, colors.dark, [0, 2.02, .2], [.12, 1, .12]);
    const rotor = limb('rotor', [0, 2.48, .2]);
    mesh(rotor, geo.sphere, 0x738176, [0, 2.48, .2], [.35, .19, .35]);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      mesh(rotor, geo.box, colors.dark, [Math.sin(a) * 2.45, 2.48, .2 + Math.cos(a) * 2.45], [.29, .065, 4.6], [0, a, 0]);
      mesh(rotor, geo.box, colors.ivory, [Math.sin(a) * 4.55, 2.48, .2 + Math.cos(a) * 4.55], [.31, .07, .4], [0, a, 0]);
    }
    const tail = limb('tailRotor', [.35, 1.52, 6.06]);
    for (const a of [0, Math.PI / 2]) mesh(tail, geo.box, colors.dark, [.35, 1.52, 6.06], [.07, 1.75, .15], [a, 0, 0]);
    mesh(body, geo.sphere, colors.coral, [0, 2.9, 5.65], [.14, .15, .14]);
  } else if (kind === 'balloon') {
    const envelope = new THREE.Mesh(balloonEnvelope(), new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .95 })); body.add(envelope);
    mesh(body, geo.box, 0x7f573c, [0, 0, 0], [3.3, 1.7, 2.7]);
    mesh(body, geo.box, colors.dark, [0, .88, 0], [3.4, .2, 2.8]);
    for (let i = 0; i < 5; i++) {
      mesh(body, geo.box, 0xc79863, [0, -.65 + i * .3, -1.38], [3.36, .08, .05]);
      mesh(body, geo.box, 0xc79863, [0, -.65 + i * .3, 1.38], [3.36, .08, .05]);
      mesh(body, geo.box, 0xc79863, [-1.68, -.65 + i * .3, 0], [.05, .08, 2.75]);
      mesh(body, geo.box, 0xc79863, [1.68, -.65 + i * .3, 0], [.05, .08, 2.75]);
    }
    for (const x of [-1.35, 1.35]) for (const z of [-1.05, 1.05]) {
      spar(body, colors.ink, [x, .75, z], [x * .56, 4.8, z * .56], .05);
      spar(body, colors.ivory, [x * .56, 4.8, z * .56], [x * 2.15, 8.2, z * 2.15], .025);
    }
    mesh(body, geo.cylinder, colors.dark, [0, 2.2, 0], [.48, .4, .48]);
    const flame = limb('flame', [0, 2.5, 0]);
    const flameMesh = new THREE.Mesh(geo.cone, new THREE.MeshBasicMaterial({ color: 0xffc06b }));
    flameMesh.position.set(0, 3.12, 0); flameMesh.scale.set(.27, 1.2, .27); flame.add(flameMesh);
    for (const s of [-1, 1]) {
      const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#f6dfb3'; ctx.beginPath(); ctx.arc(64, 64, 59, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a84e34'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#243e47'; ctx.font = 'bold 65px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('01', 64, 66);
      const material = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, roughness: 1 });
      material.map!.colorSpace = THREE.SRGBColorSpace;
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 3.25), material); badge.position.set(0, 10.6, s * 4.42); badge.rotation.y = s === 1 ? 0 : Math.PI; body.add(badge);
    }
    const pennant = limb('pennant', [1.75, .6, 0]);
    mesh(pennant, new THREE.ConeGeometry(.6, 2.8, 3), colors.coral, [2.85, .6, 0], [1, 1, .04], [0, 0, -Math.PI / 2]);
  }
  const out = bake(body);
  moving.forEach(part => animated(out, part.group, part.motion, part.pivot, part.phase)); return out;
}
function sandstoneGeometry() {
  const geometry = new THREE.CylinderGeometry(.58, 1, 1, 10, 5);
  const positions = geometry.attributes.position;
  const profile = [1, .96, .81, .82, .58, .47], vertexColors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i) + .5, a = Math.atan2(positions.getZ(i), positions.getX(i));
    const band = Math.min(4, Math.floor(y * 5)), t = y * 5 - band;
    const radius = Math.hypot(positions.getX(i), positions.getZ(i)) / (1 - y * .42);
    const r = radius * (profile[band] * (1 - t) + profile[band + 1] * t) * (1 + Math.sin(a * 3 + .7) * .07 + Math.sin(a * 7 - y * 2) * .04);
    positions.setXYZ(i, Math.cos(a) * r + y * .14, y + Math.sin(a * 2) * y * .035, Math.sin(a) * r + y * y * .09);
    color.setHex(y > .95 ? 0xdba17c : y > .58 && y < .62 || y > .18 && y < .22 ? 0xc79677 : 0xb87e60);
    vertexColors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3)); geometry.computeVertexNormals();
  return geometry;
}
const terrainVertex = `
  uniform vec3 trail[12]; uniform float time; uniform float underground; uniform float wormScale;
  varying vec3 vWorld; varying vec3 vNormal; varying float vEye; varying float vWake;
  void main() {
    vec3 p = position;
    float nearest=10000.; float strength=0.; vec2 wakeDelta=vec2(0.);
    for (int i=0; i<11; i++) {
      vec2 segment=trail[i+1].xz-trail[i].xz;
      float t=clamp(dot(p.xz-trail[i].xz,segment)/max(dot(segment,segment),.001),0.,1.);
      vec2 delta=p.xz-mix(trail[i].xz,trail[i+1].xz,t);
      float distance2=dot(delta,delta);
      if(distance2<nearest) { nearest=distance2; strength=mix(trail[i].y,trail[i+1].y,t); wakeDelta=delta; }
    }
    float width=max(.75,wormScale);
    vWake=exp(-nearest*.18/(width*width))*strength;
    p.y += vWake*.85*width;
    vec2 wakeSlope=-wakeDelta*vWake*.306/width;
    vWorld=(modelMatrix*vec4(p,1.)).xyz;
    vNormal=normalize(mat3(modelMatrix)*(normal-vec3(wakeSlope.x,0.,wakeSlope.y)));
    vec4 mv=modelViewMatrix*vec4(p,1.); vEye=-mv.z;
    gl_Position=projectionMatrix*mv;
  }`;
const terrainFragment = `
  uniform float time; uniform float underground;
  varying vec3 vWorld; varying vec3 vNormal; varying float vEye; varying float vWake;
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main() {
    vec3 sun=normalize(vec3(-.7,.4,-.65));
    vec3 n=normalize(vNormal);
    float light=dot(n,sun);
    float ripplePhase=vWorld.x*2.8+vWorld.z*1.6+sin(vWorld.z*.23)*2.+sin(vWorld.x*.09)*4.;
    float ripple=sin(ripplePhase)/(1.+fwidth(ripplePhase)*fwidth(ripplePhase));
    float fine=hash(floor(vWorld.xz*34.));
    float wind=sin(vWorld.x*.031-vWorld.z*.014+time*.16)*.5+.5;
    // Broad, copper lee faces give the small ripples a much quieter canvas.
    vec3 shadow=vec3(.58,.37,.29), sand=vec3(.94,.72,.48);
    float sunFace=smoothstep(-.04,.65,light);
    vec3 color=mix(shadow,sand,sunFace);
    float strata=sin(vWorld.x*.018+vWorld.z*.032+vWorld.y*.22)*.5+.5;
    color += vec3(.027,.012,-.005)*strata;
    float detail=1.-smoothstep(16.,105.,vEye);
    color += ripple*.011*detail*(.5+sunFace*.5)*(1.-vWake*.75);
    color += (fine-.5)*.024*(1.-smoothstep(10.,55.,vEye));
    color += pow(fine,65.)*.14*sunFace*(.6+wind*.4)*(1.-smoothstep(8.,42.,vEye));
    color=mix(color,vec3(.94,.77,.55),vWake*.2);
    float fog=1.-exp(-max(vEye,0.)*.0024);
    color=mix(color,vec3(.86,.64,.49),fog);
    // The ceiling becomes a soft vibration field instead of a lit sand texture.
    float strataEcho=sin(vWorld.x*.11+vWorld.z*.08+sin(vWorld.z*.035)*2.);
    vec3 under=vec3(.055,.115,.13)+strataEcho*.003;
    color=mix(color,under,underground);
    gl_FragColor=vec4(pow(max(color,vec3(0.)),vec3(2.2)),1.);
    #include <colorspace_fragment>
  }`;
const skyFragment = `
  uniform float underground; varying vec3 vDirection;
  void main(){
    vec3 d=normalize(vDirection); float y=max(d.y,0.);
    vec3 c=mix(vec3(.91,.67,.49),vec3(.29,.47,.53),pow(y,.55));
    vec3 sun=normalize(vec3(-.7,.24,-.65)); float s=dot(d,sun);
    c+=vec3(.15,.07,.015)*pow(max(s,0.),18.);
    float haze=exp(-abs(d.y-.045)*18.);
    c=mix(c,vec3(.95,.75,.55),haze*.24);
    float streak=sin(d.x*19.+d.z*8.+sin(d.z*16.)*.7+d.y*57.);
    float cloud=smoothstep(.65,1.,streak)*smoothstep(.08,.24,d.y)*(1.-smoothstep(.24,.4,d.y));
    c=mix(c,vec3(.86,.77,.63),cloud*.08);
    c=mix(c,vec3(1.,.9,.66),smoothstep(.99915,.99962,s));
    c=mix(c,vec3(.025,.075,.09),underground);
    gl_FragColor=vec4(pow(max(c,vec3(0.)),vec3(2.2)),1.);
    #include <colorspace_fragment>
  }`;
const echoVertex = `
  attribute vec3 signal; attribute float echoCore; varying vec2 vUv; varying vec3 vSignal; varying float vCore;
  void main(){vUv=uv;vSignal=signal;vCore=echoCore;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`;
const echoFragment = `
  uniform float time; uniform float opacity; varying vec2 vUv; varying vec3 vSignal; varying float vCore;
  void main(){
    vec2 p=(vUv-.5)*2.; float radius=length(p); float aa=max(fwidth(radius),.008);
    float phase=fract(time*(vSignal.y>.75?.85:.55)+vSignal.x);
    float pulseRadius=.25+phase*.68;
    float pulse=(1.-smoothstep(.022,.022+aa,abs(radius-pulseRadius)))*(1.-phase*.65)*.95;
    float halo=(1.-smoothstep(.01,.01+aa,abs(radius-.3)))*.4;
    float core=exp(-dot(p,p)*75.);
    float tooLarge=step(.25,vSignal.y)*(1.-step(.75,vSignal.y));
    float dash=mix(1.,smoothstep(-.2,.2,sin(atan(p.y,p.x)*10.)),tooLarge);
    float alpha=mix((pulse+halo)*dash+core,mix(.8,.35,tooLarge),vCore)*vSignal.z*opacity;
    if(alpha<.006) discard;
    vec3 color=vSignal.y<.25?vec3(.86,.84,.59):vSignal.y<.75?vec3(.37,.64,.72):vec3(1.,.4,.2);
    gl_FragColor=vec4(color,alpha);
    #include <colorspace_fragment>
  }`;
const windVertex = `
  uniform float time; attribute float seed; attribute float along; varying float vAlpha;
  void main(){
    vec3 p=position; p.x=mod(p.x-along*15.4+time*(7.+seed*4.)+170.,340.)-170.+along*15.4;
    p.y=sin(p.x*.026+p.z*.016)*4.8+sin(p.z*.048-p.x*.017)*2.7+sin(p.x*.065+p.z*.037)*1.1+sin(p.x*.012-p.z*.009)*4.+.17;
    vAlpha=sin(along*3.14159)*(.5+sin(time*.7+seed*20.)*.5)*.14;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`;
const windFragment = `
  varying float vAlpha; void main(){gl_FragColor=vec4(.94,.8,.6,vAlpha);
    #include <colorspace_fragment>
  }`;
const markerVertex = `
  uniform float underground; attribute vec3 warning; varying vec2 vUv; varying vec3 vWarning;
  void main(){
    vUv=uv;vWarning=warning;
    vec3 p=(instanceMatrix*vec4(position,1.)).xyz;
    p.y=sin(p.x*.026+p.z*.016)*4.8+sin(p.z*.048-p.x*.017)*2.7+sin(p.x*.065+p.z*.037)*1.1+sin(p.x*.012-p.z*.009)*4.+.13-underground*7.;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`;
const markerFragment = `
  uniform float time; varying vec2 vUv; varying vec3 vWarning;
  void main(){
    vec2 p=(vUv-.5)*2.; float r=length(p), aa=max(fwidth(r),.004), progress=vWarning.x;
    if(r>1.) discard;
    float angle=atan(p.y,p.x);
    float ticks=smoothstep(.2,.3,sin(angle*16.));
    float boundary=(1.-smoothstep(.014,.014+aa,abs(r-.94)))*(.42+ticks*.4);
    float closing=(1.-smoothstep(.012,.012+aa,abs(r-(.9-progress*.73))))*.85;
    float inner=(1.-smoothstep(.01,.01+aa,abs(r-.14)))*.55;
    float cross=(1.-smoothstep(.018,.018+aa,min(abs(p.x),abs(p.y))))*(1.-smoothstep(.08,.23,r));
    float urgent=.65+sin(time*(progress>.75?24.:8.))*.35;
    float fill=(1.-smoothstep(.87,.94,r))*(.055+progress*.14);
    float alpha=(boundary+closing+inner+cross*.7)*(.7+progress*.3)+fill*urgent;
    vec3 color=mix(vec3(1.,.24,.08),vec3(1.,.46,.12),vWarning.y);
    gl_FragColor=vec4(color,alpha*vWarning.z);
    #include <colorspace_fragment>
  }`;
export class World {
  terrain: THREE.Mesh;
  sandMaterial: THREE.ShaderMaterial;
  props = new THREE.Group(); scenery = new THREE.Group(); sense = new THREE.Group();
  models: THREE.Group[] = []; echoes: THREE.Group[] = [];
  flags: THREE.Mesh[] = []; winds: THREE.Line[] = []; balloons: THREE.Group[] = [];
  private preyBatches: ({ mesh: THREE.InstancedMesh; indices: number[] } & AnimatedPart)[] = [];
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private articulation = new THREE.Object3D(); private partMatrix = new THREE.Matrix4();
  private echoBatch: THREE.InstancedMesh;
  private echoSignals: THREE.InstancedBufferAttribute;
  private echoMaterial: THREE.ShaderMaterial;
  private windMaterial = new THREE.ShaderMaterial({ vertexShader: windVertex, fragmentShader: windFragment,
    uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false });
  private markerMaterial = new THREE.ShaderMaterial({ vertexShader: markerVertex, fragmentShader: markerFragment,
    uniforms: { time: { value: 0 }, underground: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  private markerBatch: THREE.InstancedMesh; private markerWarnings: THREE.InstancedBufferAttribute;
  private seenMarkers = new Set<number>(); private shotAge = -10;
  private previousAge = 0;
  underground = 0; skyMaterial: THREE.ShaderMaterial;
  trails = Array.from({ length: 12 }, () => new THREE.Vector3());
  constructor(scene: THREE.Scene, sim: Simulation) {
    scene.background = new THREE.Color(0xdca578); scene.fog = new THREE.FogExp2(0xd6a07b, .0033);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: { underground: { value: 0 } },
      vertexShader: 'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: skyFragment
    })); this.skyMaterial = sky.material; scene.add(sky);
    // Spend triangles in the playable basin, then stretch the grid toward the horizon.
    const geometry = new THREE.PlaneGeometry(2, 2, 224, 224); geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const u = positions.getX(i), v = positions.getZ(i);
      const x = u * 240 + u * u * u * 660, z = v * 240 + v * v * v * 660;
      positions.setXYZ(i, x, ground(x, z), z);
    }
    geometry.computeVertexNormals();
    this.sandMaterial = new THREE.ShaderMaterial({ vertexShader: terrainVertex, fragmentShader: terrainFragment,
      uniforms: { trail: { value: this.trails }, time: { value: 0 }, underground: { value: 0 }, wormScale: { value: 1 } }, side: THREE.DoubleSide });
    this.terrain = new THREE.Mesh(geometry, this.sandMaterial); scene.add(this.terrain);
    const hemi = new THREE.HemisphereLight(0xffe2b1, 0x7a6867, 2.6); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd5a0, 3.6); sun.position.set(-90, 120, -80);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -65; sun.shadow.camera.right = 65;
    sun.shadow.camera.top = 65; sun.shadow.camera.bottom = -65; sun.shadow.camera.near = 1; sun.shadow.camera.far = 350;
    sun.shadow.normalBias = .09; sun.shadow.bias = -.0004;
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0x86c5ce, 1.2); fill.position.set(20, 30, 80); scene.add(fill);
    scene.userData.sun = sun;
    this.makeLandscape();
    const kinds: PreyKind[] = ['rabbit', 'chicken', 'crate', 'urn', 'jeep', 'goat', 'militia', 'pickup', 'helicopter', 'balloon'];
    const templates = new Map(kinds.map(k => [k, preyModel(k)]));
    const echoPlane = new THREE.PlaneGeometry(2, 2); echoPlane.rotateX(-Math.PI / 2);
    const echoSeed = new THREE.SphereGeometry(.13, 6, 4); echoSeed.scale(1, 2, 1); echoSeed.translate(0, .22, 0);
    echoPlane.setAttribute('echoCore', new THREE.Float32BufferAttribute(new Float32Array(echoPlane.attributes.position.count), 1));
    echoSeed.setAttribute('echoCore', new THREE.Float32BufferAttribute(new Float32Array(echoSeed.attributes.position.count).fill(1), 1));
    const echoGeometry = mergeGeometries([echoPlane, echoSeed]); echoPlane.dispose(); echoSeed.dispose();
    this.echoSignals = new THREE.InstancedBufferAttribute(new Float32Array(sim.prey.length * 3), 3);
    this.echoSignals.setUsage(THREE.DynamicDrawUsage); echoGeometry.setAttribute('signal', this.echoSignals);
    this.echoMaterial = new THREE.ShaderMaterial({ vertexShader: echoVertex, fragmentShader: echoFragment,
      uniforms: { time: { value: 0 }, opacity: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.echoBatch = new THREE.InstancedMesh(echoGeometry, this.echoMaterial, sim.prey.length);
    this.echoBatch.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.echoBatch.frustumCulled = false; this.sense.add(this.echoBatch);
    for (const p of sim.prey) {
      this.models.push(new THREE.Group());
      const echo = new THREE.Group();
      this.echoSignals.setXYZ(p.id, p.seed % 1, p.kind === 'jeep' ? 1 : 0, 0);
      this.echoes.push(echo);
    }
    for (const kind of kinds) {
      const indices = sim.prey.filter(p => p.kind === kind).map(p => p.id);
      if (!indices.length) continue;
      for (const part of templates.get(kind)!.children as THREE.Mesh[]) {
        const batch = new THREE.InstancedMesh(part.geometry, part.material, indices.length);
        batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage); batch.frustumCulled = false; batch.castShadow = !(part.material as THREE.Material).transparent; batch.receiveShadow = true;
        this.props.add(batch); this.preyBatches.push({ mesh: batch, indices, ...part.userData as AnimatedPart });
      }
    }
    const markerGeometry = new THREE.PlaneGeometry(2, 2, 16, 16); markerGeometry.rotateX(-Math.PI / 2);
    this.markerWarnings = new THREE.InstancedBufferAttribute(new Float32Array(12 * 3), 3); this.markerWarnings.setUsage(THREE.DynamicDrawUsage);
    markerGeometry.setAttribute('warning', this.markerWarnings);
    this.markerBatch = new THREE.InstancedMesh(markerGeometry, this.markerMaterial, 12); this.markerBatch.frustumCulled = false;
    this.markerBatch.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.markerBatch.visible = false;
    scene.add(this.props, this.scenery, this.sense, this.markerBatch);
  }
  private makeLandscape() {
    const rng = random(54);
    // Eroded sentinels frame the basin rather than enclosing it with a wall.
    const rocks = new THREE.InstancedMesh(sandstoneGeometry(), new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, flatShading: true }), 80); rocks.castShadow = false; rocks.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 80; i++) {
      const a = rng() * Math.PI * 2, r = 260 + rng() * 450, x = Math.sin(a) * r, z = Math.cos(a) * r;
      const h = 3 + Math.pow(rng(), 2) * (i < 18 ? 55 : 28);
      dummy.position.set(x, ground(x, z) - .8, z); dummy.scale.set(9 + rng() * 15, h, 8 + rng() * 12);
      dummy.rotation.set(rng() * .15, rng() * 6, rng() * .2); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
    }
    this.scenery.add(rocks);
    const tufts = new THREE.InstancedMesh(geo.cone, mat(0xc6b17a), 550);
    for (let i = 0; i < 550; i++) {
      const x = (rng() - .5) * 360, z = (rng() - .5) * 360;
      dummy.position.set(x, ground(x, z) + .25, z); dummy.scale.set(.12, .6 + rng() * .7, .13); dummy.rotation.set(.3, rng() * 6, .25); dummy.updateMatrix(); tufts.setMatrixAt(i, dummy.matrix);
    }
    this.scenery.add(tufts);
    const camps = new THREE.Group();
    for (const [x, z] of [[23, -25], [-54, -25], [68, 67], [-74, 80], [20, -115], [116, -44]]) {
      const camp = new THREE.Group(); camp.position.set(x - 6, ground(x - 6, z - 7), z - 7);
      const tent = new THREE.Mesh(new THREE.ConeGeometry(4.4, 3.3, 4, 1, true), mat(0xddd0a6)); tent.position.y = 1.65; tent.rotation.y = Math.PI / 4; camp.add(tent);
      mesh(camp, geo.box, 0x584c3e, [0, 1.05, 2.23], [1.15, 2.1, .03]);
      for (const s of [-1, 1]) mesh(camp, geo.cylinder, 0x85694a, [s * 3.2, 1.3, 0], [.055, 2.6, .055]);
      mesh(camp, geo.cylinder, 0x80634b, [6, 3.8, -2], [.07, 7.6, .07]);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.05, 12, 4), mat(colors.coral)); flag.material = mat(colors.coral).clone(); flag.material.side = THREE.DoubleSide;
      flag.position.set(camp.position.x + 7.3, camp.position.y + 6.8, camp.position.z - 2); this.flags.push(flag); this.scenery.add(flag); camps.add(camp);
      // Tent stays as background geometry; every nearby box, pot and jeep is interactive.
    }
    this.scenery.add(bake(camps));
    // A natural arch and its sediment bands anchor the horizon.
    const arch = new THREE.Group(); arch.position.set(-170, ground(-170, -150), -150); arch.rotation.y = -.2;
    for (const s of [-1, 1]) {
      mesh(arch, geo.ico, 0xbe8868, [s * 14, 17, 0], [10, 25, 12]);
      for (let k = 0; k < 5; k++) mesh(arch, geo.ico, k % 2 ? 0xc9916e : 0xae755b, [s * (14 - k * .7), 3 + k * 7, 0], [10.5, 2.4, 12]);
    }
    mesh(arch, geo.ico, 0xca9370, [0, 35, 0], [27, 7, 12]); this.scenery.add(bake(arch));
    for (let i = 0; i < 3; i++) {
      const balloon = new THREE.Group(); const c = i % 2 ? colors.ivory : colors.rust;
      mesh(balloon, geo.sphere, c, [0, 0, 0], [3.5, 4.5, 3.5]);
      mesh(balloon, geo.cone, c, [0, -3.6, 0], [2.7, 2.2, 2.7], [Math.PI, 0, 0]);
      mesh(balloon, geo.box, 0x604d3e, [0, -6.3, 0], [1.8, 1.1, 1.6]);
      for (const s of [-1, 1]) mesh(balloon, geo.cylinder, colors.ink, [s * .7, -5, 0], [.035, 2.1, .035]);
      balloon.position.set(50 + i * 55, 50 + i * 13, -220 - i * 35); this.balloons.push(balloon); this.scenery.add(balloon);
    }
    const windPositions: number[] = [], seeds: number[] = [], alongs: number[] = [];
    for (let i = 0; i < 32; i++) {
      const x = (rng() - .5) * 300, z = (rng() - .5) * 300, seed = rng();
      for (let n = 0; n < 11; n++) for (const j of [n, n + 1]) {
        windPositions.push(x + j * 1.4, 0, z + Math.sin(j * .3) * .9); seeds.push(seed); alongs.push(j / 11);
      }
    }
    const windGeometry = new THREE.BufferGeometry(); windGeometry.setAttribute('position', new THREE.Float32BufferAttribute(windPositions, 3));
    windGeometry.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1)); windGeometry.setAttribute('along', new THREE.Float32BufferAttribute(alongs, 1));
    const wind = new THREE.LineSegments(windGeometry, this.windMaterial); wind.frustumCulled = false; this.winds.push(wind); this.scenery.add(wind);
  }
  update(sim: Simulation, dt: number) {
    if (sim.age < this.previousAge) { this.seenMarkers.clear(); this.shotAge = -10; }
    this.previousAge = sim.age;
    this.underground = damp(this.underground, sim.deep ? 1 : 0, sim.deep ? 4 : 8, dt);
    this.skyMaterial.uniforms.underground.value = this.underground;
    this.sandMaterial.uniforms.time.value = sim.age; this.sandMaterial.uniforms.underground.value = this.underground;
    this.sandMaterial.uniforms.wormScale.value = sim.mode === 'hunt' ? sim.hunt.scale : 1;
    this.echoMaterial.uniforms.time.value = sim.age; this.echoMaterial.uniforms.opacity.value = this.underground * .85;
    this.windMaterial.uniforms.time.value = sim.age;
    for (let i = 0; i < 12; i++) {
      const p = sim.history[Math.min(i * 4, sim.history.length - 1)];
      const depth = ground(p.x, p.z) - p.y;
      this.trails[i].set(p.x, depth > 0 && depth < 3 ? (1 - depth / 3) * (1 - i / 16) : 0, p.z);
    }
    this.props.visible = this.underground < .65; this.scenery.visible = this.underground < .65;
    this.sense.visible = this.underground > .25;
    sim.prey.forEach((p, i) => {
      const model = this.models[i]; model.visible = p.alive;
      if (p.alive) {
        model.position.set(p.x, p.y, p.z); model.rotation.set(p.flipped ? Math.PI : p.airborne && p.kind !== 'helicopter' && p.kind !== 'balloon' ? sim.age * p.spin : 0, p.yaw, 0);
        model.scale.setScalar(1);
        if (p.flipped) model.position.y += 2.4;
        if (p.kind === 'rabbit' || p.kind === 'chicken') {
          const near = Math.hypot(p.x - sim.x, p.z - sim.z) < 17 && sim.depth < 3;
          model.rotation.x += Math.sin(sim.age * (near ? 14 : 6) + p.seed) * (near ? .22 : .035);
        } else if (p.kind === 'goat' || p.kind === 'militia') {
          const scared = Math.hypot(p.x - sim.x, p.z - sim.z) < 35 && sim.depth < 4;
          model.position.y += Math.abs(Math.sin(sim.age * (scared ? 11 : 6) + p.seed)) * (scared ? .17 : .035);
          model.rotation.x += scared ? -.12 : .025;
        } else if (p.kind === 'pickup') {
          model.position.y += Math.sin(sim.age * 11 + p.seed) * .045;
          if (!p.flipped && !p.airborne) model.rotation.z = Math.sin(sim.age * 2.8 + p.seed) * .035;
        } else if (p.kind === 'helicopter') {
          model.rotation.set(-.08 + Math.sin(sim.age * .9) * .045 + Math.exp(-Math.max(0, sim.age - this.shotAge) * 15) * .07, p.yaw, Math.sin(sim.age * 1.1) * .09);
        } else if (p.kind === 'balloon') {
          model.rotation.set(Math.sin(sim.age * .7) * .018, p.yaw, Math.sin(sim.age * .55) * .025);
        }
      }
      model.updateMatrix();
      const e = this.echoes[i], distance = Math.hypot(p.x - sim.x, p.z - sim.z), range = sim.speed < 10 ? 110 : 70;
      e.visible = p.alive && distance < range;
      e.position.set(p.x, ground(p.x, p.z) - 5.3, p.z);
      e.scale.setScalar(p.radius * 1.4 + 1.5); e.updateMatrix();
      this.echoBatch.setMatrixAt(i, e.visible ? e.matrix : this.hidden);
      const dangerous = p.kind === 'militia' || p.kind === 'pickup' || p.kind === 'helicopter';
      this.echoSignals.setY(i, sim.canEat(p) ? 0 : dangerous ? 1 : .5);
      this.echoSignals.setZ(i, Math.sqrt(Math.max(0, 1 - distance / range)) * (p.kind === 'rabbit' || p.kind === 'chicken' || p.airborne ? 1 : .8));
    });
    this.echoBatch.instanceMatrix.needsUpdate = true; this.echoSignals.needsUpdate = true;
    this.markerBatch.visible = sim.mode === 'hunt' && sim.markers.length > 0;
    this.markerMaterial.uniforms.time.value = sim.age; this.markerMaterial.uniforms.underground.value = this.underground;
    for (let i = 0; i < 12; i++) {
      const marker = sim.markers[i];
      if (marker) {
        if (!this.seenMarkers.has(marker.id)) {
          this.seenMarkers.add(marker.id); if (marker.kind === 'shell') this.shotAge = sim.age;
        }
        this.articulation.position.set(marker.x, 0, marker.z); this.articulation.rotation.set(0, 0, 0); this.articulation.scale.set(marker.radius, 1, marker.radius); this.articulation.updateMatrix();
        this.markerBatch.setMatrixAt(i, this.articulation.matrix);
        this.markerWarnings.setXYZ(i, 1 - marker.time / marker.duration, marker.kind === 'seismic' ? 1 : 0, 1);
      } else {
        this.markerBatch.setMatrixAt(i, this.hidden); this.markerWarnings.setXYZ(i, 0, 0, 0);
      }
    }
    for (const id of this.seenMarkers) if (!sim.markers.some(marker => marker.id === id)) this.seenMarkers.delete(id);
    this.markerBatch.instanceMatrix.needsUpdate = true; this.markerWarnings.needsUpdate = true;
    for (const batch of this.preyBatches) {
      batch.indices.forEach((index, slot) => {
        const p = sim.prey[index];
        if (!p.alive) { batch.mesh.setMatrixAt(slot, this.hidden); return; }
        if (batch.motion) {
          this.posePart(batch, p, sim);
          this.partMatrix.multiplyMatrices(this.models[index].matrix, this.articulation.matrix);
          batch.mesh.setMatrixAt(slot, this.partMatrix);
        } else batch.mesh.setMatrixAt(slot, this.models[index].matrix);
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    this.flags.forEach((flag, i) => {
      const attr = flag.geometry.attributes.position;
      for (let n = 0; n < attr.count; n++) attr.setZ(n, Math.sin(attr.getX(n) * 2.5 + sim.age * 5 + i) * .15 * (attr.getX(n) + 1.3));
      attr.needsUpdate = true;
    });
    this.balloons.forEach((b, i) => { b.position.y = 50 + i * 13 + Math.sin(sim.age * .45 + i) * 1.5; b.rotation.z = Math.sin(sim.age * .3 + i) * .04; });
  }
  private posePart(part: AnimatedPart, prey: Prey, sim: Simulation) {
    const pivot = part.pivot!, phase = part.phase ?? 0;
    const scared = Math.hypot(prey.x - sim.x, prey.z - sim.z) < 35 && sim.depth < 4;
    const stride = Math.sin(sim.age * (scared ? 11 : 6) + prey.seed) * phase;
    this.articulation.position.set(...pivot); this.articulation.rotation.set(0, 0, 0); this.articulation.scale.setScalar(1);
    switch (part.motion) {
      case 'goatLeg': this.articulation.rotation.x = stride * (scared ? .8 : .3); break;
      case 'personLeg': this.articulation.rotation.x = stride * (scared ? .8 : .42); break;
      case 'personArm':
        this.articulation.rotation.set(stride * .4, 0, phase * (scared ? 1.5 : .22) + stride * .35); break;
      case 'turret': case 'barrel': {
        this.articulation.rotation.y = Math.atan2(sim.x - prey.x, prey.z - sim.z) - prey.yaw;
        if (part.motion === 'barrel') this.articulation.translateZ(Math.exp(-Math.max(0, sim.age - this.shotAge) * 15) * .3);
        break;
      }
      case 'rotor': this.articulation.rotation.y = sim.age * 37; break;
      case 'tailRotor': this.articulation.rotation.x = sim.age * 53; break;
      case 'pennant': this.articulation.rotation.set(Math.sin(sim.age * 4) * .17, Math.sin(sim.age * 5) * .35, Math.sin(sim.age * 3) * .15); break;
      case 'flame': this.articulation.scale.set(.8, .65 + Math.sin(sim.age * 17) * .15, .8); break;
    }
    this.articulation.updateMatrix();
  }
}

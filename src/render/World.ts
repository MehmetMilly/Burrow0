import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { colors, geo, mat, mesh } from './palette';
import { ground, random, damp } from '../game/math';
import type { Simulation, PreyKind } from '../game/Simulation';

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
const terrainVertex = `
  uniform vec3 trail[12]; uniform float time; uniform float underground;
  varying vec3 vWorld; varying vec3 vNormal; varying float vEye;
  void main() {
    vec3 p = position;
    for (int i=0; i<12; i++) {
      vec2 delta=p.xz-trail[i].xz;
      p.y += exp(-dot(delta,delta)*.35) * trail[i].y * .38;
    }
    vWorld=(modelMatrix*vec4(p,1.)).xyz; vNormal=normalize(mat3(modelMatrix)*normal);
    vec4 mv=modelViewMatrix*vec4(p,1.); vEye=-mv.z;
    gl_Position=projectionMatrix*mv;
  }`;
const terrainFragment = `
  uniform float time; uniform float underground;
  varying vec3 vWorld; varying vec3 vNormal; varying float vEye;
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main() {
    vec3 sun=normalize(vec3(-.7,.46,-.65));
    float light=max(dot(normalize(vNormal),sun),0.);
    float ripple=sin(vWorld.x*2.8+vWorld.z*1.6+sin(vWorld.z*.23)*2.+sin(vWorld.x*.09)*4.);
    float fine=hash(floor(vWorld.xz*34.));
    float wind=sin(vWorld.x*.031-vWorld.z*.014+time*.16)*.5+.5;
    vec3 shadow=vec3(.64,.365,.26), sand=vec3(.92,.68,.42);
    vec3 color=mix(shadow,sand,light*.78+.22);
    color += ripple*.021*(1.-smoothstep(25.,180.,vEye));
    color += (fine-.5)*.045*(1.-smoothstep(20.,100.,vEye));
    color += pow(fine,45.)*.22*light*(.6+wind*.4)*(1.-smoothstep(8.,85.,vEye));
    float fog=1.-exp(-max(vEye,0.)*.0021);
    color=mix(color,vec3(.88,.64,.48),fog);
    vec3 under=vec3(.07,.15,.17)+ripple*.008;
    color=mix(color,under,underground);
    gl_FragColor=vec4(pow(max(color,vec3(0.)),vec3(2.2)),1.);
    #include <colorspace_fragment>
  }`;
export class World {
  terrain: THREE.Mesh;
  sandMaterial: THREE.ShaderMaterial;
  props = new THREE.Group(); scenery = new THREE.Group(); sense = new THREE.Group();
  models: THREE.Group[] = []; echoes: THREE.Group[] = [];
  flags: THREE.Mesh[] = []; winds: THREE.Line[] = []; balloons: THREE.Group[] = [];
  underground = 0;
  trails = Array.from({ length: 12 }, () => new THREE.Vector3());
  constructor(scene: THREE.Scene, sim: Simulation) {
    scene.background = new THREE.Color(0xdca578); scene.fog = new THREE.FogExp2(0xd6a07b, .0033);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vDirection; void main(){vec3 d=normalize(vDirection); float y=max(d.y,0.); vec3 c=mix(vec3(.89,.64,.46),vec3(.33,.53,.59),pow(y,.55)); vec3 sun=normalize(vec3(-.7,.24,-.65)); float s=dot(d,sun); c+=vec3(.35,.17,.04)*pow(max(s,0.),12.); c=mix(c,vec3(1.,.87,.59),smoothstep(.9991,.9996,s)); gl_FragColor=vec4(pow(max(c,vec3(0.)),vec3(2.2)),1.);\n#include <colorspace_fragment>\n}`
    })); sky.material.fragmentShader = sky.material.fragmentShader.replace(' #include', '\n#include'); scene.add(sky);
    const geometry = new THREE.PlaneGeometry(1800, 1800, 300, 300); geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setY(i, ground(positions.getX(i), positions.getZ(i)));
    geometry.computeVertexNormals();
    this.sandMaterial = new THREE.ShaderMaterial({ vertexShader: terrainVertex, fragmentShader: terrainFragment,
      uniforms: { trail: { value: this.trails }, time: { value: 0 }, underground: { value: 0 } }, side: THREE.DoubleSide });
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
    const kinds: PreyKind[] = ['rabbit', 'chicken', 'crate', 'urn', 'jeep'];
    const templates = new Map(kinds.map(k => [k, preyModel(k)]));
    for (const p of sim.prey) {
      const m = templates.get(p.kind)!.clone(); this.props.add(m); this.models.push(m);
      const echo = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(p.radius * 1.7 + .7, .045, 4, 28), new THREE.MeshBasicMaterial({ color: p.kind === 'jeep' ? colors.coral : 0xf5ca87, transparent: true, opacity: .7, depthWrite: false }));
      ring.rotation.x = Math.PI / 2; echo.add(ring);
      const mark = new THREE.Mesh(new THREE.OctahedronGeometry(.4), new THREE.MeshBasicMaterial({ color: p.kind === 'jeep' ? colors.coral : colors.ivory, wireframe: true })); mark.position.y = .5; echo.add(mark);
      this.sense.add(echo); this.echoes.push(echo);
    }
    scene.add(this.props, this.scenery, this.sense);
  }
  private makeLandscape() {
    const rng = random(54);
    // Eroded sentinels frame the basin rather than enclosing it with a wall.
    const rocks = new THREE.InstancedMesh(geo.ico, mat(0xb97d61), 170); rocks.castShadow = false; rocks.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 170; i++) {
      const a = rng() * Math.PI * 2, r = 200 + rng() * 300, x = Math.sin(a) * r, z = Math.cos(a) * r;
      const h = 5 + Math.pow(rng(), 2) * 65;
      dummy.position.set(x, ground(x, z) + h * .3, z); dummy.scale.set(9 + rng() * 15, h, 8 + rng() * 12);
      dummy.rotation.set(rng() * .15, rng() * 6, rng() * .2); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
    }
    this.scenery.add(rocks);
    const tufts = new THREE.InstancedMesh(geo.cone, mat(0xc6b17a), 550);
    for (let i = 0; i < 550; i++) {
      const x = (rng() - .5) * 360, z = (rng() - .5) * 360;
      dummy.position.set(x, ground(x, z) + .25, z); dummy.scale.set(.12, .6 + rng() * .7, .13); dummy.rotation.set(.3, rng() * 6, .25); dummy.updateMatrix(); tufts.setMatrixAt(i, dummy.matrix);
    }
    this.scenery.add(tufts);
    for (const [x, z] of [[23, -25], [-54, -25], [68, 67], [-74, 80], [20, -115], [116, -44]]) {
      const camp = new THREE.Group(); camp.position.set(x - 6, ground(x - 6, z - 7), z - 7);
      const tent = new THREE.Mesh(new THREE.ConeGeometry(4.4, 3.3, 4, 1, true), mat(0xddd0a6)); tent.position.y = 1.65; tent.rotation.y = Math.PI / 4; camp.add(tent);
      mesh(camp, geo.box, 0x584c3e, [0, 1.05, 2.23], [1.15, 2.1, .03]);
      for (const s of [-1, 1]) mesh(camp, geo.cylinder, 0x85694a, [s * 3.2, 1.3, 0], [.055, 2.6, .055]);
      mesh(camp, geo.cylinder, 0x80634b, [6, 3.8, -2], [.07, 7.6, .07]);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.05, 12, 4), mat(colors.coral)); flag.material = mat(colors.coral).clone(); flag.material.side = THREE.DoubleSide;
      flag.position.set(7.3, 6.8, -2); this.flags.push(flag); camp.add(flag); this.scenery.add(camp);
      // Tent stays as background geometry; every nearby box, pot and jeep is interactive.
    }
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
    for (let i = 0; i < 32; i++) {
      const points = Array.from({ length: 12 }, (_, n) => new THREE.Vector3(n * 1.4, .1 + Math.sin(n * .4) * .12, Math.sin(n * .3) * .9));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xffe3ae, transparent: true, opacity: .15 }));
      line.position.set((rng() - .5) * 300, 0, (rng() - .5) * 300); line.userData.seed = rng(); this.winds.push(line); this.scenery.add(line);
    }
  }
  update(sim: Simulation, dt: number) {
    this.underground = damp(this.underground, sim.deep ? 1 : 0, sim.deep ? 4 : 8, dt);
    this.sandMaterial.uniforms.time.value = sim.age; this.sandMaterial.uniforms.underground.value = this.underground;
    for (let i = 0; i < 12; i++) {
      const p = sim.history[Math.min(i * 4, sim.history.length - 1)];
      const depth = ground(p.x, p.z) - p.y;
      this.trails[i].set(p.x, depth > 0 && depth < 3 ? 1 - depth / 3 : 0, p.z);
    }
    this.props.visible = this.underground < .65; this.scenery.visible = this.underground < .65;
    this.sense.visible = this.underground > .25;
    sim.prey.forEach((p, i) => {
      const model = this.models[i]; model.visible = p.alive;
      if (p.alive) {
        model.position.set(p.x, p.y, p.z); model.rotation.set(p.flipped ? Math.PI : p.airborne ? sim.age * p.spin : 0, p.yaw, 0);
        if (p.flipped) model.position.y += 1.6;
        if (p.kind === 'rabbit' || p.kind === 'chicken') {
          const near = Math.hypot(p.x - sim.x, p.z - sim.z) < 17 && sim.depth < 3;
          model.rotation.x += Math.sin(sim.age * (near ? 14 : 6) + p.seed) * (near ? .22 : .035);
        }
      }
      const e = this.echoes[i]; e.visible = p.alive && Math.hypot(p.x - sim.x, p.z - sim.z) < (sim.speed < 10 ? 110 : 70);
      e.position.set(p.x, ground(p.x, p.z) - 5, p.z);
      e.children[0].scale.setScalar(1 + (Math.sin(sim.age * 3 + p.seed) * .5 + .5) * 1.1);
    });
    this.flags.forEach((flag, i) => {
      const attr = flag.geometry.attributes.position;
      for (let n = 0; n < attr.count; n++) attr.setZ(n, Math.sin(attr.getX(n) * 2.5 + sim.age * 5 + i) * .15 * (attr.getX(n) + 1.3));
      attr.needsUpdate = true;
    });
    this.balloons.forEach((b, i) => { b.position.y = 50 + i * 13 + Math.sin(sim.age * .45 + i) * 1.5; b.rotation.z = Math.sin(sim.age * .3 + i) * .04; });
    this.winds.forEach((w, i) => {
      w.position.x += dt * (7 + w.userData.seed * 4); if (w.position.x > 170) w.position.x = -170;
      w.position.y = ground(w.position.x, w.position.z) + .2;
      (w.material as THREE.LineBasicMaterial).opacity = (Math.sin(sim.age + i) * .5 + .5) * .18;
    });
  }
}

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
  uniform vec3 trail[12]; uniform float time; uniform float underground;
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
    vWake=exp(-nearest*.18)*strength;
    p.y += vWake*.85;
    vec2 wakeSlope=-wakeDelta*vWake*.306;
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
    float phase=fract(time*.55+vSignal.x);
    float pulseRadius=.25+phase*.68;
    float pulse=(1.-smoothstep(.022,.022+aa,abs(radius-pulseRadius)))*(1.-phase*.65)*.95;
    float halo=(1.-smoothstep(.01,.01+aa,abs(radius-.3)))*.4;
    float core=exp(-dot(p,p)*75.);
    float alpha=mix(pulse+halo+core,.8,vCore)*vSignal.z*opacity;
    if(alpha<.006) discard;
    vec3 color=mix(vec3(.86,.84,.59),vec3(1.,.4,.2),vSignal.y);
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
export class World {
  terrain: THREE.Mesh;
  sandMaterial: THREE.ShaderMaterial;
  props = new THREE.Group(); scenery = new THREE.Group(); sense = new THREE.Group();
  models: THREE.Group[] = []; echoes: THREE.Group[] = [];
  flags: THREE.Mesh[] = []; winds: THREE.Line[] = []; balloons: THREE.Group[] = [];
  private preyBatches: { mesh: THREE.InstancedMesh; indices: number[] }[] = [];
  private hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private echoBatch: THREE.InstancedMesh;
  private echoSignals: THREE.InstancedBufferAttribute;
  private echoMaterial: THREE.ShaderMaterial;
  private windMaterial = new THREE.ShaderMaterial({ vertexShader: windVertex, fragmentShader: windFragment,
    uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false });
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
      for (const part of templates.get(kind)!.children as THREE.Mesh[]) {
        const batch = new THREE.InstancedMesh(part.geometry, part.material, indices.length);
        batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage); batch.frustumCulled = false; batch.castShadow = true; batch.receiveShadow = true;
        this.props.add(batch); this.preyBatches.push({ mesh: batch, indices });
      }
    }
    scene.add(this.props, this.scenery, this.sense);
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
    this.underground = damp(this.underground, sim.deep ? 1 : 0, sim.deep ? 4 : 8, dt);
    this.skyMaterial.uniforms.underground.value = this.underground;
    this.sandMaterial.uniforms.time.value = sim.age; this.sandMaterial.uniforms.underground.value = this.underground;
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
        model.position.set(p.x, p.y, p.z); model.rotation.set(p.flipped ? Math.PI : p.airborne ? sim.age * p.spin : 0, p.yaw, 0);
        if (p.flipped) model.position.y += 2.4;
        if (p.kind === 'rabbit' || p.kind === 'chicken') {
          const near = Math.hypot(p.x - sim.x, p.z - sim.z) < 17 && sim.depth < 3;
          model.rotation.x += Math.sin(sim.age * (near ? 14 : 6) + p.seed) * (near ? .22 : .035);
        }
      }
      model.updateMatrix();
      const e = this.echoes[i], distance = Math.hypot(p.x - sim.x, p.z - sim.z), range = sim.speed < 10 ? 110 : 70;
      e.visible = p.alive && distance < range;
      e.position.set(p.x, ground(p.x, p.z) - 5.3, p.z);
      e.scale.setScalar(p.radius * 1.4 + 1.5); e.updateMatrix();
      this.echoBatch.setMatrixAt(i, e.visible ? e.matrix : this.hidden);
      this.echoSignals.setZ(i, Math.sqrt(Math.max(0, 1 - distance / range)) * (p.kind === 'rabbit' || p.kind === 'chicken' || p.airborne ? 1 : .8));
    });
    this.echoBatch.instanceMatrix.needsUpdate = true; this.echoSignals.needsUpdate = true;
    for (const batch of this.preyBatches) {
      batch.indices.forEach((index, slot) => batch.mesh.setMatrixAt(slot, sim.prey[index].alive ? this.models[index].matrix : this.hidden));
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
    this.flags.forEach((flag, i) => {
      const attr = flag.geometry.attributes.position;
      for (let n = 0; n < attr.count; n++) attr.setZ(n, Math.sin(attr.getX(n) * 2.5 + sim.age * 5 + i) * .15 * (attr.getX(n) + 1.3));
      attr.needsUpdate = true;
    });
    this.balloons.forEach((b, i) => { b.position.y = 50 + i * 13 + Math.sin(sim.age * .45 + i) * 1.5; b.rotation.z = Math.sin(sim.age * .3 + i) * .04; });
  }
}

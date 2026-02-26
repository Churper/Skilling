import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ── Toon material ── */
function createToonGradient() {
  const c = document.createElement("canvas");
  c.width = 6; c.height = 1;
  const ctx = c.getContext("2d");
  for (let i = 0; i < 6; i++) {
    const v = [26, 68, 118, 176, 232, 255][i];
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}
const TOON_GRAD = createToonGradient();
function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRAD, ...opts });
}
function stabilizeModelLook(root) {
  if (!root) return;
  root.traverse(obj => {
    if (!obj?.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(m => {
      if (!m) return;
      if ("metalness" in m) m.metalness = 0;
      if ("roughness" in m) m.roughness = 1;
      if ("shininess" in m) m.shininess = 0;
      if ("specular" in m && m.specular?.setScalar) m.specular.setScalar(0);
      if ("envMapIntensity" in m) m.envMapIntensity = 0;
      if ("flatShading" in m) m.flatShading = true;
      m.needsUpdate = true;
    });
  });
}

/* ── Constants ── */
const LAKE_R = 24, WATER_R = 24.8, BOWL_Y = 0.58, WATER_Y = 0.596;
const MT_START = 46, MT_END = 100, MAP_R = 115;
const R_GROUND = 0, R_SHORE = 1, R_WATER = 2, R_DECOR = 3;
const SVC = Object.freeze({
  plaza:  { x: 0, z: -34, r: 14 },
  build:  { x: 18, z: -37, r: 10 },
  train:  { x: -24, z: -36, r: 10 },
});
const KEEP_OUT = Object.freeze([
  { x: SVC.plaza.x, z: SVC.plaza.z, r: SVC.plaza.r },
  { x: SVC.build.x, z: SVC.build.z, r: SVC.build.r },
  { x: SVC.train.x, z: SVC.train.z, r: SVC.train.r },
]);
function inKeepOut(x, z, pad = 0) {
  for (const k of KEEP_OUT) if (Math.hypot(x - k.x, z - k.z) <= k.r + pad) return true;
  return false;
}

/* ── Shoreline shape ── */
function lakeR(a) { return LAKE_R + Math.sin(a*1.7+0.5)*1.05 + Math.sin(a*3.4-1.2)*0.65 + Math.cos(a*5.1+0.2)*0.45; }
function waterR(a) { return lakeR(a) + (WATER_R - LAKE_R); }
function lakeRAt(x, z) { return lakeR(Math.atan2(z, x)); }
function waterRAt(x, z) { return waterR(Math.atan2(z, x)); }

/* ── Terrain ── */
function terrainNoise(x, z) {
  return Math.sin(x*0.045)*0.56 + Math.cos(z*0.037)*0.52 + Math.sin((x+z)*0.021)*0.4
    + Math.sin(x*0.12-z*0.09)*0.22 - Math.abs(Math.sin(x*0.082+z*0.073))*0.16;
}
function terrainH(x, z) {
  const r = Math.hypot(x, z), n = terrainNoise(x, z);
  const bowl = Math.pow(1 - THREE.MathUtils.smoothstep(r, 0, 31), 1.65) * 1.15;
  const amp = THREE.MathUtils.lerp(0.31, 0.55, THREE.MathUtils.smoothstep(r, 17.5, 50));
  const hill = Math.sin(x*0.065+z*0.048)*Math.cos(x*0.031-z*0.057);
  const flat = n * amp - bowl + THREE.MathUtils.smoothstep(r, 26, 50) * hill * 0.8;
  if (r <= MT_START) return flat;
  const mt = THREE.MathUtils.smoothstep(r, MT_START, MT_END);
  const angle = Math.atan2(z, x);
  return flat + mt*mt*70 + (Math.sin(angle*13.7+x*0.15)*0.5+0.5)*mt*8
    + (Math.cos(angle*7.3-z*0.12)*0.5+0.5)*mt*5 + Math.sin(x*0.18)*Math.cos(z*0.14)*mt*3;
}
function lakeFloorH(x, z) {
  const r = Math.hypot(x, z), lr = lakeRAt(x, z);
  if (r > lr) return -Infinity;
  const t = r / lr, d = Math.pow(1-t, 1.82);
  return BOWL_Y - (0.1 + d*1.95 + THREE.MathUtils.smoothstep(t, 0.74, 1)*0.08);
}

export function getWorldSurfaceHeight(x, z) {
  const f = lakeFloorH(x, z);
  return Number.isFinite(f) ? f : terrainH(x, z);
}
export function getWaterSurfaceHeight(x, z, time = 0) {
  const d = Math.hypot(x, z);
  if (d > waterRAt(x, z)) return -Infinity;
  const damp = 1 - (d / waterRAt(x, z)) * 0.18;
  return WATER_Y + (Math.sin(x*0.16+z*0.12+time*0.82)*0.032
    + Math.sin(x*0.28-z*0.22+time*0.65)*0.022
    + Math.cos(x*0.11+z*0.34-time*0.74)*0.026) * damp;
}

/* ── Helpers ── */
function setRes(n, type, label) { n.userData.resourceType = type; n.userData.resourceLabel = label; }
function setSvc(n, type, label) { n.userData.serviceType = type; n.userData.resourceLabel = label; }
const HOTSPOT_GEO = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12);
const HOTSPOT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false });
function addHotspot(parent, x, y, z, r = 0.9, h = 1.6) {
  const m = new THREE.Mesh(HOTSPOT_GEO, HOTSPOT_MAT);
  m.position.set(x, y, z); m.renderOrder = R_DECOR + 10;
  parent.add(m); return m;
}

/* ── Sky ── */
function addSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false,
    uniforms: {
      cTop: { value: new THREE.Color("#2888d4") },
      cMid: { value: new THREE.Color("#6ec8f4") },
      cBot: { value: new THREE.Color("#a8d8ee") },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 cTop,cMid,cBot; uniform float uTime; varying vec3 vP;
      float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float ns(vec2 p){vec2 i=floor(p),f=fract(p);float a=h21(i),b=h21(i+vec2(1,0)),c=h21(i+vec2(0,1)),d=h21(i+vec2(1,1));vec2 u=f*f*(3.0-2.0*f);return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;}
      float fbm(vec2 p){float v=0.0,a=0.55;for(int i=0;i<4;i++){v+=ns(p)*a;p*=2.05;a*=0.5;}return v;}
      void main(){
        float h=normalize(vP).y*0.5+0.5;
        vec3 c=mix(cBot,cMid,smoothstep(0.0,0.62,h)); c=mix(c,cTop,smoothstep(0.6,1.0,h));
        vec2 uv=normalize(vP).xz*3.2+vec2(uTime*0.01,-uTime*0.004);
        c=mix(c,vec3(1.0),smoothstep(0.62,0.9,fbm(uv+vec2(0,8)))*smoothstep(0.46,0.9,h)*0.24);
        gl_FragColor=vec4(c,1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(420, 32, 18), mat));
  return mat;
}

/* ── Terrain mesh — clean sharp zones ── */
function createTerrain(scene) {
  const inner = WATER_R - 1.5, outer = MAP_R, aSegs = 128, rRings = 55;
  const pos = [], col = [], idx = [];
  const cSand = new THREE.Color("#dcc890"), cGrass = new THREE.Color("#6bcf4f");
  const cGrassD = new THREE.Color("#2c8228"), cRock = new THREE.Color("#7a8771"), cCliff = new THREE.Color("#6d655b");
  const tmp = new THREE.Color();
  const vpr = aSegs + 1;

  for (let ri = 0; ri <= rRings; ri++) {
    const r = inner + (outer - inner) * Math.pow(ri / rRings, 0.45);
    for (let ai = 0; ai <= aSegs; ai++) {
      const a = (ai / aSegs) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const dist = Math.hypot(x, z);
      const wr = waterRAt(x, z);
      let y = terrainH(x, z);

      // Dip under water near shore — no gap
      if (dist < wr + 1.5) {
        const t = THREE.MathUtils.smoothstep(dist, wr - 1.5, wr + 1.5);
        y = THREE.MathUtils.lerp(WATER_Y - 0.12, y, t);
      }
      pos.push(x, y, z);

      // Sharp color zones
      const sandEdge = wr + 1.0;
      const sandT = THREE.MathUtils.smoothstep(dist, sandEdge, sandEdge + 0.8);
      const forestT = THREE.MathUtils.smoothstep(dist, 38, 48);
      const rockT = Math.max(
        THREE.MathUtils.smoothstep(dist, 44, 52) * 0.88,
        THREE.MathUtils.smoothstep(y, 3, 12) * 0.72
      );
      const cliffT = THREE.MathUtils.smoothstep(dist, 56, 73);

      tmp.copy(cSand).lerp(cGrass, sandT);
      if (forestT > 0) tmp.lerp(cGrassD, forestT * 0.76);
      if (rockT > 0) tmp.lerp(cRock, THREE.MathUtils.clamp(rockT, 0, 1));
      if (cliffT > 0) tmp.lerp(cCliff, cliffT * 0.84);

      // Toon lighting
      const ss = 0.8;
      const nx = -(terrainH(x+ss,z)-terrainH(x-ss,z)), ny = 2, nz = -(terrainH(x,z+ss)-terrainH(x,z-ss));
      const len = Math.hypot(nx, ny, nz);
      const lit = THREE.MathUtils.clamp((nx*0.54+ny*0.78+nz*0.31)/len*0.5+0.5, 0, 1);
      const banded = THREE.MathUtils.lerp(lit, Math.floor(lit*4.5)/4, 0.45);
      tmp.multiplyScalar(0.92 + banded * 0.22);

      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let ri = 0; ri < rRings; ri++)
    for (let ai = 0; ai < aSegs; ai++) {
      const a = ri*vpr+ai, b = a+1, c = (ri+1)*vpr+ai, d = c+1;
      idx.push(a,b,c, b,d,c);
    }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, toonMat("#fff", { vertexColors: true, fog: false }));
  mesh.renderOrder = R_GROUND;
  scene.add(mesh);
  return mesh;
}

/* ── Lake bowl ── */
function createBowl(scene) {
  const segs = 80, rings = 20, pos = [], col = [], idx = [];
  const deep = new THREE.Color("#2e8faf"), shelf = new THREE.Color("#95c9b4");

  for (let r = 0; r <= rings; r++) {
    const t = 0.03 + 0.97 * (r / rings);
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const rad = lakeR(a) * t;
      const x = Math.cos(a)*rad, z = Math.sin(a)*rad;
      const d = Math.pow(1-t, 1.72);
      const y = -(0.16 + d*1.78 + THREE.MathUtils.smoothstep(t, 0.72, 1)*0.05);
      pos.push(x, y, z);
      const c = new THREE.Color().copy(shelf).lerp(deep, THREE.MathUtils.smoothstep((-y-0.16)/1.92, 0.2, 0.8));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let r = 0; r < rings; r++) {
    const a = r*segs, b = (r+1)*segs;
    for (let s = 0; s < segs; s++) { const sn = (s+1)%segs; idx.push(a+s,b+s,b+sn, a+s,b+sn,a+sn); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, toonMat("#fff", { vertexColors: true, side: THREE.DoubleSide }));
  mesh.position.y = BOWL_Y; mesh.renderOrder = R_SHORE;
  scene.add(mesh);
}

/* ── Water — clean flat surface, no foam, no caustics ── */
function createWater(scene) {
  const uni = { uTime: { value: 0 } };
  createBowl(scene);

  const segs = 80, rings = 20, wPos = [], wRad = [], wIdx = [];
  for (let r = 0; r <= rings; r++) {
    const t = 0.03 + 0.97*(r/rings);
    for (let s = 0; s < segs; s++) {
      const a = (s/segs)*Math.PI*2;
      const rad = waterR(a)*t;
      wPos.push(Math.cos(a)*rad, 0, Math.sin(a)*rad);
      wRad.push(t);
    }
  }
  for (let r = 0; r < rings; r++) {
    const a = r*segs, b = (r+1)*segs;
    for (let s = 0; s < segs; s++) { const sn = (s+1)%segs; wIdx.push(a+s,b+s,b+sn, a+s,b+sn,a+sn); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(wIdx);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(wPos, 3));
  geo.setAttribute("aRad", new THREE.Float32BufferAttribute(wRad, 1));
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: uni,
    vertexShader: `
      attribute float aRad; varying float vR; uniform float uTime;
      void main(){
        vR = aRad; vec3 p = position; float t = uTime;
        p.y += sin(p.x*0.25+t*0.8)*0.025 + sin(p.z*0.2-t*0.6)*0.02 + cos(p.x*0.15+p.z*0.18+t*0.5)*0.015;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
      }`,
    fragmentShader: `
      varying float vR; uniform float uTime;
      void main(){
        vec3 deep = vec3(0.08,0.37,0.53);
        vec3 mid  = vec3(0.30,0.62,0.78);
        vec3 edge = vec3(0.50,0.80,0.88);
        vec3 c = mix(deep, mid, smoothstep(0.0, 0.55, vR));
        c = mix(c, edge, smoothstep(0.55, 0.92, vR));
        float shimmer = sin(vR*30.0+uTime*1.2)*0.015 + cos(vR*18.0-uTime*0.9)*0.01;
        c += shimmer;
        float a = 0.88 * smoothstep(1.01, 0.86, vR);
        if(a < 0.01) discard;
        gl_FragColor = vec4(c, a);
      }`,
  });
  const water = new THREE.Mesh(geo, mat);
  water.position.y = WATER_Y; water.renderOrder = R_WATER;
  scene.add(water);
  return { waterUniforms: uni, causticMap: null };
}

/* ── Shadow blobs ── */
function makeBlobTex() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const ctx = c.getContext("2d"); ctx.clearRect(0,0,256,256);
  const g = ctx.createRadialGradient(128,128,6,128,128,128);
  g.addColorStop(0,"rgba(255,255,255,0.82)"); g.addColorStop(0.55,"rgba(255,255,255,0.32)"); g.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter;
  return tex;
}
function addBlob(scene, tex, x, z, radius = 1.8, opacity = 0.2) {
  const y = getWorldSurfaceHeight(x, z);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius*2, radius*2),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: "#344347",
      opacity, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  m.rotation.x = -Math.PI/2;
  const p = Math.sin(x*12.99+z*78.23)*43758.55; m.rotation.z = (p-Math.floor(p))*Math.PI;
  m.position.set(x, y+0.02, z); m.renderOrder = R_GROUND+1;
  scene.add(m); return m;
}

/* ── Model loading ── */
async function loadModels() {
  THREE.Cache.enabled = true;
  const loader = new GLTFLoader();
  const load = url => new Promise((res, rej) => loader.load(url, g => res(g.scene), undefined, rej));
  const E = {
    tree1a:'models/Tree_1_A_Color1.gltf', tree1b:'models/Tree_1_B_Color1.gltf',
    tree2a:'models/Tree_2_A_Color1.gltf', tree2b:'models/Tree_2_B_Color1.gltf',
    tree3a:'models/Tree_3_A_Color1.gltf', tree3b:'models/Tree_3_B_Color1.gltf',
    tree4a:'models/Tree_4_A_Color1.gltf', tree4b:'models/Tree_4_B_Color1.gltf',
    treeBare1a:'models/Tree_Bare_1_A_Color1.gltf', treeBare1b:'models/Tree_Bare_1_B_Color1.gltf',
    treeBare2a:'models/Tree_Bare_2_A_Color1.gltf',
    bush1a:'models/Bush_1_A_Color1.gltf', bush1b:'models/Bush_1_B_Color1.gltf',
    bush2a:'models/Bush_2_A_Color1.gltf', bush2b:'models/Bush_2_B_Color1.gltf',
    bush3a:'models/Bush_3_A_Color1.gltf', bush4a:'models/Bush_4_A_Color1.gltf',
    rock1a:'models/Rock_1_A_Color1.gltf', rock1b:'models/Rock_1_B_Color1.gltf',
    rock2a:'models/Rock_2_A_Color1.gltf', rock2b:'models/Rock_2_B_Color1.gltf',
    rock3a:'models/Rock_3_A_Color1.gltf', rock3b:'models/Rock_3_B_Color1.gltf',
    grass1a:'models/Grass_1_A_Color1.gltf', grass1b:'models/Grass_1_B_Color1.gltf',
    grass2a:'models/Grass_2_A_Color1.gltf', grass2b:'models/Grass_2_B_Color1.gltf',
    sword:'models/sword_A.gltf', bow:'models/bow_A_withString.gltf',
    staff:'models/staff_A.gltf', arrow:'models/arrow_A.gltf',
  };
  const keys = Object.keys(E);
  const res = await Promise.all(keys.map(k => load(E[k]).catch(() => null)));
  res.forEach(m => stabilizeModelLook(m));
  const M = {}; keys.forEach((k,i) => M[k] = res[i]);
  return {
    trees: [M.tree1a,M.tree1b,M.tree2a,M.tree2b,M.tree3a,M.tree3b,M.tree4a,M.tree4b].filter(Boolean),
    bareTrees: [M.treeBare1a,M.treeBare1b,M.treeBare2a].filter(Boolean),
    bushes: [M.bush1a,M.bush1b,M.bush2a,M.bush2b,M.bush3a,M.bush4a].filter(Boolean),
    rocks: [M.rock1a,M.rock1b,M.rock2a,M.rock2b].filter(Boolean),
    bigRocks: [M.rock3a,M.rock3b].filter(Boolean),
    grass: [M.grass1a,M.grass1b,M.grass2a,M.grass2b].filter(Boolean),
    weapons: { sword: M.sword, bow: M.bow, staff: M.staff, arrow: M.arrow },
  };
}

/* ── Place helper ── */
function placeModel(scene, template, x, z, scale, rot) {
  const m = template.clone();
  m.scale.setScalar(scale); m.rotation.y = rot;
  m.position.set(x, getWorldSurfaceHeight(x, z), z);
  scene.add(m); return m;
}

/* ── Trees — clustered, south shore open ── */
function placeTrees(scene, blob, models, nodes) {
  const T = models.trees; if (!T.length) return;
  const clusters = [
    // North shore
    { c:[6,30], t:[{x:0,z:0,s:2.0,r:0.6},{x:2.8,z:1.5,s:1.7,r:1.4},{x:-1.5,z:2.2,s:1.8,r:2.8}] },
    { c:[-8,31], t:[{x:0,z:0,s:1.9,r:3.2},{x:-2.5,z:0.8,s:1.65,r:4.6},{x:1.2,z:2,s:1.75,r:5.8}] },
    { c:[20,26], t:[{x:0,z:0,s:1.85,r:1},{x:2.2,z:-1.4,s:1.6,r:2.2}] },
    { c:[-22,25], t:[{x:0,z:0,s:1.8,r:4},{x:-2,z:-1,s:1.55,r:5.4}] },
    { c:[0,36], t:[{x:0,z:0,s:2.1,r:.2},{x:3,z:.5,s:1.7,r:1.8},{x:-2.5,z:1.8,s:1.85,r:3.6},{x:1,z:3,s:1.6,r:5}] },
    // East
    { c:[32,12], t:[{x:0,z:0,s:1.9,r:.8},{x:2.4,z:1.8,s:1.6,r:2},{x:-1,z:2.5,s:1.7,r:3.4}] },
    { c:[34,-4], t:[{x:0,z:0,s:1.75,r:4.4},{x:2,z:-1.5,s:1.55,r:5.6}] },
    // West
    { c:[-33,10], t:[{x:0,z:0,s:1.85,r:1.2},{x:-2.2,z:1.6,s:1.65,r:2.6},{x:1.5,z:2.8,s:1.7,r:4.2}] },
    { c:[-35,-6], t:[{x:0,z:0,s:1.8,r:5},{x:-1.8,z:-1.2,s:1.6,r:.4}] },
    // Village accents
    { c:[-16,-36], t:[{x:0,z:0,s:2.2,r:1.8}] },
    { c:[13,-39], t:[{x:0,z:0,s:1.9,r:2.7}] },
    // Forest backdrop
    { c:[-18,-45], t:[{x:0,z:0,s:2,r:.9},{x:2.8,z:.5,s:1.8,r:1.7},{x:-2,z:1.2,s:1.9,r:2.4},{x:5,z:-.8,s:1.7,r:3}] },
    { c:[6,-46], t:[{x:0,z:0,s:2.1,r:3.6},{x:-2.5,z:.8,s:1.85,r:4.4},{x:3,z:1,s:1.95,r:5.2},{x:.5,z:-1.5,s:1.75,r:.3}] },
    { c:[24,-44], t:[{x:0,z:0,s:1.9,r:1.4},{x:2.5,z:1.5,s:1.7,r:2.8}] },
    { c:[-6,-47], t:[{x:0,z:0,s:1.85,r:4.8},{x:-3,z:-.5,s:1.75,r:.6}] },
  ];
  let i = 0;
  for (const cl of clusters) for (const t of cl.t) {
    const px = cl.c[0]+t.x, pz = cl.c[1]+t.z;
    if (inKeepOut(px, pz, 2.2)) continue;
    const m = placeModel(scene, T[i%T.length], px, pz, t.s, t.r);
    setRes(m, "woodcutting", "Tree"); nodes.push(m);
    addBlob(scene, blob, px, pz, t.s, 0.15); i++;
  }
}

/* ── Rocks ── */
function placeRocks(scene, blob, models, nodes) {
  const T = models.rocks; if (!T.length) return;
  const groups = [
    { c:[34,4], r:[{x:0,z:0,s:1.9,r:.3},{x:1.8,z:1.2,s:1.5,r:2.1}] },
    { c:[-32,6], r:[{x:0,z:0,s:2,r:3.2},{x:-1.5,z:1.8,s:1.6,r:5}] },
    { c:[14,32], r:[{x:0,z:0,s:1.8,r:4.1},{x:2,z:-1.2,s:1.5,r:1.4}] },
  ];
  let i = 0;
  for (const g of groups) for (const rk of g.r) {
    const px = g.c[0]+rk.x, pz = g.c[1]+rk.z;
    const m = placeModel(scene, T[i%T.length], px, pz, rk.s, rk.r);
    setRes(m, "mining", "Rock"); nodes.push(m);
    addBlob(scene, blob, px, pz, rk.s*0.7, 0.17); i++;
  }
}

function placeWaterRocks(scene, models) {
  const T = models.rocks; if (!T.length) return;
  [[-7.2,4.3,1.4,.4],[5.6,7.1,1.2,1.2],[8.8,-4.5,1.5,2],[-6.5,-6.2,1.1,3.4],[.6,9.2,1,4.8]]
    .forEach(([x,z,s,r],i) => { const m = placeModel(scene, T[i%T.length], x, z, s, r); m.renderOrder = R_DECOR; });
}

/* ── Bushes ── */
function placeBushes(scene, models) {
  const T = models.bushes; if (!T.length) return;
  [[-14,-30.5,1.1,.4],[14,-30.8,1.12,2.8],[-10,-33,1,3.4],[10,-33,.98,5.6],
   [8,29,1.14,2.1],[-10,30,1.1,2.8],[22,24,1.18,.2],[-24,22,1.2,4.2],
   [30,8,1.15,.5],[-30,6,1.1,1.1],[32,-8,1.08,1.9],[-32,-10,1.06,2.7],
   [-10,-43,1,5.2],[16,-43,1,5.8],[0,-44,.96,1.2],[-22,-44,1.02,3]]
    .forEach(([x,z,s,r],i) => { if(!inKeepOut(x,z,1.6)) { const m=placeModel(scene,T[i%T.length],x,z,s,r); m.renderOrder=R_DECOR; }});
}

/* ── Grass ── */
function placeGrass(scene, models) {
  const T = models.grass; if (!T.length) return;
  [[-8,-40],[4,-41],[-4,-39],[8,-40],[-12,-41],[12,-42],
   [4,32],[-6,34],[14,30],[-14,32],[0,38],[8,36],[-10,37],
   [34,11],[37,3],[36,-7],[33,-16],[-33,14],[-37,4],[-33,-15],[-36,-8],
   [40,14],[42,4],[-38,17],[-42,6],[28,28],[-27,27],[18,34],[-20,33]]
    .forEach(([x,z],i) => { if(!inKeepOut(x,z,1)) { const m=placeModel(scene,T[i%T.length],x,z,.86+(i%5)*.12,(i%16)*Math.PI/8); m.renderOrder=R_DECOR; }});
}

/* ── Mountain decor ── */
function placeMtnDecor(scene, models) {
  const R = models.bigRocks.length ? models.bigRocks : models.rocks;
  if (R.length) [[52,10,2.8,.4],[57,23,2.5,1.2],[61,-8,2.7,2.9],[54,-22,2.6,.9],
    [-52,12,2.8,.5],[-58,25,2.6,1.4],[-62,-9,2.8,3.1],[-55,-24,2.7,1.1],
    [30,52,3.2,3.8],[-25,55,3,4.1],[8,58,3.4,4.6],[-12,54,2.9,4.8],
    [38,-48,2.8,5.2],[-35,-50,3,5.4],[10,-54,3.1,2],[-10,-52,2.9,2.2]]
    .forEach(([x,z,s,r],i) => { const m = R[i%R.length].clone(); m.scale.setScalar(s); m.rotation.y=r; m.position.set(x,terrainH(x,z),z); scene.add(m); });

  const T = models.trees;
  if (T.length) [[48,15,1.8,.2],[51,28,1.7,1],[56,4,1.9,1.8],[-48,15,1.8,.4],[-51,28,1.7,1.2],[-56,2,1.9,2],
    [15,48,1.8,2.5],[-12,50,1.7,3.2],[0,52,1.9,3.8],[22,-48,1.7,2.7],[-20,-49,1.8,3.4]]
    .forEach(([x,z,s,r],i) => { const m = T[i%T.length].clone(); m.scale.setScalar(s); m.rotation.y=r; m.position.set(x,terrainH(x,z),z); scene.add(m); });
}

/* ── Lounges ── */
function addLounge(scene, blob, x, z, rot = 0) {
  const y = getWorldSurfaceHeight(x, z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.3,.24,1.05), toonMat("#f4d93e"));
  base.position.set(x,y+.72,z); base.rotation.y = rot; base.renderOrder = R_DECOR; scene.add(base);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2,.2,.7), toonMat("#f8df67"));
  back.position.set(x-Math.sin(rot)*.42, y+.98, z-Math.cos(rot)*.42);
  back.rotation.y = rot; back.rotation.x = -.28; back.renderOrder = R_DECOR; scene.add(back);
  addBlob(scene, blob, x, z, 1.7, .12);
}

/* ── Paths ── */
function pathGeo(curve, w, samples, yOff = .02) {
  const pos = [], uvs = [], idx = [], h = w/2;
  for (let i = 0; i <= samples; i++) {
    const t = i/samples, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const sx = -tan.z, sz = tan.x, len = Math.hypot(sx, sz) || 1;
    const nx = sx/len*h, nz = sz/len*h;
    const lx=p.x+nx, lz=p.z+nz, rx=p.x-nx, rz=p.z-nz;
    pos.push(lx, getWorldSurfaceHeight(lx,lz)+yOff, lz, rx, getWorldSurfaceHeight(rx,rz)+yOff, rz);
    uvs.push(t,0, t,1);
    if (i < samples) { const j=i*2; idx.push(j,j+1,j+2, j+1,j+3,j+2); }
  }
  const g = new THREE.BufferGeometry(); g.setIndex(idx);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs,2)); g.computeVertexNormals();
  return g;
}
function addPath(scene, pts, opts = {}) {
  if (!pts || pts.length < 2) return;
  const w = opts.width ?? 1.5, h = opts.height ?? .034, sm = opts.smooth ?? .22;
  const curve = new THREE.CatmullRomCurve3(pts.map(([x,z])=>new THREE.Vector3(x,0,z)), false, "catmullrom", sm);
  const n = Math.max(42, Math.floor(curve.getLength()*6));
  const edge = new THREE.Mesh(pathGeo(curve, w*1.26, n, h+.006), toonMat(opts.edgeColor||"#d8c39a",{transparent:true,opacity:.66}));
  edge.renderOrder = R_SHORE; scene.add(edge);
  const core = new THREE.Mesh(pathGeo(curve, w, n, h+.014), toonMat(opts.color||"#b79669"));
  core.renderOrder = R_SHORE+1; scene.add(core);
}

/* ── Oasis inlet (simple stream) ── */
function addInlet(scene, uni) {
  const pts = [[58.5,-19.8],[52.1,-17.1],[45,-13.9],[37.9,-10.9],[31.4,-8.8],[27.1,-7.3]];
  addPath(scene, pts, { width:2.7, color:"#bea47a", edgeColor:"#d9c8a3", height:.015, smooth:.16 });
  const curve = new THREE.CatmullRomCurve3(pts.map(([x,z])=>new THREE.Vector3(x,0,z)), false, "catmullrom", .16);
  const geo = pathGeo(curve, 1.4, 80, .034);
  const mat = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.DoubleSide, uniforms:{uTime:uni.uTime},
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; void main(){
      float f=sin(vUv.x*40.0-uTime*4.2)*.5+.5; f+=sin(vUv.x*73.0-uTime*3.1+vUv.y*4.0)*.5+.5; f*=.5;
      float e=smoothstep(.02,.2,vUv.y)*(1.0-smoothstep(.8,.98,vUv.y));
      vec3 c=mix(vec3(.28,.74,.9),vec3(.62,.9,.98),f*.45);
      float a=e*.78; if(a<.005)discard; gl_FragColor=vec4(c,a);
    }`,
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = R_WATER+1; scene.add(m);
}

/* ── Buildings ── */
function addBank(scene, blob, x, z, nodes) {
  const y = getWorldSurfaceHeight(x,z), g = new THREE.Group(); g.position.set(x,y,z);
  setSvc(g, "bank", "Bank Chest");
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2.2,.32,1.4), toonMat("#4e7f9b")), {position:new THREE.Vector3(0,.2,0), renderOrder:R_DECOR}));
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.25,.66,.82), toonMat("#c89d4d")), {position:new THREE.Vector3(0,.66,0), renderOrder:R_DECOR}));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(.41,.41,1.26,7,1,false,0,Math.PI), toonMat("#d7b16a"));
  lid.rotation.z=Math.PI*.5; lid.position.y=1; lid.renderOrder=R_DECOR; g.add(lid);
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.2,.24,.08), toonMat("#e7de8a")), {position:new THREE.Vector3(0,.64,.45), renderOrder:R_DECOR}));
  scene.add(g); addBlob(scene,blob,x,z,1.65,.16);
  if (nodes) nodes.push(addHotspot(g, 0,.95,.55,.86,1.75));
}

function addStore(scene, blob, x, z, nodes) {
  const y = getWorldSurfaceHeight(x,z), g = new THREE.Group(); g.position.set(x,y,z);
  setSvc(g, "store", "General Store");
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2.4,.34,1.3), toonMat("#7f5c38")), {position:new THREE.Vector3(0,.22,0), renderOrder:R_DECOR}));
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2.5,.22,1.36), toonMat("#e7a74a")), {position:new THREE.Vector3(0,1.46,0), renderOrder:R_DECOR}));
  const pL = new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,1.2,6), toonMat("#a97a4e"));
  pL.position.set(-.95,.78,.44); pL.renderOrder=R_DECOR; g.add(pL);
  const pR = pL.clone(); pR.position.x=.95; g.add(pR);
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.95,.42,.08), toonMat("#3f657d")), {position:new THREE.Vector3(0,1,.71), renderOrder:R_DECOR}));
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.04,12), toonMat("#f1d173"));
  coin.rotation.x=Math.PI*.5; coin.position.set(0,1,.76); coin.renderOrder=R_DECOR; g.add(coin);
  scene.add(g); addBlob(scene,blob,x,z,1.75,.16);
  if (nodes) nodes.push(addHotspot(g, 0,.9,.66,.95,1.8));
}

function addSmith(scene, blob, x, z, nodes) {
  const y = getWorldSurfaceHeight(x,z), g = new THREE.Group(); g.position.set(x,y,z);
  setSvc(g, "blacksmith", "Blacksmith Forge");
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2.6,.36,1.7), toonMat("#545b64")), {position:new THREE.Vector3(0,.2,0), renderOrder:R_DECOR}));
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(2.1,1.15,1.4), toonMat("#7b8793")), {position:new THREE.Vector3(0,.95,0), renderOrder:R_DECOR}));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45,.65,4), toonMat("#4a4f59"));
  roof.position.y=1.88; roof.rotation.y=Math.PI*.25; roof.renderOrder=R_DECOR; g.add(roof);
  const forge = new THREE.Mesh(new THREE.CylinderGeometry(.3,.34,.5,7), toonMat("#3f454f"));
  forge.position.set(0,.53,.82); forge.renderOrder=R_DECOR; g.add(forge);
  g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(.14,8,7), toonMat("#ff9b54")), {position:new THREE.Vector3(0,.67,.82), renderOrder:R_DECOR}));
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1,.46,.09), toonMat("#273547")), {position:new THREE.Vector3(0,1.2,.9), renderOrder:R_DECOR}));
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.24,.09,.09), toonMat("#dce6ed")), {position:new THREE.Vector3(-.07,1.23,.96), renderOrder:R_DECOR+1}));
  const hh = new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.24,6), toonMat("#9d7549"));
  hh.position.set(.05,1.2,.96); hh.rotation.z=Math.PI*.35; hh.renderOrder=R_DECOR+1; g.add(hh);
  scene.add(g); addBlob(scene,blob,x,z,1.85,.18);
  if (nodes) nodes.push(addHotspot(g, 0,.95,.9,1,1.95));
}

function addYard(scene, blob, x, z, nodes) {
  const y = getWorldSurfaceHeight(x,z), g = new THREE.Group(); g.position.set(x,y,z);
  setSvc(g, "construction", "House Construction Yard");
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,1.45,6), toonMat("#8f6742"));
  sp.position.set(-3.8,.98,3.7); sp.renderOrder=R_DECOR; g.add(sp);
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.85,.7,.1), toonMat("#2f536d")), {position:new THREE.Vector3(-3.8,1.52,3.78), renderOrder:R_DECOR+1}));
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.32,.11,.12), toonMat("#dce6ed")), {position:new THREE.Vector3(-3.98,1.54,3.86), renderOrder:R_DECOR+2}));
  const hh = new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,.28,6), toonMat("#9d7549"));
  hh.position.set(-3.72,1.5,3.86); hh.rotation.z=Math.PI*.35; hh.renderOrder=R_DECOR+2; g.add(hh);
  const H = new THREE.Group(); H.position.set(.15,.06,-.2); g.add(H);
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(4.6,.35,3.7), toonMat("#b7aea0")); foundation.position.y=.18; foundation.renderOrder=R_DECOR; H.add(foundation);
  const frame = new THREE.Group(); H.add(frame);
  const fMat = toonMat("#9c7048"), fGeo = new THREE.BoxGeometry(.2,1.5,.2);
  for (const [fx,fz] of [[-2,-1.5],[2,-1.5],[-2,1.5],[2,1.5]]) { const p=new THREE.Mesh(fGeo,fMat); p.position.set(fx,1,fz); p.renderOrder=R_DECOR+1; frame.add(p); }
  const bGeo = new THREE.BoxGeometry(4.25,.2,.2);
  const bF = new THREE.Mesh(bGeo,fMat); bF.position.set(0,1.74,1.5); bF.renderOrder=R_DECOR+1; frame.add(bF);
  const bB = bF.clone(); bB.position.z=-1.5; frame.add(bB);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(4.2,2,3.2), toonMat("#d8c09a")); walls.position.y=1.25; walls.renderOrder=R_DECOR+2; H.add(walls);
  const door = new THREE.Mesh(new THREE.BoxGeometry(.85,1.28,.09), toonMat("#7d5737")); door.position.set(0,.86,1.66); door.renderOrder=R_DECOR+3; door.visible=false; H.add(door);
  const wL = new THREE.Mesh(new THREE.BoxGeometry(.58,.5,.09), toonMat("#83c8df")); wL.position.set(-1.15,1.45,1.66); wL.renderOrder=R_DECOR+3; wL.visible=false; H.add(wL);
  const wR = wL.clone(); wR.position.x=1.15; H.add(wR);
  const yRoof = new THREE.Mesh(new THREE.ConeGeometry(3.08,1.38,4), toonMat("#91684e")); yRoof.position.y=2.78; yRoof.rotation.y=Math.PI*.25; yRoof.renderOrder=R_DECOR+3; H.add(yRoof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(.34,.86,.34), toonMat("#757980")); chimney.position.set(1,3,-.4); chimney.renderOrder=R_DECOR+4; H.add(chimney);
  const logPile = new THREE.Mesh(new THREE.CylinderGeometry(.75,.92,.46,8), toonMat("#9a6d45")); logPile.position.set(-2.7,.45,-2.3); logPile.renderOrder=R_DECOR; g.add(logPile);
  const orePile = new THREE.Mesh(new THREE.DodecahedronGeometry(.72,0), toonMat("#7f878f")); orePile.position.set(2.6,.7,-2.15); orePile.scale.y=.56; orePile.renderOrder=R_DECOR; g.add(orePile);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(2.65,2.65,.05,26), toonMat("#8adfa6")); glow.position.y=.08; glow.renderOrder=R_DECOR; glow.visible=false; g.add(glow);

  let stage = -1;
  const setProgress = (p, stock={logs:0,ore:0}) => {
    p = THREE.MathUtils.clamp(p,0,1);
    foundation.scale.set(1,.5+p*.5,1);
    frame.visible = p>=.12; frame.scale.y = THREE.MathUtils.clamp((p-.12)/.22,.2,1);
    walls.visible = p>=.33; walls.scale.set(1,THREE.MathUtils.clamp((p-.33)/.28,.12,1),1);
    door.visible = p>=.44; wL.visible = wR.visible = p>=.5;
    yRoof.visible = p>=.62; yRoof.scale.setScalar(.45+THREE.MathUtils.clamp((p-.62)/.2,0,1)*.55);
    chimney.visible = p>=.82; chimney.scale.y = THREE.MathUtils.clamp((p-.82)/.18,.25,1);
    const lr=THREE.MathUtils.clamp((stock.logs||0)/120,0,1), or=THREE.MathUtils.clamp((stock.ore||0)/80,0,1);
    logPile.scale.set(.4+lr*.9,.45+lr,0.4+lr*.9); orePile.scale.set(.45+or*.8,.32+or*.85,.45+or*.8);
    glow.visible = p>=1;
    stage = p>=1?4 : p>=.82?3 : p>=.62?2 : p>=.33?1 : 0;
  };
  setProgress(0); scene.add(g); addBlob(scene,blob,x,z,4.6,.16);
  if (nodes) nodes.push(addHotspot(g, -3.8,1.05,3.7,1.45,2.1));
  return { node:g, setProgress, getStage:()=>stage };
}

function addDummy(scene, blob, x, z, nodes) {
  const g = new THREE.Group(), y = getWorldSurfaceHeight(x,z); g.position.set(x,y,z);
  const bMat = toonMat("#a07040");
  g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,1.4,8), bMat), {position:new THREE.Vector3(0,.7,0)}));
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,1,6), bMat); arm.position.y=1.1; arm.rotation.z=Math.PI/2; g.add(arm);
  g.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(.2,8,8), toonMat("#c4a868")), {position:new THREE.Vector3(0,1.6,0)}));
  g.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.1,10), toonMat("#8a6038")), {position:new THREE.Vector3(0,.05,0)}));
  setSvc(g, "dummy", "Training Dummy"); scene.add(g);
  nodes.push(addHotspot(g, 0,.8,0,.6,1.8)); addBlob(scene,blob,x,z,.5,.18);
}

function addTrainYard(scene, blob, x, z) {
  const y = getWorldSurfaceHeight(x,z), g = new THREE.Group(); g.position.set(x,y,z);
  const fMat = toonMat("#8f6642"), fGeo = new THREE.CylinderGeometry(.07,.08,.72,6);
  for (let i=0;i<10;i++) { const a=(i/10)*Math.PI*2; const p=new THREE.Mesh(fGeo,fMat); p.position.set(Math.cos(a)*5.4,.42,Math.sin(a)*5.4); p.renderOrder=R_DECOR; g.add(p); }
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.07,.08,1.2,6), toonMat("#8a6240"));
  sp.position.set(0,.74,-4.7); sp.renderOrder=R_DECOR; g.add(sp);
  g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1.55,.52,.08), toonMat("#3d6079")), {position:new THREE.Vector3(0,1.15,-4.38), renderOrder:R_DECOR+1}));
  const cA = new THREE.Mesh(new THREE.BoxGeometry(.52,.06,.06), toonMat("#e5d08b"));
  cA.position.set(-.12,1.18,-4.32); cA.rotation.z=Math.PI*.2; cA.renderOrder=R_DECOR+2; g.add(cA);
  const cB = cA.clone(); cB.position.x=.12; cB.rotation.z=-Math.PI*.2; g.add(cB);
  scene.add(g); addBlob(scene,blob,x,z,3.5,.13);
}

/* ── Service Plaza ── */
function addPlaza(scene, blob, nodes, obstacles) {
  const tX=SVC.train.x, tZ=SVC.train.z, hX=SVC.build.x, hZ=SVC.build.z;
  const bk={x:-7,z:-34}, st={x:0,z:-34.5}, sm={x:7,z:-34};
  addPath(scene, [[-32,-31],[32,-31]], {width:3.05,color:"#b79063",smooth:.02});
  addPath(scene, [[0,-31],[0,-42]], {width:1.85,color:"#b58d61",smooth:.04});
  for (const p of [bk,st,sm]) addPath(scene, [[p.x,-31],[p.x,p.z+1.55]], {width:1.2,color:"#b58d61",smooth:.04});
  addPath(scene, [[8,-31],[12,-33],[hX,hZ]], {width:1.62,smooth:.2});
  addPath(scene, [[-8,-31],[-14,-33],[tX,tZ]], {width:1.62,smooth:.2});
  addBank(scene,blob,bk.x,bk.z,nodes);
  addStore(scene,blob,st.x,st.z,nodes);
  addSmith(scene,blob,sm.x,sm.z,nodes);
  addTrainYard(scene,blob,tX,tZ);
  addDummy(scene,blob,tX+3.1,tZ,nodes);
  addDummy(scene,blob,tX,tZ,nodes);
  addDummy(scene,blob,tX-3.1,tZ,nodes);
  const cs = addYard(scene,blob,hX,hZ,nodes);
  const cx=hX+.15, cz=hZ-.2;
  obstacles.push(
    {x:bk.x,z:bk.z,radius:1.35,id:"bank"},{x:st.x,z:st.z,radius:1.45,id:"store"},
    {x:sm.x,z:sm.z,radius:1.6,id:"blacksmith"},
    {x:cx,z:cz,radius:2.35,id:"house-core"},{x:cx-1.2,z:cz,radius:1.45,id:"house-left"},{x:cx+1.2,z:cz,radius:1.45,id:"house-right"}
  );
  return { constructionSite: cs };
}

/* ── Fishing ── */
const RING_GEO = new THREE.TorusGeometry(.5,.045,8,24);
const BOB_GEO = new THREE.SphereGeometry(.13,8,7);
const RING_MAT = new THREE.MeshBasicMaterial({color:"#dcf8ff",transparent:true,opacity:.72});
const BOB_MAT = toonMat("#ffcc58");

function addFishing(scene, nodes) {
  const spots = [];
  for (const [x,z,i] of [[-6.5,10.4,0],[8.4,9.2,1],[10.6,-5.3,2],[-9.2,-7.4,3],[2.3,13.1,4]]) {
    const g = new THREE.Group(); setRes(g,"fishing","Fishing Spot");
    g.userData.bobPhase = i*1.23; g.position.set(x,WATER_Y+.02,z); g.renderOrder=R_WATER+2;
    const ring = new THREE.Mesh(RING_GEO, RING_MAT.clone()); ring.rotation.x=Math.PI/2; g.add(ring);
    const bob = new THREE.Mesh(BOB_GEO, BOB_MAT); bob.position.y=.12; g.add(bob);
    g.userData.ring = ring; scene.add(g); nodes.push(g); spots.push(g);
  }
  return spots;
}
function updateFishing(spots, t) {
  for (const s of spots) {
    const p = s.userData.bobPhase||0;
    s.position.y = WATER_Y+.02+Math.sin(t*2+p)*.03;
    if (s.userData.ring) { s.userData.ring.scale.setScalar(1+Math.sin(t*2.2+p)*.06); s.userData.ring.material.opacity=.62+Math.sin(t*2.4+p)*.08; }
  }
}

/* ── Lily pads ── */
function addLilies(scene) {
  [{x:-8,z:6,r:.55},{x:-5,z:12,r:.45,f:"#f5a0c0"},{x:3,z:14,r:.6},{x:7,z:11,r:.5,f:"#f7e663"},
   {x:-11,z:3,r:.4},{x:12,z:-3,r:.55},{x:-4,z:-10,r:.5,f:"#f5a0c0"},{x:6,z:-8,r:.45},{x:-9,z:-5,r:.65},{x:10,z:5,r:.5}]
    .forEach((p,i) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(p.r,16,.2,Math.PI*2-.4), toonMat("#4a9e6b"));
      m.rotation.x=-Math.PI/2; m.rotation.z=(i*.73)%(Math.PI*2);
      m.position.set(p.x,WATER_Y+.01,p.z); m.renderOrder=R_WATER+1; scene.add(m);
      if (p.f) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(.08,8,6), toonMat(p.f));
        f.position.set(p.x+Math.sin(i*1.31)*.07, WATER_Y+.07, p.z+Math.cos(i*1.53)*.07);
        f.renderOrder=R_WATER+2; scene.add(f);
      }
    });
}

/* ── Wildflowers ── */
function addFlowers(scene) {
  const colors = ["#f5a0c0","#f7e663","#c4a0f5","#ff9e7a","#a0d8f0","#ffb6d9"];
  const sGeo = new THREE.CylinderGeometry(.015,.018,.35,4), bGeo = new THREE.SphereGeometry(.055,6,6), sMat = toonMat("#5a9e48");
  [[-6,-40],[2,-41],[-10,-42],[8,-43],[14,-41],[-14,-43],[-2,-44],[10,-45],[-8,-46],[4,-44],
   [10,-35],[8,-33],[-8,-32],[-10,-31],[3,-36],[-5,-37],
   [6,33],[8,35],[-4,34],[-8,32],[14,31],[-12,33],[2,37],
   [30,6],[32,-4],[-30,8],[-32,-2],[35,20],[-34,18]]
    .forEach(([x,z],i) => {
      if (inKeepOut(x,z,.6)) return;
      const y = getWorldSurfaceHeight(x,z);
      const s = new THREE.Mesh(sGeo, sMat); s.position.set(x,y+.18,z); s.renderOrder=R_DECOR; scene.add(s);
      const b = new THREE.Mesh(bGeo, toonMat(colors[i%colors.length])); b.position.set(x,y+.37,z); b.renderOrder=R_DECOR; scene.add(b);
    });
}

/* ── Entry ── */
export async function createWorld(scene) {
  const nodes = [], obstacles = [];
  const skyMat = addSky(scene);
  const ground = createTerrain(scene);
  const { waterUniforms, causticMap } = createWater(scene);
  addInlet(scene, waterUniforms);
  const blob = makeBlobTex();

  let models = null;
  try { models = await loadModels(); } catch(e) { console.warn("Model load failed:", e); }

  if (models) {
    placeTrees(scene,blob,models,nodes); placeRocks(scene,blob,models,nodes);
    placeWaterRocks(scene,models); placeBushes(scene,models);
    placeGrass(scene,models); placeMtnDecor(scene,models);
  }

  [[-10,-27,Math.PI],[-3.5,-27.5,Math.PI],[3.5,-27.5,Math.PI],[10,-27,Math.PI]]
    .forEach(([x,z,r]) => addLounge(scene,blob,x,z,r));

  addLilies(scene); addFlowers(scene);
  const fishing = addFishing(scene, nodes);
  const { constructionSite } = addPlaza(scene, blob, nodes, obstacles);

  return {
    ground, skyMat, waterUniforms, causticMap,
    addShadowBlob: (x,z,r,o) => addBlob(scene,blob,x,z,r,o),
    resourceNodes: nodes, updateWorld: t => updateFishing(fishing,t),
    constructionSite, collisionObstacles: obstacles,
    weaponModels: models?.weapons ?? null,
  };
}

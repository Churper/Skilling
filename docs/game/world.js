import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import {
  WATER_Y, GRASS_Y,
  CHUNK_SIZE, chunkBounds,
  getWorldSurfaceHeight as _getWSH,
  getWaterSurfaceHeight as _getWaSH,
} from "./terrainHeight.js";
import {
  loadTiles, buildTerrainMesh, getMeshSurfaceY, buildBridge,
  buildDock, buildFences, buildSteppingStones, addWaterfall, buildProps,
  TREE_SPOTS, ROCK_MAJOR_SPOTS, ROCK_SMALL_SPOTS,
  BUSH_SPOTS, CLIFF_ROCK_SPOTS, FISHING_SPOT_POSITIONS,
} from "./terrainLayout.js";

/* ══════════════════════════════════════════════════════════
   world.js — procedural-mesh terrain with river, hills, beach
   ══════════════════════════════════════════════════════════ */

/* ── re-export height API (keeps import contract for main.js) ── */
export function getWorldSurfaceHeight(x, z) { return _getWSH(x, z); }
export function getWaterSurfaceHeight(x, z, time = 0) { return _getWaSH(x, z, time); }
export { CHUNK_SIZE };

/* height with chunk heightOffsets baked in (for placing buildings on edited terrain) */
function _groundY(x, z) {
  let y = _getWSH(x, z);
  const ho = _tilemapData && _tilemapData.heightOffsets;
  if (ho) {
    const fx = Math.floor(x), fz = Math.floor(z);
    const tx = x - fx, tz = z - fz;
    const h00 = ho[`${fx},${fz}`] || 0;
    const h10 = ho[`${fx+1},${fz}`] || 0;
    const h01 = ho[`${fx},${fz+1}`] || 0;
    const h11 = ho[`${fx+1},${fz+1}`] || 0;
    y += h00*(1-tx)*(1-tz) + h10*tx*(1-tz) + h01*(1-tx)*tz + h11*tx*tz;
  }
  return y;
}

/* ── Toon material ── */
const TOON_GRAD = (() => {
  const c = document.createElement("canvas"); c.width = 6; c.height = 1;
  const ctx = c.getContext("2d");
  [26, 68, 118, 176, 232, 255].forEach((v, i) => {
    ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(i, 0, 1, 1);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
})();
function toonMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRAD, ...opts });
}
function stabilizeModelLook(root) {
  if (!root) return;
  root.traverse(o => {
    if (!o?.isMesh || !o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (!m) return;
      if ("metalness" in m) m.metalness = 0;
      if ("roughness" in m) m.roughness = 1;
      if ("shininess" in m) m.shininess = 0;
      if ("envMapIntensity" in m) m.envMapIntensity = 0;
      if ("flatShading" in m) m.flatShading = true;
      m.needsUpdate = true;
    });
  });
}
function m3(geo, mat, x, y, z, ro) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (ro != null) m.renderOrder = ro;
  return m;
}

/* ── Layout constants ── */
const R_GND = 0, R_WATER = 2, R_DECOR = 3;
const SVC = Object.freeze({
  plaza: { x: 0, z: -32, r: 14 },
  build: { x: 18, z: -35, r: 10 },
  train: { x: -22, z: -34, r: 8 },
});
const KEEP_OUT = [SVC.plaza, SVC.build, SVC.train];
function inKO(x, z, pad = 0) {
  for (const k of KEEP_OUT) if (Math.hypot(x - k.x, z - k.z) <= k.r + pad) return true;
  return false;
}

/* ── Helpers ── */
function setRes(n, t, l) { n.userData.resourceType = t; n.userData.resourceLabel = l; }
function setSvc(n, t, l) { n.userData.serviceType = t; n.userData.resourceLabel = l; }
const HS_GEO = new THREE.CylinderGeometry(.9, .9, 1.6, 12);
const HS_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false });
function addHS(par, x, y, z) {
  const m = new THREE.Mesh(HS_GEO, HS_MAT);
  m.position.set(x, y, z); m.renderOrder = R_DECOR + 10; par.add(m); return m;
}

/* ── Campfire builder ── */
export function createCampfire(scene, x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  /* log pile — 3 brown cylinders */
  const logGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6);
  const logMat = toonMat("#6b3a1f");
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(logGeo, logMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.set(Math.cos(i * 2.1) * 0.12, 0.08, Math.sin(i * 2.1) * 0.12);
    group.add(log);
  }

  /* fire — multiple transparent additive flame layers */
  const flameDefs = [
    { r: 0.24, h: 0.6,  segs: 8, color: "#ff4500", opacity: 0.38, y: 0.38 },
    { r: 0.17, h: 0.50, segs: 7, color: "#ff7b20", opacity: 0.32, y: 0.34 },
    { r: 0.11, h: 0.38, segs: 6, color: "#ffaa22", opacity: 0.45, y: 0.30 },
    { r: 0.06, h: 0.28, segs: 5, color: "#ffdd55", opacity: 0.50, y: 0.28 },
  ];
  const flames = [];
  for (const fd of flameDefs) {
    const geo = new THREE.ConeGeometry(fd.r, fd.h, fd.segs);
    const mat = new THREE.MeshBasicMaterial({
      color: fd.color,
      transparent: true,
      opacity: fd.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = fd.y;
    mesh.renderOrder = 5;
    group.add(mesh);
    flames.push({ mesh, mat, baseY: fd.y, baseOp: fd.opacity, baseR: fd.r });
  }

  /* animate flames — wobble scale, position, and opacity */
  let _flameT = Math.random() * 100;
  const origUpdate = group.onBeforeRender;
  group.onBeforeRender = () => {
    _flameT += 0.016; // ~60fps step
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const phase = _flameT * (5 + i * 1.3) + i * 2.1;
      const wobble = Math.sin(phase) * 0.4 + Math.sin(phase * 2.3) * 0.2;
      f.mesh.scale.x = 0.8 + wobble * 0.35;
      f.mesh.scale.z = 0.8 - wobble * 0.25;
      f.mesh.scale.y = 0.85 + Math.sin(phase * 1.7) * 0.25;
      f.mesh.position.y = f.baseY + Math.sin(phase * 0.9) * 0.04;
      f.mesh.rotation.y = wobble * 0.3;
      f.mat.opacity = f.baseOp * (0.7 + Math.sin(phase * 3.1) * 0.3);
    }
  };

  /* point light */
  const light = new THREE.PointLight("#ff8833", 1.2, 8);
  light.position.y = 0.5;
  group.add(light);

  /* shadow blob */
  const blobGeo = new THREE.CircleGeometry(0.4, 12);
  const blobMat = new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.25, depthWrite: false });
  const blob = new THREE.Mesh(blobGeo, blobMat);
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.01;
  blob.renderOrder = 1;
  group.add(blob);

  scene.add(group);
  return { group, light };
}

/* ── Sky ── */
function addSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false,
    uniforms: {
      cTop: { value: new THREE.Color("#1e78c8") },
      cMid: { value: new THREE.Color("#5cbcf0") },
      cBot: { value: new THREE.Color("#98d4ee") },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vP; void main(){vP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      uniform vec3 cTop,cMid,cBot; uniform float uTime; varying vec3 vP;
      float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float ns(vec2 p){vec2 i=floor(p),f=fract(p);float a=h21(i),b=h21(i+vec2(1,0)),c=h21(i+vec2(0,1)),d=h21(i+vec2(1,1));vec2 u=f*f*(3.0-2.0*f);return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;}
      float fbm(vec2 p){float v=0.0,a=0.55;for(int i=0;i<4;i++){v+=ns(p)*a;p*=2.05;a*=0.5;}return v;}
      void main(){
        float h=normalize(vP).y*.5+.5;
        vec3 c=mix(cBot,cMid,smoothstep(0.0,.62,h)); c=mix(c,cTop,smoothstep(.6,1.0,h));
        vec2 uv=normalize(vP).xz*3.2+vec2(uTime*.01,-uTime*.004);
        c=mix(c,vec3(1.0),smoothstep(.62,.9,fbm(uv+vec2(0,8)))*smoothstep(.46,.9,h)*.24);
        gl_FragColor=vec4(c,1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(420, 32, 18), mat));
  return mat;
}

/* ── Shadow blobs ── */
const blobTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const ctx = c.getContext("2d"); ctx.clearRect(0, 0, 256, 256);
  const g = ctx.createRadialGradient(128, 128, 6, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,0.82)");
  g.addColorStop(.55, "rgba(255,255,255,0.32)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.minFilter = t.magFilter = THREE.LinearFilter;
  return t;
})();
function addBlob(scene, x, z, radius = 1.8, opacity = .2) {
  const y = _groundY(x, z);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: blobTex, transparent: true, depthWrite: false, color: "#344347",
      opacity, toneMapped: false, polygonOffset: true,
      polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    })
  );
  m.rotation.x = -Math.PI / 2;
  const p = Math.sin(x * 12.99 + z * 78.23) * 43758.55;
  m.rotation.z = (p - Math.floor(p)) * Math.PI;
  m.position.set(x, y + .02, z);
  m.renderOrder = R_GND + 1;
  scene.add(m);
  return m;
}

/* ── Character / prop models ── */
async function loadModels() {
  THREE.Cache.enabled = true;
  const loader = new GLTFLoader();
  const load = url => new Promise((res, rej) => loader.load(url, g => res(g.scene), undefined, rej));
  const E = {
    t1a: 'models/Tree_1_A_Color1.gltf', t2a: 'models/Tree_2_A_Color1.gltf',
    t2c: 'models/Tree_2_C_Color1.gltf', t3a: 'models/Tree_3_A_Color1.gltf',
    t4a: 'models/Tree_4_A_Color1.gltf',
    b1a: 'models/Bush_1_A_Color1.gltf', b2a: 'models/Bush_2_A_Color1.gltf',
    r1j: 'models/Rock_1_J_Color1.gltf', r1k: 'models/Rock_1_K_Color1.gltf',
    r3a: 'models/Rock_3_A_Color1.gltf', r3c: 'models/Rock_3_C_Color1.gltf',
    r3e: 'models/Rock_3_E_Color1.gltf', r3g: 'models/Rock_3_G_Color1.gltf',
    sword: 'models/sword_A.gltf', bow: 'models/bow_A_withString.gltf',
    staff: 'models/staff_A.gltf', arrow: 'models/arrow_A.gltf',
  };
  const keys = Object.keys(E);
  const res = await Promise.all(keys.map(k => load(E[k]).catch(() => null)));
  res.forEach(m => stabilizeModelLook(m));
  const M = {}; keys.forEach((k, i) => M[k] = res[i]);
  const f = arr => arr.filter(Boolean);
  return {
    trees: f([M.t1a, M.t2a, M.t2c, M.t3a, M.t4a]),
    bushes: f([M.b1a, M.b2a]),
    cliffRocks: f([M.r1j, M.r1k, M.r3a, M.r3c, M.r3e, M.r3g]),
    weapons: { sword: M.sword, bow: M.bow, staff: M.staff, arrow: M.arrow },
  };
}

function placeM(scene, tmpl, x, z, s, r) {
  const m = tmpl.clone(); m.scale.setScalar(s); m.rotation.y = r;
  m.position.set(x, _groundY(x, z), z); scene.add(m); return m;
}

/* ── Trees ── */
function placeTrees(scene, M, nodes) {
  const T = M.trees; if (!T.length) return;
  TREE_SPOTS.forEach(([x, z, s, r], i) => {
    if (inKO(x, z, 3)) return;
    const m = placeM(scene, T[i % T.length], x, z, s, r);
    setRes(m, "woodcutting", "Tree"); nodes.push(m); addBlob(scene, x, z, s, .15);
  });
}

/* ── Mining rocks ── */
function placeRocks(scene, M, nodes) {
  const C = M.cliffRocks; if (!C.length) return;
  const spawnRock = (x, z, s, r, i) => {
    if (inKO(x, z, 1.6)) return;
    const m = C[i % C.length].clone();
    m.scale.setScalar(s); m.rotation.y = r;
    m.position.set(x, _groundY(x, z), z); scene.add(m);
    setRes(m, "mining", "Rock"); nodes.push(m);
  };
  ROCK_MAJOR_SPOTS.forEach(([x, z, s, r], i) => spawnRock(x, z, s, r, i));
  ROCK_SMALL_SPOTS.forEach(([x, z, s, r], i) => spawnRock(x, z, s, r, i + ROCK_MAJOR_SPOTS.length));
}

/* ── Cliff-ring decorative rocks ── */
function placeCliffRocks(scene, M) {
  const C = M.cliffRocks; if (!C.length) return;
  CLIFF_ROCK_SPOTS.forEach(([x, z, s, r], i) => {
    const m = C[i % C.length].clone();
    m.scale.setScalar(s); m.rotation.y = r;
    m.position.set(x, _groundY(x, z) - 2, z); scene.add(m);
  });
}

/* ── Bushes ── */
function placeBushes(scene, M) {
  const B = M.bushes; if (!B.length) return;
  BUSH_SPOTS.forEach(([x, z, s, r], i) => {
    if (!inKO(x, z, 1.5)) placeM(scene, B[i % B.length], x, z, s, r);
  });
}

/* ── Buildings ── */
function addBank(scene, x, z, nodes) {
  const y = _groundY(x, z), g = new THREE.Group(); g.position.set(x, y, z);
  setSvc(g, "bank", "Bank Chest");
  g.add(m3(new THREE.CylinderGeometry(1.2, 1.3, .3, 8), toonMat("#7a9eb5"), 0, .15, 0, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(1.3, .7, .85), toonMat("#d4a63c"), 0, .65, 0, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(1.34, .08, .88), toonMat("#8b6a2f"), 0, .45, 0, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(1.34, .08, .88), toonMat("#8b6a2f"), 0, .85, 0, R_DECOR));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(.43, .43, 1.32, 8, 1, false, 0, Math.PI), toonMat("#e0b84a"));
  lid.rotation.z = Math.PI * .5; lid.position.y = 1; lid.renderOrder = R_DECOR; g.add(lid);
  g.add(m3(new THREE.CylinderGeometry(.1, .1, .06, 8), toonMat("#c4a24a"), 0, .68, .46, R_DECOR));
  scene.add(g); addBlob(scene, x, z, 1.8, .16);
  if (nodes) nodes.push(addHS(g, 0, .95, .55));
}
function addStore(scene, x, z, nodes) {
  const y = _groundY(x, z), g = new THREE.Group(); g.position.set(x, y, z);
  setSvc(g, "store", "General Store");
  g.add(m3(new THREE.BoxGeometry(2.6, .25, 1.5), toonMat("#9a7044"), 0, .12, 0, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.4, 1.4, .15), toonMat("#7e5a30"), 0, .95, -.65, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.4, .08, 1.2), toonMat("#a87a48"), 0, .45, 0, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.4, .08, 1.2), toonMat("#a87a48"), 0, 1, 0, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.8, .12, 1.6), toonMat("#e8944a"), 0, 1.5, 0, R_DECOR));
  const pL = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 1.25, 6), toonMat("#9a7a4e"));
  pL.position.set(-1.1, .8, .55); pL.renderOrder = R_DECOR; g.add(pL);
  g.add(pL.clone().translateX(2.2));
  g.add(m3(new THREE.BoxGeometry(1, .35, .06), toonMat("#3f657d"), 0, 1.2, .72, R_DECOR + 1));
  scene.add(g); addBlob(scene, x, z, 1.9, .16);
  if (nodes) nodes.push(addHS(g, 0, .9, .66));
}
function addSmith(scene, x, z, nodes) {
  const y = _groundY(x, z), g = new THREE.Group(); g.position.set(x, y, z);
  setSvc(g, "blacksmith", "Blacksmith Forge");
  g.add(m3(new THREE.CylinderGeometry(1.4, 1.5, .25, 8), toonMat("#5a6068"), 0, .12, 0, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2, 1.2, 1.5), toonMat("#6e7880"), 0, .85, 0, R_DECOR));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, .7, 4), toonMat("#3e454e"));
  roof.position.y = 1.82; roof.rotation.y = Math.PI * .25; roof.renderOrder = R_DECOR; g.add(roof);
  g.add(m3(new THREE.SphereGeometry(.18, 8, 7), toonMat("#ff8844"), 0, .65, .82, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(.7, .3, .4), toonMat("#484e56"), -.8, .42, .8, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(.9, .4, .06), toonMat("#2a4050"), 0, 1.15, .82, R_DECOR));
  scene.add(g); addBlob(scene, x, z, 2, .18);
  if (nodes) nodes.push(addHS(g, 0, .95, .9));
}

function addYard(scene, x, z, nodes) {
  const y = _groundY(x, z), g = new THREE.Group(); g.position.set(x, y, z);
  setSvc(g, "construction", "House Construction Yard");
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, 1.45, 6), toonMat("#8f6742"));
  sp.position.set(-3.8, .98, 3.7); sp.renderOrder = R_DECOR; g.add(sp);
  g.add(m3(new THREE.BoxGeometry(1.85, .7, .1), toonMat("#2f536d"), -3.8, 1.52, 3.78, R_DECOR + 1));
  const H = new THREE.Group(); H.position.set(.15, .06, -.2); g.add(H);
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(4.6, .35, 3.7), toonMat("#b7aea0"));
  foundation.position.y = .18; foundation.renderOrder = R_DECOR; H.add(foundation);
  const frame = new THREE.Group(); H.add(frame);
  const fMat = toonMat("#9c7048"), fGeo = new THREE.BoxGeometry(.2, 1.5, .2);
  for (const [fx, fz] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]]) {
    const p = new THREE.Mesh(fGeo, fMat); p.position.set(fx, 1, fz); p.renderOrder = R_DECOR + 1; frame.add(p);
  }
  const bGeo = new THREE.BoxGeometry(4.25, .2, .2);
  const bF = new THREE.Mesh(bGeo, fMat); bF.position.set(0, 1.74, 1.5); bF.renderOrder = R_DECOR + 1; frame.add(bF);
  frame.add(bF.clone().translateZ(-3));
  const walls = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2, 3.2), toonMat("#d8c09a"));
  walls.position.y = 1.25; walls.renderOrder = R_DECOR + 2; H.add(walls);
  const door = new THREE.Mesh(new THREE.BoxGeometry(.85, 1.28, .09), toonMat("#7d5737"));
  door.position.set(0, .86, 1.66); door.renderOrder = R_DECOR + 3; door.visible = false; H.add(door);
  const wL = new THREE.Mesh(new THREE.BoxGeometry(.58, .5, .09), toonMat("#83c8df"));
  wL.position.set(-1.15, 1.45, 1.66); wL.renderOrder = R_DECOR + 3; wL.visible = false; H.add(wL);
  const wR = wL.clone(); wR.position.x = 1.15; H.add(wR);
  const yRoof = new THREE.Mesh(new THREE.ConeGeometry(3.08, 1.38, 4), toonMat("#91684e"));
  yRoof.position.y = 2.78; yRoof.rotation.y = Math.PI * .25; yRoof.renderOrder = R_DECOR + 3; H.add(yRoof);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(.34, .86, .34), toonMat("#757980"));
  chimney.position.set(1, 3, -.4); chimney.renderOrder = R_DECOR + 4; H.add(chimney);
  const logPile = new THREE.Mesh(new THREE.CylinderGeometry(.75, .92, .46, 8), toonMat("#9a6d45"));
  logPile.position.set(-2.7, .45, -2.3); logPile.renderOrder = R_DECOR; g.add(logPile);
  const orePile = new THREE.Mesh(new THREE.DodecahedronGeometry(.72, 0), toonMat("#7f878f"));
  orePile.position.set(2.6, .7, -2.15); orePile.scale.y = .56; orePile.renderOrder = R_DECOR; g.add(orePile);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, .05, 26), toonMat("#8adfa6"));
  glow.position.y = .08; glow.renderOrder = R_DECOR; glow.visible = false; g.add(glow);
  let stage = -1;
  const setProgress = (p, stock = { logs: 0, ore: 0 }) => {
    p = THREE.MathUtils.clamp(p, 0, 1);
    foundation.scale.set(1, .5 + p * .5, 1);
    frame.visible = p >= .12; frame.scale.y = THREE.MathUtils.clamp((p - .12) / .22, .2, 1);
    walls.visible = p >= .33; walls.scale.set(1, THREE.MathUtils.clamp((p - .33) / .28, .12, 1), 1);
    door.visible = p >= .44; wL.visible = wR.visible = p >= .5;
    yRoof.visible = p >= .62; yRoof.scale.setScalar(.45 + THREE.MathUtils.clamp((p - .62) / .2, 0, 1) * .55);
    chimney.visible = p >= .82; chimney.scale.y = THREE.MathUtils.clamp((p - .82) / .18, .25, 1);
    const lr = THREE.MathUtils.clamp((stock.logs || 0) / 120, 0, 1);
    const or = THREE.MathUtils.clamp((stock.ore || 0) / 80, 0, 1);
    logPile.scale.set(.4 + lr * .9, .45 + lr, .4 + lr * .9);
    orePile.scale.set(.45 + or * .8, .32 + or * .85, .45 + or * .8);
    glow.visible = p >= 1; stage = p >= 1 ? 4 : p >= .82 ? 3 : p >= .62 ? 2 : p >= .33 ? 1 : 0;
  };
  setProgress(0); scene.add(g); addBlob(scene, x, z, 4.6, .16);
  if (nodes) nodes.push(addHS(g, -3.8, 1.05, 3.7));
  return { node: g, setProgress, getStage: () => stage };
}

function addDummy(scene, x, z, nodes) {
  const g = new THREE.Group(), y = _groundY(x, z); g.position.set(x, y, z);
  const bMat = toonMat("#a07040");
  g.add(m3(new THREE.CylinderGeometry(.18, .22, 1.4, 8), bMat, 0, .7, 0));
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 1, 6), bMat);
  arm.position.y = 1.1; arm.rotation.z = Math.PI / 2; g.add(arm);
  g.add(m3(new THREE.SphereGeometry(.2, 8, 8), toonMat("#c4a868"), 0, 1.6, 0));
  g.add(m3(new THREE.CylinderGeometry(.28, .28, .1, 10), toonMat("#8a6038"), 0, .05, 0));
  setSvc(g, "dummy", "Training Dummy"); scene.add(g);
  nodes.push(addHS(g, 0, .8, 0)); addBlob(scene, x, z, .5, .18);
}

/* ── Shopkeeper slime (spawned next to Market_Stalls) ── */
function spawnShopkeeper(parent, x, y, z) {
  const geo = new THREE.SphereGeometry(0.65, 10, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    if (py < 0) py *= 0.52;
    const yN = (py + 0.65) / 1.3;
    const bulge = 1.0 + 0.2 * Math.sin(yN * Math.PI);
    px *= bulge * 1.02; py *= 1.08; pz *= bulge * 1.02;
    pos.setXYZ(i, px, py, pz);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhongMaterial({
    color: "#3ac95e", transparent: true, opacity: 0.72,
    shininess: 38, specular: new THREE.Color("#d8ffe4"),
  });
  const slime = new THREE.Mesh(geo, mat);
  slime.position.set(x, y + 0.5, z);
  slime.renderOrder = R_DECOR + 5;
  /* face */
  const faceG = new THREE.Group();
  faceG.position.set(0, 0.22, 0.56);
  slime.add(faceG);
  const fMat = new THREE.MeshBasicMaterial({ color: "#0d110f" });
  const eGeo = new THREE.SphereGeometry(0.052, 8, 8);
  const lEye = new THREE.Mesh(eGeo, fMat); lEye.position.set(-0.13, 0.1, 0.1);
  const rEye = new THREE.Mesh(eGeo, fMat); rEye.position.set(0.13, 0.1, 0.1);
  faceG.add(lEye, rEye);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 5, 10), fMat);
  mouth.position.set(0, -0.02, 0.11); mouth.rotation.x = Math.PI * 0.08;
  faceG.add(mouth);
  parent.add(slime);
  return slime;
}

function addTrainYard(scene, x, z) {
  const y = _groundY(x, z), g = new THREE.Group(); g.position.set(x, y, z);
  g.add(m3(new THREE.BoxGeometry(1.55, .52, .08), toonMat("#3d6079"), 0, 1.15, -4.38, R_DECOR + 1));
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 1.3, 6), toonMat("#8a6240"));
  sp.position.set(0, .74, -4.7); sp.renderOrder = R_DECOR; g.add(sp);
  scene.add(g); addBlob(scene, x, z, 3.5, .13);
}

/* ── Plaza ── */
function addPlaza(scene, nodes, obstacles) {
  const tX = SVC.train.x, tZ = SVC.train.z, hX = SVC.build.x, hZ = SVC.build.z;
  const sm = { x: 7, z: -32 };
  addSmith(scene, sm.x, sm.z, nodes);
  addTrainYard(scene, tX, tZ);
  addDummy(scene, tX + 3, tZ, nodes);
  addDummy(scene, tX, tZ, nodes);
  addDummy(scene, tX - 3, tZ, nodes);
  const cs = addYard(scene, hX, hZ, nodes);
  const cx = hX + .15, cz = hZ - .2;
  obstacles.push(
    { x: sm.x, z: sm.z, radius: 1.6, id: "blacksmith" },
    { x: cx, z: cz, radius: 2.35, id: "house-core" },
    { x: cx - 1.2, z: cz, radius: 1.45, id: "house-left" },
    { x: cx + 1.2, z: cz, radius: 1.45, id: "house-right" },
  );
  return { constructionSite: cs };
}

/* ── Cave entrance ── */
function addCaveEntrance(scene, x, z, nodes, obstacles) {
  const y = _groundY(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);

  /* Rock arch */
  const rockMat = toonMat("#5a5550");
  const darkMat = toonMat("#1a1412");

  /* Left pillar */
  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, 1.6), rockMat);
  pillarL.position.set(-1.8, 1.7, 0);
  pillarL.rotation.z = 0.08;
  g.add(pillarL);

  /* Right pillar */
  const pillarR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.4, 1.6), rockMat);
  pillarR.position.set(1.8, 1.7, 0);
  pillarR.rotation.z = -0.08;
  g.add(pillarR);

  /* Arch top */
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 1.8), rockMat);
  archTop.position.set(0, 3.6, 0);
  g.add(archTop);

  /* Jagged rocks on top */
  const spikeGeo = new THREE.ConeGeometry(0.5, 1.2, 5);
  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(spikeGeo, rockMat);
    spike.position.set(-1.5 + i * 1.0, 4.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4);
    spike.rotation.z = (Math.random() - 0.5) * 0.3;
    g.add(spike);
  }

  /* Dark cave opening */
  const opening = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.0), darkMat);
  opening.position.set(0, 1.5, 0.05);
  opening.renderOrder = R_DECOR;
  g.add(opening);

  /* Lava glow at bottom of entrance */
  const glowMat = new THREE.MeshBasicMaterial({
    color: "#ff4400",
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), glowMat);
  glow.position.set(0, 0.3, 0.08);
  glow.renderOrder = R_DECOR + 1;
  g.add(glow);

  /* Smoke particles — small spheres above entrance */
  const smokeMat = new THREE.MeshBasicMaterial({
    color: "#555555",
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const smokeParticles = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.3 + Math.random() * 0.3, 6, 6), smokeMat.clone());
    s.position.set((Math.random() - 0.5) * 2, 4.5 + Math.random() * 1.5, (Math.random() - 0.5) * 0.5);
    g.add(s);
    smokeParticles.push({ mesh: s, phase: Math.random() * Math.PI * 2, speed: 0.4 + Math.random() * 0.3 });
  }

  /* Sign post */
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6), toonMat("#7a5b38"));
  signPost.position.set(-3.2, 0.8, 0.5);
  g.add(signPost);
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 0.08), toonMat("#3a5a6e"));
  signBoard.position.set(-3.2, 1.65, 0.5);
  g.add(signBoard);

  setSvc(g, "cave", "Volcano Cave");
  scene.add(g);
  addBlob(scene, x, z, 3.2, 0.2);
  nodes.push(addHS(g, 0, 1.5, 1.0));
  obstacles.push({ x, z, radius: 2.2, id: "cave" });

  return {
    node: g, smokeParticles, glowMesh: glow,
    update(t) {
      /* animate smoke */
      for (const p of smokeParticles) {
        p.mesh.position.y = 4.5 + Math.sin(t * p.speed + p.phase) * 0.6;
        p.mesh.material.opacity = 0.15 + Math.sin(t * 0.8 + p.phase) * 0.1;
        p.mesh.position.x += Math.sin(t * 0.3 + p.phase) * 0.002;
      }
      /* pulse lava glow */
      glow.material.opacity = 0.45 + Math.sin(t * 3.0) * 0.2;
    },
  };
}

/* ── Fishing — river + dock spots ── */
const RING_GEO = new THREE.TorusGeometry(.5, .045, 8, 24);
const BOB_GEO = new THREE.SphereGeometry(.13, 8, 7);
function addFishing(scene, nodes) {
  const spots = [];
  FISHING_SPOT_POSITIONS.forEach((pos, i) => {
    const g = new THREE.Group(); setRes(g, "fishing", "Fishing Spot");
    g.userData.bobPhase = pos.phase;
    g.position.set(pos.x, WATER_Y + .02, pos.z);
    g.renderOrder = R_WATER + 2;
    const ring = new THREE.Mesh(RING_GEO,
      new THREE.MeshBasicMaterial({ color: "#dcf8ff", transparent: true, opacity: .72 }));
    ring.rotation.x = Math.PI / 2; g.add(ring);
    const bob = new THREE.Mesh(BOB_GEO, toonMat("#ffcc58")); bob.position.y = .12; g.add(bob);
    g.userData.ring = ring;
    scene.add(g);
    const hs = addHS(g, 0, .25, 0);
    hs.scale.set(1.25, .55, 1.25);
    nodes.push(hs);
    spots.push(g);
  });
  return spots;
}
function updateFishing(spots, t) {
  for (const s of spots) {
    const p = s.userData.bobPhase || 0;
    s.position.y = WATER_Y + .02 + Math.sin(t * 2 + p) * .03;
    if (s.userData.ring) {
      s.userData.ring.scale.setScalar(1 + Math.sin(t * 2.2 + p) * .06);
      s.userData.ring.material.opacity = .62 + Math.sin(t * 2.4 + p) * .08;
    }
  }
}

/* ── Chunk manifest + loading ── */
let _chunkManifest = null;
const _loadedChunks = new Map();   // "cx,cz" → { group, data }
let _chunkScene = null;            // scene ref for chunk add/remove
let _chunkGround = null;           // ground group ref
let _chunkNodes = null;            // resourceNodes array ref
let _chunkTileLib = null;          // tile lib ref

async function loadChunkManifest() {
  try {
    const resp = await fetch(`chunks.json?v=${Date.now()}`, { cache: "no-store" });
    if (resp.ok) { _chunkManifest = await resp.json(); return _chunkManifest; }
  } catch (e) { /* no manifest */ }
  return null;
}

async function loadChunkData(cx, cz) {
  const file = `chunks/chunk_${cx}_${cz}.json`;
  try {
    const resp = await fetch(`${file}?v=${Date.now()}`, { cache: "no-store" });
    if (resp.ok) return await resp.json();
  } catch (e) { /* not found */ }
  return null;
}

const _chunkLoading = new Set();  // prevent duplicate async loads
async function loadChunk(cx, cz, scene, ground, nodes) {
  const key = `${cx},${cz}`;
  if (_loadedChunks.has(key) || _chunkLoading.has(key)) return;
  _chunkLoading.add(key);
  const data = await loadChunkData(cx, cz);
  if (!data) { _chunkLoading.delete(key); return; }
  if (!data) return;
  const b = chunkBounds(cx, cz);
  b.water = data.water !== false;
  b.edges = data.edges || {};
  b.baseType = data.baseType || "grass";
  /* chunk world offset — heightOffset/colorOverride keys are in local chunk coords */
  const chunkOffX = cx * CHUNK_SIZE;
  const chunkOffZ = cz * CHUNK_SIZE;
  b.localOffsetX = chunkOffX;
  b.localOffsetZ = chunkOffZ;
  const heightOffsets = data.heightOffsets || null;
  const colorOverrides = data.colorOverrides || null;
  const waterUniforms = { uTime: { value: 0 } };
  /* neighboring chunks use lower detail terrain (step=3 vs 1) */
  const terrainGroup = buildTerrainMesh(waterUniforms, heightOffsets, colorOverrides, b, 3);
  terrainGroup.name = `chunk_${cx}_${cz}`;
  ground.add(terrainGroup);
  /* place objects from chunk */
  const objGroup = new THREE.Group();
  objGroup.name = `chunk_obj_${cx}_${cz}`;
  if (data.objects && data.objects.length) {
    const placeableObjs = data.objects.filter(o => !STRUCTURAL_TYPES.has(o.type));
    if (placeableObjs.length) {
      const loader = new GLTFLoader();
      const load = url => new Promise((res, rej) => loader.load(url, g => res(g.scene), undefined, rej));
      const types = [...new Set(placeableObjs.map(o => o.type))];
      const templates = {};
      await Promise.all(types.map(async t => {
        const path = _fileLookup[t];
        if (!path) return;
        try { const s = await load(path); stabilizeModelLook(s); templates[t] = s; }
        catch (e) { /* skip */ }
      }));
      for (const entry of placeableObjs) {
        /* object positions are in local chunk coords — offset to world */
        const wx = entry.x + chunkOffX, wz = entry.z + chunkOffZ;
        /* procedural service buildings */
        const svcB = SERVICE_BUILDER[entry.type];
        if (svcB) { svcB.builder(scene, wx, wz, nodes); continue; }
        const tmpl = templates[entry.type];
        if (!tmpl) continue;
        const m = SkeletonUtils.clone(tmpl);
        m.scale.setScalar(entry.scale || 1);
        let y = _getWSH(wx, wz);
        if (heightOffsets) {
          const fx = Math.floor(entry.x), fz = Math.floor(entry.z);
          const tx = entry.x - fx, tz = entry.z - fz;
          const h00 = heightOffsets[`${fx},${fz}`] || 0;
          const h10 = heightOffsets[`${fx+1},${fz}`] || 0;
          const h01 = heightOffsets[`${fx},${fz+1}`] || 0;
          const h11 = heightOffsets[`${fx+1},${fz+1}`] || 0;
          y += h00*(1-tx)*(1-tz) + h10*tx*(1-tz) + h01*(1-tx)*tz + h11*tx*tz;
        }
        m.position.set(wx, y, wz);
        m.rotation.y = entry.rot || 0;
        const res = RESOURCE_MAP[entry.type];
        if (res) { setRes(m, res.type, res.label); nodes.push(m); }
        /* GLTF-based services — tag with service interaction */
        const svcTag = SERVICE_TAG[entry.type];
        if (svcTag) {
          setSvc(m, svcTag.service, svcTag.label);
          nodes.push(addHS(m, 0, 0.95, 0.55));
          if (entry.type === "Market_Stalls") {
            spawnShopkeeper(objGroup, wx + 1.2, y, wz + 0.8);
          }
        }
        /* tag animals as attackable NPCs — push model itself so any mesh is clickable */
        if (ANIMAL_TYPES.has(entry.type)) {
          setSvc(m, "animal", entry.type);
          m.userData.animalType = entry.type;
          nodes.push(m);
        }
        objGroup.add(m);
      }
    }
  }
  scene.add(objGroup);
  _loadedChunks.set(key, { terrainGroup, objGroup, data, waterUniforms });
  _chunkLoading.delete(key);
}

function unloadChunk(cx, cz, scene, ground, nodes) {
  const key = `${cx},${cz}`;
  const chunk = _loadedChunks.get(key);
  if (!chunk) return;
  /* dispose terrain */
  chunk.terrainGroup.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  });
  ground.remove(chunk.terrainGroup);
  /* dispose objects and remove from resource nodes */
  chunk.objGroup.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
    const idx = nodes.indexOf(o);
    if (idx >= 0) nodes.splice(idx, 1);
  });
  scene.remove(chunk.objGroup);
  _loadedChunks.delete(key);
}

/** Call each frame with player world position to load/unload chunks */
function updateChunks(px, pz) {
  if (!_chunkManifest || !_chunkScene) return;
  const ccx = Math.round(px / CHUNK_SIZE);
  const ccz = Math.round(pz / CHUNK_SIZE);
  /* load chunks within 1 of player */
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ccx + dx, cz = ccz + dz;
      const key = `${cx},${cz}`;
      if (!_loadedChunks.has(key) && _chunkManifest.chunks.includes(key)) {
        loadChunk(cx, cz, _chunkScene, _chunkGround, _chunkNodes);
      }
    }
  }
  /* unload chunks more than 2 away */
  for (const [key] of _loadedChunks) {
    const [cx, cz] = key.split(",").map(Number);
    if (Math.abs(cx - ccx) > 2 || Math.abs(cz - ccz) > 2) {
      unloadChunk(cx, cz, _chunkScene, _chunkGround, _chunkNodes);
    }
  }
}

/* ── Load tilemap.json data (objects + height offsets) — legacy fallback ── */
let _tilemapData = null;
async function loadTilemapData() {
  /* try chunk system first */
  if (_chunkManifest) {
    const data = await loadChunkData(0, 0);
    if (data) { _tilemapData = data; return data; }
  }
  /* legacy: flat files */
  for (const file of ["objectmap.json", "tilemap.json"]) {
    try {
      const resp = await fetch(`${file}?v=${Date.now()}`, { cache: "no-store" });
      if (resp.ok) {
        const data = await resp.json();
        if (data.objects || data.heightOffsets || data.colorOverrides) { _tilemapData = data; return data; }
      }
    } catch (e) { /* try next */ }
  }
  return null;
}

/* Structural types built by the game already — skip these in object loading */
const STRUCTURAL_TYPES = new Set(["bridge", "dock", "fence", "stepping_stones", "bridge_piece", "dock_piece", "fence_piece"]);

/* ── Shared file lookup for object type → model path ── */
const _fileLookup = {};
{
  const MODEL_DIR = "models/", TILE_DIR = "models/terrain/";
  for (const t of [
    "Tree_1_A","Tree_1_B","Tree_1_C","Tree_2_A","Tree_2_B","Tree_2_C",
    "Tree_3_A","Tree_3_B","Tree_4_A","Tree_4_B","Tree_Bare_1_A","Tree_Bare_2_A",
    "Rock_1_A","Rock_1_J","Rock_1_K","Rock_2_A","Rock_3_A","Rock_3_C","Rock_3_E","Rock_3_G",
    "Bush_1_A","Bush_2_A","Bush_3_A","Bush_4_A","Grass_1_A","Grass_2_A",
  ]) _fileLookup[t] = MODEL_DIR + t + "_Color1.gltf";
  for (const t of [
    "Prop_Grass_Clump_1","Prop_Grass_Clump_2","Prop_Grass_Clump_3","Prop_Grass_Clump_4",
    "Prop_Flower_Daisy","Prop_Flower_Rose","Prop_Flower_Sunflower","Prop_Flower_Tulip",
    "Prop_Flower_Lily_Blue","Prop_Flower_Lily_Pink",
    "Prop_Cattail_1","Prop_Cattail_2","Prop_Mushroom_1","Prop_Mushroom_2",
    "Prop_Stump","Prop_Hollow_Trunk","Prop_Branch_1","Prop_Branch_2","Prop_Branch_3",
    "Prop_Rock_1","Prop_Rock_2","Prop_Rock_3","Prop_Rock_4",
    "Prop_Bush_1","Prop_Bush_2","Prop_Bush_3",
    "Prop_Cliff_Rock_1","Prop_Cliff_Rock_2",
    "Prop_Shell_1","Prop_Shell_2","Prop_Starfish_1","Prop_Starfish_2",
    "Prop_Treasure_Chest",
    "Prop_Tree_Cedar_1","Prop_Tree_Cedar_2",
    "Prop_Tree_Oak_1","Prop_Tree_Oak_2","Prop_Tree_Oak_3",
    "Prop_Tree_Palm_1","Prop_Tree_Palm_2","Prop_Tree_Palm_3",
    "Prop_Tree_Pine_1","Prop_Tree_Pine_2","Prop_Tree_Pine_3",
    "Prop_Fence_Boards_1","Prop_Fence_Boards_2","Prop_Fence_Boards_3","Prop_Fence_Boards_4",
    "Prop_Fence_Post_1","Prop_Fence_Post_2","Prop_Fence_Post_3","Prop_Fence_Post_4",
    "Prop_Fence_Curve_1x1","Prop_Fence_Curve_2x2","Prop_Fence_Curve_3x3",
    "Prop_Fence_Gate_1","Prop_Fence_Gate_2","Prop_Fence_Hill_Gentle","Prop_Fence_Hill_Sharp",
    "Prop_Bridge_Log_End","Prop_Bridge_Log_End_Edge","Prop_Bridge_Log_Middle","Prop_Bridge_Log_Middle_Edge",
    "Prop_Bridge_Log_Post_Support","Prop_Bridge_Log_Post_Top",
    "Prop_Bridge_Rope_End","Prop_Bridge_Rope_Middle","Prop_Bridge_Rope_Rope_Support",
    "Prop_Docks_Straight","Prop_Docks_Straight_Supports","Prop_Docks_Steps",
    "Prop_Docks_Corner","Prop_Docks_Corner_Supports",
  ]) _fileLookup[t] = TILE_DIR + t + ".glb";
}

/* Resource type lookup — maps editor object types to game interaction data */
const RESOURCE_MAP = {};
/* Trees → woodcutting */
for (const t of [
  "Tree_1_A","Tree_1_B","Tree_1_C","Tree_2_A","Tree_2_B","Tree_2_C",
  "Tree_3_A","Tree_3_B","Tree_4_A","Tree_4_B","Tree_Bare_1_A","Tree_Bare_2_A",
  "Prop_Tree_Cedar_1","Prop_Tree_Cedar_2","Prop_Tree_Oak_1","Prop_Tree_Oak_2","Prop_Tree_Oak_3",
  "Prop_Tree_Palm_1","Prop_Tree_Palm_2","Prop_Tree_Palm_3",
  "Prop_Tree_Pine_1","Prop_Tree_Pine_2","Prop_Tree_Pine_3",
]) RESOURCE_MAP[t] = { type: "woodcutting", label: "Tree" };
/* Rocks → mining */
for (const t of [
  "Rock_1_A","Rock_1_J","Rock_1_K","Rock_2_A",
  "Rock_3_A","Rock_3_C","Rock_3_E","Rock_3_G",
  "Prop_Rock_1","Prop_Rock_2","Prop_Rock_3","Prop_Rock_4",
  "Prop_Cliff_Rock_1","Prop_Cliff_Rock_2",
]) RESOURCE_MAP[t] = { type: "mining", label: "Rock" };

/* Service type lookup — maps editor object types to procedural building builders or service tags */
const SERVICE_BUILDER = {
  "Svc_Blacksmith":  { builder: (s, x, z, n) => addSmith(s, x, z, n) },
  "Svc_Dummy":       { builder: (s, x, z, n) => addDummy(s, x, z, n) },
  "Svc_Construction":{ builder: (s, x, z, n) => addYard(s, x, z, n) },
};
/* Service tags — GLTF model objects that need service interaction wired up */
const SERVICE_TAG = {
  "Svc_Bank": { service: "bank", label: "Bank Chest" },
  "Prop_Treasure_Chest": { service: "bank", label: "Bank Chest" },
  "Market_Stalls": { service: "store", label: "General Store" },
};
/* Register Svc_Bank in file lookup so it loads the chest model */
_fileLookup["Svc_Bank"] = "models/terrain/Prop_Treasure_Chest.glb";
_fileLookup["Market_Stalls"] = "models/terrain/Market_Stalls.glb";
_fileLookup["Farm"] = "models/terrain/Farm.glb";
for (const a of ["Cow","Horse","Llama","Pig","Pug","Sheep","Zebra"])
  _fileLookup[a] = "models/terrain/" + a + ".glb";

/* ── Animal types (attackable NPCs) ── */
const ANIMAL_TYPES = new Set(["Cow","Horse","Llama","Pig","Pug","Sheep","Zebra"]);

async function loadMapObjects(scene, nodes) {
  try {
    const data = _tilemapData;
    if (!data) return;
    const objs = data.objects;
    if (!objs || !objs.length) return;

    /* Filter out structural types and animals (chunk system handles animals) */
    const placeableObjs = objs.filter(o => !STRUCTURAL_TYPES.has(o.type) && !ANIMAL_TYPES.has(o.type));
    if (!placeableObjs.length) return;

    const loader = new GLTFLoader();
    const load = url => new Promise((res, rej) => loader.load(url, g => res(g.scene), undefined, rej));

    const types = [...new Set(placeableObjs.map(o => o.type))];
    const templates = {};
    await Promise.all(types.map(async t => {
      const path = _fileLookup[t];
      if (!path) { console.warn("Unknown map object type:", t); return; }
      try { const s = await load(path); stabilizeModelLook(s); templates[t] = s; }
      catch (e) { console.warn("Failed to load map object:", t, e); }
    }));

    const group = new THREE.Group();
    group.name = "map_objects";
    const ho = data.heightOffsets || null;
    for (const entry of placeableObjs) {
      /* procedural service buildings */
      const svcB = SERVICE_BUILDER[entry.type];
      if (svcB) { svcB.builder(scene, entry.x, entry.z, nodes); continue; }
      const tmpl = templates[entry.type];
      if (!tmpl) continue;
      const m = SkeletonUtils.clone(tmpl);
      m.scale.setScalar(entry.scale || 1);
      let y = GRASS_Y;
      if (ho) {
        const fx = Math.floor(entry.x), fz = Math.floor(entry.z);
        const tx = entry.x - fx, tz = entry.z - fz;
        const h00 = ho[`${fx},${fz}`] || 0;
        const h10 = ho[`${fx+1},${fz}`] || 0;
        const h01 = ho[`${fx},${fz+1}`] || 0;
        const h11 = ho[`${fx+1},${fz+1}`] || 0;
        y += h00*(1-tx)*(1-tz) + h10*tx*(1-tz) + h01*(1-tx)*tz + h11*tx*tz;
      }
      m.position.set(entry.x, y, entry.z);
      m.rotation.y = entry.rot || 0;
      /* GLTF-based services — tag with service interaction */
      const svcTag = SERVICE_TAG[entry.type];
      if (svcTag) {
        setSvc(m, svcTag.service, svcTag.label);
        if (entry.type === "Market_Stalls") {
          /* Stall hitbox in front of counter, not at model origin.
             Offset ~1.2 units forward in model-local space (pre-scale). */
          const fwd = 0.4; // local forward offset (z)
          nodes.push(addHS(m, 0, 0.3, fwd));
          /* Shopkeeper positioned in front of the stall using rotation */
          const rot = entry.rot || 0;
          const shopDist = 3.5;
          const sx = entry.x + Math.sin(rot) * shopDist;
          const sz = entry.z + Math.cos(rot) * shopDist;
          spawnShopkeeper(group, sx, y, sz);
        } else {
          nodes.push(addHS(m, 0, 0.95, 0.55));
        }
      }
      /* tag resources so game interaction works */
      const res = RESOURCE_MAP[entry.type];
      if (res) {
        setRes(m, res.type, res.label);
        nodes.push(m);
        addBlob(scene, entry.x, entry.z, entry.scale || 1, .15);
      }
      group.add(m);
    }
    scene.add(group);
    console.log(`Loaded ${placeableObjs.length} map objects from tilemap`);
  } catch (e) {
    console.warn("loadMapObjects error:", e);
  }
}

/* ══════════════════════════════════════════════════════════
   createWorld() — main entry
   ══════════════════════════════════════════════════════════ */
export async function createWorld(scene) {
  const nodes = [], obstacles = [];

  /* sky */
  const skyMat = addSky(scene);

  /* water uniforms (shared by water plane + waterfall) */
  const waterUniforms = { uTime: { value: 0 } };

  /* ── chunk manifest ── */
  await loadChunkManifest();

  /* ── load tile models (bridge, dock, fences, props) ── */
  /* load tilemap data early so height offsets can be applied to terrain */
  await loadTilemapData();
  const heightOffsets = _tilemapData && _tilemapData.heightOffsets ? _tilemapData.heightOffsets : null;
  const colorOverrides = _tilemapData && _tilemapData.colorOverrides ? _tilemapData.colorOverrides : null;

  let tileLib = null;
  try { tileLib = await loadTiles(); } catch (e) { console.warn("Tile load failed:", e); }

  /* ── terrain mesh (ground + water) for spawn chunk ── */
  const ground = new THREE.Group();
  ground.name = "ground";
  ground.add(buildTerrainMesh(waterUniforms, heightOffsets, colorOverrides));

  const hasEditorObjects = _tilemapData && _tilemapData.objects && _tilemapData.objects.length > 0;

  if (tileLib) {
    /* bridge */
    const bridge = buildBridge(tileLib);
    scene.add(bridge);
    bridge.traverse(o => { if (o.name === "bridge_deck") ground.add(o.clone()); });

    /* dock */
    const dock = buildDock(tileLib);
    scene.add(dock);
    dock.traverse(o => { if (o.name === "dock_deck") ground.add(o.clone()); });

    /* props — skip if editor tilemap has objects (editor is source of truth) */
    if (!hasEditorObjects) buildProps(tileLib, scene);
  }

  scene.add(ground);

  /* stepping stones in river */
  scene.add(buildSteppingStones());

  /* waterfall from north cliff */
  addWaterfall(scene, waterUniforms);

  /* ── character / prop models ── */
  /* skip hard-coded placements if editor tilemap has objects */
  let models = null;
  try { models = await loadModels(); } catch (e) { console.warn("Model load failed:", e); }

  if (models && !hasEditorObjects) {
    placeTrees(scene, models, nodes);
    placeRocks(scene, models, nodes);
    placeBushes(scene, models);
    placeCliffRocks(scene, models);
  }

  /* fishing spots */
  const fishing = addFishing(scene, nodes);

  /* buildings / village */
  const { constructionSite } = addPlaza(scene, nodes, obstacles);

  /* cave entrance removed */
  const cave = { update() {} };

  /* editor-placed objects from tilemap.json (animals excluded — chunk system handles them) */
  await loadMapObjects(scene, nodes);

  /* ── chunk system: store refs and pre-load adjacent chunks ── */
  _chunkScene = scene;
  _chunkGround = ground;
  _chunkNodes = nodes;

  /* spawn chunk 0,0 animals separately (loadMapObjects skips animals) */
  const spawn00animals = (_tilemapData?.objects || []).filter(o => ANIMAL_TYPES.has(o.type));
  if (spawn00animals.length) {
    const loader00 = new GLTFLoader();
    const load00 = url => new Promise((r, j) => loader00.load(url, g => r(g.scene), undefined, j));
    const aTypes = [...new Set(spawn00animals.map(o => o.type))];
    const aTmpls = {};
    await Promise.all(aTypes.map(async t => {
      const p = _fileLookup[t]; if (!p) return;
      try { const s = await load00(p); stabilizeModelLook(s); aTmpls[t] = s; } catch {}
    }));
    const aGroup = new THREE.Group(); aGroup.name = "chunk_animals_0_0";
    const ho00 = _tilemapData?.heightOffsets || null;
    for (const entry of spawn00animals) {
      const tmpl = aTmpls[entry.type]; if (!tmpl) continue;
      const m = SkeletonUtils.clone(tmpl);
      m.scale.setScalar(entry.scale || 1);
      let ay = _groundY(entry.x, entry.z);
      m.position.set(entry.x, ay, entry.z);
      m.rotation.y = entry.rot || 0;
      setSvc(m, "animal", entry.type);
      m.userData.animalType = entry.type;
      nodes.push(m);
      aGroup.add(m);
    }
    scene.add(aGroup);
  }

  /* mark spawn chunk as loaded (terrain already built above) */
  _loadedChunks.set("0,0", { terrainGroup: ground.children[0], objGroup: null, data: _tilemapData, waterUniforms });
  /* load adjacent chunks from manifest */
  if (_chunkManifest) {
    for (const key of _chunkManifest.chunks) {
      if (key === "0,0") continue;
      const [cx, cz] = key.split(",").map(Number);
      if (Math.abs(cx) <= 1 && Math.abs(cz) <= 1) {
        loadChunk(cx, cz, scene, ground, nodes);
      }
    }
  }

  return {
    ground,
    skyMat,
    waterUniforms,
    causticMap: null,
    addShadowBlob: (x, z, r, o) => addBlob(scene, x, z, r, o),
    resourceNodes: nodes,
    updateWorld: (t, px, pz) => {
      updateFishing(fishing, t);
      cave.update(t);
      /* update loaded chunks based on player position */
      if (px !== undefined) updateChunks(px, pz);
      /* sync water time for all loaded chunks */
      for (const [, c] of _loadedChunks) {
        if (c.waterUniforms) c.waterUniforms.uTime.value = t;
      }
    },
    constructionSite,
    collisionObstacles: obstacles,
    weaponModels: models?.weapons ?? null,
  };
}

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  WATER_Y, terrainH,
  getWorldSurfaceHeight as _getWSH,
  getWaterSurfaceHeight as _getWaSH,
} from "./terrainHeight.js";
import {
  loadTiles, buildTerrain, buildBridge,
  buildDock, buildFences, buildSteppingStones, addWaterfall, buildProps,
  TREE_SPOTS, ROCK_MAJOR_SPOTS, ROCK_SMALL_SPOTS,
  BUSH_SPOTS, CLIFF_ROCK_SPOTS, FISHING_SPOT_POSITIONS,
} from "./terrainLayout.js";

/* ══════════════════════════════════════════════════════════
   world.js — modular-tile terrain with river, cliffs, beach
   ══════════════════════════════════════════════════════════ */

/* ── re-export height API (keeps import contract for main.js) ── */
export function getWorldSurfaceHeight(x, z) { return _getWSH(x, z); }
export function getWaterSurfaceHeight(x, z, time = 0) { return _getWaSH(x, z, time); }

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

async function loadTerrainTilemap() {
  try {
    const resp = await fetch(`tilemap.json?v=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) throw new Error(String(resp.status));
    const data = await resp.json();
    if (!data) return null;
    return data.tiles ? data : { tiles: data };
  } catch (e) {
    console.warn("Tilemap load failed; falling back to runtime autotiling:", e);
    return null;
  }
}

let ACTIVE_GROUND = null;
const GROUND_RAY = new THREE.Raycaster();
const GROUND_RAY_ORIGIN = new THREE.Vector3();
const GROUND_RAY_DIR = new THREE.Vector3(0, -1, 0);

function getPlacedSurfaceY(x, z, allowWater = false) {
  if (ACTIVE_GROUND) {
    const baseY = _getWSH(x, z);
    GROUND_RAY_ORIGIN.set(x, baseY + 40, z);
    GROUND_RAY.set(GROUND_RAY_ORIGIN, GROUND_RAY_DIR);
    GROUND_RAY.far = 120;
    const hits = GROUND_RAY.intersectObject(ACTIVE_GROUND, true);
    for (const h of hits) {
      if (!allowWater && h.object?.userData?.isWaterSurface) continue;
      if (Number.isFinite(h.point?.y)) return h.point.y;
    }
  }
  return _getWSH(x, z);
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
  const y = getPlacedSurfaceY(x, z, false);
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
  m.position.set(x, getPlacedSurfaceY(x, z, false), z); scene.add(m); return m;
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
    m.position.set(x, getPlacedSurfaceY(x, z, false), z); scene.add(m);
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
    m.position.set(x, terrainH(x, z) - 2, z); scene.add(m);
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
  const y = getPlacedSurfaceY(x, z, false), g = new THREE.Group(); g.position.set(x, y, z);
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
  const y = getPlacedSurfaceY(x, z, false), g = new THREE.Group(); g.position.set(x, y, z);
  setSvc(g, "store", "General Store");
  g.add(m3(new THREE.BoxGeometry(2.6, .25, 1.5), toonMat("#9a7044"), 0, .12, 0, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.4, 1.4, .15), toonMat("#7e5a30"), 0, .95, -.65, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.4, .08, 1.2), toonMat("#a87a48"), 0, .45, 0, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.4, .08, 1.2), toonMat("#a87a48"), 0, 1, 0, R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.8, .12, 1.6), toonMat("#e8944a"), 0, 1.5, 0, R_DECOR));
  const pL = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, 1.25, 6), toonMat("#9a7a4e"));
  pL.position.set(-1.1, .8, .55); pL.renderOrder = R_DECOR; g.add(pL);
  g.add(pL.clone().translateX(2.2));
  g.add(m3(new THREE.BoxGeometry(1, .35, .06), toonMat("#3f657d"), 0, 1.2, .72, R_DECOR));
  scene.add(g); addBlob(scene, x, z, 1.9, .16);
  if (nodes) nodes.push(addHS(g, 0, .9, .66));
}
function addSmith(scene, x, z, nodes) {
  const y = getPlacedSurfaceY(x, z, false), g = new THREE.Group(); g.position.set(x, y, z);
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
  const y = getPlacedSurfaceY(x, z, false), g = new THREE.Group(); g.position.set(x, y, z);
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
  const g = new THREE.Group(), y = getPlacedSurfaceY(x, z, false); g.position.set(x, y, z);
  const bMat = toonMat("#a07040");
  g.add(m3(new THREE.CylinderGeometry(.18, .22, 1.4, 8), bMat, 0, .7, 0));
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 1, 6), bMat);
  arm.position.y = 1.1; arm.rotation.z = Math.PI / 2; g.add(arm);
  g.add(m3(new THREE.SphereGeometry(.2, 8, 8), toonMat("#c4a868"), 0, 1.6, 0));
  g.add(m3(new THREE.CylinderGeometry(.28, .28, .1, 10), toonMat("#8a6038"), 0, .05, 0));
  setSvc(g, "dummy", "Training Dummy"); scene.add(g);
  nodes.push(addHS(g, 0, .8, 0)); addBlob(scene, x, z, .5, .18);
}

function addTrainYard(scene, x, z) {
  const y = getPlacedSurfaceY(x, z, false), g = new THREE.Group(); g.position.set(x, y, z);
  g.add(m3(new THREE.BoxGeometry(1.55, .52, .08), toonMat("#3d6079"), 0, 1.15, -4.38, R_DECOR + 1));
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 1.3, 6), toonMat("#8a6240"));
  sp.position.set(0, .74, -4.7); sp.renderOrder = R_DECOR; g.add(sp);
  scene.add(g); addBlob(scene, x, z, 3.5, .13);
}

/* ── Plaza ── */
function addPlaza(scene, nodes, obstacles) {
  const tX = SVC.train.x, tZ = SVC.train.z, hX = SVC.build.x, hZ = SVC.build.z;
  const bk = { x: -7, z: -32 }, st = { x: 0, z: -32.5 }, sm = { x: 7, z: -32 };
  addBank(scene, bk.x, bk.z, nodes);
  addStore(scene, st.x, st.z, nodes);
  addSmith(scene, sm.x, sm.z, nodes);
  addTrainYard(scene, tX, tZ);
  addDummy(scene, tX + 3, tZ, nodes);
  addDummy(scene, tX, tZ, nodes);
  addDummy(scene, tX - 3, tZ, nodes);
  const cs = addYard(scene, hX, hZ, nodes);
  const cx = hX + .15, cz = hZ - .2;
  obstacles.push(
    { x: bk.x, z: bk.z, radius: 1.35, id: "bank" },
    { x: st.x, z: st.z, radius: 1.45, id: "store" },
    { x: sm.x, z: sm.z, radius: 1.6, id: "blacksmith" },
    { x: cx, z: cz, radius: 2.35, id: "house-core" },
    { x: cx - 1.2, z: cz, radius: 1.45, id: "house-left" },
    { x: cx + 1.2, z: cz, radius: 1.45, id: "house-right" },
  );
  return { constructionSite: cs };
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

/* ══════════════════════════════════════════════════════════
   createWorld() — main entry
   ══════════════════════════════════════════════════════════ */
export async function createWorld(scene) {
  const nodes = [], obstacles = [];

  /* sky */
  const skyMat = addSky(scene);

  /* water uniforms (shared by river mesh + waterfall) */
  const waterUniforms = { uTime: { value: 0 } };

  /* ── load tile models + build terrain ── */
  let tileLib = null;
  try { tileLib = await loadTiles(); } catch (e) { console.warn("Tile load failed:", e); }

  /* ground group — contains all walkable surfaces for raycasting */
  const ground = new THREE.Group();
  ground.name = "ground";

  if (tileLib) {
    const terrainTilemap = await loadTerrainTilemap();
    /* merged terrain tiles (includes water tile geometry) */
    const terrain = buildTerrain(tileLib, waterUniforms, terrainTilemap);
    ground.add(terrain);
    buildProps(tileLib, scene);

    /* bridge */
    const bridge = buildBridge(tileLib);
    scene.add(bridge);
    /* add invisible bridge deck to ground for raycasting */
    bridge.traverse(o => { if (o.name === "bridge_deck") ground.add(o.clone()); });

    /* dock */
    const dock = buildDock(tileLib);
    scene.add(dock);
    dock.traverse(o => { if (o.name === "dock_deck") ground.add(o.clone()); });

    /* fences */
    const fences = buildFences(tileLib);
    scene.add(fences);
  }

  scene.add(ground);
  ACTIVE_GROUND = ground;

  /* stepping stones in river */
  const stones = buildSteppingStones();
  scene.add(stones);

  /* waterfall from north cliff */
  addWaterfall(scene, waterUniforms);

  /* ── character / prop models ── */
  let models = null;
  try { models = await loadModels(); } catch (e) { console.warn("Model load failed:", e); }

  if (models) {
    placeTrees(scene, models, nodes);
    placeRocks(scene, models, nodes);
    placeBushes(scene, models);
    placeCliffRocks(scene, models);
  }

  /* fishing spots */
  const fishing = addFishing(scene, nodes);

  /* buildings / village */
  const { constructionSite } = addPlaza(scene, nodes, obstacles);

  return {
    ground,
    skyMat,
    waterUniforms,
    causticMap: null,
    addShadowBlob: (x, z, r, o) => addBlob(scene, x, z, r, o),
    resourceNodes: nodes,
    updateWorld: t => updateFishing(fishing, t),
    constructionSite,
    collisionObstacles: obstacles,
    weaponModels: models?.weapons ?? null,
  };
}

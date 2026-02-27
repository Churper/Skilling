import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  TILE_S, WATER_Y, GRASS_Y, HILL_Y,
  GX_MIN, GX_MAX, GZ_MIN, GZ_MAX,
  isInRiver, isBeach, isOnPath,
  riverQuery, distToPath,
  terrainH, getWorldSurfaceHeight,
} from "./terrainHeight.js";

/* ══════════════════════════════════════════════════════════
   terrainLayout.js — procedural mesh terrain + tile structures
   ══════════════════════════════════════════════════════════ */

const R_GND = 0, R_WATER = 2, R_DECOR = 3;

/* ── toon gradient ── */
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
function tMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRAD, ...opts });
}

/* ── tile catalogue ── */
const TILE_DIR = "models/terrain/";
const TILES = {
  /* structure */
  bridgeEnd:   "Prop_Bridge_Log_End.glb",
  bridgeMid:   "Prop_Bridge_Log_Middle.glb",
  bridgePost:  "Prop_Bridge_Log_Post_Support.glb",
  fenceBoard1: "Prop_Fence_Boards_1.glb",
  fenceBoard2: "Prop_Fence_Boards_2.glb",
  fenceBoard3: "Prop_Fence_Boards_3.glb",
  fenceBoard4: "Prop_Fence_Boards_4.glb",
  fencePost1:  "Prop_Fence_Post_1.glb",
  fencePost2:  "Prop_Fence_Post_2.glb",
  fencePost3:  "Prop_Fence_Post_3.glb",
  fencePost4:  "Prop_Fence_Post_4.glb",
  dockStr:     "Prop_Docks_Straight.glb",
  dockStrSup:  "Prop_Docks_Straight_Supports.glb",
  /* props */
  grassClump1:     "Prop_Grass_Clump_1.glb",
  grassClump2:     "Prop_Grass_Clump_2.glb",
  grassClump3:     "Prop_Grass_Clump_3.glb",
  grassClump4:     "Prop_Grass_Clump_4.glb",
  flowerDaisy:     "Prop_Flower_Daisy.glb",
  flowerRose:      "Prop_Flower_Rose.glb",
  flowerSunflower: "Prop_Flower_Sunflower.glb",
  flowerTulip:     "Prop_Flower_Tulip.glb",
  cattail1:        "Prop_Cattail_1.glb",
  cattail2:        "Prop_Cattail_2.glb",
  mushroom1:       "Prop_Mushroom_1.glb",
  mushroom2:       "Prop_Mushroom_2.glb",
  palmTree1:       "Prop_Tree_Palm_1.glb",
  palmTree2:       "Prop_Tree_Palm_2.glb",
  shell1:          "Prop_Shell_1.glb",
  shell2:          "Prop_Shell_2.glb",
  starfish1:       "Prop_Starfish_1.glb",
  starfish2:       "Prop_Starfish_2.glb",
  stump:           "Prop_Stump.glb",
  hollowTrunk:     "Prop_Hollow_Trunk.glb",
};

/* ── Load all tiles ── */
export async function loadTiles() {
  THREE.Cache.enabled = true;
  const loader = new GLTFLoader();
  const load = url =>
    new Promise((res, rej) => loader.load(url, g => res(g.scene), undefined, rej));
  const keys = Object.keys(TILES);
  const results = await Promise.all(
    keys.map(k => load(TILE_DIR + TILES[k]).catch(e => {
      console.warn(`tile load fail: ${TILES[k]}`, e);
      return null;
    }))
  );
  const lib = {};
  keys.forEach((k, i) => { lib[k] = results[i]; });
  return lib;
}

/* ── Geometry helpers ── */
function harvestTile(tileScene, worldMatrix) {
  const out = [];
  if (!tileScene) return out;
  tileScene.updateMatrixWorld(true);
  tileScene.traverse(o => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone();
    const m = new THREE.Matrix4().multiplyMatrices(worldMatrix, o.matrixWorld);
    geo.applyMatrix4(m);
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const name = mat?.name || "default";
    const color = mat?.color ? "#" + mat.color.getHexString() : "#888888";
    out.push({ geometry: geo, materialName: name, color });
  });
  return out;
}

function mergeByMaterial(harvested) {
  const groups = {};
  for (const { geometry, materialName, color } of harvested) {
    const key = materialName + "_" + color;
    if (!groups[key]) groups[key] = { geos: [], color };
    groups[key].geos.push(geometry);
  }
  const meshes = [];
  for (const [name, { geos, color }] of Object.entries(groups)) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    merged.computeVertexNormals();
    const mat = tMat(color, { flatShading: true });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = "terrain_" + name;
    mesh.renderOrder = R_GND;
    meshes.push(mesh);
  }
  return meshes;
}

function tileMat4(wx, wy, wz, rotY = 0, scale = 1) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(wx, wy, wz),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(TILE_S * scale, TILE_S * scale, TILE_S * scale)
  );
  return m;
}

/* ── village keep-out ── */
const SVC = [
  { x: 0, z: -32, r: 14 },
  { x: 18, z: -35, r: 10 },
  { x: -22, z: -34, r: 8 },
];
function inVillage(x, z, pad = 0) {
  for (const s of SVC)
    if (Math.hypot(x - s.x, z - s.z) <= s.r + pad) return true;
  return false;
}

/* ── simple hash for vertex jitter ── */
function hash21(x, z) {
  let n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/* ═══════════════════════════════════════════
   buildTerrainMesh — vertex-colored ground + water plane
   ═══════════════════════════════════════════ */

export function buildTerrainMesh(waterUniforms) {
  const group = new THREE.Group();
  group.name = "terrain";

  /* ── ground mesh ── */
  const step = 1.0;
  const xMin = (GX_MIN - 1) * TILE_S, xMax = (GX_MAX + 1) * TILE_S;
  const zMin = (GZ_MIN - 1) * TILE_S, zMax = (GZ_MAX + 1) * TILE_S;
  const nx = Math.ceil((xMax - xMin) / step) + 1;
  const nz = Math.ceil((zMax - zMin) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const idx = [];

  /* palette — clean solid colors */
  const cGrass = new THREE.Color("#4dad38");
  const cPath  = new THREE.Color("#c4a060");
  const cSand  = new THREE.Color("#e2d098");
  const cHill  = new THREE.Color("#3d8a2e");
  const cBank  = new THREE.Color("#6d8854");
  const cRiver = new THREE.Color("#5a7454");
  const cCliff = new THREE.Color("#8a8a7a");
  const tmp = new THREE.Color();

  /* beach center + radius for rounded shape */
  const beachCX = 42, beachCZ = -10, beachR = 18;

  /* small random bumps scattered across grass for variety */
  const BUMPS = [];
  { const rng = mulberry32(77);
    for (let i = 0; i < 35; i++) {
      const bx = -36 + rng() * 68, bz = -34 + rng() * 64;
      const rq = riverQuery(bx, bz);
      if (rq.dist < rq.width + 4 || isOnPath(bx, bz)) continue;
      if (inVillage(bx, bz, 6)) continue;
      BUMPS.push({ x: bx, z: bz, r: 2 + rng() * 4, h: 0.3 + rng() * 0.8 });
    }
  }

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = xMin + ix * step, z = zMin + iz * step;
      let y = terrainH(x, z);
      const i3 = (iz * nx + ix) * 3;

      /* add small random bumps/hills */
      for (const b of BUMPS) {
        const d = Math.hypot(x - b.x, z - b.z);
        if (d < b.r) {
          const t = 1 - d / b.r;
          y += b.h * t * t * (3 - 2 * t);
        }
      }

      /* low-poly jitter (don't jitter edges or river) */
      const rq = riverQuery(x, z);
      const jit = (rq.dist < rq.width + 2 || ix === 0 || ix === nx - 1 || iz === 0 || iz === nz - 1)
        ? 0 : (hash21(x, z) - 0.5) * 0.12;

      pos[i3] = x + jit;
      pos[i3 + 1] = y;
      pos[i3 + 2] = z + jit * 0.7;

      /* color — clean zones with smooth transitions */
      const beachDist = Math.hypot(x - beachCX, z - beachCZ);
      const beachT = 1 - THREE.MathUtils.smoothstep(beachDist, beachR - 6, beachR);
      let c;
      if (isInRiver(x, z)) {
        c = cRiver;
      } else if (rq.dist < rq.width + 2.5) {
        const t = Math.max(0, (rq.dist - rq.width) / 2.5);
        tmp.copy(cBank).lerp(cGrass, t);
        c = tmp;
      } else if (beachT > 0.01) {
        tmp.copy(cGrass).lerp(cSand, beachT);
        c = tmp;
      } else if (isOnPath(x, z)) {
        const pd = distToPath(x, z);
        const edge = THREE.MathUtils.smoothstep(pd, 0, 2.5);
        tmp.copy(cPath).lerp(cGrass, edge);
        c = tmp;
      } else if (y > GRASS_Y + 3) {
        c = cCliff;
      } else if (y > GRASS_Y + 0.5) {
        const ht = THREE.MathUtils.smoothstep(y, GRASS_Y + 0.5, HILL_Y);
        tmp.copy(cHill).lerp(cGrass, 1 - ht);
        c = tmp;
      } else {
        c = cGrass;
      }
      col[i3] = c.r; col[i3 + 1] = c.g; col[i3 + 2] = c.b;

      if (ix < nx - 1 && iz < nz - 1) {
        const a = iz * nx + ix, b = a + 1, d = a + nx, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const groundMesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: TOON_GRAD, flatShading: true,
  }));
  groundMesh.renderOrder = R_GND;
  group.add(groundMesh);

  /* ── water plane ── */
  const ww = xMax - xMin + 20, wh = zMax - zMin + 20;
  const waterGeo = new THREE.PlaneGeometry(ww, wh, 48, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshBasicMaterial({
    color: "#93d8f6", transparent: true, opacity: 0.62,
    depthWrite: false, depthTest: true,
  });
  waterMat.onBeforeCompile = shader => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       transformed.y += sin(position.x*0.14 + position.z*0.10 + uTime*0.7)*0.025
                      + cos(position.x*0.09 + position.z*0.22 - uTime*0.5)*0.02;`
    );
  };
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set((xMin + xMax) / 2, WATER_Y, (zMin + zMax) / 2);
  waterMesh.userData.isWaterSurface = true;
  waterMesh.renderOrder = R_WATER;
  group.add(waterMesh);

  return group;
}

/* ═══════════════════════════════════════════
   buildProps — scatter decorations
   ═══════════════════════════════════════════ */

function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildProps(lib, scene) {
  const group = new THREE.Group();
  group.name = "props";
  const rng = mulberry32(42);
  const rand = (lo, hi) => lo + rng() * (hi - lo);

  function place(key, x, z, scale, rotY) {
    const tmpl = lib[key];
    if (!tmpl) return;
    const m = tmpl.clone();
    m.scale.setScalar(TILE_S * scale);
    m.position.set(x, getWorldSurfaceHeight(x, z), z);
    m.rotation.y = rotY;
    group.add(m);
  }

  const grassKeys = ["grassClump1", "grassClump2", "grassClump3", "grassClump4"];
  const flowerKeys = ["flowerDaisy", "flowerRose", "flowerSunflower", "flowerTulip"];
  const cattailKeys = ["cattail1", "cattail2"];
  const mushKeys = ["mushroom1", "mushroom2"];
  const shellKeys = ["shell1", "shell2", "starfish1", "starfish2"];
  const palmKeys = ["palmTree1", "palmTree2"];

  for (let i = 0; i < 80; i++) {
    const x = rand(-36, 28), z = rand(-34, 36);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width + 1.5) continue;
    if (isBeach(x, z)) continue;
    if (inVillage(x, z, 3)) continue;
    if (isOnPath(x, z)) continue;
    place(grassKeys[i % grassKeys.length], x, z, rand(0.7, 1.1), rng() * Math.PI * 2);
  }

  for (let i = 0; i < 40; i++) {
    const x = rand(-34, 26), z = rand(-30, 34);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width + 2) continue;
    if (isBeach(x, z)) continue;
    if (inVillage(x, z, 4)) continue;
    if (isOnPath(x, z)) continue;
    place(flowerKeys[i % flowerKeys.length], x, z, rand(0.6, 1.0), rng() * Math.PI * 2);
  }

  for (let i = 0; i < 15; i++) {
    const x = rand(-10, 30), z = rand(-16, 38);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width || rq.dist > rq.width + 3) continue;
    place(cattailKeys[i % cattailKeys.length], x, z, rand(0.8, 1.2), rng() * Math.PI * 2);
  }

  for (let i = 0; i < 10; i++) {
    const x = rand(-32, 34), z = rand(10, 34);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width + 1) continue;
    if (isOnPath(x, z)) continue;
    place(mushKeys[i % mushKeys.length], x, z, rand(0.6, 1.0), rng() * Math.PI * 2);
  }

  for (let i = 0; i < 8; i++) {
    const x = rand(32, 46), z = rand(-22, 2);
    if (isInRiver(x, z)) continue;
    place(shellKeys[i % shellKeys.length], x, z, rand(0.5, 0.9), rng() * Math.PI * 2);
  }
  for (let i = 0; i < 4; i++) {
    const x = rand(34, 44), z = rand(-20, 0);
    if (isInRiver(x, z)) continue;
    place(palmKeys[i % palmKeys.length], x, z, rand(0.8, 1.2), rng() * Math.PI * 2);
  }

  const stumpSpots = [[22, 20], [26, 26], [-24, 20], [-18, 24], [30, 24]];
  for (const [sx, sz] of stumpSpots) {
    const ox = sx + rand(-2, 2), oz = sz + rand(-2, 2);
    place("stump", ox, oz, rand(0.7, 1.0), rng() * Math.PI * 2);
  }

  place("hollowTrunk", -28, 18, 0.9, rand(0, Math.PI * 2));

  scene.add(group);
  return group;
}

/* ═══════════════════════════════════════════
   buildBridge — log bridge crossing the river
   ═══════════════════════════════════════════ */

export function buildBridge(lib) {
  const group = new THREE.Group();
  group.name = "bridge";
  const bz = 8, bw = 4;
  const deckY = WATER_Y + 0.35;

  for (let i = -bw; i <= bw; i++) {
    const tmpl = (i === -bw || i === bw) ? lib.bridgeEnd : lib.bridgeMid;
    if (!tmpl) continue;
    const m = tmpl.clone();
    m.scale.setScalar(TILE_S);
    m.position.set(i * TILE_S * 0.5, deckY, bz);
    m.rotation.y = Math.PI / 2;
    group.add(m);
  }

  if (lib.bridgePost) {
    for (const ox of [-bw * 0.5 * TILE_S, bw * 0.5 * TILE_S]) {
      const p = lib.bridgePost.clone();
      p.scale.setScalar(TILE_S);
      p.position.set(ox, WATER_Y - 0.5, bz);
      group.add(p);
    }
  }

  const deckGeo = new THREE.BoxGeometry(bw * TILE_S + 2, 0.15, TILE_S * 1.5);
  const deck = new THREE.Mesh(deckGeo, tMat("#8B6A40", { transparent: true, opacity: 0 }));
  deck.position.set(0, deckY + 0.2, bz);
  deck.name = "bridge_deck";
  group.add(deck);

  group.renderOrder = R_DECOR;
  return group;
}

/* ═══════════════════════════════════════════
   buildDock — wooden dock on the beach
   ═══════════════════════════════════════════ */

export function buildDock(lib) {
  const group = new THREE.Group();
  group.name = "dock";
  const dx = 40, ddz = -16;
  const deckY = WATER_Y + 0.3;

  for (let i = 0; i < 6; i++) {
    const tmpl = lib.dockStr;
    if (!tmpl) continue;
    const m = tmpl.clone();
    m.scale.setScalar(TILE_S);
    m.position.set(dx + i * TILE_S, deckY, ddz);
    m.rotation.y = Math.PI / 2;
    group.add(m);
    if (lib.dockStrSup) {
      const s = lib.dockStrSup.clone();
      s.scale.setScalar(TILE_S);
      s.position.set(dx + i * TILE_S, deckY - 0.6, ddz);
      s.rotation.y = Math.PI / 2;
      group.add(s);
    }
  }

  const deckGeo = new THREE.BoxGeometry(6 * TILE_S, 0.15, TILE_S * 1.5);
  const deck = new THREE.Mesh(deckGeo, tMat("#8B6A40", { transparent: true, opacity: 0 }));
  deck.position.set(dx + 2.5 * TILE_S, deckY + 0.15, ddz);
  deck.name = "dock_deck";
  group.add(deck);

  group.renderOrder = R_DECOR;
  return group;
}

/* ═══════════════════════════════════════════
   buildFences — wooden fences along paths
   ═══════════════════════════════════════════ */

export function buildFences(lib) {
  const group = new THREE.Group();
  group.name = "fences";
  const board = lib.fenceBoard2 || lib.fenceBoard1 || lib.fenceBoard3 || lib.fenceBoard4;
  const post = lib.fencePost1 || lib.fencePost2 || lib.fencePost3 || lib.fencePost4;
  if (!board || !post) return group;
  const harvested = [];

  const runs = [
    [[4, 8], [8, 4], [12, 0], [16, -4], [20, -8], [24, -12], [28, -15]],
    [[9, -24], [15, -26], [21, -28], [27, -30], [34, -30]],
    [[-26, -40], [-26, -30], [-18, -30], [-18, -40], [-26, -40]],
    [[-2, 10], [2, 10], [6, 8]],
  ];

  const spacing = TILE_S;
  const yawOffset = Math.PI * 0.5;
  const addBoard = (x, z, rot) => {
    const y = getWorldSurfaceHeight(x, z);
    harvested.push(...harvestTile(board, tileMat4(x, y, z, rot + yawOffset, 0.9)));
  };
  const addPost = (x, z, rot) => {
    const y = getWorldSurfaceHeight(x, z);
    harvested.push(...harvestTile(post, tileMat4(x, y, z, rot + yawOffset, 0.9)));
  };

  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      const [ax, az] = run[i], [bx, bz] = run[i + 1];
      const ddx = bx - ax, ddz = bz - az;
      const segLen = Math.hypot(ddx, ddz);
      const steps = Math.max(1, Math.round(segLen / spacing));
      const rot = Math.atan2(ddx, ddz);
      for (let s = 0; s <= steps; s++) {
        if (i > 0 && s === 0) continue;
        const t = s / steps;
        const x = ax + ddx * t, z = az + ddz * t;
        if (s < steps) {
          const mt = (s + 0.5) / steps;
          addBoard(ax + ddx * mt, az + ddz * mt, rot);
        }
        addPost(x, z, rot);
      }
    }
  }

  mergeByMaterial(harvested).forEach(m => group.add(m));
  group.renderOrder = R_DECOR;
  return group;
}

/* ═══════════════════════════════════════════
   buildSteppingStones — gray stones in the river
   ═══════════════════════════════════════════ */

export function buildSteppingStones() {
  const group = new THREE.Group();
  group.name = "stepping_stones";
  const geo = new THREE.CylinderGeometry(0.55, 0.65, 0.25, 8);
  const mat = tMat("#8a8a82");
  for (const [x, z] of [[0,20],[-1,18],[1,16],[4,-1],[8,-4],[12,-7]]) {
    const s = new THREE.Mesh(geo, mat);
    s.position.set(x, WATER_Y - 0.05, z);
    s.rotation.y = Math.random() * Math.PI;
    s.renderOrder = R_WATER + 1;
    group.add(s);
  }
  return group;
}

/* ═══════════════════════════════════════════
   addWaterfall — cascading from north cliff
   ═══════════════════════════════════════════ */

export function addWaterfall(scene, waterUniforms) {
  const cx = 0, topZ = 40.9, endZ = 34.4;
  const topY = terrainH(cx, 40) + 4.8, botY = WATER_Y + 0.16;
  const midZ = (topZ + endZ) / 2, midY = topY * 0.58 + botY * 0.42;

  const makeMat = (phase, alpha = 1) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: waterUniforms.uTime, uPhase: { value: phase }, uAlpha: { value: alpha } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime,uPhase,uAlpha;
      void main(){
        float t=fract(vUv.y*2.2-uTime*0.45+uPhase);
        float streak=smoothstep(0.0,0.24,t)*smoothstep(1.0,0.62,t);
        float edge=smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x);
        vec3 col=mix(vec3(0.62,0.86,0.97),vec3(0.80,0.95,1.0),streak*0.65);
        float a=edge*(0.26+streak*0.48)*uAlpha;
        gl_FragColor=vec4(col,clamp(a,0.0,0.85)); }`,
  });

  const addRibbon = (rx, w, phase, alpha = 1) => {
    const pts = [[rx, topY, topZ], [rx, midY, midZ], [rx, botY, endZ]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
      const len = Math.hypot(y1 - y0, z1 - z0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len, 1, 12), makeMat(phase + i * 0.17, alpha));
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, y1 - y0, z1 - z0).normalize());
      m.renderOrder = R_DECOR + 1;
      scene.add(m);
    }
  };
  addRibbon(cx, 3.6, 0, 1);
  addRibbon(cx - 1.05, 1.4, 0.22, 0.7);
  addRibbon(cx + 1.05, 1.4, 0.41, 0.7);

  const lip = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.9), tMat("#8a8f92", { flatShading: true }));
  lip.position.set(cx, topY + 0.02, topZ + 0.2);
  lip.renderOrder = R_DECOR;
  scene.add(lip);

  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(2.25, 20),
    new THREE.MeshBasicMaterial({ color: "#dff6ff", transparent: true, opacity: 0.42, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(cx, WATER_Y + 0.03, endZ + 0.15);
  foam.renderOrder = R_WATER + 1;
  scene.add(foam);
}

/* ═══════════════════════════════════════════
   Placement data for world.js
   ═══════════════════════════════════════════ */

export const TREE_SPOTS = [
  [20,18,2.2,1.8],[28,28,2.4,3.6],[18,28,2.1,0.9],[32,20,1.9,2.4],[24,32,2.3,4.2],
  [-22,18,2.0,1.0],[-30,24,1.9,5.2],[-20,26,2.2,4.5],[-16,-18,1.7,2.1],[14,-18,1.6,0.7],[-8,-42,2.4,3.3],
];
export const ROCK_MAJOR_SPOTS = [
  [30,30,1.55,0.3],[-28,26,1.6,1.4],[-14,8,1.45,2.1],[10,16,1.5,4.8],[-20,-6,1.4,0.9],
];
export const ROCK_SMALL_SPOTS = [
  [22,34,1.04,3.2],[-26,30,1.0,4.1],[34,22,0.98,5.0],[-32,18,0.95,2.6],
  [-10,14,0.95,1.7],[-16,10,1.0,5.3],[8,20,0.9,0.5],[14,12,1.05,3.9],
  [-22,-2,0.92,2.4],[-18,-10,0.98,4.6],[6,8,0.88,1.2],[-8,4,1.02,3.5],
  [12,24,0.96,5.8],[-24,16,0.94,0.3],
];
export const BUSH_SPOTS = [
  [-12,-28,1.1,0.4],[12,-28,1.12,2.8],[20,-10,1.1,1.9],[-18,-12,1.08,5.0],[8,-38,1.0,3.8],
];
export const CLIFF_ROCK_SPOTS = [
  [-38,38,4.2,0],[0,42,3.8,1.6],[38,38,4.5,3.1],[-36,40,4.0,4.7],[36,40,3.6,0.8],
  [-42,20,4.1,2.3],[-42,4,3.9,5.5],[-42,-12,4.4,3.9],[-42,-28,3.5,1.2],
  [0,-40,4.3,4.1],[-18,-40,3.7,2.8],[18,-40,4.0,5.8],[-34,-38,4.6,0.4],[28,-38,3.8,3.5],
];
export const FISHING_SPOT_POSITIONS = [
  { x:-4, z:14, phase:0 },{ x:4, z:4, phase:1.2 },{ x:8, z:-4, phase:2.4 },
  { x:42, z:-16, phase:3.6 },{ x:46, z:-18, phase:4.8 },
];

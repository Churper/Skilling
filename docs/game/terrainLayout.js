import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  TILE_S, WATER_Y, GRASS_Y, HILL_Y,
  GX_MIN, GX_MAX, GZ_MIN, GZ_MAX,
  isInRiver, isBeach, isOnPath,
  riverQuery, distToPath,
  terrainH,
} from "./terrainHeight.js";

/* ══════════════════════════════════════════════════════════
   terrainLayout.js — procedural mesh terrain + tile structures
   ══════════════════════════════════════════════════════════ */

const R_GND = 0, R_WATER = 2, R_DECOR = 3;

/* ── toon gradient ── */
const TOON_GRAD = (() => {
  const c = document.createElement("canvas"); c.width = 4; c.height = 1;
  const ctx = c.getContext("2d");
  [25, 95, 185, 255].forEach((v, i) => {
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
  bridgeEndE:  "Prop_Bridge_Log_End_Edge.glb",
  bridgeMid:   "Prop_Bridge_Log_Middle.glb",
  bridgeMidE:  "Prop_Bridge_Log_Middle_Edge.glb",
  bridgePost:  "Prop_Bridge_Log_Post_Support.glb",
  bridgePostT: "Prop_Bridge_Log_Post_Top.glb",
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
  dockSteps:   "Prop_Docks_Steps.glb",
  dockCorner:  "Prop_Docks_Corner.glb",
  dockCornerSup: "Prop_Docks_Corner_Supports.glb",
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

/* ── seeded RNG ── */
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Procedural hills (module-level so placement code can query) ── */
const beachCX = 38, beachCZ = -6, beachR = 26;
const BUMPS = [];
{ const rng = mulberry32(77);
  for (let i = 0; i < 120; i++) {
    const bx = -40 + rng() * 80, bz = -38 + rng() * 72;
    const rq = riverQuery(bx, bz);
    if (rq.dist < rq.width + 3) continue;
    if (distToPath(bx, bz) < 2) continue;
    if (inVillage(bx, bz, 4)) continue;
    if (Math.hypot(bx - beachCX, bz - beachCZ) < beachR - 4) continue;
    const big = rng() < 0.25;
    BUMPS.push({
      x: bx, z: bz,
      r: big ? 10 + rng() * 12 : 5 + rng() * 7,
      h: big ? 1.2 + rng() * 1.5 : 0.3 + rng() * 0.6,
    });
  }
}

/* Bridge location — suppress terrain underneath */
const BRIDGE_X0 = -6, BRIDGE_X1 = 6, BRIDGE_Z = 8, BRIDGE_HW = 3;

/** Surface Y that matches the actual mesh vertices (terrainH + hills + bumps) */
export function getMeshSurfaceY(x, z) {
  let y = terrainH(x, z);
  const rq = riverQuery(x, z);
  const sm = THREE.MathUtils.smoothstep;
  const riverFar  = sm(rq.dist, rq.width, rq.width + 6);
  const pathFar   = sm(distToPath(x, z), 1, 5);
  let villageFar  = 1;
  for (const sv of SVC)
    villageFar = Math.min(villageFar, sm(Math.hypot(x - sv.x, z - sv.z), sv.r, sv.r + 6));
  const beachFar  = sm(Math.hypot(x - beachCX, z - beachCZ), beachR - 18, beachR + 4);
  const hillAmp   = riverFar * pathFar * villageFar * beachFar;
  y += (Math.sin(x * 0.07 + z * 0.05) * 0.5
      + Math.cos(x * 0.11 - z * 0.06) * 0.35
      + Math.sin(x * 0.04 + z * 0.13) * 0.25) * hillAmp;
  for (const b of BUMPS) {
    const d = Math.hypot(x - b.x, z - b.z);
    if (d < b.r) { const t = 1 - d / b.r; y += b.h * t * t * (3 - 2 * t) * hillAmp; }
  }
  /* flatten terrain under/near bridge so ground doesn't poke through */
  if (x > BRIDGE_X0 - 3 && x < BRIDGE_X1 + 3 && Math.abs(z - BRIDGE_Z) < BRIDGE_HW + 3) {
    const bxT = 1 - sm(Math.max(BRIDGE_X0 - x, x - BRIDGE_X1, 0), 0, 3);
    const bzT = 1 - sm(Math.abs(z - BRIDGE_Z), BRIDGE_HW, BRIDGE_HW + 3);
    const bridgeT = bxT * bzT;
    if (bridgeT > 0) y = THREE.MathUtils.lerp(y, WATER_Y - 2, bridgeT);
  }
  /* flatten terrain under dock */
  if (x > 34 && x < 54 && Math.abs(z - (-16)) < 6) {
    const dxT = 1 - sm(Math.max(34 - x, x - 54, 0), 0, 3);
    const dzT = 1 - sm(Math.abs(z - (-16)), 3, 6);
    const dockT = dxT * dzT;
    if (dockT > 0) y = THREE.MathUtils.lerp(y, WATER_Y - 2, dockT);
  }
  return y;
}

/* ═══════════════════════════════════════════
   buildTerrainMesh — vertex-colored ground + water plane
   ═══════════════════════════════════════════ */

export function buildTerrainMesh(waterUniforms, heightOffsets, colorOverrides, bounds, lodStep) {
  const group = new THREE.Group();
  group.name = "terrain";

  /* ── ground mesh ── */
  const step = lodStep || 1.0;
  const xMin = bounds ? bounds.xMin - step : (GX_MIN - 1) * TILE_S;
  const xMax = bounds ? bounds.xMax + step : (GX_MAX + 1) * TILE_S;
  const zMin = bounds ? bounds.zMin - step : (GZ_MIN - 1) * TILE_S;
  const zMax = bounds ? bounds.zMax + step : (GZ_MAX + 1) * TILE_S;
  const nx = Math.ceil((xMax - xMin) / step) + 1;
  const nz = Math.ceil((zMax - zMin) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const idx = [];

  /* palette */
  const BASE_COLORS = {
    grass: "#4dad38", dirt: "#8B7355", sand: "#e2d098",
    stone: "#8a8a7a", snow: "#e8eef0", dark: "#3a3a42",
  };
  const baseType = bounds && bounds.baseType || "grass";
  const cGrass = new THREE.Color(BASE_COLORS[baseType] || BASE_COLORS.grass);
  const cHill  = new THREE.Color(baseType === "grass" ? "#3d8a2e" : cGrass.clone().multiplyScalar(0.85));
  const cCliff = new THREE.Color("#8a8a7a");
  const tmp = new THREE.Color();
  const sm = THREE.MathUtils.smoothstep;

  /* chunk local offset — heightOffset/colorOverride keys are stored in local coords */
  const loX = bounds && bounds.localOffsetX || 0;
  const loZ = bounds && bounds.localOffsetZ || 0;

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = xMin + ix * step, z = zMin + iz * step;
      /* local coords for data lookup (subtract chunk world offset) */
      const lx = x - loX, lz = z - loZ;
      let y = GRASS_Y;
      /* apply editor height offsets */
      if (heightOffsets) {
        const key = `${lx},${lz}`;
        if (key in heightOffsets) y += heightOffsets[key];
      }
      const i3 = (iz * nx + ix) * 3;

      /* low-poly jitter (don't jitter edges) */
      const jit = (ix === 0 || ix === nx - 1 || iz === 0 || iz === nz - 1)
        ? 0 : (hash21(x, z) - 0.5) * 0.12;
      pos[i3] = x + jit;
      pos[i3 + 1] = y;
      pos[i3 + 2] = z + jit * 0.7;

      /* base color with height variation */
      let c;
      if (y > GRASS_Y + 3) { c = cCliff; }
      else if (y > GRASS_Y + 0.5) { tmp.copy(cHill).lerp(cGrass, 1 - sm(y, GRASS_Y + 0.5, HILL_Y)); c = tmp; }
      else { c = cGrass; }
      /* editor color overrides */
      if (colorOverrides) {
        const key = `${lx},${lz}`;
        if (key in colorOverrides) { const ov = colorOverrides[key]; tmp.setRGB(ov[0], ov[1], ov[2]); c = tmp; }
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

  /* ── water plane (optional per chunk) ── */
  const showWater = !bounds || bounds.water !== false;
  if (showWater) {
    const ww = xMax - xMin + 2, wh = zMax - zMin + 2;
    const wSegs = step <= 1 ? 48 : 16;
    const waterGeo = new THREE.PlaneGeometry(ww, wh, wSegs, wSegs);
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
  }

  /* ── edge walls (tall cliff boundaries per side) ── */
  if (bounds && bounds.edges) {
    const wallH = 12, wallColor = "#6a6a5e";
    const wallMat = tMat(wallColor);
    const e = bounds.edges;
    const cx = (xMin + xMax) / 2, cz = (zMin + zMax) / 2;
    const w = xMax - xMin, d = zMax - zMin;
    if (e.north) { const m = new THREE.Mesh(new THREE.BoxGeometry(w + 2, wallH, 2), wallMat); m.position.set(cx, wallH / 2 - 1, zMax + 1); group.add(m); }
    if (e.south) { const m = new THREE.Mesh(new THREE.BoxGeometry(w + 2, wallH, 2), wallMat); m.position.set(cx, wallH / 2 - 1, zMin - 1); group.add(m); }
    if (e.east)  { const m = new THREE.Mesh(new THREE.BoxGeometry(2, wallH, d + 2), wallMat); m.position.set(xMax + 1, wallH / 2 - 1, cz); group.add(m); }
    if (e.west)  { const m = new THREE.Mesh(new THREE.BoxGeometry(2, wallH, d + 2), wallMat); m.position.set(xMin - 1, wallH / 2 - 1, cz); group.add(m); }
  }

  return group;
}

/* ═══════════════════════════════════════════
   buildProps — scatter decorations
   ═══════════════════════════════════════════ */

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
    m.position.set(x, getMeshSurfaceY(x, z), z);
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
  const bz = 8;
  const deckY = WATER_Y + 0.35;

  /*  Bridge runs along X at z=8.  All pieces use rotation.y = π/2.
      Model defaults: ramp descends toward local -Z, railing on local -X.
      After π/2 rotation: ramp → west (-X), railing → north (+Z).
      scale.x flips railing side:  +1 = north,  -1 = south
      scale.z flips ramp direction: +1 = west (left end), -1 = east (right end) */

  const xs = [-4, -2, 0, 2, 4];
  for (let i = 0; i < xs.length; i++) {
    const isEnd = i === 0 || i === xs.length - 1;
    const isRightEnd = i === xs.length - 1;

    /* main plank — only end pieces have a ramp to flip */
    const tmpl = isEnd ? lib.bridgeEnd : lib.bridgeMid;
    if (tmpl) {
      const m = tmpl.clone();
      m.scale.setScalar(TILE_S);
      m.position.set(xs[i], deckY, bz);
      m.rotation.y = isRightEnd ? -Math.PI / 2 : Math.PI / 2;
      group.add(m);
    }

    /* edge railings — scale.x for side, scale.z for ramp direction */
    const eTmpl = isEnd ? lib.bridgeEndE : lib.bridgeMidE;
    if (eTmpl) {
      const flipZ = (isEnd && isRightEnd) ? -1 : 1;
      for (const side of [1, -1]) {
        const e = eTmpl.clone();
        e.scale.set(side * TILE_S, TILE_S, flipZ * TILE_S);
        e.position.set(xs[i], deckY, bz + side * TILE_S * 0.5);
        e.rotation.y = Math.PI / 2;
        group.add(e);
      }
    }
  }

  /* support posts at each end */
  const endXs = [xs[0], xs[xs.length - 1]];
  for (let ei = 0; ei < endXs.length; ei++) {
    const px = endXs[ei];
    const flipZ = ei === 1 ? -1 : 1;
    for (const side of [1, -1]) {
      if (lib.bridgePost) {
        const p = lib.bridgePost.clone();
        p.scale.set(side * TILE_S, TILE_S, flipZ * TILE_S);
        p.position.set(px, WATER_Y - 0.3, bz + side * TILE_S * 0.4);
        p.rotation.y = Math.PI / 2;
        group.add(p);
      }
      if (lib.bridgePostT) {
        const pt = lib.bridgePostT.clone();
        pt.scale.set(side * TILE_S, TILE_S, flipZ * TILE_S);
        pt.position.set(px, deckY, bz + side * TILE_S * 0.4);
        pt.rotation.y = Math.PI / 2;
        group.add(pt);
      }
    }
  }

  /* invisible walkable deck */
  const span = (xs[xs.length - 1] - xs[0]) + TILE_S;
  const cx = (xs[0] + xs[xs.length - 1]) / 2;
  const deckGeo = new THREE.BoxGeometry(span + 3, 0.4, TILE_S * 2.5);
  const deckMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.set(cx, deckY + 0.1, bz);
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
  const dx = 40, dz = -16, count = 4;
  const deckY = WATER_Y + 0.15;

  /* entry steps at shore end — faces from shore out to water */
  if (lib.dockSteps) {
    const st = lib.dockSteps.clone();
    st.scale.setScalar(TILE_S);
    st.position.set(dx - TILE_S, deckY, dz);
    st.rotation.y = Math.PI / 2;
    group.add(st);
  }

  /* straight sections — planks sit low, supports extend above */
  for (let i = 0; i < count; i++) {
    if (lib.dockStr) {
      const m = lib.dockStr.clone();
      m.scale.setScalar(TILE_S);
      m.position.set(dx + i * TILE_S, deckY, dz);
      m.rotation.y = Math.PI / 2;
      group.add(m);
    }
    /* supports placed at deck level — model geometry extends above and below */
    if (lib.dockStrSup) {
      for (const rot of [Math.PI / 2, -Math.PI / 2]) {
        const s = lib.dockStrSup.clone();
        s.scale.setScalar(TILE_S);
        s.position.set(dx + i * TILE_S, deckY, dz);
        s.rotation.y = rot;
        group.add(s);
      }
    }
  }

  /* invisible walkable deck — at plank surface level */
  const deckTop = deckY + 0.1;
  const dockDeckMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const fullLen = count * TILE_S + 2;
  const deckGeo = new THREE.BoxGeometry(fullLen, 0.4, TILE_S * 2.5);
  const deck = new THREE.Mesh(deckGeo, dockDeckMat);
  deck.position.set(dx + count * TILE_S * 0.5, deckTop, dz);
  deck.name = "dock_deck";
  group.add(deck);

  /* invisible walkable ramp for stairs */
  const stairLen = TILE_S * 3;
  const stairGeo = new THREE.BoxGeometry(stairLen, 0.4, TILE_S * 2.5);
  const stairDeck = new THREE.Mesh(stairGeo, dockDeckMat.clone());
  const shoreY = getMeshSurfaceY(dx - TILE_S * 2, dz);
  stairDeck.position.set(dx - TILE_S, (shoreY + deckTop) / 2, dz);
  stairDeck.rotation.z = Math.atan2(deckTop - shoreY, stairLen);
  stairDeck.name = "dock_deck";
  group.add(stairDeck);

  group.renderOrder = R_DECOR;
  return group;
}

/* ═══════════════════════════════════════════
   buildFences — wooden fences along paths
   ═══════════════════════════════════════════ */

export function buildFences(lib) {
  const group = new THREE.Group();
  group.name = "fences";
  const boardTmpl = lib.fenceBoard1 || lib.fenceBoard2;
  const postTmpl  = lib.fencePost1 || lib.fencePost2;
  if (!boardTmpl) return group;

  /* fence runs — behind village buildings */
  const runs = [
    [[-14, -38], [-7, -38], [0, -38], [7, -38], [14, -38]],
  ];

  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      const [ax, az] = run[i], [bx, bz] = run[i + 1];
      const dx = bx - ax, dz = bz - az;
      const segLen = Math.hypot(dx, dz);
      const steps = Math.max(1, Math.round(segLen / TILE_S));
      const rot = Math.atan2(dx, dz);

      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const x = ax + dx * t, z = az + dz * t;
        const y = getMeshSurfaceY(x, z);

        /* board at this position, extending forward one tile */
        const b = boardTmpl.clone();
        b.scale.setScalar(TILE_S);
        b.position.set(x, y, z);
        b.rotation.y = rot + Math.PI / 2;
        group.add(b);

        /* post at same position */
        if (postTmpl) {
          const p = postTmpl.clone();
          p.scale.setScalar(TILE_S);
          p.position.set(x, y, z);
          p.rotation.y = rot + Math.PI / 2;
          group.add(p);
        }
      }
      /* final post at end of segment */
      if (postTmpl && i === run.length - 2) {
        const p = postTmpl.clone();
        p.scale.setScalar(TILE_S);
        p.position.set(bx, getMeshSurfaceY(bx, bz), bz);
        p.rotation.y = rot + Math.PI / 2;
        group.add(p);
      }
    }
  }

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
  /* more natural spread */
  [10,30,1.8,0.5],[-10,22,2.0,3.1],[36,28,1.7,4.4],[-34,16,1.9,1.6],[-26,8,1.8,5.7],
  [6,24,1.6,2.3],[-6,16,1.7,0.2],[16,10,1.5,4.0],[-12,32,2.1,2.9],[26,14,1.8,5.1],
  [-28,-8,1.6,3.7],[22,-8,1.5,1.3],[-4,28,1.9,4.6],[30,8,1.7,0.8],[-18,4,1.6,2.5],
];
export const ROCK_MAJOR_SPOTS = [
  [-28,26,1.6,1.4],[-14,8,1.45,2.1],[-20,-6,1.4,0.9],
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

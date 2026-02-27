import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  TILE_S, WATER_Y,
  GX_MIN, GX_MAX, GZ_MIN, GZ_MAX,
  isInRiver, isBeach, isOnPath,
  riverQuery, distToPath,
  terrainH, getWorldSurfaceHeight,
} from "./terrainHeight.js";

/* ══════════════════════════════════════════════════════════
   terrainLayout.js — procedural ground mesh + tile cliffs/props
   ══════════════════════════════════════════════════════════ */

const R_GND = 0, R_WATER = 2, R_DECOR = 3;

/* ── toon gradient (local) ── */
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

/* ── tile catalogue — GLB files to load ── */
const TILE_DIR = "models/terrain/";
const TILES = {
  /* structure tiles */
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

  /* cliff tiles */
  cliffBaseStr: "Cliff_Base_Straight.glb",
  cliffBaseWF:  "Cliff_Base_Waterfall.glb",
  cliffBaseCornerOuterLg: "Cliff_Base_Corner_Outer_Lg.glb",
  cliffBaseCornerOuterSm: "Cliff_Base_Corner_Outer_Sm.glb",
  cliffBaseCornerInnerLg: "Cliff_Base_Corner_Inner_Lg.glb",
  cliffBaseCornerInnerSm: "Cliff_Base_Corner_Inner_Sm.glb",
  cliffBaseHillGentle: "Cliff_Base_Hill_Gentle.glb",
  cliffBaseHillSharp: "Cliff_Base_Hill_Sharp.glb",
  cliffMidStr:  "Cliff_Mid_Straight.glb",
  cliffMidWF:   "Cliff_Mid_Waterfall.glb",
  cliffMidCornerOuterLg: "Cliff_Mid_Corner_Outer_Lg.glb",
  cliffMidCornerOuterSm: "Cliff_Mid_Corner_Outer_Sm.glb",
  cliffMidCornerInnerLg: "Cliff_Mid_Corner_Inner_Lg.glb",
  cliffMidCornerInnerSm: "Cliff_Mid_Corner_Inner_Sm.glb",
  cliffTopStr:  "Cliff_Top_Straight.glb",
  cliffTopWF:   "Cliff_Top_Waterfall.glb",
  cliffTopCornerOuterLg: "Cliff_Top_Corner_Outer_Lg.glb",
  cliffTopCornerOuterSm: "Cliff_Top_Corner_Outer_Sm.glb",
  cliffTopCornerInnerLg: "Cliff_Top_Corner_Inner_Lg.glb",
  cliffTopCornerInnerSm: "Cliff_Top_Corner_Inner_Sm.glb",
  cliffTopHillGentle: "Cliff_Top_Hill_Gentle.glb",
  cliffTopHillSharp: "Cliff_Top_Hill_Sharp.glb",
  waterSlope: "Water_Slope.glb",
  waterfallTile: "Waterfall.glb",
  waterfallTop: "Waterfall_Top.glb",

  /* prop tiles for scatter */
  bush1:         "Prop_Bush_1.glb",
  bush2:         "Prop_Bush_2.glb",
  bush3:         "Prop_Bush_3.glb",
  rock1:         "Prop_Rock_1.glb",
  rock2:         "Prop_Rock_2.glb",
  rock3:         "Prop_Rock_3.glb",
  grassClump1:   "Prop_Grass_Clump_1.glb",
  grassClump2:   "Prop_Grass_Clump_2.glb",
  grassClump3:   "Prop_Grass_Clump_3.glb",
  grassClump4:   "Prop_Grass_Clump_4.glb",
  flowerDaisy:   "Prop_Flower_Daisy.glb",
  flowerRose:    "Prop_Flower_Rose.glb",
  flowerSunflower: "Prop_Flower_Sunflower.glb",
  flowerTulip:   "Prop_Flower_Tulip.glb",
  cattail1:      "Prop_Cattail_1.glb",
  cattail2:      "Prop_Cattail_2.glb",
  mushroom1:     "Prop_Mushroom_1.glb",
  mushroom2:     "Prop_Mushroom_2.glb",
  palmTree1:     "Prop_Tree_Palm_1.glb",
  palmTree2:     "Prop_Tree_Palm_2.glb",
  shell1:        "Prop_Shell_1.glb",
  shell2:        "Prop_Shell_2.glb",
  starfish1:     "Prop_Starfish_1.glb",
  starfish2:     "Prop_Starfish_2.glb",
  stump:         "Prop_Stump.glb",
  hollowTrunk:   "Prop_Hollow_Trunk.glb",
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

/* ═══════════════════════════════════════════
   Geometry helpers — collect & merge by material name
   ═══════════════════════════════════════════ */

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
    if (!groups[key])
      groups[key] = { geos: [], color };
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

/* helper: build a 4×4 placement matrix */
function tileMat4(wx, wy, wz, rotY = 0) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(wx, wy, wz),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(TILE_S, TILE_S, TILE_S)
  );
  return m;
}

/* ═══════════════════════════════════════════
   buildGroundMesh() — procedural heightmap with vertex colors
   ═══════════════════════════════════════════ */

function smoothstep(x, lo, hi) {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/* zone colors */
const C_GRASS = [0.20, 0.70, 0.27];
const C_DIRT  = [0.769, 0.686, 0.561];
const C_SAND  = [0.969, 0.918, 0.792];
const C_ROCK  = [0.631, 0.624, 0.612];
const C_WATER = [0.200, 0.588, 0.820];
const PATH_LINES = [
  [[0, -28], [0, -16], [0, -4], [0, 8], [0, 12]],
  [[10, -30], [20, -26], [30, -22], [40, -18], [46, -16]],
  [[0, 14], [0, 22], [0, 34], [0, 40]],
];

/* village keep-out zones (don't scatter props here) */
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

function getVertexColor(x, z, slope = 0) {
  let col = C_GRASS;

  /* river */
  const rq = riverQuery(x, z);
  if (rq.dist < rq.width) {
    const t = smoothstep(rq.dist, 0, rq.width);
    return lerpColor([0.50, 0.80, 0.90], [0.27, 0.58, 0.33], t * 0.35);
  }
  if (rq.dist < rq.width + 2.2) {
    const t = 1 - smoothstep(rq.dist, rq.width, rq.width + 2.2);
    col = lerpColor(col, [0.17, 0.57, 0.22], t * 0.34);
  }

  /* cliff rock coloring */
  if (z >= 38 || x <= -38 || z <= -36) {
    if (z >= 38) {
      const t = smoothstep(z, 38, 42);
      col = lerpColor(col, C_ROCK, t);
    } else if (x <= -38) {
      const t = smoothstep(-x, 38, 42);
      col = lerpColor(col, C_ROCK, t);
    } else if (z <= -36) {
      const t = smoothstep(-z, 36, 40);
      col = lerpColor(col, C_ROCK, t);
    }
  }

  /* beach */
  if (x > 30 && z < 6) {
    const t = smoothstep(x, 30, 34);
    col = lerpColor(col, C_SAND, t);
  }

  /* dirt paths */
  const pd = distToPath(x, z);
  if (pd < 2.6) {
    const t = 1 - smoothstep(pd, 0.55, 2.6);
    col = lerpColor(col, C_DIRT, t);
  }

  /* village center area — slight dirt tint */
  for (const s of SVC) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r) {
      const t = (1 - smoothstep(d, s.r * 0.3, s.r)) * 0.6;
      col = lerpColor(col, C_DIRT, t);
    }
  }

  /* slope tinting for stronger low-poly terrain read */
  if (slope > 0.04) {
    const shade = smoothstep(slope, 0.04, 0.28) * 0.16;
    col = lerpColor(col, [0.11, 0.46, 0.17], shade);
  }

  return col;
}

function buildGroundMesh() {
  const xMin = -42, xMax = 50, zMin = -40, zMax = 42;
  const cols = xMax - xMin, rows = zMax - zMin;
  const vCount = (cols + 1) * (rows + 1);

  const positions = new Float32Array(vCount * 3);
  const colors = new Float32Array(vCount * 3);
  const indices = [];

  for (let iz = 0; iz <= rows; iz++) {
    for (let ix = 0; ix <= cols; ix++) {
      const vi = iz * (cols + 1) + ix;
      const x = xMin + ix;
      const z = zMin + iz;
      const y = terrainH(x, z);

      positions[vi * 3]     = x;
      positions[vi * 3 + 1] = y;
      positions[vi * 3 + 2] = z;

      const dx = terrainH(x + 0.45, z) - terrainH(x - 0.45, z);
      const dz = terrainH(x, z + 0.45) - terrainH(x, z - 0.45);
      const slope = Math.min(1, Math.hypot(dx, dz));
      const c = getVertexColor(x, z, slope);
      colors[vi * 3]     = c[0];
      colors[vi * 3 + 1] = c[1];
      colors[vi * 3 + 2] = c[2];
    }
  }

  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const a = iz * (cols + 1) + ix;
      const b = a + 1;
      const c = (iz + 1) * (cols + 1) + ix;
      const d = c + 1;
      if ((ix + iz) & 1) indices.push(a, c, d, a, d, b);
      else indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: TOON_GRAD,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "ground_mesh";
  mesh.renderOrder = R_GND;
  return mesh;
}

function buildPathOverlayMesh() {
  const mkStrip = (width, yOff = 0.04) => {
    const pos = [];
    const idx = [];
    let vBase = 0;

    const pushPath = points => {
      const curve = new THREE.CatmullRomCurve3(
        points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
        false,
        "centripetal",
        0.3
      );
      const steps = Math.max(6, Math.round(curve.getLength() * 1.2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = curve.getPointAt(t);
        const tg = curve.getTangentAt(t).normalize();
        const px = -tg.z, pz = tg.x;

        const lx = p.x + px * width, lz = p.z + pz * width;
        const rx = p.x - px * width, rz = p.z - pz * width;
        const ly = terrainH(lx, lz) + yOff;
        const ry = terrainH(rx, rz) + yOff;
        pos.push(lx, ly, lz, rx, ry, rz);

        if (i > 0) {
          const a = vBase + (i - 1) * 2;
          const b = a + 1;
          const c = vBase + i * 2;
          const d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      vBase += (steps + 1) * 2;
    };
    PATH_LINES.forEach(pushPath);

    const geo = new THREE.BufferGeometry();
    geo.setIndex(idx);
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return geo;
  };

  const g = new THREE.Group();
  const outer = new THREE.Mesh(mkStrip(1.6, 0.038), tMat("#ddd3bf", { flatShading: true, transparent: true, opacity: 0.9 }));
  outer.renderOrder = R_GND + 1;
  const inner = new THREE.Mesh(mkStrip(1.16, 0.05), tMat("#cfbea0", { flatShading: true }));
  inner.renderOrder = R_GND + 2;
  g.add(outer, inner);

  g.name = "path_overlay";
  return g;
}

/* ═══════════════════════════════════════════
   buildCliffs() — stacked cliff tiles from asset pack
   ═══════════════════════════════════════════ */

function buildCliffs(lib) {
  const harvested = [];
  const push = (tile, x, y, z, rot = 0) => {
    const tmpl = lib[tile];
    if (!tmpl) return;
    harvested.push(...harvestTile(tmpl, tileMat4(x, y, z, rot)));
  };
  const pushPair = (x, z, rot, base, mid) => {
    push(base, x, 0, z, rot);
    push(mid, x, TILE_S, z, rot);
  };
  const pushStack = (x, z, rot, base, mid, top) => {
    push(base, x, 0, z, rot);
    push(mid, x, TILE_S, z, rot);
    push(top, x, 2 * TILE_S, z, rot);
  };

  /* North cliff wall (gz=20): 3-tier stack with curved throat around waterfall */
  for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
    const wx = gx * TILE_S, wz = 20 * TILE_S;
    let rot = 0;
    let base = "cliffBaseStr", mid = "cliffMidStr", top = "cliffTopStr";

    if (gx === 0) {
      base = "cliffBaseWF"; mid = "cliffMidWF"; top = "cliffTopWF";
    } else if (gx === -1) {
      base = "cliffBaseCornerInnerSm"; mid = "cliffMidCornerInnerSm"; top = "cliffTopCornerInnerSm"; rot = Math.PI / 2;
    } else if (gx === 1) {
      base = "cliffBaseCornerInnerSm"; mid = "cliffMidCornerInnerSm"; top = "cliffTopCornerInnerSm"; rot = -Math.PI / 2;
    } else if (gx === -20) {
      base = "cliffBaseCornerOuterLg"; mid = "cliffMidCornerOuterLg"; top = "cliffTopCornerOuterLg"; rot = -Math.PI / 2;
    } else if (gx === GX_MIN) {
      base = "cliffBaseCornerOuterSm"; mid = "cliffMidCornerOuterSm"; top = "cliffTopCornerOuterSm"; rot = Math.PI;
    } else if (gx === GX_MAX) {
      base = "cliffBaseCornerOuterSm"; mid = "cliffMidCornerOuterSm"; top = "cliffTopCornerOuterSm";
    }
    pushStack(wx, wz, rot, base, mid, top);

    // Break long straight skyline with gentle curved cliff-top segments.
    if (gx !== 0 && gx % 6 === 0) push("cliffTopHillGentle", wx, 2 * TILE_S, wz, 0);
  }

  /* West cliff wall (gx=-20): 2-tier stack */
  for (let gz = GZ_MIN; gz < 20; gz++) {
    if (gz === -19) continue; // south corner handled by south wall
    const wx = -20 * TILE_S, wz = gz * TILE_S;
    pushPair(wx, wz, -Math.PI / 2, "cliffBaseStr", "cliffMidStr");
    if (gz % 7 === 0) push("cliffBaseHillGentle", wx, 0, wz, -Math.PI / 2);
  }

  /* South cliff wall (gz=-19): 2-tier stack with curved west corner */
  for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
    const wx = gx * TILE_S, wz = -19 * TILE_S;
    if (gx === -20) {
      pushPair(wx, wz, Math.PI, "cliffBaseCornerOuterLg", "cliffMidCornerOuterLg");
      continue;
    }
    pushPair(wx, wz, Math.PI, "cliffBaseStr", "cliffMidStr");
    if (gx % 7 === 0) push("cliffBaseHillSharp", wx, 0, wz, Math.PI);
  }

  return mergeByMaterial(harvested);
}

function buildRiverBankCurves(lib) {
  // Disabled: water-slope tile overlays produced visible spikes/tears.
  return [];
}

/* ═══════════════════════════════════════════
   buildProps() — scatter decorations from tile pack
   ═══════════════════════════════════════════ */

/* seeded PRNG */
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

  /* Grass clumps (~80) on meadows */
  for (let i = 0; i < 80; i++) {
    const x = rand(-36, 28), z = rand(-34, 36);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width + 1.5) continue;
    if (isBeach(x, z)) continue;
    if (inVillage(x, z, 3)) continue;
    if (isOnPath(x, z)) continue;
    place(grassKeys[i % grassKeys.length], x, z, rand(0.7, 1.1), rng() * Math.PI * 2);
  }

  /* Flowers (~40) on meadows */
  for (let i = 0; i < 40; i++) {
    const x = rand(-34, 26), z = rand(-30, 34);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width + 2) continue;
    if (isBeach(x, z)) continue;
    if (inVillage(x, z, 4)) continue;
    if (isOnPath(x, z)) continue;
    place(flowerKeys[i % flowerKeys.length], x, z, rand(0.6, 1.0), rng() * Math.PI * 2);
  }

  /* Cattails (~15) along riverbanks */
  for (let i = 0; i < 15; i++) {
    const x = rand(-10, 30), z = rand(-16, 38);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width || rq.dist > rq.width + 3) continue;
    place(cattailKeys[i % cattailKeys.length], x, z, rand(0.8, 1.2), rng() * Math.PI * 2);
  }

  /* Mushrooms (~10) near hills */
  for (let i = 0; i < 10; i++) {
    const x = rand(-32, 34), z = rand(10, 34);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width + 1) continue;
    if (isOnPath(x, z)) continue;
    place(mushKeys[i % mushKeys.length], x, z, rand(0.6, 1.0), rng() * Math.PI * 2);
  }

  /* Beach props (~12): shells, starfish, palms */
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

  /* Stumps (~5) near tree spots */
  const stumpSpots = [[22, 20], [26, 26], [-24, 20], [-18, 24], [30, 24]];
  for (const [sx, sz] of stumpSpots) {
    const ox = sx + rand(-2, 2), oz = sz + rand(-2, 2);
    place("stump", ox, oz, rand(0.7, 1.0), rng() * Math.PI * 2);
  }

  /* Hollow trunk */
  place("hollowTrunk", -28, 18, 0.9, rand(0, Math.PI * 2));

  scene.add(group);
  return group;
}

/* ═══════════════════════════════════════════
   buildTerrain() — main entry: returns walkable ground Group
   ═══════════════════════════════════════════ */

export function buildTerrain(lib) {
  const group = new THREE.Group();
  group.name = "terrain";

  /* procedural heightmap ground */
  group.add(buildGroundMesh());
  // Path tint is already baked into the ground vertex colors.

  /* stacked cliff tiles */
  const cliffMeshes = buildCliffs(lib);
  cliffMeshes.forEach(m => group.add(m));

  return group;
}

/* ═══════════════════════════════════════════
   buildWater() — river + ocean water surface
   ═══════════════════════════════════════════ */

export function buildWater(waterUniforms) {
  const RP = [
    [0, 40, 2.5], [0, 34, 2.5], [0, 26, 2.8], [0, 18, 3.0],
    [0, 12, 3.2], [0, 6, 3.5], [2, 2, 3.5], [6, -2, 4.0],
    [12, -6, 4.5], [20, -10, 5.0], [28, -14, 5.5], [36, -14, 6.5], [48, -14, 8.0],
  ];
  const ctrl = RP.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(ctrl, false, "centripetal", 0.3);
  const widthAt = t => {
    const seg = t * (RP.length - 1);
    const i = Math.min(RP.length - 2, Math.max(0, Math.floor(seg)));
    const f = seg - i;
    return RP[i][2] + (RP[i + 1][2] - RP[i][2]) * f;
  };

  const pos = [], uv = [], idx = [];
  const STEPS = 180;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t).normalize();
    const hw = widthAt(t) * 1.02;
    const px = -tg.z, pz = tg.x;

    pos.push(
      p.x + px * hw, 0, p.z + pz * hw,
      p.x - px * hw, 0, p.z - pz * hw
    );
    uv.push(t, 0, t, 1);

    if (i > 0) {
      const a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }

  const m = curve.getPointAt(1);
  const mt = curve.getTangentAt(1).normalize();
  const mw = widthAt(1);
  const mpx = -mt.z, mpz = mt.x;
  const oi = pos.length / 3;
  pos.push(
    m.x + mpx * mw * 1.03, 0, m.z + mpz * mw * 1.03,
    58, 0, m.z + 5.5,
    58, 0, -30,
    m.x - mpx * mw * 1.03, 0, m.z - mpz * mw * 1.03,
    58, 0, m.z - 8.5
  );
  uv.push(
    1, 0,
    1.08, 0.12,
    1.18, 0.5,
    1, 1,
    1.08, 0.88
  );
  idx.push(
    oi, oi + 1, oi + 4,
    oi, oi + 4, oi + 3,
    oi + 3, oi + 4, oi + 2
  );

  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: waterUniforms,
    vertexShader: `
      varying vec2 vUv2;
      varying vec2 vW;
      uniform float uTime;
      void main(){
        vec3 p = position;
        p.y += sin((p.x+p.z)*0.11 + uTime*0.55)*0.015;
        p.y += cos((p.x*0.27-p.z*0.21) + uTime*0.35)*0.01;
        vUv2 = uv;
        vW = p.xz;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv2;
      varying vec2 vW;
      uniform float uTime;
      void main(){
        float flow = sin(vUv2.x * 18.0 - uTime * 0.8) * 0.5 + 0.5;
        vec3 cA = vec3(0.44, 0.76, 0.89);
        vec3 cB = vec3(0.60, 0.87, 0.95);
        vec3 c = mix(cA, cB, 0.28 + flow * 0.16);
        c += sin(vW.x * 0.30 + vW.y * 0.22 + uTime * 0.9) * 0.012;
        float alpha = 0.66;
        gl_FragColor = vec4(c, alpha);
      }`,
  });

  const water = new THREE.Mesh(geo, mat);
  water.position.y = WATER_Y + 0.015;
  water.renderOrder = R_WATER;
  return water;
}

/* ═══════════════════════════════════════════
   buildBridge() — log bridge crossing the river
   ═══════════════════════════════════════════ */

export function buildBridge(lib) {
  const group = new THREE.Group();
  group.name = "bridge";

  /* Bridge spans the river at z ≈ 8, east-west across x = 0 */
  const bz = 8, bw = 4; // 4 planks wide
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

  /* support posts */
  if (lib.bridgePost) {
    for (const ox of [-bw * 0.5 * TILE_S, bw * 0.5 * TILE_S]) {
      const p = lib.bridgePost.clone();
      p.scale.setScalar(TILE_S);
      p.position.set(ox, WATER_Y - 0.5, bz);
      group.add(p);
    }
  }

  /* flat walkable deck for raycasting */
  const deckGeo = new THREE.BoxGeometry(bw * TILE_S + 2, 0.15, TILE_S * 1.5);
  const deck = new THREE.Mesh(deckGeo, tMat("#8B6A40", { transparent: true, opacity: 0 }));
  deck.position.set(0, deckY + 0.2, bz);
  deck.name = "bridge_deck";
  group.add(deck);

  group.renderOrder = R_DECOR;
  return group;
}

/* ═══════════════════════════════════════════
   buildDock() — wooden dock on the beach
   ═══════════════════════════════════════════ */

export function buildDock(lib) {
  const group = new THREE.Group();
  group.name = "dock";
  const dx = 40, dz = -16;
  const deckY = WATER_Y + 0.3;

  /* dock planks extending east into water */
  for (let i = 0; i < 6; i++) {
    const tmpl = lib.dockStr;
    if (!tmpl) continue;
    const m = tmpl.clone();
    m.scale.setScalar(TILE_S);
    m.position.set(dx + i * TILE_S, deckY, dz);
    m.rotation.y = Math.PI / 2;
    group.add(m);
    /* supports under */
    if (lib.dockStrSup) {
      const s = lib.dockStrSup.clone();
      s.scale.setScalar(TILE_S);
      s.position.set(dx + i * TILE_S, deckY - 0.6, dz);
      s.rotation.y = Math.PI / 2;
      group.add(s);
    }
  }

  /* flat walkable deck for raycasting */
  const deckGeo = new THREE.BoxGeometry(6 * TILE_S, 0.15, TILE_S * 1.5);
  const deck = new THREE.Mesh(deckGeo, tMat("#8B6A40", { transparent: true, opacity: 0 }));
  deck.position.set(dx + 2.5 * TILE_S, deckY + 0.15, dz);
  deck.name = "dock_deck";
  group.add(deck);

  group.renderOrder = R_DECOR;
  return group;
}

/* ═══════════════════════════════════════════
   buildFences() — wooden fences along paths
   ═══════════════════════════════════════════ */

export function buildFences(lib) {
  const group = new THREE.Group();
  group.name = "fences";
  const postGeo = new THREE.BoxGeometry(0.32, 1.02, 0.32);
  const railGeo = new THREE.BoxGeometry(0.14, 0.13, 1.0);
  const postMat = tMat("#61686b");
  const railMat = tMat("#b9ad96");

  const runs = [
    /* right-side river run from bridge to village */
    [[4, 8], [8, 4], [12, 0], [16, -4], [20, -8], [24, -12], [30, -16]],
    /* lower village perimeter */
    [[10, -24], [16, -26], [22, -28], [28, -30], [34, -30]],
    /* training area */
    [[-26, -40], [-26, -28], [-18, -28], [-18, -40], [-26, -40]],
    /* bridge approach accent */
    [[-2, 10], [2, 10], [6, 8]],
  ];

  const segmentLen = 1.2;
  const addPost = (x, z) => {
    const y = getWorldSurfaceHeight(x, z);
    const m = new THREE.Mesh(postGeo, postMat);
    m.position.set(x, y + 0.50, z);
    m.renderOrder = R_DECOR;
    group.add(m);
    return y;
  };

  const addRails = (a, b, yA, yB) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) return;
    const rot = Math.atan2(dx, dz);
    const mx = (a.x + b.x) * 0.5, mz = (a.z + b.z) * 0.5;

    const mkRail = y => {
      const r = new THREE.Mesh(railGeo, railMat);
      r.scale.z = len;
      r.position.set(mx, y, mz);
      r.rotation.y = rot;
      r.renderOrder = R_DECOR;
      group.add(r);
    };
    mkRail((yA + yB) * 0.5 + 0.37);
    mkRail((yA + yB) * 0.5 + 0.62);
  };

  for (const run of runs) {
    const curve = new THREE.CatmullRomCurve3(
      run.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      false,
      "centripetal",
      0.2
    );
    const count = Math.max(2, Math.round(curve.getLength() / segmentLen));
    const pts = [];
    const ys = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const p = curve.getPointAt(t);
      pts.push({ x: p.x, z: p.z });
      ys.push(addPost(p.x, p.z));
    }
    for (let i = 0; i < pts.length - 1; i++) {
      addRails(pts[i], pts[i + 1], ys[i], ys[i + 1]);
    }
  }

  group.renderOrder = R_DECOR;
  return group;
}

/* ═══════════════════════════════════════════
   buildSteppingStones() — gray stones in the river
   ═══════════════════════════════════════════ */

export function buildSteppingStones() {
  const group = new THREE.Group();
  group.name = "stepping_stones";

  const stoneGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.25, 8);
  const stoneMat = tMat("#8a8a82");

  const spots = [
    [0, 20], [-1, 18], [1, 16],
    [4, -1], [8, -4], [12, -7],
  ];
  for (const [x, z] of spots) {
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    stone.position.set(x, WATER_Y - 0.05, z);
    stone.rotation.y = Math.random() * Math.PI;
    stone.renderOrder = R_WATER + 1;
    group.add(stone);
  }

  return group;
}

/* ═══════════════════════════════════════════
   addWaterfall() — cascading from north cliff
   ═══════════════════════════════════════════ */

export function addWaterfall(scene, waterUniforms) {
  const cx = 0, baseZ = 40;
  const topY = terrainH(cx, 48) + 1.5;
  const botY = WATER_Y + 0.2;

  /* stone ledges */
  const ledgeMat = tMat("#8f8e87");
  const ledges = [
    { y: topY, z: 46, w: 7, h: 1.2, d: 3 },
    { y: topY * 0.65 + botY * 0.35, z: 43, w: 6, h: 0.9, d: 2.5 },
    { y: botY + 0.5, z: 41, w: 5, h: 0.6, d: 2 },
  ];
  for (const l of ledges) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(l.w, l.h, l.d), ledgeMat);
    m.position.set(cx, l.y, l.z);
    m.renderOrder = R_DECOR;
    scene.add(m);
  }

  /* animated water cascade */
  const wfMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide,
    uniforms: { uTime: waterUniforms.uTime },
    vertexShader: `varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      void main(){
        float flow = fract(vUv.y*1.35 - uTime*0.42);
        float wave = smoothstep(0.0,0.42,flow)*smoothstep(1.0,0.6,flow);
        vec3 c = mix(vec3(.3,.58,.75),vec3(.4,.68,.85),wave*.5);
        float edge = smoothstep(0.0,0.18,vUv.x)*smoothstep(1.0,0.82,vUv.x);
        float foam = smoothstep(0.55,1.0,abs(sin((vUv.y-uTime*.45)*14.0)))*0.10;
        gl_FragColor = vec4(c+foam, edge*0.9);
      }`,
  });

  /* cascade planes from ledge to ledge */
  const pts = [
    [cx, topY, 47], [cx, topY * 0.65 + botY * 0.35 + 0.5, 44],
    [cx, botY + 0.8, 42], [cx, botY, 40.5],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
    const len = Math.hypot(y1 - y0, z1 - z0);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(4, len, 1, 10), wfMat);
    plane.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const dir = new THREE.Vector3(0, y1 - y0, z1 - z0).normalize();
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    plane.renderOrder = R_DECOR + 1;
    scene.add(plane);
  }

  /* foam at base */
  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 16),
    new THREE.MeshBasicMaterial({ color: "#c8e8f0", transparent: true, opacity: 0.4 })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(cx, WATER_Y + 0.03, baseZ - 0.5);
  foam.renderOrder = R_WATER + 1;
  scene.add(foam);
}

/* ═══════════════════════════════════════════
   Placement data for world.js
   ═══════════════════════════════════════════ */

export const TREE_SPOTS = [
  /* NE hills – woodcutting */
  [20, 18, 2.2, 1.8], [28, 28, 2.4, 3.6], [18, 28, 2.1, 0.9],
  [32, 20, 1.9, 2.4], [24, 32, 2.3, 4.2],
  /* NW hills */
  [-22, 18, 2.0, 1.0], [-30, 24, 1.9, 5.2], [-20, 26, 2.2, 4.5],
  /* meadow edges */
  [-16, -18, 1.7, 2.1], [14, -18, 1.6, 0.7], [-8, -42, 2.4, 3.3],
];

export const ROCK_MAJOR_SPOTS = [
  [30, 30, 1.55, 0.3],   /* NE hill */
  [-28, 26, 1.6, 1.4],   /* NW hill */
];

export const ROCK_SMALL_SPOTS = [
  [22, 34, 1.04, 3.2], [-26, 30, 1.0, 4.1],
  [34, 22, 0.98, 5.0], [-32, 18, 0.95, 2.6],
];

export const BUSH_SPOTS = [
  [-12, -28, 1.1, 0.4], [12, -28, 1.12, 2.8],
  [20, -10, 1.1, 1.9], [-18, -12, 1.08, 5.0],
  [8, -38, 1.0, 3.8],
];

export const CLIFF_ROCK_SPOTS = [
  [-38, 38, 4.2, 0], [0, 42, 3.8, 1.6], [38, 38, 4.5, 3.1],
  [-36, 40, 4.0, 4.7], [36, 40, 3.6, 0.8],
  [-42, 20, 4.1, 2.3], [-42, 4, 3.9, 5.5],
  [-42, -12, 4.4, 3.9], [-42, -28, 3.5, 1.2],
  [0, -40, 4.3, 4.1], [-18, -40, 3.7, 2.8],
  [18, -40, 4.0, 5.8], [-34, -38, 4.6, 0.4],
  [28, -38, 3.8, 3.5],
];

export const FISHING_SPOT_POSITIONS = [
  { x: -4, z: 14, phase: 0 },
  { x: 4, z: 4, phase: 1.2 },
  { x: 8, z: -4, phase: 2.4 },
  { x: 42, z: -16, phase: 3.6 },
  { x: 46, z: -18, phase: 4.8 },
];

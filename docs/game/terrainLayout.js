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
   terrainLayout.js — full tile-based terrain with autotiling
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
  /* ground */
  grass:              "Grass_Flat.glb",
  hillSide:           "Hill_Side.glb",
  hillSideOnSide:     "Hill_Side_On_Side.glb",
  hillCornerOuter:    "Hill_Corner_Outer_2x2.glb",
  hillCornerInner:    "Hill_Corner_Inner_2x2.glb",
  hillTransFromGentle:"Hill_Side_Transition_From_Gentle.glb",
  hillTransToGentle:  "Hill_Side_Transition_To_Gentle.glb",

  /* path */
  pathCenter:           "Path_Center.glb",
  pathSide:             "Path_Side.glb",
  pathCornerInner1x1:   "Path_Corner_Inner_1x1.glb",
  pathCornerInner2x2:   "Path_Corner_Inner_2x2.glb",
  pathCornerOuter1x1:   "Path_Corner_Outer_1x1.glb",
  pathCornerOuter2x2:   "Path_Corner_Outer_2x2.glb",
  pathCornerOuter3x3:   "Path_Corner_Outer_3x3.glb",
  pathCornerY2x2:       "Path_Corner_Y_2x2.glb",
  pathCornerY3x3:       "Path_Corner_Y_3x3.glb",
  pathHillGentleCenter: "Path_Hill_Gentle_Center.glb",
  pathHillGentleSide:   "Path_Hill_Gentle_Side.glb",
  pathHillSharpCenter:  "Path_Hill_Sharp_Center.glb",
  pathHillSharpSide:    "Path_Hill_Sharp_Side.glb",
  pathStepsCenter:      "Path_Steps_Center.glb",
  pathStepsEdge:        "Path_Steps_Edge.glb",
  pathStepsGrassEdge:   "Path_Steps_Grass_Edge.glb",
  pathStepsGrassEdgeTop:"Path_Steps_Grass_Edge_Top.glb",

  /* water */
  waterFlat:   "Water_Flat.glb",
  waterSlope:  "Water_Slope.glb",

  /* sand */
  sandFlat:            "Sand_Flat.glb",
  sandSide:            "Sand_Side.glb",
  sandCornerOuter:     "Sand_Corner_Outer_3x3.glb",
  sandCornerInner:     "Sand_Corner_Inner_3x3.glb",
  sandSideOverlap:     "Sand_Side_Overlap_Side.glb",
  sandTransFromGentle: "Sand_Side_Transition_From_Gentle.glb",
  sandTransToGentle:   "Sand_Side_Transition_To_Gentle.glb",

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

  /* cliff */
  cliffBaseStr:            "Cliff_Base_Straight.glb",
  cliffBaseWF:             "Cliff_Base_Waterfall.glb",
  cliffBaseCornerOuterLg:  "Cliff_Base_Corner_Outer_Lg.glb",
  cliffBaseCornerOuterSm:  "Cliff_Base_Corner_Outer_Sm.glb",
  cliffBaseCornerInnerLg:  "Cliff_Base_Corner_Inner_Lg.glb",
  cliffBaseCornerInnerSm:  "Cliff_Base_Corner_Inner_Sm.glb",
  cliffBaseHillGentle:     "Cliff_Base_Hill_Gentle.glb",
  cliffBaseHillSharp:      "Cliff_Base_Hill_Sharp.glb",
  cliffMidStr:             "Cliff_Mid_Straight.glb",
  cliffMidWF:              "Cliff_Mid_Waterfall.glb",
  cliffMidCornerOuterLg:   "Cliff_Mid_Corner_Outer_Lg.glb",
  cliffMidCornerOuterSm:   "Cliff_Mid_Corner_Outer_Sm.glb",
  cliffMidCornerInnerLg:   "Cliff_Mid_Corner_Inner_Lg.glb",
  cliffMidCornerInnerSm:   "Cliff_Mid_Corner_Inner_Sm.glb",
  cliffTopStr:             "Cliff_Top_Straight.glb",
  cliffTopWF:              "Cliff_Top_Waterfall.glb",
  cliffTopCornerOuterLg:   "Cliff_Top_Corner_Outer_Lg.glb",
  cliffTopCornerOuterSm:   "Cliff_Top_Corner_Outer_Sm.glb",
  cliffTopCornerInnerLg:   "Cliff_Top_Corner_Inner_Lg.glb",
  cliffTopCornerInnerSm:   "Cliff_Top_Corner_Inner_Sm.glb",
  cliffTopHillGentle:      "Cliff_Top_Hill_Gentle.glb",
  cliffTopHillSharp:       "Cliff_Top_Hill_Sharp.glb",
  waterfallTile:           "Waterfall.glb",
  waterfallTop:            "Waterfall_Top.glb",

  /* props */
  bush1:           "Prop_Bush_1.glb",
  bush2:           "Prop_Bush_2.glb",
  bush3:           "Prop_Bush_3.glb",
  rock1:           "Prop_Rock_1.glb",
  rock2:           "Prop_Rock_2.glb",
  rock3:           "Prop_Rock_3.glb",
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

/* ═══════════════════════════════════════════
   Geometry helpers
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

/* ═══════════════════════════════════════════
   Zone classification & autotiling constants
   ═══════════════════════════════════════════ */

const ZONE = { WATER: 0, SAND: 1, PATH: 2, GRASS: 3 };
const DROP_MIN = 0.15;

const DIRS = ["n", "e", "s", "w"];
const DIR_DELTA = { n: [0, 1], e: [1, 0], s: [0, -1], w: [-1, 0] };
const DIR_ROT = { n: 0, e: -Math.PI / 2, s: Math.PI, w: Math.PI / 2 };
const DIAGS = { ne: [1, 1], se: [1, -1], sw: [-1, -1], nw: [-1, 1] };
const ADJ_PAIRS = [["n", "e"], ["e", "s"], ["s", "w"], ["w", "n"]];
const OPP_PAIRS = [["n", "s"], ["e", "w"]];
const CORNER_ROT = { "n,e": 0, "e,s": -Math.PI / 2, "s,w": Math.PI, "w,n": Math.PI / 2 };
const INNER_ROT  = { "n,e": Math.PI, "e,s": Math.PI / 2, "s,w": 0, "w,n": -Math.PI / 2 };
const DIAG_ROT   = { ne: 0, se: -Math.PI / 2, sw: Math.PI, nw: Math.PI / 2 };

function ck(gx, gz) { return gx + "," + gz; }

function isPlayableTerrainCell(gx, gz) {
  return !(gz > 19 || gx < -19 || gz < -18);
}

function isOceanCell(wx, wz) {
  return wx > 34 && terrainH(wx, wz) < WATER_Y + 0.08;
}

function isWaterCellWorld(wx, wz) {
  return isInRiver(wx, wz) || isOceanCell(wx, wz);
}

/* village keep-out zones (for buildProps scatter) */
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

/* ═══════════════════════════════════════════
   buildTerrain() — tile-driven terrain with autotiling
   ═══════════════════════════════════════════ */

export function buildTerrain(lib, waterUniforms) {
  /* ── 1. Zone + height maps ── */
  const zoneMap = new Map(), hMap = new Map();
  for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
    for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
      if (!isPlayableTerrainCell(gx, gz)) continue;
      const wx = gx * TILE_S, wz = gz * TILE_S;
      const h = terrainH(wx, wz);
      const k = ck(gx, gz);
      hMap.set(k, h);
      if (isWaterCellWorld(wx, wz))   zoneMap.set(k, ZONE.WATER);
      else if (isBeach(wx, wz))       zoneMap.set(k, ZONE.SAND);
      else if (isOnPath(wx, wz))      zoneMap.set(k, ZONE.PATH);
      else                            zoneMap.set(k, ZONE.GRASS);
    }
  }

  const claimed = new Set();
  const landH = [], waterH = [];

  /* shorthand helpers */
  const nz = (gx, gz, d) => { const [dx, dz] = DIR_DELTA[d]; return zoneMap.get(ck(gx + dx, gz + dz)); };
  const nh = (gx, gz, d) => { const [dx, dz] = DIR_DELTA[d]; return hMap.get(ck(gx + dx, gz + dz)); };
  const dz = (gx, gz, diag) => { const [dx, ddz] = DIAGS[diag]; return zoneMap.get(ck(gx + dx, gz + ddz)); };

  const putL = (tile, gx, gz, y, rot) => {
    const t = lib[tile]; if (!t) return;
    landH.push(...harvestTile(t, tileMat4(gx * TILE_S, y, gz * TILE_S, rot)));
  };
  const putW = (tile, gx, gz, y, rot) => {
    const t = lib[tile]; if (!t) return;
    waterH.push(...harvestTile(t, tileMat4(gx * TILE_S, y, gz * TILE_S, rot)));
  };

  const canClaim = cells => {
    for (const [x, z] of cells) if (claimed.has(ck(x, z)) || !zoneMap.has(ck(x, z))) return false;
    return true;
  };
  const claimAll = cells => { for (const [x, z] of cells) claimed.add(ck(x, z)); };

  /* ── 2a. 3×3 pass: sand corners ── */
  for (let gx = GX_MIN + 1; gx <= GX_MAX - 1; gx++) {
    for (let gz = GZ_MIN + 1; gz <= GZ_MAX - 1; gz++) {
      const k = ck(gx, gz);
      if (zoneMap.get(k) !== ZONE.SAND) continue;
      const cells = [];
      for (let dx = -1; dx <= 1; dx++)
        for (let ddz = -1; ddz <= 1; ddz++)
          cells.push([gx + dx, gz + ddz]);
      if (!canClaim(cells)) continue;
      const h = hMap.get(k);

      /* Outer: 2 adjacent non-sand cardinal */
      const nonSand = DIRS.filter(d => { const n = nz(gx, gz, d); return n != null && n !== ZONE.SAND; });
      if (nonSand.length === 2) {
        for (const [a, b] of ADJ_PAIRS) {
          if (nonSand.includes(a) && nonSand.includes(b)) {
            putL("sandCornerOuter", gx, gz, h - GRASS_Y, CORNER_ROT[a + "," + b] ?? 0);
            claimAll(cells); break;
          }
        }
        if (claimed.has(k)) continue;
      }

      /* Inner: all cardinal sand, 1 diagonal non-sand */
      if (nonSand.length === 0) {
        for (const diag of ["ne", "se", "sw", "nw"]) {
          const d2 = dz(gx, gz, diag);
          if (d2 != null && d2 !== ZONE.SAND) {
            putL("sandCornerInner", gx, gz, h - GRASS_Y, DIAG_ROT[diag]);
            claimAll(cells); break;
          }
        }
      }
    }
  }

  /* ── 2b. 2×2 pass: hill corners ── */
  for (let gx = GX_MIN; gx <= GX_MAX - 1; gx += 2) {
    for (let gz = GZ_MIN; gz <= GZ_MAX - 1; gz += 2) {
      const cells = [[gx, gz], [gx + 1, gz], [gx, gz + 1], [gx + 1, gz + 1]];
      if (!canClaim(cells)) continue;
      const k = ck(gx, gz);
      if (zoneMap.get(k) === ZONE.WATER) continue;
      const h = hMap.get(k);
      const drops = {};
      for (const d of DIRS) { const n = nh(gx, gz, d); drops[d] = n != null ? h - n : 0; }
      const topY = Math.max(0, h - GRASS_Y);

      /* Outer corner: 2 adjacent drops */
      let placed = false;
      for (const [a, b] of ADJ_PAIRS) {
        if (drops[a] > DROP_MIN && drops[b] > DROP_MIN) {
          putL("hillCornerOuter", gx, gz, topY, CORNER_ROT[a + "," + b] ?? 0);
          claimAll(cells); placed = true; break;
        }
      }
      if (placed) continue;

      /* Inner corner: 2 adjacent raises */
      for (const [a, b] of ADJ_PAIRS) {
        if (drops[a] < -DROP_MIN && drops[b] < -DROP_MIN) {
          putL("hillCornerInner", gx, gz, topY, INNER_ROT[a + "," + b] ?? 0);
          claimAll(cells); break;
        }
      }
    }
  }

  /* ── 3. Single-cell edge pass ── */
  for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
    for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
      const k = ck(gx, gz);
      if (claimed.has(k) || !zoneMap.has(k)) continue;
      const z = zoneMap.get(k), h = hMap.get(k);

      /* Water → slope toward land */
      if (z === ZONE.WATER) {
        for (const d of DIRS) {
          const n = nz(gx, gz, d);
          if (n != null && n !== ZONE.WATER) {
            putW("waterSlope", gx, gz, 0, DIR_ROT[d]);
            claimed.add(k); break;
          }
        }
        continue; // remaining water filled in pass 4
      }

      /* Height-based hill tiles for non-water cells */
      const drops = {};
      const dropDirs = [];
      for (const d of DIRS) {
        const n = nh(gx, gz, d);
        drops[d] = n != null ? h - n : 0;
        if (drops[d] > DROP_MIN) dropDirs.push(d);
      }
      const topY = Math.max(0, h - GRASS_Y);

      if (dropDirs.length >= 2) {
        /* Opposite drops → ridge */
        for (const [a, b] of OPP_PAIRS) {
          if (drops[a] > DROP_MIN && drops[b] > DROP_MIN) {
            putL("hillSideOnSide", gx, gz, topY, a === "n" ? 0 : -Math.PI / 2);
            claimed.add(k); break;
          }
        }
        if (claimed.has(k)) continue;
      }

      if (dropDirs.length >= 1) {
        let bestDir = dropDirs[0], bestVal = drops[dropDirs[0]];
        for (const d of dropDirs) if (drops[d] > bestVal) { bestVal = drops[d]; bestDir = d; }
        putL("hillSide", gx, gz, topY, DIR_ROT[bestDir]);
        claimed.add(k); continue;
      }

      /* Zone-specific edge tiles (flat boundaries) */
      if (z === ZONE.SAND) {
        const ns = DIRS.filter(d => { const n = nz(gx, gz, d); return n != null && n !== ZONE.SAND; });
        if (ns.length >= 2) {
          for (const [a, b] of OPP_PAIRS) {
            if (ns.includes(a) && ns.includes(b)) {
              putL("sandSideOverlap", gx, gz, h - GRASS_Y, DIR_ROT[a]);
              claimed.add(k); break;
            }
          }
          if (claimed.has(k)) continue;
          for (const [a, b] of ADJ_PAIRS) {
            if (ns.includes(a) && ns.includes(b)) {
              putL("sandSide", gx, gz, h - GRASS_Y, DIR_ROT[a]);
              claimed.add(k); break;
            }
          }
          if (claimed.has(k)) continue;
        }
        if (ns.length === 1) {
          putL("sandSide", gx, gz, h - GRASS_Y, DIR_ROT[ns[0]]);
          claimed.add(k); continue;
        }
      }

      if (z === ZONE.PATH) {
        const np = DIRS.filter(d => { const n = nz(gx, gz, d); return n != null && n !== ZONE.PATH; });
        if (np.length >= 2) {
          for (const [a, b] of ADJ_PAIRS) {
            if (np.includes(a) && np.includes(b)) {
              putL("pathCornerOuter1x1", gx, gz, h, CORNER_ROT[a + "," + b] ?? 0);
              claimed.add(k); break;
            }
          }
          if (claimed.has(k)) continue;
        }
        if (np.length === 1) {
          putL("pathSide", gx, gz, h, DIR_ROT[np[0]]);
          claimed.add(k); continue;
        }
        if (np.length === 0) {
          for (const diag of ["ne", "se", "sw", "nw"]) {
            const d2 = dz(gx, gz, diag);
            if (d2 != null && d2 !== ZONE.PATH) {
              putL("pathCornerInner1x1", gx, gz, h, DIAG_ROT[diag]);
              claimed.add(k); break;
            }
          }
          if (claimed.has(k)) continue;
        }
      }
    }
  }

  /* ── 4. Fill pass: flat tiles for remaining cells ── */
  for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
    for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
      const k = ck(gx, gz);
      if (claimed.has(k) || !zoneMap.has(k)) continue;
      const z = zoneMap.get(k), h = hMap.get(k);
      switch (z) {
        case ZONE.WATER: putW("waterFlat", gx, gz, 0, 0);          break;
        case ZONE.SAND:  putL("sandFlat",  gx, gz, h - GRASS_Y, 0); break;
        case ZONE.PATH:  putL("pathCenter", gx, gz, h, 0);          break;
        default:         putL("grass",      gx, gz, h - GRASS_Y, 0); break;
      }
    }
  }

  /* ── 5. Merge terrain geometry ── */
  const terrainMeshes = mergeByMaterial(landH);
  const group = new THREE.Group();
  group.name = "terrain";
  terrainMeshes.forEach(m => group.add(m));

  /* ── 6. Merge water geometry with wave animation ── */
  const waterMeshes = mergeByMaterial(waterH);
  for (const m of waterMeshes) {
    m.material.onBeforeCompile = shader => {
      shader.uniforms.uTime = waterUniforms.uTime;
      shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         transformed.y += sin(transformed.x*0.18+uTime*0.6)*0.02
                        + cos(transformed.z*0.15+uTime*0.4)*0.015;`
      );
    };
    m.renderOrder = R_WATER;
    group.add(m);
  }

  /* ── 7. Cliffs ── */
  buildCliffs(lib).forEach(m => group.add(m));

  return group;
}

/* ═══════════════════════════════════════════
   buildCliffs() — stacked cliff tiles
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

  /* North cliff wall (gz=20) */
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
    if (gx !== 0 && gx % 6 === 0) push("cliffTopHillGentle", wx, 2 * TILE_S, wz, 0);
  }

  /* West cliff wall (gx=-20) */
  for (let gz = GZ_MIN; gz < 20; gz++) {
    if (gz === -19) continue;
    const wx = -20 * TILE_S, wz = gz * TILE_S;
    pushPair(wx, wz, -Math.PI / 2, "cliffBaseStr", "cliffMidStr");
    if (gz % 7 === 0) push("cliffBaseHillGentle", wx, 0, wz, -Math.PI / 2);
  }

  /* South cliff wall (gz=-19) */
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

/* ═══════════════════════════════════════════
   buildProps() — scatter decorations
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
   buildBridge() — log bridge crossing the river
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
   buildDock() — wooden dock on the beach
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
   buildFences() — wooden fences along paths
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
  [20, 18, 2.2, 1.8], [28, 28, 2.4, 3.6], [18, 28, 2.1, 0.9],
  [32, 20, 1.9, 2.4], [24, 32, 2.3, 4.2],
  [-22, 18, 2.0, 1.0], [-30, 24, 1.9, 5.2], [-20, 26, 2.2, 4.5],
  [-16, -18, 1.7, 2.1], [14, -18, 1.6, 0.7], [-8, -42, 2.4, 3.3],
];

export const ROCK_MAJOR_SPOTS = [
  [30, 30, 1.55, 0.3],
  [-28, 26, 1.6, 1.4],
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

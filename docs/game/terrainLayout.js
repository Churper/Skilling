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

function setupWaterMaterial(mesh, waterUniforms) {
  if (!mesh) return;
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#93d8f6"),
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    depthTest: true,
  });
  mesh.material = mat;
  mesh.userData.isWaterSurface = true;
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       transformed.y += sin(transformed.x*0.18+uTime*0.6)*0.02
                      + cos(transformed.z*0.15+uTime*0.4)*0.015;`
    );
  };
  mesh.renderOrder = R_WATER;
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
  waterCurve:  "Water_Curve.glb",
  waterfallWaterTop:      "Waterfall_Water_Top.glb",
  waterfallWaterTopEdge:  "Waterfall_Water_Top_Edge.glb",
  waterfallWaterMid:      "Waterfall_Water_Mid.glb",
  waterfallWaterMidEdge:  "Waterfall_Water_Mid_Edge.glb",

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

/* Editor tile names -> runtime library keys */
const EDITOR_TILE_TO_LIB = Object.freeze({
  Grass_Flat: "grass",
  Hill_Side: "hillSide",
  Hill_Side_On_Side: "hillSideOnSide",
  Hill_Corner_Outer_2x2: "hillCornerOuter",
  Hill_Corner_Inner_2x2: "hillCornerInner",
  Hill_Side_Transition_From_Gentle: "hillTransFromGentle",
  Hill_Side_Transition_To_Gentle: "hillTransToGentle",
  Path_Center: "pathCenter",
  Path_Side: "pathSide",
  Path_Corner_Inner_1x1: "pathCornerInner1x1",
  Path_Corner_Inner_2x2: "pathCornerInner2x2",
  Path_Corner_Outer_1x1: "pathCornerOuter1x1",
  Path_Corner_Outer_2x2: "pathCornerOuter2x2",
  Path_Corner_Outer_3x3: "pathCornerOuter3x3",
  Path_Corner_Y_2x2: "pathCornerY2x2",
  Path_Corner_Y_3x3: "pathCornerY3x3",
  Path_Hill_Gentle_Center: "pathHillGentleCenter",
  Path_Hill_Gentle_Side: "pathHillGentleSide",
  Path_Hill_Sharp_Center: "pathHillSharpCenter",
  Path_Hill_Sharp_Side: "pathHillSharpSide",
  Path_Steps_Center: "pathStepsCenter",
  Path_Steps_Edge: "pathStepsEdge",
  Path_Steps_Grass_Edge: "pathStepsGrassEdge",
  Path_Steps_Grass_Edge_Top: "pathStepsGrassEdgeTop",
  Water_Flat: "waterFlat",
  Water_Slope: "waterSlope",
  Water_Curve: "waterCurve",
  Waterfall_Water_Top: "waterfallWaterTop",
  Waterfall_Water_Top_Edge: "waterfallWaterTopEdge",
  Waterfall_Water_Mid: "waterfallWaterMid",
  Waterfall_Water_Mid_Edge: "waterfallWaterMidEdge",
  Sand_Flat: "sandFlat",
  Sand_Side: "sandSide",
  Sand_Corner_Outer_3x3: "sandCornerOuter",
  Sand_Corner_Inner_3x3: "sandCornerInner",
  Sand_Side_Overlap_Side: "sandSideOverlap",
  Sand_Side_Transition_From_Gentle: "sandTransFromGentle",
  Sand_Side_Transition_To_Gentle: "sandTransToGentle",
});

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
const DROP_MIN = 0.35;

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

function rotQuarterTurn(rot) {
  return ((Math.round((rot || 0) / (Math.PI / 2)) % 4) + 4) % 4;
}

function getEditorTileExtensions(gx, gz, tile, rot) {
  const r = rotQuarterTurn(rot);
  if (tile === "Hill_Side" || tile.includes("Transition")) {
    if (r === 0) return [[gx, gz - 1]];
    if (r === 1) return [[gx - 1, gz]];
    if (r === 2) return [[gx, gz + 1]];
    return [[gx + 1, gz]];
  }
  if (tile === "Hill_Corner_Outer_2x2") {
    if (r === 0) return [[gx + 1, gz], [gx, gz - 1], [gx + 1, gz - 1]];
    if (r === 1) return [[gx - 1, gz], [gx, gz - 1], [gx - 1, gz - 1]];
    if (r === 2) return [[gx - 1, gz], [gx, gz + 1], [gx - 1, gz + 1]];
    return [[gx + 1, gz], [gx, gz + 1], [gx + 1, gz + 1]];
  }
  if (tile === "Hill_Corner_Inner_2x2") {
    if (r === 0) return [[gx - 1, gz], [gx, gz + 1], [gx - 1, gz + 1]];
    if (r === 1) return [[gx, gz - 1], [gx - 1, gz], [gx - 1, gz - 1]];
    if (r === 2) return [[gx + 1, gz], [gx, gz - 1], [gx + 1, gz - 1]];
    return [[gx, gz + 1], [gx + 1, gz], [gx + 1, gz + 1]];
  }
  return [];
}

function classifyEditorTileZone(tileName) {
  if (!tileName) return "grass";
  if (isEditorWaterTile(tileName)) return "water";
  if (tileName.startsWith("Sand_")) return "sand";
  if (tileName.startsWith("Path_")) return "path";
  return "grass";
}

function isEditorWaterTile(tileName) {
  return !!tileName && (
    tileName.startsWith("Water_") ||
    tileName.startsWith("Waterfall_Water_")
  );
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

export function buildTerrain(lib, waterUniforms, tilemapData = null) {
  /* Optional direct terrain placement from editor tilemap */
  if (tilemapData && tilemapData.tiles && typeof tilemapData.tiles === "object") {
    const landH = [], waterH = [];
    const coverage = new Set();
    const markCoverage = (entryObj, key) => {
      if (!entryObj || !entryObj.tile) return;
      const [gx, gz] = key.split(",").map(Number);
      if (!Number.isFinite(gx) || !Number.isFinite(gz)) return;
      coverage.add(ck(gx, gz));
      for (const [ex, ez] of getEditorTileExtensions(gx, gz, entryObj.tile, entryObj.rot || 0)) {
        coverage.add(ck(ex, ez));
      }
    };
    const addPlaced = (entryObj, key, preferUnderlay = false) => {
      if (!entryObj || !entryObj.tile) return;
      const [gx, gz] = key.split(",").map(Number);
      if (!Number.isFinite(gx) || !Number.isFinite(gz)) return;
      const libKey = EDITOR_TILE_TO_LIB[entryObj.tile];
      const tmpl = lib[libKey];
      if (!tmpl) return;
      const y = Number.isFinite(entryObj.y) ? entryObj.y : 0;
      const rot = Number.isFinite(entryObj.rot) ? entryObj.rot : 0;
      const arr = isEditorWaterTile(entryObj.tile) || preferUnderlay ? waterH : landH;
      arr.push(...harvestTile(tmpl, tileMat4(gx * TILE_S, y, gz * TILE_S, rot)));
    };

    const underlays = tilemapData.underlays || {};
    for (const [key, val] of Object.entries(tilemapData.tiles)) markCoverage(val, key);
    for (const [key, val] of Object.entries(underlays)) {
      // Skip duplicate stacked water if this cell already has a water top tile.
      const top = tilemapData.tiles[key];
      if (isEditorWaterTile(top?.tile) && isEditorWaterTile(val?.tile)) continue;
      addPlaced(val, key, true);
    }
    for (const [key, val] of Object.entries(tilemapData.tiles)) addPlaced(val, key, false);

    // Fill uncovered playable cells with flat fallback tiles to eliminate holes.
    for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
      for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
        if (!isPlayableTerrainCell(gx, gz)) continue;
        const k = ck(gx, gz);
        if (coverage.has(k)) continue;
        const wx = gx * TILE_S, wz = gz * TILE_S;
        let tile = "Grass_Flat";
        if (isWaterCellWorld(wx, wz)) tile = "Water_Flat";
        else if (isBeach(wx, wz)) tile = "Sand_Flat";
        else if (isOnPath(wx, wz)) tile = "Path_Center";
        addPlaced({ tile, rot: 0, y: 0 }, k, false);
      }
    }

    const group = new THREE.Group();
    group.name = "terrain";

    mergeByMaterial(landH).forEach(m => group.add(m));

    const waterMeshes = mergeByMaterial(waterH);
    for (const m of waterMeshes) {
      setupWaterMaterial(m, waterUniforms);
      group.add(m);
    }

    buildCliffs(lib).forEach(m => group.add(m));
    return group;
  }

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

  /* Tile Y for flat land — y=0 in flatlands, real height in hills */
  const flatY = (h) => h > GRASS_Y + 0.3 ? h - GRASS_Y : 0;

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

      /* Outer: 2 adjacent non-sand cardinal */
      const nonSand = DIRS.filter(d => { const n = nz(gx, gz, d); return n != null && n !== ZONE.SAND; });
      if (nonSand.length === 2) {
        for (const [a, b] of ADJ_PAIRS) {
          if (nonSand.includes(a) && nonSand.includes(b)) {
            putL("sandCornerOuter", gx, gz, 0, CORNER_ROT[a + "," + b] ?? 0);
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
            putL("sandCornerInner", gx, gz, 0, DIAG_ROT[diag]);
            claimAll(cells); break;
          }
        }
      }
    }
  }

  /* ── 2b. 2×2 pass: hill & riverbank corners ── */
  for (let gx = GX_MIN; gx <= GX_MAX - 1; gx += 2) {
    for (let gz = GZ_MIN; gz <= GZ_MAX - 1; gz += 2) {
      const cells = [[gx, gz], [gx + 1, gz], [gx, gz + 1], [gx + 1, gz + 1]];
      if (!canClaim(cells)) continue;
      const k = ck(gx, gz);
      /* all 4 cells must be non-water */
      if (cells.some(([cx, cz]) => {
        const zn = zoneMap.get(ck(cx, cz));
        return zn == null || zn === ZONE.WATER;
      })) continue;
      const h = hMap.get(k);

      /* Riverbank corner: check which block edges face water (outside the 2x2) */
      const bWater = [];
      const isW = (cx, cz) => zoneMap.get(ck(cx, cz)) === ZONE.WATER;
      if (isW(gx, gz + 2) || isW(gx + 1, gz + 2)) bWater.push("n");
      if (isW(gx + 2, gz) || isW(gx + 2, gz + 1)) bWater.push("e");
      if (isW(gx, gz - 1) || isW(gx + 1, gz - 1)) bWater.push("s");
      if (isW(gx - 1, gz) || isW(gx - 1, gz + 1)) bWater.push("w");
      if (bWater.length >= 2) {
        for (const [a, b] of ADJ_PAIRS) {
          if (bWater.includes(a) && bWater.includes(b)) {
            putL("hillCornerOuter", gx, gz, 0, CORNER_ROT[a + "," + b] ?? 0);
            claimAll(cells); break;
          }
        }
        if (claimed.has(k)) continue;
      }
      /* Inner corner: no cardinal water, but diagonal water outside block */
      if (bWater.length === 0) {
        const diagCells = { ne: [gx+2,gz+2], se: [gx+2,gz-1], sw: [gx-1,gz-1], nw: [gx-1,gz+2] };
        let innerDone = false;
        for (const diag of ["ne", "se", "sw", "nw"]) {
          const [dcx, dcz] = diagCells[diag];
          if (isW(dcx, dcz)) {
            putL("hillCornerInner", gx, gz, 0, DIAG_ROT[diag]);
            claimAll(cells); innerDone = true; break;
          }
        }
        if (innerDone) continue;
      }

      /* Skip height-based corners near river (bank carving causes false drops) */
      const rq2 = riverQuery(gx * TILE_S, gz * TILE_S);
      if (rq2.dist < rq2.width + TILE_S * 3) continue;

      /* Hill corner: 2 adjacent height drops (actual hills only) */
      const drops = {};
      for (const d of DIRS) {
        const n = nh(gx, gz, d); drops[d] = n != null ? h - n : 0;
      }
      const topY = Math.max(0, h - GRASS_Y);

      let placed = false;
      for (const [a, b] of ADJ_PAIRS) {
        if (drops[a] > DROP_MIN && drops[b] > DROP_MIN) {
          putL("hillCornerOuter", gx, gz, topY, CORNER_ROT[a + "," + b] ?? 0);
          claimAll(cells); placed = true; break;
        }
      }
      if (placed) continue;

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

      /* Water cells → all filled with Water_Flat (no slope tiles) */
      if (z === ZONE.WATER) continue;

      /* ── Riverbank: land cell adjacent to water → Hill_Side ── */
      const waterAdj = DIRS.filter(d => nz(gx, gz, d) === ZONE.WATER);
      if (waterAdj.length >= 2) {
        for (const [a, b] of OPP_PAIRS) {
          if (waterAdj.includes(a) && waterAdj.includes(b)) {
            putL("hillSideOnSide", gx, gz, 0, a === "n" ? 0 : -Math.PI / 2);
            claimed.add(k); break;
          }
        }
        if (!claimed.has(k)) {
          putL("hillSide", gx, gz, 0, DIR_ROT[waterAdj[0]]);
          claimed.add(k);
        }
        continue;
      }
      if (waterAdj.length === 1) {
        putL("hillSide", gx, gz, 0, DIR_ROT[waterAdj[0]]);
        claimed.add(k); continue;
      }

      /* ── Height-based hill tiles (actual hills only — skip near river/ocean) ── */
      const cellRq = riverQuery(gx * TILE_S, gz * TILE_S);
      const nearWaterBody = cellRq.dist < cellRq.width + TILE_S * 3;
      if (!nearWaterBody) {
        const drops = {};
        const dropDirs = [];
        for (const d of DIRS) {
          const n = nh(gx, gz, d);
          drops[d] = n != null ? h - n : 0;
          if (drops[d] > DROP_MIN) dropDirs.push(d);
        }
        const topY = Math.max(0, h - GRASS_Y);

        if (dropDirs.length >= 2) {
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
      }

      /* ── Zone-specific edge tiles (flat boundaries) ── */
      if (z === ZONE.SAND) {
        const ns = DIRS.filter(d => { const n = nz(gx, gz, d); return n != null && n !== ZONE.SAND; });
        if (ns.length >= 2) {
          for (const [a, b] of OPP_PAIRS) {
            if (ns.includes(a) && ns.includes(b)) {
              putL("sandSideOverlap", gx, gz, 0, DIR_ROT[a]);
              claimed.add(k); break;
            }
          }
          if (claimed.has(k)) continue;
          for (const [a, b] of ADJ_PAIRS) {
            if (ns.includes(a) && ns.includes(b)) {
              putL("sandSide", gx, gz, 0, DIR_ROT[a]);
              claimed.add(k); break;
            }
          }
          if (claimed.has(k)) continue;
        }
        if (ns.length === 1) {
          putL("sandSide", gx, gz, 0, DIR_ROT[ns[0]]);
          claimed.add(k); continue;
        }
      }

      if (z === ZONE.PATH) {
        const np = DIRS.filter(d => { const n = nz(gx, gz, d); return n != null && n !== ZONE.PATH; });
        if (np.length >= 2) {
          for (const [a, b] of ADJ_PAIRS) {
            if (np.includes(a) && np.includes(b)) {
              putL("pathCornerOuter1x1", gx, gz, GRASS_Y, CORNER_ROT[a + "," + b] ?? 0);
              claimed.add(k); break;
            }
          }
          if (claimed.has(k)) continue;
        }
        if (np.length === 1) {
          putL("pathSide", gx, gz, GRASS_Y, DIR_ROT[np[0]]);
          claimed.add(k); continue;
        }
        if (np.length === 0) {
          for (const diag of ["ne", "se", "sw", "nw"]) {
            const d2 = dz(gx, gz, diag);
            if (d2 != null && d2 !== ZONE.PATH) {
              putL("pathCornerInner1x1", gx, gz, GRASS_Y, DIAG_ROT[diag]);
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
        case ZONE.WATER: putW("waterFlat", gx, gz, 0, 0);              break;
        case ZONE.SAND:  putL("sandFlat",  gx, gz, 0, 0);              break;
        case ZONE.PATH:  putL("pathCenter", gx, gz, GRASS_Y, 0);       break;
        default:         putL("grass",      gx, gz, flatY(h), 0);      break;
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
    setupWaterMaterial(m, waterUniforms);
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
  const cx = 0;
  const topZ = 40.9;
  const endZ = 34.4;
  const topY = terrainH(cx, 40) + 4.8;
  const botY = WATER_Y + 0.16;
  const midZ = (topZ + endZ) * 0.5;
  const midY = topY * 0.58 + botY * 0.42;

  const makeMat = (phase = 0, alpha = 1) => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: waterUniforms.uTime,
      uPhase: { value: phase },
      uAlpha: { value: alpha },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uPhase, uAlpha;
      void main(){
        float t = fract(vUv.y * 2.2 - uTime * 0.45 + uPhase);
        float streak = smoothstep(0.0, 0.24, t) * smoothstep(1.0, 0.62, t);
        float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        float foam = smoothstep(0.75, 1.0, abs(sin((vUv.y * 18.0) - (uTime * 5.2))));
        vec3 col = mix(vec3(0.62,0.86,0.97), vec3(0.80,0.95,1.0), streak * 0.65);
        float a = edge * (0.26 + streak * 0.48) * uAlpha;
        a += edge * foam * 0.08 * uAlpha;
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.85));
      }`,
  });

  const addRibbon = (x, width, phase, alpha = 1) => {
    const pts = [[x, topY, topZ], [x, midY, midZ], [x, botY, endZ]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
      const len = Math.hypot(y1 - y0, z1 - z0);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, len, 1, 12), makeMat(phase + i * 0.17, alpha));
      plane.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
      const dir = new THREE.Vector3(0, y1 - y0, z1 - z0).normalize();
      plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      plane.renderOrder = R_DECOR + 1;
      scene.add(plane);
    }
  };

  // Main fall + softer side ribbons.
  addRibbon(cx, 3.6, 0.0, 1.0);
  addRibbon(cx - 1.05, 1.4, 0.22, 0.7);
  addRibbon(cx + 1.05, 1.4, 0.41, 0.7);

  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.12, 0.9),
    tMat("#8a8f92", { flatShading: true })
  );
  lip.position.set(cx, topY + 0.02, topZ + 0.2);
  lip.renderOrder = R_DECOR;
  scene.add(lip);

  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(2.25, 20),
    new THREE.MeshBasicMaterial({ color: "#dff6ff", transparent: true, opacity: 0.42, depthWrite: false })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(cx, WATER_Y + 0.03, endZ + 0.15);
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
  [-14, 8, 1.45, 2.1],
  [10, 16, 1.5, 4.8],
  [-20, -6, 1.4, 0.9],
];

export const ROCK_SMALL_SPOTS = [
  [22, 34, 1.04, 3.2], [-26, 30, 1.0, 4.1],
  [34, 22, 0.98, 5.0], [-32, 18, 0.95, 2.6],
  [-10, 14, 0.95, 1.7], [-16, 10, 1.0, 5.3],
  [8, 20, 0.9, 0.5], [14, 12, 1.05, 3.9],
  [-22, -2, 0.92, 2.4], [-18, -10, 0.98, 4.6],
  [6, 8, 0.88, 1.2], [-8, 4, 1.02, 3.5],
  [12, 24, 0.96, 5.8], [-24, 16, 0.94, 0.3],
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

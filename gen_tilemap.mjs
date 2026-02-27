// gen_tilemap.mjs v3 — Fill gaps, sand edges, water slopes
// Loads user_tilemap6.json as base (ALL tiles kept), fixes Y, fills gaps,
// adds Sand_Side / Sand_Side_Overlap_Side edges, Water_Slope foam edges.
import fs from "fs";

const TILE_S = 2;
const PI = Math.PI;
const HP = PI / 2;

// ── Grid bounds ──
const GX_MIN = -19, GX_MAX = 24;
const GZ_MIN = -18, GZ_MAX = 19;

function ck(gx, gz) { return `${gx},${gz}`; }

// ── World-space zone helpers (fallback only) ──
const RP = [
  [0,40,2.5],[0,34,2.5],[0,26,2.8],[0,18,3.0],[0,12,3.2],[0,6,3.5],
  [2,2,3.5],[6,-2,4.0],[12,-6,4.5],[20,-10,5.0],[28,-14,5.5],[36,-14,6.5],[48,-14,8.0],
];
function riverQuery(px, pz) {
  let best = { dist: 1e9, width: 3 };
  for (let i = 0; i < RP.length - 1; i++) {
    const [ax,az,aw] = RP[i], [bx,bz,bw] = RP[i+1];
    const dx = bx-ax, dz = bz-az, len2 = dx*dx+dz*dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((px-ax)*dx+(pz-az)*dz)/len2)) : 0;
    const d = Math.hypot(px-(ax+t*dx), pz-(az+t*dz));
    if (d < best.dist) best = { dist: d, width: aw+(bw-aw)*t };
  }
  return best;
}
function isInRiver(x, z) { const q = riverQuery(x, z); return q.dist < q.width; }
function isBeach(x, z) {
  if (x <= 26 || z >= 8) return false;
  if (x > 34 && z < 4) return true;
  if (x > 28 && z < 0 && z > -16) return true;
  return Math.hypot(x - 38, z + 6) < 14;
}
function isOnPath(x, z) {
  const PATH_CLS = [
    [[0,-28],[0,-16],[0,-4],[0,8],[0,12]],
    [[10,-30],[20,-26],[30,-22],[40,-18],[46,-16]],
    [[0,14],[0,22],[0,34],[0,40]],
  ];
  let md = 1e9;
  for (const pts of PATH_CLS)
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax,az] = pts[i], [bx,bz] = pts[i+1];
      const dx = bx-ax, dz = bz-az, l2 = dx*dx+dz*dz;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x-ax)*dx+(z-az)*dz)/l2)) : 0;
      md = Math.min(md, Math.hypot(x-(ax+t*dx), z-(az+t*dz)));
    }
  return md < 3.0;
}

// ═══════════════════════════════════════════════════════════
// PHASE 0: Load user tiles — keep ALL 1,576 tiles
// ═══════════════════════════════════════════════════════════
const data = JSON.parse(fs.readFileSync("user_tilemap6.json", "utf8"));
const tiles = { ...data.tiles };
console.log(`Phase 0: Loaded ${Object.keys(tiles).length} tiles from user_tilemap6.json`);

// ═══════════════════════════════════════════════════════════
// PHASE 1: Fix Y values
// ═══════════════════════════════════════════════════════════
const Y_MAP = {
  "Grass_Flat": 2.0,
  "Path_Center": 2.0,
  "Sand_Flat": 0,
  "Water_Flat": 0,
};
// Hill_Side, Hill_Corner_*, Hill_Side_Transition_* → y=0
let yFixed = 0;
for (const [key, val] of Object.entries(tiles)) {
  const expected = Y_MAP[val.tile];
  if (expected !== undefined) {
    if (val.y !== expected) { val.y = expected; yFixed++; }
  } else if (val.tile.startsWith("Hill_")) {
    if (val.y !== 0) { val.y = 0; yFixed++; }
  }
}
console.log(`Phase 1: Fixed ${yFixed} Y values`);

// ═══════════════════════════════════════════════════════════
// PHASE 2: Build extension & claimed sets
// ═══════════════════════════════════════════════════════════
function getExtensions(gx, gz, tile, rotRad) {
  const r = Math.round(rotRad * 180 / PI);
  if (tile === "Hill_Side" || tile.includes("Transition")) {
    return r === 0 ? [[gx,gz-1]] : r === 90 ? [[gx-1,gz]] :
           r === 180 ? [[gx,gz+1]] : [[gx+1,gz]];
  }
  if (tile === "Hill_Corner_Outer_2x2") {
    return r === 0   ? [[gx+1,gz],[gx,gz-1],[gx+1,gz-1]] :
           r === 90  ? [[gx-1,gz],[gx,gz-1],[gx-1,gz-1]] :
           r === 180 ? [[gx-1,gz],[gx,gz+1],[gx-1,gz+1]] :
                        [[gx+1,gz],[gx,gz+1],[gx+1,gz+1]];
  }
  if (tile === "Hill_Corner_Inner_2x2") {
    return r === 0   ? [[gx-1,gz],[gx,gz+1],[gx-1,gz+1]] :
           r === 90  ? [[gx,gz-1],[gx-1,gz],[gx-1,gz-1]] :
           r === 180 ? [[gx+1,gz],[gx,gz-1],[gx+1,gz-1]] :
                        [[gx,gz+1],[gx+1,gz],[gx+1,gz+1]];
  }
  return [];
}

const claimed = new Set();
for (const [key, val] of Object.entries(tiles)) {
  const [gx, gz] = key.split(",").map(Number);
  const exts = getExtensions(gx, gz, val.tile, val.rot);
  for (const [ex, ez] of exts) claimed.add(ck(ex, ez));
}
console.log(`Phase 2: ${claimed.size} extension cells claimed`);

// ═══════════════════════════════════════════════════════════
// PHASE 3: Fill gap cells
// ═══════════════════════════════════════════════════════════
const DIRS = [[0,1],[0,-1],[1,0],[-1,0]];

let filled = 0;
for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
  for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
    const key = ck(gx, gz);
    if (tiles[key]) continue;        // already has tile
    if (claimed.has(key)) continue;   // extension cell — leave empty

    // Check neighbors
    const neighborTiles = [];
    for (const [dx, dz] of DIRS) {
      const nk = ck(gx + dx, gz + dz);
      if (tiles[nk]) neighborTiles.push(tiles[nk].tile);
    }

    let fillTile, fillY;
    if (neighborTiles.some(t => t === "Water_Flat")) {
      fillTile = "Water_Flat"; fillY = 0;
    } else if (neighborTiles.some(t => t === "Sand_Flat")) {
      fillTile = "Sand_Flat"; fillY = 0;
    } else if (neighborTiles.some(t => t === "Path_Center")) {
      fillTile = "Path_Center"; fillY = 2.0;
    } else if (neighborTiles.length > 0) {
      fillTile = "Grass_Flat"; fillY = 2.0;
    } else {
      // No neighbors — world-space fallback
      const wx = gx * TILE_S, wz = gz * TILE_S;
      if (isInRiver(wx, wz)) { fillTile = "Water_Flat"; fillY = 0; }
      else if (isBeach(wx, wz)) { fillTile = "Sand_Flat"; fillY = 0; }
      else if (isOnPath(wx, wz)) { fillTile = "Path_Center"; fillY = 2.0; }
      else { fillTile = "Grass_Flat"; fillY = 2.0; }
    }

    tiles[key] = { tile: fillTile, rot: 0, y: fillY };
    filled++;
  }
}
console.log(`Phase 3: Filled ${filled} gap cells`);

// ═══════════════════════════════════════════════════════════
// PHASE 4: Sand edge autotiling
// ═══════════════════════════════════════════════════════════
function isSandTile(t) { return t && t.startsWith("Sand_"); }

let sandSideCount = 0, sandOverlapCount = 0;
for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
  for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
    const key = ck(gx, gz);
    const val = tiles[key];
    if (!val || val.tile !== "Sand_Flat") continue;

    // Check which cardinal neighbors are non-sand
    const nonSandDirs = []; // [dirName, ...]
    const checks = [
      { dx: 0, dz: 1, name: "n" },
      { dx: -1, dz: 0, name: "w" },
      { dx: 0, dz: -1, name: "s" },
      { dx: 1, dz: 0, name: "e" },
    ];
    for (const { dx, dz, name } of checks) {
      const nk = ck(gx + dx, gz + dz);
      const nt = tiles[nk];
      if (!nt || !isSandTile(nt.tile)) nonSandDirs.push(name);
    }

    if (nonSandDirs.length === 0) continue; // interior sand, keep flat

    // 4a: Two opposite non-sand neighbors → Sand_Side_Overlap_Side
    const hasNS = nonSandDirs.includes("n") && nonSandDirs.includes("s");
    const hasEW = nonSandDirs.includes("e") && nonSandDirs.includes("w");
    if (hasNS || hasEW) {
      const rot = hasNS ? 0 : HP;
      tiles[key] = { tile: "Sand_Side_Overlap_Side", rot, y: 0 };
      sandOverlapCount++;
      continue;
    }

    // 4b: Exactly 1 non-sand neighbor → Sand_Side
    if (nonSandDirs.length === 1) {
      const dir = nonSandDirs[0];
      const rot = dir === "n" ? 0 : dir === "w" ? HP : dir === "s" ? PI : HP * 3;
      tiles[key] = { tile: "Sand_Side", rot, y: 0 };
      sandSideCount++;
      continue;
    }

    // 2+ adjacent non-sand (L-shape) — keep as Sand_Flat for now
    // (Sand_Corner_Outer_3x3 deferred)
  }
}
console.log(`Phase 4: ${sandSideCount} Sand_Side, ${sandOverlapCount} Sand_Side_Overlap_Side`);

// ═══════════════════════════════════════════════════════════
// PHASE 5: Water_Slope at river edges
// ═══════════════════════════════════════════════════════════
function isLandTile(t) {
  if (!t) return false;
  return t.startsWith("Grass_") || t.startsWith("Sand_") ||
         t.startsWith("Path_") || t.startsWith("Hill_");
}

let waterSlopeCount = 0;
for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
  for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
    const key = ck(gx, gz);
    const val = tiles[key];
    if (!val || val.tile !== "Water_Flat") continue;

    const landDirs = [];
    const checks = [
      { dx: 0, dz: 1, name: "n" },
      { dx: -1, dz: 0, name: "w" },
      { dx: 0, dz: -1, name: "s" },
      { dx: 1, dz: 0, name: "e" },
    ];
    for (const { dx, dz, name } of checks) {
      const nk = ck(gx + dx, gz + dz);
      const nt = tiles[nk];
      if (nt && isLandTile(nt.tile)) landDirs.push(name);
    }

    // Only place slope for single-side edges
    if (landDirs.length !== 1) continue;

    const dir = landDirs[0];
    const rot = dir === "n" ? 0 : dir === "w" ? HP : dir === "s" ? PI : HP * 3;
    tiles[key] = { tile: "Water_Slope", rot, y: 0 };
    waterSlopeCount++;
  }
}
console.log(`Phase 5: ${waterSlopeCount} Water_Slope placed`);

// ═══════════════════════════════════════════════════════════
// PHASE 6: Output
// ═══════════════════════════════════════════════════════════
const output = { version: 1, tileSize: TILE_S, tiles };
fs.writeFileSync("docs/tilemap.json", JSON.stringify(output, null, 2));

const counts = {};
for (const v of Object.values(tiles)) counts[v.tile] = (counts[v.tile] || 0) + 1;
console.log("\nFinal tile counts:", counts);
console.log("Total tiles:", Object.keys(tiles).length);
console.log("Wrote docs/tilemap.json");

// ═══════════════════════════════════════════════════════════
// PHASE 7: Self-validation
// ═══════════════════════════════════════════════════════════
let gaps = 0;
for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
  for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
    const key = ck(gx, gz);
    if (!tiles[key] && !claimed.has(key)) gaps++;
  }
}
console.log(`\nValidation: ${gaps} gap cells remaining (should be 0)`);
if (gaps > 0) console.warn("WARNING: There are still gap cells!");

// Check Y values
let badY = 0;
for (const [key, val] of Object.entries(tiles)) {
  if (val.tile === "Grass_Flat" && val.y !== 2.0) badY++;
  if (val.tile === "Path_Center" && val.y !== 2.0) badY++;
  if (val.tile === "Sand_Flat" && val.y !== 0) badY++;
  if (val.tile === "Water_Flat" && val.y !== 0) badY++;
  if (val.tile === "Water_Slope" && val.y !== 0) badY++;
  if (val.tile.startsWith("Hill_") && val.y !== 0) badY++;
}
if (badY > 0) console.warn(`WARNING: ${badY} tiles with unexpected Y values`);
else console.log("Y values: all correct");

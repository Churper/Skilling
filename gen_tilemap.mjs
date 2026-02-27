// gen_tilemap.mjs v2 — Learns from user's tile connections
// Uses flood-fill from existing tiles (not world-space functions) for river shape
// Follows the user's exact rotation/placement conventions
import fs from "fs";

const TILE_S = 2;
const PI = Math.PI;
const HP = PI / 2;

// ── Load user's tilemap as BASE ──
const data = JSON.parse(fs.readFileSync("user_tilemap5.json", "utf8"));
const tiles = data.tiles;
console.log("Loaded user tilemap:", Object.keys(tiles).length, "tiles");

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
function smoothstep(x, mn, mx) {
  const t = Math.max(0, Math.min(1, (x - mn) / (mx - mn)));
  return t * t * (3 - 2 * t);
}
function terrainH(x, z) {
  let h = 0.40;
  if (isBeach(x, z)) h -= smoothstep(x, 30, 48) * 1.0;
  const rq = riverQuery(x, z);
  const bankHi = rq.width + TILE_S;
  if (rq.dist < bankHi) {
    const center = 1 - smoothstep(rq.dist, 0, rq.width);
    const bank = 1 - smoothstep(rq.dist, rq.width, bankHi);
    const bed = -0.72 - 0.48 * center;
    h = h + (bed - h) * Math.max(center, bank * 0.45);
  }
  return h;
}
function isOcean(wx, wz) { return wx > 38 && terrainH(wx, wz) < 0.08; }
function isWater(wx, wz) { return isInRiver(wx, wz) || isOcean(wx, wz); }
const PATH_CLS = [
  [[0,-28],[0,-16],[0,-4],[0,8],[0,12]],
  [[10,-30],[20,-26],[30,-22],[40,-18],[46,-16]],
  [[0,14],[0,22],[0,34],[0,40]],
];
function distToPath(x, z) {
  let md = 1e9;
  for (const pts of PATH_CLS)
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax,az] = pts[i], [bx,bz] = pts[i+1];
      const dx = bx-ax, dz = bz-az, l2 = dx*dx+dz*dz;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x-ax)*dx+(z-az)*dz)/l2)) : 0;
      md = Math.min(md, Math.hypot(x-(ax+t*dx), z-(az+t*dz)));
    }
  return md;
}
function isOnPath(x, z) { return distToPath(x, z) < 3.0; }

const GX_MIN = -19, GX_MAX = 24;
const GZ_MIN = -18, GZ_MAX = 19;

function ck(gx, gz) { return `${gx},${gz}`; }

// ── Flat tile check ──
const FLAT_SET = new Set(["Grass_Flat", "Water_Flat", "Sand_Flat", "Path_Center"]);
function isFlat(tile) { return FLAT_SET.has(tile); }
function isSlope(tile) { return tile && !isFlat(tile); }

// ── Extension cells for multi-cell tiles ──
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

// ── Build claimed set from ALL existing tiles ──
const claimed = new Set();
for (const [key, val] of Object.entries(tiles)) {
  const [gx, gz] = key.split(",").map(Number);
  claimed.add(key);
  if (!isFlat(val.tile)) {
    const exts = getExtensions(gx, gz, val.tile, val.rot);
    exts.forEach(([ex, ez]) => claimed.add(ck(ex, ez)));
  }
}
console.log("Cells claimed by existing tiles:", claimed.size);

// ═══════════════════════════════════════════════════════════
// PHASE 1: Build elevation map from existing tiles + flood-fill
// ═══════════════════════════════════════════════════════════

const elev = new Map(); // key → "low" | "elevated" | "boundary"

// Step 1a: Classify from existing tiles
for (const [key, val] of Object.entries(tiles)) {
  if (isFlat(val.tile)) {
    elev.set(key, val.y >= 1.5 ? "elevated" : "low");
  } else {
    elev.set(key, "boundary"); // slope tile = boundary
  }
}

// Step 1b: Extension cells of slope tiles → LOW (they're on the downhill side)
for (const [key, val] of Object.entries(tiles)) {
  if (isFlat(val.tile)) continue;
  const [gx, gz] = key.split(",").map(Number);
  const exts = getExtensions(gx, gz, val.tile, val.rot);
  for (const [ex, ez] of exts) {
    const ek = ck(ex, ez);
    if (!elev.has(ek) || elev.get(ek) !== "boundary") {
      elev.set(ek, "low");
    }
  }
}

// Step 1c: HIGH side of slope tiles → ELEVATED
function getHighNeighbors(gx, gz, tile, rotRad) {
  const r = Math.round(rotRad * 180 / PI);
  if (tile === "Hill_Side" || tile.includes("Transition")) {
    return r === 0 ? [[gx,gz+1]] : r === 90 ? [[gx+1,gz]] :
           r === 180 ? [[gx,gz-1]] : [[gx-1,gz]];
  }
  // HCO: high side is the two sides NOT facing water
  if (tile === "Hill_Corner_Outer_2x2") {
    // rot=0 (SE): high to N and W from anchor
    return r === 0   ? [[gx-1,gz],[gx,gz+1]] :
           r === 90  ? [[gx+1,gz],[gx,gz+1]] :
           r === 180 ? [[gx+1,gz],[gx,gz-1]] :
                        [[gx-1,gz],[gx,gz-1]];
  }
  return [];
}

for (const [key, val] of Object.entries(tiles)) {
  if (isFlat(val.tile)) continue;
  const [gx, gz] = key.split(",").map(Number);
  const highCells = getHighNeighbors(gx, gz, val.tile, val.rot);
  for (const [hx, hz] of highCells) {
    const hk = ck(hx, hz);
    if (!elev.has(hk)) {
      elev.set(hk, "elevated");
    }
  }
}

// Step 1d: Flood-fill LOW from all known LOW cells
// Stop at cells that have an ELEVATED neighbor (those are potential bank cells)
const lowQueue = [];
for (const [key, e] of elev) {
  if (e === "low") lowQueue.push(key);
}

let lowFilled = 0;
while (lowQueue.length > 0) {
  const key = lowQueue.shift();
  const [gx, gz] = key.split(",").map(Number);

  for (const [dx, dz] of [[0,1],[0,-1],[1,0],[-1,0]]) {
    const nx = gx+dx, nz = gz+dz;
    const nk = ck(nx, nz);
    if (elev.has(nk)) continue; // already classified
    if (nx < GX_MIN-2 || nx > GX_MAX+2 || nz < GZ_MIN-2 || nz > GZ_MAX+2) continue;

    // Don't flood into cells adjacent to an ELEVATED cell (those are bank edges)
    let touchesElevated = false;
    for (const [ddx, ddz] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const adjE = elev.get(ck(nx+ddx, nz+ddz));
      if (adjE === "elevated") { touchesElevated = true; break; }
    }
    if (touchesElevated) continue;

    elev.set(nk, "low");
    lowQueue.push(nk);
    lowFilled++;
  }
}
console.log("Flood-filled LOW:", lowFilled);

// Step 1e: Remaining cells → world-space fallback
for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
  for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
    const key = ck(gx, gz);
    if (elev.has(key)) continue;
    const wx = gx * TILE_S, wz = gz * TILE_S;
    if (isWater(wx, wz) || isBeach(wx, wz)) {
      elev.set(key, "low");
    } else {
      elev.set(key, "elevated");
    }
  }
}

// Helper: is this cell LOW? (water/sand level)
function cellIsLow(gx, gz) {
  const e = elev.get(ck(gx, gz));
  return e === "low";
}
function cellIsElev(gx, gz) {
  const e = elev.get(ck(gx, gz));
  return e === "elevated";
}

// Count low neighbors in cardinal directions
function getLowCardinals(gx, gz) {
  const dirs = [];
  if (cellIsLow(gx, gz+1)) dirs.push("n");
  if (cellIsLow(gx+1, gz)) dirs.push("e");
  if (cellIsLow(gx, gz-1)) dirs.push("s");
  if (cellIsLow(gx-1, gz)) dirs.push("w");
  return dirs;
}
function getLowDiags(gx, gz) {
  const diags = [];
  if (cellIsLow(gx+1, gz+1)) diags.push("ne");
  if (cellIsLow(gx+1, gz-1)) diags.push("se");
  if (cellIsLow(gx-1, gz-1)) diags.push("sw");
  if (cellIsLow(gx-1, gz+1)) diags.push("nw");
  return diags;
}

// Check if cell is free for a new slope tile
// (empty or has an auto-generated flat tile that can be replaced)
function canPlaceSlope(gx, gz) {
  const key = ck(gx, gz);
  if (claimed.has(key)) return false; // claimed by extension
  const t = tiles[key];
  if (!t) return true;         // empty cell
  if (isFlat(t.tile)) return true;  // flat tile → can overwrite
  return false;                // slope tile → protected
}

// Place a tile, updating claimed set
function place(gx, gz, tile, rot, y) {
  const key = ck(gx, gz);
  tiles[key] = { tile, rot, y };
  claimed.add(key);
  const exts = getExtensions(gx, gz, tile, rot);
  exts.forEach(([ex, ez]) => claimed.add(ck(ex, ez)));
}

// ═══════════════════════════════════════════════════════════
// PHASE 2: HCO — Convex corners (2 adjacent low cardinals)
// Following user's pattern: place at elevated cell adjacent to L-shaped low area
// ═══════════════════════════════════════════════════════════

const HCO_CFG = {
  // dir: [rot, cells (anchor + 3 extensions)]
  se: { rot: 0,      cells: [[0,0],[1,0],[0,-1],[1,-1]] },
  sw: { rot: HP,     cells: [[0,0],[-1,0],[0,-1],[-1,-1]] },
  nw: { rot: PI,     cells: [[0,0],[-1,0],[0,1],[-1,1]] },
  ne: { rot: HP * 3, cells: [[0,0],[1,0],[0,1],[1,1]] },
};

let addedHCO = 0;
for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
  for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
    if (!cellIsElev(gx, gz)) continue;
    if (!canPlaceSlope(gx, gz)) continue;

    const low = getLowCardinals(gx, gz);
    if (low.length < 2) continue;

    // Check adjacent pairs (L-shape)
    const pairs = [];
    if (low.includes("s") && low.includes("e")) pairs.push("se");
    if (low.includes("s") && low.includes("w")) pairs.push("sw");
    if (low.includes("n") && low.includes("w")) pairs.push("nw");
    if (low.includes("n") && low.includes("e")) pairs.push("ne");

    for (const dir of pairs) {
      const cfg = HCO_CFG[dir];
      const cells = cfg.cells.map(([dx,dz]) => [gx+dx, gz+dz]);
      // All 4 cells must be placeable (not claimed by other tiles)
      if (cells.some(([cx,cz]) => claimed.has(ck(cx,cz)) && !(tiles[ck(cx,cz)] && isFlat(tiles[ck(cx,cz)].tile)))) {
        // Check more carefully: claimed by extension vs claimed by flat tile
        const allFree = cells.every(([cx,cz]) => {
          const k = ck(cx,cz);
          if (!claimed.has(k)) return true;
          // Claimed but has a replaceable flat tile?
          const t = tiles[k];
          return t && isFlat(t.tile);
        });
        if (!allFree) continue;
      }

      // Remove any flat tiles in the cells
      for (const [cx, cz] of cells) {
        const k = ck(cx, cz);
        if (tiles[k] && isFlat(tiles[k].tile)) delete tiles[k];
      }

      place(gx, gz, "Hill_Corner_Outer_2x2", cfg.rot, 0);
      addedHCO++;
      break;
    }
  }
}
console.log("Added HCO:", addedHCO);

// ═══════════════════════════════════════════════════════════
// PHASE 3: Hill_Side — Straight banks (1 low cardinal)
// Anchor at elevated cell, extension toward low side
// ═══════════════════════════════════════════════════════════

const HS_CFG = {
  s: { rot: 0,      ext: [0,-1] },
  w: { rot: HP,     ext: [-1,0] },
  n: { rot: PI,     ext: [0,1] },
  e: { rot: HP * 3, ext: [1,0] },
};

let addedHS = 0;
for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
  for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
    if (!cellIsElev(gx, gz)) continue;
    if (!canPlaceSlope(gx, gz)) continue;

    const low = getLowCardinals(gx, gz);
    if (low.length === 0) continue;

    for (const dir of low) {
      const cfg = HS_CFG[dir];
      const ex = gx + cfg.ext[0], ez = gz + cfg.ext[1];
      const extKey = ck(ex, ez);

      // Both anchor and extension must be available
      if (claimed.has(ck(gx, gz)) && !(tiles[ck(gx,gz)] && isFlat(tiles[ck(gx,gz)].tile))) continue;
      if (claimed.has(extKey) && !(tiles[extKey] && isFlat(tiles[extKey].tile))) continue;

      // Remove flat tiles if present
      if (tiles[ck(gx,gz)] && isFlat(tiles[ck(gx,gz)].tile)) delete tiles[ck(gx,gz)];
      if (tiles[extKey] && isFlat(tiles[extKey].tile)) delete tiles[extKey];

      place(gx, gz, "Hill_Side", cfg.rot, 0);
      addedHS++;
      break;
    }
  }
}
console.log("Added HS:", addedHS);

// ═══════════════════════════════════════════════════════════
// PHASE 4: HCI — Concave corners (0 low cardinals, 1+ low diagonal)
// ═══════════════════════════════════════════════════════════

const HCI_CFG = {
  nw: { rot: 0,      cells: [[0,0],[-1,0],[0,1],[-1,1]] },
  sw: { rot: HP,     cells: [[0,0],[-1,0],[0,-1],[-1,-1]] },
  se: { rot: PI,     cells: [[0,0],[1,0],[0,-1],[1,-1]] },
  ne: { rot: HP * 3, cells: [[0,0],[1,0],[0,1],[1,1]] },
};

let addedHCI = 0;
for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
  for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
    if (!cellIsElev(gx, gz)) continue;
    if (!canPlaceSlope(gx, gz)) continue;

    const low = getLowCardinals(gx, gz);
    if (low.length > 0) continue; // has cardinal low → not concave

    const diags = getLowDiags(gx, gz);
    if (diags.length === 0) continue;

    for (const dir of diags) {
      const cfg = HCI_CFG[dir];
      if (!cfg) continue;
      const cells = cfg.cells.map(([dx,dz]) => [gx+dx, gz+dz]);

      const allFree = cells.every(([cx,cz]) => {
        const k = ck(cx, cz);
        if (!claimed.has(k)) return true;
        const t = tiles[k];
        return t && isFlat(t.tile);
      });
      if (!allFree) continue;

      // Remove flat tiles
      for (const [cx, cz] of cells) {
        const k = ck(cx, cz);
        if (tiles[k] && isFlat(tiles[k].tile)) delete tiles[k];
      }

      place(gx, gz, "Hill_Corner_Inner_2x2", cfg.rot, 0);
      addedHCI++;
      break;
    }
  }
}
console.log("Added HCI:", addedHCI);

// ═══════════════════════════════════════════════════════════
// PHASE 5: Fill remaining empty cells with flat tiles
// Uses zone detection for correct tile type
// ═══════════════════════════════════════════════════════════

let filled = 0;
for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
  for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
    const key = ck(gx, gz);
    if (tiles[key]) continue;         // already has tile
    if (claimed.has(key)) continue;    // extension cell → leave empty

    const isLow = cellIsLow(gx, gz);
    const wx = gx * TILE_S, wz = gz * TILE_S;

    if (isLow) {
      if (isBeach(wx, wz)) {
        tiles[key] = { tile: "Sand_Flat", rot: 0, y: 0 };
      } else {
        tiles[key] = { tile: "Water_Flat", rot: 0, y: 0 };
      }
    } else {
      if (isOnPath(wx, wz)) {
        tiles[key] = { tile: "Path_Center", rot: 0, y: 2.0 };
      } else {
        tiles[key] = { tile: "Grass_Flat", rot: 0, y: 2.0 };
      }
    }
    filled++;
  }
}
console.log("Filled flat:", filled);

// ═══════════════════════════════════════════════════════════
// Summary & output
// ═══════════════════════════════════════════════════════════
const counts = {};
for (const v of Object.values(tiles)) counts[v.tile] = (counts[v.tile] || 0) + 1;
console.log("\nFinal counts:", counts);
console.log("Total tiles:", Object.keys(tiles).length);

fs.writeFileSync("docs/tilemap.json", JSON.stringify({ version: 1, tileSize: TILE_S, tiles }, null, 2));
console.log("Wrote docs/tilemap.json");

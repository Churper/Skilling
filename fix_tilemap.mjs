// Take the user's tilemap and fill gaps:
// 1. Empty cells in the river channel → Water_Flat at y=0
// 2. Empty cells in grass area → Grass_Flat at y=2.0
// 3. Add Hill_Corner_Inner_2x2 at concave river bends
import fs from "fs";

const TILE_S = 2;
const PI = Math.PI;
const HP = PI / 2;

// Load user's tilemap
const data = JSON.parse(fs.readFileSync("user_tilemap.json", "utf8"));
const tiles = data.tiles;

// ── River centreline ──
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
  const d = Math.hypot(x - 38, z + 6);
  if (d > 18) return false;
  if (x > 34 && z < 4) return true;
  if (x > 28 && z < 0 && z > -16) return true;
  return d < 14;
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

// ── Analyze existing tiles to understand which cells are Hill_Side extensions ──
// Hill_Side extensions: the cell the slope extends into
function getHillSideExtCell(gx, gz, rotDeg) {
  switch (rotDeg) {
    case 0:   return { gx, gz: gz-1 };   // extends south
    case 90:  return { gx: gx-1, gz };    // extends west
    case 180: return { gx, gz: gz+1 };    // extends north
    case 270: return { gx: gx+1, gz };    // extends east
  }
  return null;
}

// Hill_Corner_Outer_2x2 occupied cells
function getCornerOuterCells(gx, gz, rotDeg) {
  switch (rotDeg) {
    case 0:   return [{gx,gz},{gx:gx+1,gz},{gx,gz:gz-1},{gx:gx+1,gz:gz-1}];
    case 90:  return [{gx,gz},{gx:gx-1,gz},{gx,gz:gz-1},{gx:gx-1,gz:gz-1}];
    case 180: return [{gx,gz},{gx:gx-1,gz},{gx,gz:gz+1},{gx:gx-1,gz:gz+1}];
    case 270: return [{gx,gz},{gx:gx+1,gz},{gx,gz:gz+1},{gx:gx+1,gz:gz+1}];
  }
  return [{gx,gz}];
}

function getCornerInnerCells(gx, gz, rotDeg) {
  // Hill_Corner_Inner_2x2: min(-1.5, 0, -0.5) max(0.5, 1.2, 1.5) at rot=0
  // Cells at rot=0: (gx,gz), (gx-1,gz), (gx,gz+1), (gx-1,gz+1)
  switch (rotDeg) {
    case 0:   return [{gx,gz},{gx:gx-1,gz},{gx,gz:gz+1},{gx:gx-1,gz:gz+1}];
    case 90:  return [{gx,gz},{gx,gz:gz-1},{gx:gx-1,gz},{gx:gx-1,gz:gz-1}];
    case 180: return [{gx,gz},{gx:gx+1,gz},{gx,gz:gz-1},{gx:gx+1,gz:gz-1}];
    case 270: return [{gx,gz},{gx,gz:gz+1},{gx:gx+1,gz},{gx:gx+1,gz:gz+1}];
  }
  return [{gx,gz}];
}

// Build set of cells claimed by multi-cell tiles
const claimedByMulti = new Set();
for (const [key, val] of Object.entries(tiles)) {
  const [gx, gz] = key.split(",").map(Number);
  const rotD = Math.round(val.rot * 180 / Math.PI);

  if (val.tile === "Hill_Side") {
    const ext = getHillSideExtCell(gx, gz, rotD);
    if (ext) claimedByMulti.add(`${ext.gx},${ext.gz}`);
    claimedByMulti.add(key);
  }
  if (val.tile === "Hill_Corner_Outer_2x2") {
    const cells = getCornerOuterCells(gx, gz, rotD);
    cells.forEach(c => claimedByMulti.add(`${c.gx},${c.gz}`));
  }
  if (val.tile === "Hill_Corner_Inner_2x2") {
    const cells = getCornerInnerCells(gx, gz, rotD);
    cells.forEach(c => claimedByMulti.add(`${c.gx},${c.gz}`));
  }
}

console.log("Cells claimed by multi-cell tiles:", claimedByMulti.size);

// ── Fill empty cells ──
let filled = 0;
for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
  for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
    const key = `${gx},${gz}`;
    if (tiles[key]) continue;            // already has a tile
    if (claimedByMulti.has(key)) continue; // covered by a multi-cell tile

    const wx = gx * TILE_S, wz = gz * TILE_S;

    // Determine what should go here
    if (isWater(wx, wz)) {
      tiles[key] = { tile: "Water_Flat", rot: 0, y: 0 };
      filled++;
    } else if (isBeach(wx, wz)) {
      tiles[key] = { tile: "Sand_Flat", rot: 0, y: 0 };
      filled++;
    } else if (isOnPath(wx, wz)) {
      tiles[key] = { tile: "Path_Center", rot: 0, y: 2.0 };
      filled++;
    } else {
      tiles[key] = { tile: "Grass_Flat", rot: 0, y: 2.0 };
      filled++;
    }
  }
}

console.log("Filled", filled, "empty cells");

// Also check for cells near the river that are empty but claimed by multi-cell tiles
// These might need Water_Flat underneath to fill the visual gap
// Let's add Water_Flat at y=-0.2 under Hill_Side extension cells that are in the river zone
let underFilled = 0;
for (const claimedKey of claimedByMulti) {
  if (tiles[claimedKey]) continue; // Has an explicit tile already (it's the anchor)

  const [gx, gz] = claimedKey.split(",").map(Number);
  const wx = gx * TILE_S, wz = gz * TILE_S;

  // If this extension cell is near water, add a Water_Flat underneath
  const rq = riverQuery(wx, wz);
  if (rq.dist < rq.width + TILE_S * 2 || isWater(wx, wz)) {
    tiles[claimedKey] = { tile: "Water_Flat", rot: 0, y: -0.2 };
    underFilled++;
  }
}
console.log("Added", underFilled, "Water_Flat under Hill_Side extensions");

// Count
const counts = {};
for (const v of Object.values(tiles)) counts[v.tile] = (counts[v.tile] || 0) + 1;
console.log("Final counts:", counts);
console.log("Total:", Object.keys(tiles).length);

// Write
const output = { version: 1, tileSize: TILE_S, tiles };
fs.writeFileSync("docs/tilemap.json", JSON.stringify(output, null, 2));
console.log("Wrote docs/tilemap.json");

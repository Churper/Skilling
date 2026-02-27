// Deep analysis of user's tile connections in tilemap5
import fs from "fs";

const data = JSON.parse(fs.readFileSync("user_tilemap5.json", "utf8"));
const tiles = data.tiles;
const PI = Math.PI;

// Get all tiles as structured data
const allTiles = [];
for (const [key, val] of Object.entries(tiles)) {
  const [gx, gz] = key.split(",").map(Number);
  const rotD = Math.round(val.rot * 180 / PI);
  allTiles.push({ gx, gz, tile: val.tile, rot: rotD, y: val.y, key });
}

// Build lookup
function get(gx, gz) {
  const t = tiles[`${gx},${gz}`];
  if (!t) return null;
  return { ...t, rotD: Math.round(t.rot * 180 / PI) };
}

// Categorize tiles
const categories = {};
for (const t of allTiles) {
  const cat = t.tile;
  if (!categories[cat]) categories[cat] = [];
  categories[cat].push(t);
}

console.log("=== TILE COUNTS ===");
for (const [cat, arr] of Object.entries(categories).sort((a,b) => b[1].length - a[1].length)) {
  console.log(`  ${cat}: ${arr.length}`);
}

// Focus on non-flat tiles (the interesting connections)
const slopeTiles = allTiles.filter(t =>
  !["Grass_Flat", "Water_Flat", "Sand_Flat", "Path_Center"].includes(t.tile)
);

console.log(`\n=== ALL ${slopeTiles.length} SLOPE/EDGE TILES ===`);
slopeTiles.sort((a, b) => a.gz !== b.gz ? b.gz - a.gz : a.gx - b.gx);
for (const t of slopeTiles) {
  // Check what's in each cardinal direction
  const n = get(t.gx, t.gz + 1);
  const s = get(t.gx, t.gz - 1);
  const e = get(t.gx + 1, t.gz);
  const w = get(t.gx - 1, t.gz);

  const nStr = n ? `${n.tile.substring(0,6)}_${n.rotD}` : "EMPTY";
  const sStr = s ? `${s.tile.substring(0,6)}_${s.rotD}` : "EMPTY";
  const eStr = e ? `${e.tile.substring(0,6)}_${e.rotD}` : "EMPTY";
  const wStr = w ? `${w.tile.substring(0,6)}_${w.rotD}` : "EMPTY";

  console.log(`  (${t.gx},${t.gz}) ${t.tile} rot=${t.rot} y=${t.y}`);
  console.log(`    N=${nStr}  S=${sStr}  E=${eStr}  W=${wStr}`);
}

// Analyze Hill_Side connection patterns
console.log("\n\n=== HILL_SIDE NEIGHBOR ANALYSIS ===");
const hsTiles = slopeTiles.filter(t => t.tile === "Hill_Side");
for (const t of hsTiles) {
  const extCell = t.rot === 0 ? [t.gx, t.gz-1] :
                  t.rot === 90 ? [t.gx-1, t.gz] :
                  t.rot === 180 ? [t.gx, t.gz+1] :
                  [t.gx+1, t.gz]; // 270

  const extTile = get(extCell[0], extCell[1]);
  const highSide = t.rot === 0 ? get(t.gx, t.gz+1) :    // high = north
                   t.rot === 90 ? get(t.gx+1, t.gz) :    // high = east
                   t.rot === 180 ? get(t.gx, t.gz-1) :   // high = south
                   get(t.gx-1, t.gz);                      // high = west

  // Check what's along the sides (parallel to slope)
  let leftCell, rightCell;
  if (t.rot === 0 || t.rot === 180) {
    leftCell = get(t.gx-1, t.gz);
    rightCell = get(t.gx+1, t.gz);
  } else {
    leftCell = get(t.gx, t.gz+1);
    rightCell = get(t.gx, t.gz-1);
  }

  const highStr = highSide ? `${highSide.tile.substring(0,10)}_${highSide.rotD}` : "EMPTY";
  const extStr = extTile ? `${extTile.tile.substring(0,10)}_${extTile.rotD}` : "EMPTY";
  const leftStr = leftCell ? `${leftCell.tile.substring(0,10)}_${leftCell.rotD}` : "EMPTY";
  const rightStr = rightCell ? `${rightCell.tile.substring(0,10)}_${rightCell.rotD}` : "EMPTY";

  console.log(`  HS(${t.gx},${t.gz}) rot=${t.rot}  HIGH=${highStr}  EXT(${extCell})=${extStr}  L=${leftStr}  R=${rightStr}`);
}

// Analyze HCO connection patterns
console.log("\n\n=== HCO NEIGHBOR ANALYSIS ===");
const hcoTiles = slopeTiles.filter(t => t.tile === "Hill_Corner_Outer_2x2");
for (const t of hcoTiles) {
  // What tiles surround the HCO?
  const neighbors = [];
  for (let dx = -1; dx <= 2; dx++) {
    for (let dz = -1; dz <= 2; dz++) {
      if (dx === 0 && dz === 0) continue;
      const n = get(t.gx + dx, t.gz + dz);
      if (n && !["Grass_Flat", "Water_Flat", "Sand_Flat", "Path_Center"].includes(n.tile)) {
        neighbors.push({ dx, dz, tile: n.tile, rot: n.rotD });
      }
    }
  }
  console.log(`  HCO(${t.gx},${t.gz}) rot=${t.rot}`);
  neighbors.forEach(n => {
    console.log(`    (${t.gx+n.dx},${t.gz+n.dz}) [d=${n.dx},${n.dz}] ${n.tile} rot=${n.rot}`);
  });
}

// Analyze HCI connection patterns
console.log("\n\n=== HCI NEIGHBOR ANALYSIS ===");
const hciTiles = slopeTiles.filter(t => t.tile === "Hill_Corner_Inner_2x2");
for (const t of hciTiles) {
  const neighbors = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (dx === 0 && dz === 0) continue;
      const n = get(t.gx + dx, t.gz + dz);
      if (n && !["Grass_Flat", "Water_Flat", "Sand_Flat", "Path_Center"].includes(n.tile)) {
        neighbors.push({ dx, dz, tile: n.tile, rot: n.rotD });
      }
    }
  }
  console.log(`  HCI(${t.gx},${t.gz}) rot=${t.rot}`);
  neighbors.forEach(n => {
    console.log(`    (${t.gx+n.dx},${t.gz+n.dz}) [d=${n.dx},${n.dz}] ${n.tile} rot=${n.rot}`);
  });
}

// Analyze transition tiles
console.log("\n\n=== TRANSITION TILE ANALYSIS ===");
const transTiles = slopeTiles.filter(t => t.tile.includes("Transition"));
for (const t of transTiles) {
  const neighbors = [];
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if (dx === 0 && dz === 0) continue;
      const n = get(t.gx + dx, t.gz + dz);
      if (n && !["Grass_Flat", "Water_Flat", "Sand_Flat", "Path_Center"].includes(n.tile)) {
        neighbors.push({ dx, dz, tile: n.tile, rot: n.rotD });
      }
    }
  }
  console.log(`  ${t.tile}(${t.gx},${t.gz}) rot=${t.rot}`);
  neighbors.forEach(n => {
    console.log(`    (${t.gx+n.dx},${t.gz+n.dz}) [d=${n.dx},${n.dz}] ${n.tile} rot=${n.rot}`);
  });
}

// Show vertical sequences along west bank (x=-2) and east bank
console.log("\n\n=== WEST BANK VERTICAL SEQUENCE (x=-2) ===");
for (let gz = 19; gz >= -18; gz--) {
  const t = get(-2, gz);
  if (t && t.tile !== "Grass_Flat") {
    console.log(`  z=${gz}: ${t.tile} rot=${t.rotD}`);
  }
}

console.log("\n\n=== EAST BANK SEQUENCE ===");
// The east bank shifts x position, trace it
for (let gz = 19; gz >= -18; gz--) {
  for (let gx = 0; gx <= 20; gx++) {
    const t = get(gx, gz);
    if (t && !["Grass_Flat", "Water_Flat", "Sand_Flat", "Path_Center"].includes(t.tile)) {
      console.log(`  z=${gz}, x=${gx}: ${t.tile} rot=${t.rotD}`);
    }
  }
}

// Full map visualization - wider view
console.log("\n\n=== FULL MAP (x=-8 to x=20, z=-12 to z=18) ===");
function abbr(tile, rotD) {
  switch (tile) {
    case "Grass_Flat": return " GF ";
    case "Water_Flat": return " WF ";
    case "Sand_Flat": return " SF ";
    case "Path_Center": return " PC ";
    case "Hill_Side": return `S${rotD}`.padStart(4);
    case "Hill_Corner_Outer_2x2": return `O${rotD}`.padStart(4);
    case "Hill_Corner_Inner_2x2": return `I${rotD}`.padStart(4);
    case "Hill_Side_Transition_To_Gentle": return `T${rotD}`.padStart(4);
    case "Hill_Side_Transition_From_Gentle": return `F${rotD}`.padStart(4);
    default: return tile.substring(0,3).padStart(4);
  }
}

let hdr = "z\\x ";
for (let gx = -8; gx <= 20; gx++) hdr += String(gx).padStart(4) + " ";
console.log(hdr);

for (let gz = 18; gz >= -12; gz--) {
  let row = String(gz).padStart(3) + " ";
  for (let gx = -8; gx <= 20; gx++) {
    const t = get(gx, gz);
    if (t) row += abbr(t.tile, t.rotD) + " ";
    else row += "   . ";
  }
  console.log(row);
}

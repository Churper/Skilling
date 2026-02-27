// Visualize the river area from the tilemap as ASCII art
import fs from "fs";

const data = JSON.parse(fs.readFileSync("docs/tilemap.json", "utf8"));
const tiles = data.tiles;

// Abbreviation map
function abbrev(tile, rotDeg) {
  const r = rotDeg;
  switch (tile) {
    case "Grass_Flat": return "GF";
    case "Water_Flat": return "WF";
    case "Sand_Flat": return "SF";
    case "Path_Center": return "PC";
    case "Hill_Side": return `HS${r}`;
    case "Hill_Corner_Outer_2x2": return `HO${r}`;
    case "Hill_Corner_Inner_2x2": return `HI${r}`;
    case "Hill_Side_Transition_To_Gentle": return `TG${r}`;
    case "Hill_Side_Transition_From_Gentle": return `FG${r}`;
    default: return tile.substring(0, 3) + r;
  }
}

// Focus on the river area: x from -5 to 15, z from -10 to 15
const X_MIN = -5, X_MAX = 15;
const Z_MIN = -10, Z_MAX = 15;

console.log("River area visualization (tilemap5):");
console.log("Legend: GF=Grass_Flat, WF=Water_Flat, HS=Hill_Side, HO=Hill_Corner_Outer, HI=Hill_Corner_Inner");
console.log("       TG=Transition_To_Gentle, FG=Transition_From_Gentle, PC=Path_Center, SF=Sand_Flat");
console.log("       Number suffix = rotation in degrees");
console.log("       . = empty cell (extension or missing)\n");

// Print header
let header = "z\\x  ";
for (let gx = X_MIN; gx <= X_MAX; gx++) {
  header += String(gx).padStart(5) + " ";
}
console.log(header);
console.log("-".repeat(header.length));

// Print rows (z from high to low so north is up)
for (let gz = Z_MAX; gz >= Z_MIN; gz--) {
  let row = String(gz).padStart(3) + "  ";
  for (let gx = X_MIN; gx <= X_MAX; gx++) {
    const key = `${gx},${gz}`;
    const t = tiles[key];
    if (t) {
      const rotD = Math.round(t.rot * 180 / Math.PI);
      row += abbrev(t.tile, rotD).padStart(5) + " ";
    } else {
      row += "    . ";
    }
  }
  console.log(row);
}

// Also print all non-flat tiles in the river area sorted by position
console.log("\n\n=== Non-flat tiles in river area ===");
const interesting = [];
for (const [key, val] of Object.entries(tiles)) {
  const [gx, gz] = key.split(",").map(Number);
  if (gx < X_MIN || gx > X_MAX || gz < Z_MIN || gz > Z_MAX) continue;
  if (val.tile === "Grass_Flat" || val.tile === "Water_Flat" || val.tile === "Sand_Flat" || val.tile === "Path_Center") continue;
  const rotD = Math.round(val.rot * 180 / Math.PI);
  interesting.push({ gx, gz, tile: val.tile, rot: rotD, y: val.y });
}
interesting.sort((a, b) => a.gz !== b.gz ? b.gz - a.gz : a.gx - b.gx);
interesting.forEach(t => {
  console.log(`  (${t.gx},${t.gz})  ${t.tile} rot=${t.rot} y=${t.y}`);
});

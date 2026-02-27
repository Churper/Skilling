import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const tilemapPath = process.argv[2] || path.join(ROOT, "docs", "tilemap.json");
const rulesPath = process.argv[3] || path.join(ROOT, "docs", "game", "tilesetRules.json");

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function toQuarterTurn(rot) {
  return ((Math.round((rot || 0) / (Math.PI / 2)) % 4) + 4) % 4;
}

function extCells(gx, gz, tile, rot, footprint) {
  const r = toQuarterTurn(rot);
  if (footprint === "hill_side") {
    if (r === 0) return [[gx, gz - 1]];
    if (r === 1) return [[gx - 1, gz]];
    if (r === 2) return [[gx, gz + 1]];
    return [[gx + 1, gz]];
  }
  if (footprint === "hill_corner_outer_2x2") {
    if (r === 0) return [[gx + 1, gz], [gx, gz - 1], [gx + 1, gz - 1]];
    if (r === 1) return [[gx - 1, gz], [gx, gz - 1], [gx - 1, gz - 1]];
    if (r === 2) return [[gx - 1, gz], [gx, gz + 1], [gx - 1, gz + 1]];
    return [[gx + 1, gz], [gx, gz + 1], [gx + 1, gz + 1]];
  }
  if (footprint === "hill_corner_inner_2x2") {
    if (r === 0) return [[gx - 1, gz], [gx, gz + 1], [gx - 1, gz + 1]];
    if (r === 1) return [[gx, gz - 1], [gx - 1, gz], [gx - 1, gz - 1]];
    if (r === 2) return [[gx + 1, gz], [gx, gz - 1], [gx + 1, gz - 1]];
    return [[gx, gz + 1], [gx + 1, gz], [gx + 1, gz + 1]];
  }
  return [];
}

function key(x, z) {
  return `${x},${z}`;
}

const tilemapJson = loadJson(tilemapPath);
const rulesJson = loadJson(rulesPath);

const tiles = tilemapJson.tiles || tilemapJson;
const underlays = tilemapJson.underlays || {};
const rules = rulesJson.tiles || {};

const card = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const warnings = [];
const errors = [];
const coverage = new Set();

function markCoverage(gx, gz) {
  coverage.add(key(gx, gz));
}

for (const [k, entry] of Object.entries(tiles)) {
  const [gx, gz] = k.split(",").map(Number);
  if (!entry || !entry.tile) {
    errors.push(`Invalid tile entry at ${k}`);
    continue;
  }
  const rule = rules[entry.tile];
  if (!rule) {
    errors.push(`Unknown tile "${entry.tile}" at ${k}`);
    continue;
  }
  markCoverage(gx, gz);
  for (const [ex, ez] of extCells(gx, gz, entry.tile, entry.rot || 0, rule.footprint)) {
    markCoverage(ex, ez);
  }
}

for (const [k, entry] of Object.entries(underlays)) {
  if (!entry || !entry.tile) continue;
  if (!rules[entry.tile]) warnings.push(`Unknown underlay tile "${entry.tile}" at ${k}`);
}

// Warn about flat land tiles touching water where slope/corner is usually expected.
for (const [k, entry] of Object.entries(tiles)) {
  if (!entry || !entry.tile) continue;
  const rule = rules[entry.tile];
  if (!rule) continue;
  if (!rule.isFlat || entry.tile === "Water_Flat") continue;
  const [gx, gz] = k.split(",").map(Number);
  let waterAdj = 0;
  for (const [dx, dz] of card) {
    if (tiles[key(gx + dx, gz + dz)]?.tile === "Water_Flat") waterAdj++;
  }
  if (waterAdj > 0) {
    warnings.push(`Flat shoreline tile at ${k}: ${entry.tile} (adjWater=${waterAdj})`);
  }
}

// Find holes next to water that no multi-cell footprint covers.
let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
for (const k of Object.keys(tiles)) {
  const [x, z] = k.split(",").map(Number);
  minX = Math.min(minX, x);
  maxX = Math.max(maxX, x);
  minZ = Math.min(minZ, z);
  maxZ = Math.max(maxZ, z);
}
if (Number.isFinite(minX)) {
  for (let x = minX - 1; x <= maxX + 1; x++) {
    for (let z = minZ - 1; z <= maxZ + 1; z++) {
      const k = key(x, z);
      if (coverage.has(k)) continue;
      let adjWater = false;
      for (const [dx, dz] of card) {
        if (tiles[key(x + dx, z + dz)]?.tile === "Water_Flat") {
          adjWater = true;
          break;
        }
      }
      if (adjWater) warnings.push(`Uncovered hole near water at ${k}`);
    }
  }
}

console.log(`Validated: ${Object.keys(tiles).length} tiles, ${Object.keys(underlays).length} underlays`);
if (errors.length) {
  console.log("\nErrors:");
  errors.forEach(e => console.log(`- ${e}`));
}
if (warnings.length) {
  console.log("\nWarnings:");
  warnings.slice(0, 120).forEach(w => console.log(`- ${w}`));
  if (warnings.length > 120) console.log(`- ... ${warnings.length - 120} more`);
}

if (!errors.length && !warnings.length) {
  console.log("\nNo issues found.");
}

process.exit(errors.length ? 1 : 0);

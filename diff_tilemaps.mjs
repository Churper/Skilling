import fs from "fs";

const old = JSON.parse(fs.readFileSync("user_tilemap2.json","utf8")).tiles;
const nw = JSON.parse(fs.readFileSync("user_tilemap5.json","utf8")).tiles;

const changed = [];
const added = [];
const removed = [];

for (const [key, val] of Object.entries(nw)) {
  if (!old[key]) { added.push({key, ...val}); continue; }
  const o = old[key];
  if (o.tile !== val.tile || Math.abs(o.rot - val.rot) > 0.01 || Math.abs((o.y||0) - (val.y||0)) > 0.01) {
    changed.push({key, from: o, to: val});
  }
}
for (const key of Object.keys(old)) {
  if (!nw[key]) removed.push({key, ...old[key]});
}

console.log("Added:", added.length, " Changed:", changed.length, " Removed:", removed.length);

if (added.length > 0) {
  console.log("\n=== ADDED ===");
  added.forEach(a => {
    const rotD = Math.round(a.rot * 180 / Math.PI);
    console.log(`  ${a.key}  ${a.tile} rot=${rotD} y=${a.y}`);
  });
}
if (changed.length > 0) {
  console.log("\n=== CHANGED ===");
  changed.forEach(c => {
    const fromR = Math.round(c.from.rot * 180 / Math.PI);
    const toR = Math.round(c.to.rot * 180 / Math.PI);
    console.log(`  ${c.key}  ${c.from.tile}_${fromR}_y${c.from.y||0} -> ${c.to.tile}_${toR}_y${c.to.y||0}`);
  });
}
if (removed.length > 0) {
  console.log("\n=== REMOVED ===");
  removed.forEach(r => {
    const rotD = Math.round(r.rot * 180 / Math.PI);
    console.log(`  ${r.key}  ${r.tile} rot=${rotD}`);
  });
}

if (added.length === 0 && changed.length === 0 && removed.length === 0) {
  console.log("\nNo differences found — same file as last export.");
  console.log("Tip: Make sure you click 'Export JSON' in the editor AFTER making changes.");
}

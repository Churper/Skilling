// Analyze tile GLB bounding boxes to understand geometry
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import fs from "fs";
import path from "path";

// Patch for node - GLTFLoader needs fetch/FileLoader to work
// Use the node loader approach
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const TILE_DIR = "docs/models/terrain/";

const TILES = [
  "Grass_Flat",
  "Hill_Side", "Hill_Side_On_Side",
  "Hill_Corner_Outer_2x2", "Hill_Corner_Inner_2x2",
  "Hill_Side_Transition_From_Gentle", "Hill_Side_Transition_To_Gentle",
  "Water_Flat", "Water_Slope",
  "Sand_Flat", "Sand_Side",
  "Sand_Corner_Outer_3x3", "Sand_Corner_Inner_3x3",
  "Sand_Side_Overlap_Side",
  "Path_Center", "Path_Side",
  "Path_Corner_Inner_1x1", "Path_Corner_Outer_1x1",
];

async function analyzeTile(name) {
  const filePath = path.resolve(TILE_DIR + name + ".glb");
  const buffer = fs.readFileSync(filePath);

  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    loader.parse(arrayBuffer, "", (gltf) => {
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = new THREE.Vector3();
      box.getSize(size);
      resolve({
        name,
        min: { x: +box.min.x.toFixed(3), y: +box.min.y.toFixed(3), z: +box.min.z.toFixed(3) },
        max: { x: +box.max.x.toFixed(3), y: +box.max.y.toFixed(3), z: +box.max.z.toFixed(3) },
        size: { x: +size.x.toFixed(3), y: +size.y.toFixed(3), z: +size.z.toFixed(3) },
      });
    }, (err) => {
      resolve({ name, error: String(err) });
    });
  });
}

const results = [];
for (const name of TILES) {
  const r = await analyzeTile(name);
  results.push(r);
  const s = r.size;
  const mn = r.min;
  const mx = r.max;
  if (r.error) {
    console.log(`${name}: ERROR ${r.error}`);
  } else {
    console.log(`${name}: size(${s.x}, ${s.y}, ${s.z})  min(${mn.x}, ${mn.y}, ${mn.z})  max(${mx.x}, ${mx.y}, ${mx.z})`);
  }
}

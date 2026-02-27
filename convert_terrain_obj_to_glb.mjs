import fs from "node:fs/promises";
import path from "node:path";
import { Blob } from "node:buffer";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

globalThis.Blob = globalThis.Blob || Blob;

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null;
      this.error = null;
      this.onload = null;
      this.onloadend = null;
      this.onerror = null;
    }

    async #finish(work) {
      try {
        this.result = await work();
        if (typeof this.onload === "function") this.onload({ target: this });
        if (typeof this.onloadend === "function") this.onloadend({ target: this });
      } catch (err) {
        this.error = err;
        if (typeof this.onerror === "function") this.onerror(err);
        if (typeof this.onloadend === "function") this.onloadend({ target: this });
      }
    }

    readAsArrayBuffer(blob) {
      this.#finish(() => blob.arrayBuffer());
    }

    readAsDataURL(blob) {
      this.#finish(async () => {
        const buf = Buffer.from(await blob.arrayBuffer());
        const mime = blob.type || "application/octet-stream";
        return `data:${mime};base64,${buf.toString("base64")}`;
      });
    }
  };
}

function parseArgs(argv) {
  const args = { pairs: [] };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--src") {
      args.srcDir = argv[++i];
    } else if (token === "--mtl") {
      args.mtlFile = argv[++i];
    } else if (token === "--out") {
      args.outDir = argv[++i];
    } else {
      args.pairs.push(token);
    }
  }
  if (!args.srcDir || !args.outDir || !args.pairs.length) {
    throw new Error(
      "Usage: node convert_terrain_obj_to_glb.mjs --src <obj-dir> --out <glb-dir> [--mtl <mtl-file>] Src.obj=Out.glb ..."
    );
  }
  return args;
}

function normalizeScene(root) {
  root.updateMatrixWorld(true);
  root.traverse(obj => {
    if (!obj.isMesh) return;
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    if (mat && "flatShading" in mat) mat.flatShading = true;
    obj.castShadow = false;
    obj.receiveShadow = false;
  });
  return root;
}

async function loadMaterials(mtlFile) {
  if (!mtlFile) return null;
  const text = await fs.readFile(mtlFile, "utf8");
  const loader = new MTLLoader();
  const materials = loader.parse(text, path.dirname(mtlFile) + path.sep);
  materials.preload();
  return materials;
}

async function exportBinary(scene) {
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(scene, {
    binary: true,
    onlyVisible: false,
    trs: false,
    embedImages: true,
  });
  if (glb instanceof ArrayBuffer) return Buffer.from(glb);
  if (ArrayBuffer.isView(glb)) return Buffer.from(glb.buffer, glb.byteOffset, glb.byteLength);
  throw new Error("GLTFExporter did not return binary glb data.");
}

async function convertOne(srcDir, outDir, materials, pair) {
  const [srcName, outName] = pair.split("=");
  if (!srcName || !outName) throw new Error(`Invalid mapping "${pair}". Expected Src.obj=Out.glb.`);
  const srcPath = path.resolve(srcDir, srcName);
  const outPath = path.resolve(outDir, outName);
  const objText = await fs.readFile(srcPath, "utf8");
  const loader = new OBJLoader();
  if (materials) loader.setMaterials(materials);
  const scene = normalizeScene(loader.parse(objText));
  const data = await exportBinary(scene);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, data);
  console.log(`Converted ${path.basename(srcPath)} -> ${outName}`);
}

async function main() {
  const args = parseArgs(process.argv);
  const materials = await loadMaterials(args.mtlFile);
  for (const pair of args.pairs) {
    await convertOne(args.srcDir, args.outDir, materials, pair);
  }
}

main().catch(err => {
  console.error(err?.stack || err);
  process.exit(1);
});

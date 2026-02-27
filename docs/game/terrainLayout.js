import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  TILE_S, WATER_Y, GRASS_Y,
  GX_MIN, GX_MAX, GZ_MIN, GZ_MAX,
  isInRiver, isBeach, isOnPath,
  terrainH, getWorldSurfaceHeight,
} from "./terrainHeight.js";

/* ══════════════════════════════════════════════════════════
   terrainLayout.js — load tile GLBs, generate layout, merge
   ══════════════════════════════════════════════════════════ */

const R_GND = 0, R_WATER = 2, R_DECOR = 3;

/* ── toon gradient (local) ── */
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

/* ── tile catalogue — which GLB files to load ── */
const TILE_DIR = "models/terrain/";
const TILES = {
  /* hilly pack — terrain + props used by builders */
  grass:       "Grass_Flat.glb",
  pathCenter:  "Path_Center.glb",
  waterFlat:   "Water_Flat.glb",
  bridgeEnd:   "Prop_Bridge_Log_End.glb",
  bridgeMid:   "Prop_Bridge_Log_Middle.glb",
  bridgePost:  "Prop_Bridge_Log_Post_Support.glb",
  fenceBoard1: "Prop_Fence_Boards_1.glb",
  fenceBoard2: "Prop_Fence_Boards_2.glb",
  fencePost1:  "Prop_Fence_Post_1.glb",

  /* cliff pack */
  cliffBaseStr: "Cliff_Base_Straight.glb",
  cliffBaseWF:  "Cliff_Base_Waterfall.glb",
  cliffMidStr:  "Cliff_Mid_Straight.glb",
  cliffMidWF:   "Cliff_Mid_Waterfall.glb",
  cliffTopStr:  "Cliff_Top_Straight.glb",
  cliffTopWF:   "Cliff_Top_Waterfall.glb",

  /* beach pack */
  sandFlat:   "Sand_Flat.glb",
  dockStr:    "Prop_Docks_Straight.glb",
  dockStrSup: "Prop_Docks_Straight_Supports.glb",
};

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
   Geometry helpers — collect & merge by material name
   ═══════════════════════════════════════════ */

/* Collect all meshes from a tile scene, applying a world-space matrix.
   Returns an array of { geometry, materialName, color }. */
function harvestTile(tileScene, worldMatrix) {
  const out = [];
  if (!tileScene) return out;
  tileScene.updateMatrixWorld(true);
  tileScene.traverse(o => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone();
    /* compose tile-local transform with world placement */
    const m = new THREE.Matrix4().multiplyMatrices(worldMatrix, o.matrixWorld);
    geo.applyMatrix4(m);
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const name = mat?.name || "default";
    const color = mat?.color ? "#" + mat.color.getHexString() : "#888888";
    out.push({ geometry: geo, materialName: name, color });
  });
  return out;
}

/* Merge harvested geometries by material name → one Mesh each. */
function mergeByMaterial(harvested) {
  const groups = {};
  for (const { geometry, materialName, color } of harvested) {
    const key = materialName + "_" + color;
    if (!groups[key])
      groups[key] = { geos: [], color };
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

/* ═══════════════════════════════════════════
   Layout generation — place tiles on the grid
   ═══════════════════════════════════════════ */

/* helper: build a 4×4 placement matrix */
function tileMat4(wx, wy, wz, rotY = 0) {
  const m = new THREE.Matrix4();
  m.compose(
    new THREE.Vector3(wx, wy, wz),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    new THREE.Vector3(TILE_S, TILE_S, TILE_S)
  );
  return m;
}

/* Return an array of { tile, y, rot } placements for this grid cell,
   or null to skip the cell entirely. Cliff tiers stack vertically
   at the same (gx,gz) instead of spreading across rows. */
function getCellPlacements(gx, gz) {
  const wx = gx * TILE_S, wz = gz * TILE_S;

  /* ── Skip cells beyond cliff walls (player never goes there) ── */
  if (gz > 21 || gx < -21 || gz < -20) return null;

  /* ── River → water tile ── */
  if (isInRiver(wx, wz))
    return [{ tile: "waterFlat", y: 0, rot: 0 }];

  /* ── North cliff wall — 3-tier stack at gz=20 ── */
  if (gz === 20) {
    const base = (gx === 0) ? "cliffBaseWF" : "cliffBaseStr";
    const mid  = (gx === 0) ? "cliffMidWF"  : "cliffMidStr";
    const top  = (gx === 0) ? "cliffTopWF"  : "cliffTopStr";
    return [
      { tile: base, y: 0,              rot: 0 },
      { tile: mid,  y: 1.0 * TILE_S,   rot: 0 },
      { tile: top,  y: 2.0 * TILE_S,   rot: 0 },
    ];
  }
  /* Cap above north cliff */
  if (gz === 21)
    return [{ tile: "grass", y: 3.0 * TILE_S - GRASS_Y, rot: 0 }];

  /* ── West cliff wall — 2-tier stack at gx=-20 ── */
  if (gx === -20)
    return [
      { tile: "cliffBaseStr", y: 0,            rot: -Math.PI / 2 },
      { tile: "cliffMidStr",  y: 1.0 * TILE_S, rot: -Math.PI / 2 },
    ];
  if (gx === -21)
    return [{ tile: "grass", y: 2.0 * TILE_S - GRASS_Y, rot: 0 }];

  /* ── South cliff wall — 2-tier stack at gz=-19 ── */
  if (gz === -19)
    return [
      { tile: "cliffBaseStr", y: 0,            rot: Math.PI },
      { tile: "cliffMidStr",  y: 1.0 * TILE_S, rot: Math.PI },
    ];
  if (gz === -20)
    return [{ tile: "grass", y: 2.0 * TILE_S - GRASS_Y, rot: 0 }];

  /* ── Beach → sand tiles at analytical height ── */
  if (isBeach(wx, wz)) {
    const h = terrainH(wx, wz);
    return [{ tile: "sandFlat", y: h - GRASS_Y, rot: 0 }];
  }

  /* ── Dirt paths → path tile flush with grass surface ── */
  if (isOnPath(wx, wz)) {
    const h = terrainH(wx, wz);
    return [{ tile: "pathCenter", y: h, rot: 0 }];
  }

  /* ── Default: grass tile at analytical height ── */
  const h = terrainH(wx, wz);
  return [{ tile: "grass", y: h - GRASS_Y, rot: 0 }];
}

/* ═══════════════════════════════════════════
   buildTerrain() — main entry: returns walkable ground Group
   ═══════════════════════════════════════════ */

export function buildTerrain(lib) {
  const harvested = [];

  for (let gx = GX_MIN; gx <= GX_MAX; gx++) {
    for (let gz = GZ_MIN; gz <= GZ_MAX; gz++) {
      const placements = getCellPlacements(gx, gz);
      if (!placements) continue;
      const wx = gx * TILE_S;
      const wz = gz * TILE_S;
      for (const { tile, y, rot } of placements) {
        const tmpl = lib[tile];
        if (!tmpl) continue;
        const mat4 = tileMat4(wx, y, wz, rot);
        harvested.push(...harvestTile(tmpl, mat4));
      }
    }
  }

  const meshes = mergeByMaterial(harvested);
  const group = new THREE.Group();
  group.name = "terrain";
  meshes.forEach(m => group.add(m));
  return group;
}

/* ═══════════════════════════════════════════
   buildWater() — river + ocean water surface
   ═══════════════════════════════════════════ */

export function buildWater(waterUniforms) {
  /* River ribbon: sample centre-line, build strip */
  const RP = [
    [0, 40, 2.5], [0, 34, 2.5], [0, 26, 2.8], [0, 18, 3.0],
    [0, 12, 3.2], [0, 6, 3.5], [2, 2, 3.5], [6, -2, 4.0],
    [12, -6, 4.5], [20, -10, 5.0], [28, -14, 5.5], [36, -14, 6.5], [48, -14, 8.0],
  ];
  const pos = [], idx = [];
  for (let i = 0; i < RP.length; i++) {
    const [cx, cz, hw] = RP[i];
    let dx = 0, dz = 1;
    if (i < RP.length - 1) { dx = RP[i + 1][0] - cx; dz = RP[i + 1][1] - cz; }
    else if (i > 0) { dx = cx - RP[i - 1][0]; dz = cz - RP[i - 1][1]; }
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len, pz = dx / len;
    pos.push(cx + px * hw, 0, cz + pz * hw);
    pos.push(cx - px * hw, 0, cz - pz * hw);
    if (i > 0) {
      const a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  /* ocean rectangle on east side */
  const oi = pos.length / 3;
  pos.push(34, 0, 6,  58, 0, 6,  58, 0, -30,  34, 0, -30);
  idx.push(oi, oi + 1, oi + 2,  oi, oi + 2, oi + 3);

  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: waterUniforms,
    vertexShader: `
      varying vec2 vW; uniform float uTime;
      void main(){
        vec3 p = position;
        p.y += sin(p.x*.18+uTime*.6)*.02 + cos(p.z*.15+uTime*.4)*.015;
        vW = p.xz;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader: `
      varying vec2 vW; uniform float uTime;
      void main(){
        float d = length(vW - vec2(24.0,-10.0));
        vec3 deep = vec3(.18,.48,.62), shallow = vec3(.56,.86,.94);
        float t = smoothstep(0.0,35.0,d);
        vec3 c = mix(deep,shallow,t);
        c += sin(vW.x*.6+vW.y*.4+uTime*1.2)*.016;
        c += cos(vW.x*.3-vW.y*.5+uTime*.7)*.012;
        float alpha = mix(0.42,0.28,t);
        gl_FragColor = vec4(c,alpha);
      }`,
  });

  const water = new THREE.Mesh(geo, mat);
  water.position.y = WATER_Y + 0.01;
  water.renderOrder = R_WATER;
  return water;
}

/* ═══════════════════════════════════════════
   buildBridge() — log bridge crossing the river
   ═══════════════════════════════════════════ */

export function buildBridge(lib) {
  const group = new THREE.Group();
  group.name = "bridge";

  /* Bridge spans the river at z ≈ 8, east-west across x = 0 */
  const bz = 8, bw = 4; // 4 planks wide
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

  /* support posts */
  if (lib.bridgePost) {
    for (const ox of [-bw * 0.5 * TILE_S, bw * 0.5 * TILE_S]) {
      const p = lib.bridgePost.clone();
      p.scale.setScalar(TILE_S);
      p.position.set(ox, WATER_Y - 0.5, bz);
      group.add(p);
    }
  }

  /* flat walkable deck for raycasting */
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
  const dx = 40, dz = -16;
  const deckY = WATER_Y + 0.3;

  /* dock planks extending east into water */
  for (let i = 0; i < 6; i++) {
    const tmpl = lib.dockStr;
    if (!tmpl) continue;
    const m = tmpl.clone();
    m.scale.setScalar(TILE_S);
    m.position.set(dx + i * TILE_S, deckY, dz);
    m.rotation.y = Math.PI / 2;
    group.add(m);
    /* supports under */
    if (lib.dockStrSup) {
      const s = lib.dockStrSup.clone();
      s.scale.setScalar(TILE_S);
      s.position.set(dx + i * TILE_S, deckY - 0.6, dz);
      s.rotation.y = Math.PI / 2;
      group.add(s);
    }
  }

  /* flat walkable deck for raycasting */
  const deckGeo = new THREE.BoxGeometry(6 * TILE_S, 0.15, TILE_S * 1.5);
  const deck = new THREE.Mesh(deckGeo, tMat("#8B6A40", { transparent: true, opacity: 0 }));
  deck.position.set(dx + 2.5 * TILE_S, deckY + 0.15, dz);
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

  const fence = lib.fenceBoard1 || lib.fenceBoard2;
  const post = lib.fencePost1;
  if (!fence) return group;

  /* fence line definitions: [startX, startZ, endX, endZ] world coords */
  const lines = [
    /* village north border */
    [-18, -24, 14, -24],
    /* village east */
    [14, -24, 14, -40],
    /* training yard */
    [-26, -28, -18, -28],
    [-26, -40, -26, -28],
    [-18, -40, -18, -28],
    /* path to bridge (west side) */
    [-4, -24, -4, 6],
    /* beach path south */
    [14, -20, 38, -20],
  ];

  const spacing = TILE_S; // one fence segment per tile

  for (const [sx, sz, ex, ez] of lines) {
    const dx = ex - sx, dz = ez - sz;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.round(len / spacing));
    const rot = Math.atan2(dx, dz);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = sx + dx * t, z = sz + dz * t;
      const y = getWorldSurfaceHeight(x, z);

      if (i < steps) {
        const f = fence.clone();
        f.scale.setScalar(TILE_S);
        f.position.set(x + dx / steps * 0.5, y, z + dz / steps * 0.5);
        f.rotation.y = rot;
        group.add(f);
      }
      if (post && i % 2 === 0) {
        const p = post.clone();
        p.scale.setScalar(TILE_S);
        p.position.set(x, y, z);
        p.rotation.y = rot;
        group.add(p);
      }
    }
  }

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
  const cx = 0, baseZ = 40;
  const topY = terrainH(cx, 48) + 1.5;
  const botY = WATER_Y + 0.2;

  /* stone ledges */
  const ledgeMat = tMat("#8f8e87");
  const ledges = [
    { y: topY, z: 46, w: 7, h: 1.2, d: 3 },
    { y: topY * 0.65 + botY * 0.35, z: 43, w: 6, h: 0.9, d: 2.5 },
    { y: botY + 0.5, z: 41, w: 5, h: 0.6, d: 2 },
  ];
  for (const l of ledges) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(l.w, l.h, l.d), ledgeMat);
    m.position.set(cx, l.y, l.z);
    m.renderOrder = R_DECOR;
    scene.add(m);
  }

  /* animated water cascade */
  const wfMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide,
    uniforms: { uTime: waterUniforms.uTime },
    vertexShader: `varying vec2 vUv;
      void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      void main(){
        float flow = fract(vUv.y*1.35 - uTime*0.42);
        float wave = smoothstep(0.0,0.42,flow)*smoothstep(1.0,0.6,flow);
        vec3 c = mix(vec3(.3,.58,.75),vec3(.4,.68,.85),wave*.5);
        float edge = smoothstep(0.0,0.18,vUv.x)*smoothstep(1.0,0.82,vUv.x);
        float foam = smoothstep(0.55,1.0,abs(sin((vUv.y-uTime*.45)*14.0)))*0.10;
        gl_FragColor = vec4(c+foam, edge*0.9);
      }`,
  });

  /* cascade planes from ledge to ledge */
  const pts = [
    [cx, topY, 47], [cx, topY * 0.65 + botY * 0.35 + 0.5, 44],
    [cx, botY + 0.8, 42], [cx, botY, 40.5],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
    const len = Math.hypot(y1 - y0, z1 - z0);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(4, len, 1, 10), wfMat);
    plane.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const dir = new THREE.Vector3(0, y1 - y0, z1 - z0).normalize();
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    plane.renderOrder = R_DECOR + 1;
    scene.add(plane);
  }

  /* foam at base */
  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 16),
    new THREE.MeshBasicMaterial({ color: "#c8e8f0", transparent: true, opacity: 0.4 })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(cx, WATER_Y + 0.03, baseZ - 0.5);
  foam.renderOrder = R_WATER + 1;
  scene.add(foam);
}

/* ═══════════════════════════════════════════
   Placement data for world.js
   ═══════════════════════════════════════════ */

export const TREE_SPOTS = [
  /* NE hills – woodcutting */
  [20, 18, 2.2, 1.8], [28, 28, 2.4, 3.6], [18, 28, 2.1, 0.9],
  [32, 20, 1.9, 2.4], [24, 32, 2.3, 4.2],
  /* NW hills */
  [-22, 18, 2.0, 1.0], [-30, 24, 1.9, 5.2], [-20, 26, 2.2, 4.5],
  /* meadow edges */
  [-16, -18, 1.7, 2.1], [14, -18, 1.6, 0.7], [-8, -42, 2.4, 3.3],
];

export const ROCK_MAJOR_SPOTS = [
  [30, 30, 1.55, 0.3],   /* NE hill */
  [-28, 26, 1.6, 1.4],   /* NW hill */
];

export const ROCK_SMALL_SPOTS = [
  [22, 34, 1.04, 3.2], [-26, 30, 1.0, 4.1],
  [34, 22, 0.98, 5.0], [-32, 18, 0.95, 2.6],
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

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  TILE_S, WATER_Y, GRASS_Y, HILL_Y,
  GX_MIN, GX_MAX, GZ_MIN, GZ_MAX,
  isInRiver, isBeach, isOnPath,
  riverQuery, distToPath,
  terrainH,
} from "./terrainHeight.js";
import { biomeAt as _mainlandBiomeAt, heightAt as _mainlandHeightAt } from "./mainland/mainland_continent.mjs";

/* ══════════════════════════════════════════════════════════
   terrainLayout.js — procedural mesh terrain + tile structures
   ══════════════════════════════════════════════════════════ */

const R_GND = 0, R_WATER = 2, R_FOAM = 2.5, R_DECOR = 3;


/* ── smooth value noise for vertex color variation ── */
function _vnoise(x, z) {
  const _h = (ix, iz) => {
    let n = ((ix * 1597334677) ^ (iz * 3812015801)) >>> 0;
    n = ((n >> 16) ^ n) * 0x45d9f3b >>> 0;
    n = ((n >> 16) ^ n) >>> 0;
    return n / 0xffffffff;
  };
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = _h(ix, iz), b = _h(ix + 1, iz);
  const c = _h(ix, iz + 1), d = _h(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
/* scattered radial hills — smooth round elevation contours */
const _HILLS = (() => {
  const hills = [];
  for (let i = 0; i < 350; i++) {
    let n = ((i * 1597334677) ^ (i * 7 + 3812015801)) >>> 0;
    const hx = (n / 0xffffffff) * 2000 - 1000;
    n = ((n >> 16) ^ n) * 0x45d9f3b >>> 0;
    const hz = (n / 0xffffffff) * 1600 - 700;
    n = ((n >> 16) ^ n) >>> 0;
    const r = 120 + (n / 0xffffffff) * 60;
    n = ((n >> 13) ^ n) * 0x27d4eb2d >>> 0;
    const amp = 0.10 + (n / 0xffffffff) * 0.10;
    hills.push({ x: hx, z: hz, r, amp });
  }
  return hills;
})();
function _hillField(x, z) {
  let v = 0;
  for (let i = 0; i < _HILLS.length; i++) {
    const h = _HILLS[i];
    const dx = x - h.x, dz = z - h.z;
    const d2 = dx * dx + dz * dz;
    const r2 = h.r * h.r;
    if (d2 < r2) {
      const t = 1 - d2 / r2;
      v += h.amp * t * t;
    }
  }
  return v;
}
/* soft toon banding — smoothstep transition between bands */
function _softBand(val, bands) {
  const scaled = val * bands;
  const band = Math.floor(scaled);
  const frac = scaled - band;
  const edge = 0.85;
  let t = frac < edge ? 0 : (frac - edge) / 0.15;
  t = t * t * (3 - 2 * t);
  return (band + t) / bands;
}

/* ── toon gradient ── */
const TOON_GRAD = (() => {
  const c = document.createElement("canvas"); c.width = 4; c.height = 1;
  const ctx = c.getContext("2d");
  [100, 160, 220, 255].forEach((v, i) => {
    ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(i, 0, 1, 1);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t._shared = true;  /* single module-level instance — never dispose */
  return t;
})();
function tMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRAD, ...opts });
}

/* ── tile catalogue ── */
const TILE_DIR = "models/terrain/";
const TILES = {
  /* structure */
  bridgeEnd:   "Prop_Bridge_Log_End.glb",
  bridgeEndE:  "Prop_Bridge_Log_End_Edge.glb",
  bridgeMid:   "Prop_Bridge_Log_Middle.glb",
  bridgeMidE:  "Prop_Bridge_Log_Middle_Edge.glb",
  bridgePost:  "Prop_Bridge_Log_Post_Support.glb",
  bridgePostT: "Prop_Bridge_Log_Post_Top.glb",
  fenceBoard1: "Prop_Fence_Boards_1.glb",
  fenceBoard2: "Prop_Fence_Boards_2.glb",
  fenceBoard3: "Prop_Fence_Boards_3.glb",
  fenceBoard4: "Prop_Fence_Boards_4.glb",
  fencePost1:  "Prop_Fence_Post_1.glb",
  fencePost2:  "Prop_Fence_Post_2.glb",
  fencePost3:  "Prop_Fence_Post_3.glb",
  fencePost4:  "Prop_Fence_Post_4.glb",
  dockStr:     "Prop_Docks_Straight.glb",
  dockStrSup:  "Prop_Docks_Straight_Supports.glb",
  dockSteps:   "Prop_Docks_Steps.glb",
  dockCorner:  "Prop_Docks_Corner.glb",
  dockCornerSup: "Prop_Docks_Corner_Supports.glb",
  /* props */
  grassClump1:     "Prop_Grass_Clump_1.glb",
  grassClump2:     "Prop_Grass_Clump_2.glb",
  grassClump3:     "Prop_Grass_Clump_3.glb",
  grassClump4:     "Prop_Grass_Clump_4.glb",
  flowerDaisy:     "Prop_Flower_Daisy.glb",
  flowerRose:      "Prop_Flower_Rose.glb",
  flowerSunflower: "Prop_Flower_Sunflower.glb",
  flowerTulip:     "Prop_Flower_Tulip.glb",
  cattail1:        "Prop_Cattail_1.glb",
  cattail2:        "Prop_Cattail_2.glb",
  mushroom1:       "Prop_Mushroom_1.glb",
  mushroom2:       "Prop_Mushroom_2.glb",
  palmTree1:       "Prop_Tree_Palm_1.glb",
  palmTree2:       "Prop_Tree_Palm_2.glb",
  shell1:          "Prop_Shell_1.glb",
  shell2:          "Prop_Shell_2.glb",
  starfish1:       "Prop_Starfish_1.glb",
  starfish2:       "Prop_Starfish_2.glb",
  stump:           "Prop_Stump.glb",
  hollowTrunk:     "Prop_Hollow_Trunk.glb",
};

/* ── Load all tiles ── */
export async function loadTiles() {
  /* THREE.Cache.enabled is set to true by world.js loadModels (which runs first).
     Don't override it here — caching speeds up boss re-entry + procgen template loads. */
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

/* ── village keep-out ── */
const SVC = [
  { x: 0, z: -32, r: 14 },
  { x: 18, z: -35, r: 10 },
  { x: -22, z: -34, r: 8 },
];
function inVillage(x, z, pad = 0) {
  for (const s of SVC)
    if (Math.hypot(x - s.x, z - s.z) <= s.r + pad) return true;
  return false;
}

/* ── simple hash for vertex jitter ── */
function hash21(x, z) {
  let n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/* ── seeded RNG ── */
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Procedural hills (module-level so placement code can query) ── */
const beachCX = 38, beachCZ = -6, beachR = 26;
const BUMPS = [];
{ const rng = mulberry32(77);
  for (let i = 0; i < 120; i++) {
    const bx = -40 + rng() * 80, bz = -38 + rng() * 72;
    const rq = riverQuery(bx, bz);
    if (rq.dist < rq.width + 3) continue;
    if (distToPath(bx, bz) < 2) continue;
    if (inVillage(bx, bz, 4)) continue;
    if (Math.hypot(bx - beachCX, bz - beachCZ) < beachR - 4) continue;
    const big = rng() < 0.25;
    BUMPS.push({
      x: bx, z: bz,
      r: big ? 10 + rng() * 12 : 5 + rng() * 7,
      h: big ? 1.2 + rng() * 1.5 : 0.3 + rng() * 0.6,
    });
  }
}

/* Bridge location — suppress terrain underneath */
const BRIDGE_X0 = -6, BRIDGE_X1 = 6, BRIDGE_Z = 8, BRIDGE_HW = 3;

/** Surface Y that matches the actual mesh vertices (terrainH + hills + bumps) */
export function getMeshSurfaceY(x, z) {
  let y = terrainH(x, z);
  const rq = riverQuery(x, z);
  const sm = THREE.MathUtils.smoothstep;
  const riverFar  = sm(rq.dist, rq.width, rq.width + 6);
  const pathFar   = sm(distToPath(x, z), 1, 5);
  let villageFar  = 1;
  for (const sv of SVC)
    villageFar = Math.min(villageFar, sm(Math.hypot(x - sv.x, z - sv.z), sv.r, sv.r + 6));
  const beachFar  = sm(Math.hypot(x - beachCX, z - beachCZ), beachR - 18, beachR + 4);
  const hillAmp   = riverFar * pathFar * villageFar * beachFar;
  y += (Math.sin(x * 0.07 + z * 0.05) * 0.5
      + Math.cos(x * 0.11 - z * 0.06) * 0.35
      + Math.sin(x * 0.04 + z * 0.13) * 0.25) * hillAmp;
  for (const b of BUMPS) {
    const d = Math.hypot(x - b.x, z - b.z);
    if (d < b.r) { const t = 1 - d / b.r; y += b.h * t * t * (3 - 2 * t) * hillAmp; }
  }
  /* flatten terrain under/near bridge so ground doesn't poke through */
  if (x > BRIDGE_X0 - 3 && x < BRIDGE_X1 + 3 && Math.abs(z - BRIDGE_Z) < BRIDGE_HW + 3) {
    const bxT = 1 - sm(Math.max(BRIDGE_X0 - x, x - BRIDGE_X1, 0), 0, 3);
    const bzT = 1 - sm(Math.abs(z - BRIDGE_Z), BRIDGE_HW, BRIDGE_HW + 3);
    const bridgeT = bxT * bzT;
    if (bridgeT > 0) y = THREE.MathUtils.lerp(y, WATER_Y - 2, bridgeT);
  }
  /* dock removed for performance */
  return y;
}

/* ═══════════════════════════════════════════
   buildTerrainMesh — vertex-colored ground + water plane
   ═══════════════════════════════════════════ */

export function buildTerrainMesh(waterUniforms, heightOffsets, colorOverrides, bounds, lodStep) {
  const group = new THREE.Group();
  group.name = "terrain";

  /* ── ground mesh ── */
  /* step=4 default — matches the rebuild_terrain.mjs grid density.
     All chunks load at the same step; no per-chunk LOD switching needed. */
  const step = lodStep || 4;
  const dxMin = bounds ? bounds.xMin : (GX_MIN - 1) * TILE_S;
  const dxMax = bounds ? bounds.xMax : (GX_MAX + 1) * TILE_S;
  const dzMin = bounds ? bounds.zMin : (GZ_MIN - 1) * TILE_S;
  const dzMax = bounds ? bounds.zMax : (GZ_MAX + 1) * TILE_S;
  /* exact chunk bounds — no overlap so adjacent meshes never z-fight */
  const xMin = dxMin, xMax = dxMax;
  const zMin = dzMin, zMax = dzMax;
  const nx = Math.ceil((xMax - xMin) / step) + 1;
  const nz = Math.ceil((zMax - zMin) / step) + 1;

  const pos = new Float32Array(nx * nz * 3);
  /* Uint8 (0-255) instead of Float32 (0-1) for vertex colors — 4x smaller
     buffer per chunk. Passed to BufferAttribute with normalized=true so
     the GPU shader still sees 0-1 values. The bilinear lerp below reads
     raw 0-255 values; the texData write loop multiplies by 1 instead of
     255 to compensate. */
  const col = new Uint8Array(nx * nz * 3);
  const idx = [];

  /* biome palette — grass → sand → deep (water handles the transition now) */
  const cGrass   = new THREE.Color("#4dad38");   // standard grass
  const cSand    = new THREE.Color("#F0D28A");   // warm sand
  const cDeep    = new THREE.Color(0.06, 0.18, 0.38);
  const tmp      = new THREE.Color();
  const sm       = THREE.MathUtils.smoothstep;   // hoisted — used in every vertex

  /* chunk local offset — heightOffset/colorOverride keys are in local coords */
  const loX = bounds && bounds.localOffsetX || 0;
  const loZ = bounds && bounds.localOffsetZ || 0;

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = xMin + ix * step, z = zMin + iz * step;
      let lx = x - loX, lz = z - loZ;
      const isPad = x < dxMin || x > dxMax || z < dzMin || z > dzMax;
      let y = GRASS_Y;

      /* height from chunk data (step-4 grid, bilinear for objects) */
      if (heightOffsets) {
        let key = `${lx},${lz}`;
        if (!(key in heightOffsets) && isPad) {
          lx = Math.max(dxMin, Math.min(dxMax, x)) - loX;
          lz = Math.max(dzMin, Math.min(dzMax, z)) - loZ;
          key = `${lx},${lz}`;
        }
        if (key in heightOffsets) y += heightOffsets[key];
      }
      /* Mainland height anchors — additive on top of chunk heightOffsets */
      const _isProcgenH = bounds && bounds._chunkData && bounds._chunkData.procgen;
      if (!_isProcgenH) y += _mainlandHeightAt(x, z);

      const i3 = (iz * nx + ix) * 3;

      /* low-poly vertex jitter — suppressed at chunk boundary edges to keep
         seams closed, and FULLY disabled for procgen chunks because the
         sub-cell wobble on a smooth chaikin-driven shoreline reads as
         tooth-like roughness when the camera rotates. */
      const isEdgeX = ix === 0 || ix === nx - 1;
      const isEdgeZ = iz === 0 || iz === nz - 1;
      const isInstance = bounds && bounds.isInstance;
      const isProcgenJit = bounds && bounds._chunkData && bounds._chunkData.procgen;
      const jit = (isEdgeX || isEdgeZ || isInstance || isProcgenJit) ? 0 : (hash21(x, z) - 0.5) * (step * 0.03);
      /* no edge nudge — nudging outward caused cracks visible under transparent water */
      pos[i3]     = x + jit;
      pos[i3 + 1] = y;
      pos[i3 + 2] = z + jit * 0.7;

      /* Biome color — height-banded palette + per-position noise added
         uniformly across r/g/b (preserves saturation; brightens or
         darkens each vertex differently so adjacent faces vary). Same
         look as procgen islands. */
      const _bi = _mainlandBiomeAt(x, z);
      const _S = _bi.sand, _G = _bi.grass, _H = _bi.hill, _P = _bi.peak;
      /* Underwater seabed shares the SAME color as procgen islands and
         the global ocean floor (procgen_island.mjs `_SEABED_COLOR` =
         world.js `_globalOceanFloor` color). One source-of-truth so the
         deep ocean visually flows INTO every continent edge without a
         seam. Shallow band still smoothly blends from biome grass for
         a soft cohesive shoreline. */
      const _SEABED_R = 0.06, _SEABED_G = 0.18, _SEABED_B = 0.38;
      let c = tmp;
      let _r, _g, _b;
      const _SHALLOW_DEPTH = 0.6;
      if (y < WATER_Y - _SHALLOW_DEPTH) {
        /* Deep band = pure unified seabed (matches procgen + global floor) */
        _r = _SEABED_R; _g = _SEABED_G; _b = _SEABED_B;
      } else if (y < WATER_Y) {
        /* Shallow band — smooth grass→seabed fade for a natural-looking
           mainland shoreline. Mainland uses a single grass color (not
           per-biome sand like procgen), so this blend doesn't produce
           the biome-specific seabed mismatches that motivated removing
           the equivalent procgen blend. */
        const t = (WATER_Y - y) / _SHALLOW_DEPTH;
        const e = t * t * (3 - 2 * t);
        _r = _G[0] * (1 - e) + _SEABED_R * e;
        _g = _G[1] * (1 - e) + _SEABED_G * e;
        _b = _G[2] * (1 - e) + _SEABED_B * e;
      } else if (y < HILL_Y) {
        _r = _G[0]; _g = _G[1]; _b = _G[2];
      } else if (y < HILL_Y + 1.5) {
        const t = (y - HILL_Y) / 1.5;
        _r = _G[0] * (1 - t) + _H[0] * t;
        _g = _G[1] * (1 - t) + _H[1] * t;
        _b = _G[2] * (1 - t) + _H[2] * t;
      } else {
        const t = Math.min(1, (y - HILL_Y - 1.5) / 2.0);
        _r = _H[0] * (1 - t) + _P[0] * t;
        _g = _H[1] * (1 - t) + _P[1] * t;
        _b = _H[2] * (1 - t) + _P[2] * t;
      }
      /* Per-position uniform noise — calmer than procgen's amp so adjacent
         triangles don't clash. Saturation preserved (uniform r/g/b shift). */
      if (y >= WATER_Y) {
        const _surfN = _vnoise(x * 0.09 + 31.7, z * 0.09 + 17.3) - 0.5;
        const _macroN = _vnoise(x * 0.025 + 81.4, z * 0.025 + 53.7) - 0.5;
        const _tonalN = _vnoise(x * 0.012 + 121.1, z * 0.012 + 199.5) - 0.5;
        const _nv = _surfN * 0.09 + _macroN * 0.05 + _tonalN * 0.06;
        _r += _nv; _g += _nv; _b += _nv;
      }
      c.setRGB(_r, _g, _b);

      /* editor color overrides — specific keys always win, _default only for non-padded verts */
      if (colorOverrides) {
        const clKey = `${lx},${lz}`;
        if (clKey in colorOverrides) { const ov = colorOverrides[clKey]; tmp.setRGB(ov[0], ov[1], ov[2]); c = tmp; }
        else if (!isPad && colorOverrides._default) { const ov = colorOverrides._default; tmp.setRGB(ov[0], ov[1], ov[2]); c = tmp; }
      }
      col[i3] = (c.r * 255 + 0.5) | 0; col[i3 + 1] = (c.g * 255 + 0.5) | 0; col[i3 + 2] = (c.b * 255 + 0.5) | 0;

      if (ix < nx - 1 && iz < nz - 1) {
        const a = iz * nx + ix, b = a + 1, d = a + nx, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
  }

  /* color blur removed — DataTexture LinearFilter handles smooth gradients */

  /* no runtime blur — smooth applied in fix_shorelines on the actual data */

  /* ─── OSRS_V2 ─── per-face-flat-shaded vertex-color path. Originally
     procgen-only; now applies to mainland too so we get the same clean
     per-face look without DataTexture polkadot blending. */
  const OSRS_V2 = true;
  const _isProcgenChunk = bounds && bounds._chunkData && bounds._chunkData.procgen;
  if (OSRS_V2) {
    let geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    /* normalized=true → GPU shader reads col as 0-1 even though storage is 0-255 */
    geo.setAttribute("color",    new THREE.BufferAttribute(col, 3, true));
    geo.setIndex(idx);
    /* Un-index so each face has 3 unique verts → computeVertexNormals
       produces a single flat normal per face (no smooth interpolation). */
    geo = geo.toNonIndexed();
    /* Per-face uniform color: average each face's 3 vertex colors and
       write that average back to all 3, so each triangle is one solid
       toon-bandable hue with no gradient inside the face. */
    {
      const c = geo.attributes.color.array;
      const p = geo.attributes.position.array;
      const _isMainland = !_isProcgenChunk;
      for (let f = 0; f < c.length; f += 9) {
        let r = (c[f]   + c[f+3] + c[f+6]) / 3;
        let g = (c[f+1] + c[f+4] + c[f+7]) / 3;
        let b = (c[f+2] + c[f+5] + c[f+8]) / 3;
        const fx = (p[f]     + p[f + 3] + p[f + 6]) / 3;
        const fy = (p[f + 1] + p[f + 4] + p[f + 7]) / 3;
        const fz = (p[f + 2] + p[f + 5] + p[f + 8]) / 3;
        /* Underwater seabed faces stay UNIFORM — no jitter, no toon-band
           shade, no fine noise. The deep band must read as one continuous
           color across procgen islands, mainland coast, and global ocean
           floor (single _SEABED_COLOR source-of-truth). Above water gets
           the full per-face polygon look. */
        const _underwater = fy < WATER_Y - 0.5;
        if (!_underwater) {
        /* Per-face hash jitter — each polygon gets its own subtle shade.
           Reduced amp so triangles don't clash. */
        const h = Math.sin(fx * 12.9898 + fz * 78.233) * 43758.5453;
        const jitterBase = ((h - Math.floor(h)) - 0.5);
        const amp = 0.025;
        const j = jitterBase * amp;
        r += j; g += j; b += j;
        }
        /* Toon shade map — mainland-only. Soft-banded hills + multi-octave
           fbm gives the cool gradient look the live site shipped with.
           Amp matches the minimap composite (~0.20) so the in-game terrain
           reads as the SAME shade pattern as the minimap.png overlay.
           Skipped underwater so seabed stays uniform across continents. */
        if (_isMainland && !_underwater) {
          const _hills = _hillField(-fx, -fz);
          const _raw   = 0.81 - Math.min(_hills, 0.49);
          const _banded = _softBand(Math.max(0, Math.min(1, _raw)), 14);
          const _fine = (_vnoise(-fx * 0.018 + 7.31,  -fz * 0.018 + 13.77) * 0.45
                       + _vnoise(-fx * 0.045 + 53.17, -fz * 0.045 + 97.43) * 0.28
                       + _vnoise(-fx * 0.10  + 107.89,-fz * 0.10  + 151.61) * 0.16
                       + _vnoise(-fx * 0.22  + 199.33,-fz * 0.22  + 263.07) * 0.11) * 0.76 - 0.38;
          /* Multiplicative shade — darken by up to ~30% in the deepest
             bands; lightest bands stay near full brightness. Matches
             the minimap composite_minimap_shade.mjs SHADE_OPACITY=0.85
             SHADE_FLOOR=0.35 so terrain visually matches the map. */
          const _shClamped = 0.35 + 0.65 * Math.max(0, Math.min(1, _banded));
          const _mult = 1 - 0.85 + 0.85 * _shClamped;
          /* Add the fine fbm as a small bias so smooth blotchy variation
             doesn't get crushed by the band quantization. */
          const _bias = _fine * 0.08;
          r = r * _mult + _bias;
          g = g * _mult + _bias;
          b = b * _mult + _bias;
        }
        const rj = Math.max(0, r), gj = Math.max(0, g), bj = Math.max(0, b);
        c[f] = c[f+3] = c[f+6] = rj;
        c[f+1] = c[f+4] = c[f+7] = gj;
        c[f+2] = c[f+5] = c[f+8] = bj;
      }
      geo.attributes.color.needsUpdate = true;
    }
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    /* Toon-banded flat-shaded ground: vertex colors per face + toon gradient
       map quantizes the diffuse into 3 bands, giving each polygon-flat face
       the OSRS polygonal silhouette plus the cel-shaded brightness banding. */
    /* `flatShading: true` is not supported on MeshToonMaterial. The flat-
       shaded look comes from `geo.toNonIndexed()` + per-face unique verts
       above — each triangle has its own normal, so the toon gradient maps
       each face to a single band even without the flag. */
    const groundMat = new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap: TOON_GRAD,
    });
    const groundMesh = new THREE.Mesh(geo, groundMat);
    groundMesh.renderOrder = R_GND;
    group.add(groundMesh);

    /* Add water plane + foam below same as the original path. The texture/
       UV creation that followed is skipped — those only fed the ground map. */
    /* Fall through to water-plane code below by NOT returning here. */
    /* ── early water plane setup using waterUniforms ── */
    /* Mark _osrsBuilt so we skip the original ground-mesh code further down. */
    bounds._osrsBuilt = true;
  }


  /* ── 4x resolution DataTexture — padded 2 texels for seamless chunk edges ── */
  if (bounds && bounds._osrsBuilt) {
    /* OSRS path already added the ground mesh; skip texture + smooth geo. */
  } else {
  const texStep = 1;
  const tPad = 2;
  const tnxI = Math.ceil((xMax - xMin) / texStep) + 1;  // inner (101)
  const tnzI = Math.ceil((zMax - zMin) / texStep) + 1;
  const tnx = tnxI + tPad * 2;  // padded (105)
  const tnz = tnzI + tPad * 2;
  const texData = new Uint8Array(tnx * tnz * 4);

  for (let tz = 0; tz < tnz; tz++) {
    for (let tx = 0; tx < tnx; tx++) {
      const x = xMin + (tx - tPad) * texStep, z = zMin + (tz - tPad) * texStep;
      const ti = (tz * tnx + tx) * 4;

      /* Color: bilinear from col[] (which is built per-vertex via
         biomeAt at line ~313). colorOverrides win at exact key matches. */
      let lx = x - loX, lz = z - loZ;
      let r, g, b;
      const coKey = `${lx},${lz}`;
      if (colorOverrides && colorOverrides[coKey]) {
        const ov = colorOverrides[coKey];
        r = ov[0]; g = ov[1]; b = ov[2];
      } else {
        const fx = (x - xMin) / step, fz = (z - zMin) / step;
        const ix0 = Math.max(0, Math.min(Math.floor(fx), nx - 2));
        const iz0 = Math.max(0, Math.min(Math.floor(fz), nz - 2));
        const ix1 = Math.min(ix0 + 1, nx - 1), iz1 = Math.min(iz0 + 1, nz - 1);
        const sx = Math.max(0, Math.min(1, fx - ix0)), sz = Math.max(0, Math.min(1, fz - iz0));
        const i00 = (iz0 * nx + ix0) * 3, i10 = (iz0 * nx + ix1) * 3;
        const i01 = (iz1 * nx + ix0) * 3, i11 = (iz1 * nx + ix1) * 3;
        r = col[i00]*(1-sx)*(1-sz) + col[i10]*sx*(1-sz) + col[i01]*(1-sx)*sz + col[i11]*sx*sz;
        g = col[i00+1]*(1-sx)*(1-sz) + col[i10+1]*sx*(1-sz) + col[i01+1]*(1-sx)*sz + col[i11+1]*sx*sz;
        b = col[i00+2]*(1-sx)*(1-sz) + col[i10+2]*sx*(1-sz) + col[i01+2]*(1-sx)*sz + col[i11+2]*sx*sz;
      }
      /* Toon shade pass: still OFF — turn back on once palette looks right. */

      /* col is now Uint8 (0-255) so r/g/b from the lerp above are already
         in 0-255 range — no need to multiply by 255. */
      texData[ti]     = Math.min(255, Math.max(0, r + 0.5));
      texData[ti + 1] = Math.min(255, Math.max(0, g + 0.5));
      texData[ti + 2] = Math.min(255, Math.max(0, b + 0.5));
      texData[ti + 3] = 255;
    }
  }
  const colorTex = new THREE.DataTexture(texData, tnx, tnz, THREE.RGBAFormat);
  colorTex.magFilter = THREE.LinearFilter;
  colorTex.minFilter = THREE.LinearFilter;
  colorTex.wrapS = THREE.ClampToEdgeWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;
  colorTex.colorSpace = THREE.LinearSRGBColorSpace;
  colorTex.needsUpdate = true;

  const uvs = new Float32Array(nx * nz * 2);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const ui = (iz * nx + ix) * 2;
      const txPos = (ix * step) / texStep + tPad;
      const tzPos = (iz * step) / texStep + tPad;
      uvs[ui]     = (txPos + 0.5) / tnx;
      uvs[ui + 1] = (tzPos + 0.5) / tnz;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv",       new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  /* Force boundary vertex normals to (0,1,0) so adjacent chunks match lighting */
  {
    const nrm = geo.attributes.normal.array;
    const _isProcgenChunk = bounds && bounds._chunkData && bounds._chunkData.procgen;
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        if (ix === 0 || ix === nx-1 || iz === 0 || iz === nz-1) {
          const i3 = (iz * nx + ix) * 3;
          nrm[i3] = 0; nrm[i3+1] = 1; nrm[i3+2] = 0;
        } else if (_isProcgenChunk) {
          /* Procgen runs at step=1, so computeVertexNormals produces
             high-frequency per-cell normal wobble → faceted look at
             close zoom. Flatten all procgen normals to straight-up.
             MeshToonMaterial reads mostly horizontal shading from this,
             which is the look we want for smooth shores + grass. */
          const i3 = (iz * nx + ix) * 3;
          nrm[i3] = 0; nrm[i3+1] = 1; nrm[i3+2] = 0;
        }
      }
    }
    geo.attributes.normal.needsUpdate = true;
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const groundMat  = new THREE.MeshToonMaterial({ map: colorTex, gradientMap: TOON_GRAD });
  const groundMesh = new THREE.Mesh(geo, groundMat);
  groundMesh.renderOrder = R_GND;
  group.add(groundMesh);
  } /* end !_osrsBuilt branch */

  /* ── pre-baked water alpha texture (from global spline) ──
     Procgen chunks now ship their own waterAlpha baked against each
     island's Chaikin-smoothed shoreline polygon (see islandToChunks in
     procgen_island.mjs), so they render through the same chunk-water
     shader path as hand-authored mainland chunks — no skip needed.
     Boss instance arenas (bounds.isInstance) skip the water plane to
     save a draw call. Mainland chunks with water:false STILL build it
     since the alpha texture controls where water is actually visible. */
  if (!bounds || !bounds.isInstance || bounds.water === true) {
    const ww = dxMax - dxMin, wh = dzMax - dzMin;
    const aNx = dxMax - dxMin + 1, aNz = dzMax - dzMin + 1; // 101x101

    const PAD = 8;
    const pNx = aNx + PAD * 2, pNz = aNz + PAD * 2; // padded dims (105x105)

    let aTex;
    if (bounds && bounds._chunkData && bounds._chunkData.waterAlpha) {
      const b64 = bounds._chunkData.waterAlpha;
      const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      aTex = new THREE.DataTexture(bin, pNx, pNz, THREE.RGBAFormat);
    } else {
      /* Fallback: flat water color */
      const flat = new Uint8Array(aNx * aNz * 4);
      for (let i = 0; i < aNx * aNz; i++) {
        flat[i*4] = 107; flat[i*4+1] = 189; flat[i*4+2] = 235; flat[i*4+3] = 112; // ~0.44
      }
      aTex = new THREE.DataTexture(flat, aNx, aNz, THREE.RGBAFormat);
    }
    aTex.magFilter = THREE.LinearFilter; aTex.minFilter = THREE.LinearFilter;
    aTex.wrapS = THREE.ClampToEdgeWrapping; aTex.wrapT = THREE.ClampToEdgeWrapping;
    aTex.needsUpdate = true;

    const waterGeo = new THREE.PlaneGeometry(ww, wh, 8, 8);
    waterGeo.rotateX(-Math.PI / 2);
    /* Sample exact texel centers at chunk edges to avoid cross-chunk seam blending. */
    const uvMinX = (PAD + 0.5) / pNx;
    const uvMinY = (PAD + 0.5) / pNz;
    const uvMaxX = (PAD + aNx - 0.5) / pNx;
    const uvMaxY = (PAD + aNz - 0.5) / pNz;
    /* Procgen chunks carry smooth depth-based RGB in their waterAlpha
       texture (bake writes a shallow→deep colour gradient); the mainland
       shader's discrete-band lookup `rawA<0.15 ? shallow : ...` would
       cause visible concentric colour rings on top of procgen coasts
       because mainland relies on its foam strip to mask those bands and
       procgen islands don't have foam. Use a smooth-RGB fragment for
       procgen chunks; mainland keeps its toon bands. */
    const _chunkProcgen = !!(bounds && bounds._chunkData && bounds._chunkData.procgen);
    /* Water shader — mainland uses 3-band toon depth coloring (shallow/
       mid/deep) which is fine at mainland scale. On procgen small
       islands those bands read as visible concentric rings because the
       whole water is on screen. Procgen uses a single DEEP seabed
       color (same 0x2A6FA1 as the global ocean plane) so there's
       zero visible seam — the chunk water and the global ocean are
       identical blue, only distinguishable by the alpha fade at shore. */
    /* Tier ring tint helper — MUST mirror world.js global ocean shader
       (line ~8117-8119) exactly, otherwise chunk water and global ocean
       desync at every tier boundary. Single source-of-truth via the
       shared GLSL snippet pasted into both shaders. */
    const _tierTintGLSL = `
      float tierTint(vec2 worldXZ) {
        float dist = length(worldXZ);
        if (dist > 5704.0)      return 0.55;
        else if (dist > 3630.0) return 0.70;
        else if (dist > 1556.0) return 0.85;
        return 1.0;
      }
    `;
    const _waterFrag = _chunkProcgen
      ? `
        uniform sampler2D uTex;
        uniform float uTime;
        uniform float uDim;
        uniform float uFancyFx;
        uniform vec2 uUvMin;
        uniform vec2 uUvMax;
        varying vec2 vUv;
        varying float vWave;
        varying vec3 vWorldPos;
        void main() {
          vec2 uv = mix(uUvMin, uUvMax, vUv);
          vec4 c = texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
          /* Procgen alpha texture encodes signed distance in the alpha
             channel: sd = (a*255 - 128) / 20, positive = water side.
             No edge offset — water follows the polygon exactly so
             noise-perturbed lake crevices stay visible. */
          float sd = (c.a * 255.0 - 128.0) / 20.0;
          float aaW = max(fwidth(sd), 1e-4);
          float edge = smoothstep(-aaW, aaW, sd);
          if (edge < 0.005) discard;

          /* Potato mode early-out — flat color, no trig. */
          if (uFancyFx < 0.5) {
            vec3 flatCol = vec3(0.18, 0.52, 0.72);
            float flatA = edge * 0.62;
            gl_FragColor = vec4(flatCol * flatA * uDim, flatA);
            return;
          }

          /* Lake mask in R channel (set by procgen bake when fragment is
             inland depthSD > shoreSD). Lakes get calmer surface — less
             shimmer, less foam, fewer sparkles, slower animation. */
          float isLake = c.r;
          float liveMul = mix(1.0, 0.35, isLake);    /* foam/sparkle intensity */
          float speedMul = mix(1.0, 0.45, isLake);   /* animation speed */

          /* ── Our base: UV-warped multi-scale ripple shimmer ─────── */
          vec2 rUV = vWorldPos.xz * 0.20;
          vec2 warp = vec2(
            sin(rUV.x * 0.21 + uTime * 0.31) * 0.6,
            cos(rUV.y * 0.18 - uTime * 0.27) * 0.6
          );
          vec2 wUV = rUV + warp;
          float s1 = sin(dot(wUV, vec2( 0.71,  0.71)) * 0.42 + uTime * 0.55);
          float s2 = sin(dot(wUV, vec2(-0.55,  0.84)) * 0.31 - uTime * 0.42) * 0.85;
          float m1 = sin(dot(wUV, vec2( 0.92, -0.39)) * 1.05 + uTime * 1.10) * 0.45;
          float f1 = sin(dot(wUV, vec2(-0.88, -0.47)) * 3.10 - uTime * 2.20) * 0.18;
          float f2 = sin(dot(wUV, vec2( 0.39,  0.92)) * 4.50 + uTime * 2.80) * 0.12;
          float ripple = (s1 + s2 + m1 + f1 + f2) * 0.32 * uFancyFx;
          vec3 deep = vec3(0.18, 0.52, 0.72);
          /* Reduce shimmer amplitude for lakes (less surface activity). */
          float shimmer = 1.0 + ripple * mix(0.06, 0.025, isLake);
          vec3 col = deep * shimmer;
          vec3 foamCol = vec3(0.700, 1.000, 1.000);
          vec3 wp = vWorldPos;
          float tt = uTime * speedMul;  /* lake-slowed time */

          /* Sparse foam crests — speed dampened on lakes via tt. */
          float w1 = sin(wp.x * 0.43 + wp.z * 0.11 + tt * 1.8) * 0.5 + 0.5;
          float w2 = sin(wp.z * 0.37 + wp.x * 0.07 - tt * 1.4) * 0.5 + 0.5;
          float w3 = sin(wp.x * 0.31 + wp.z * 0.47 + tt * 1.1) * 0.5 + 0.5;
          float w4 = sin(wp.x * 0.17 + wp.z * 0.29 + tt * 0.8) * 0.5 + 0.5;
          float w5 = sin(wp.z * 0.41 + wp.x * 0.33 + tt * 0.9) * 0.5 + 0.5;
          float w6 = sin(wp.x * 0.67 - wp.z * 0.43 - tt * 0.5) * 0.5 + 0.5;
          float foam = w1 * w2 * w3 + w4 * w5 * w6 * 0.4;
          foam = 1.0 - smoothstep(0.002, 0.012, foam);
          col += foamCol * foam * 0.22 * liveMul * uFancyFx;

          float sp1 = sin(wp.x * 0.40 + wp.z * 0.09 + tt * 1.7);
          float sp2 = sin(wp.z * 0.35 + wp.x * 0.13 - tt * 1.4);
          float sp3 = sin(wp.x * 0.27 - wp.z * 0.17 + tt * 2.0);
          float sp4 = sin(wp.x * 0.71 - wp.z * 0.47 + tt * 0.95);
          float sparkleMask = sin(wp.x * 0.031 + wp.z * 0.047 + tt * 0.12)
                            * sin(wp.z * 0.053 - wp.x * 0.029 - tt * 0.09);
          sparkleMask = smoothstep(0.15, 0.55, sparkleMask);
          float sparkle = sp1 * sp2 * sp3 * sp4;
          sparkle = smoothstep(0.7, 0.97, sparkle) * sparkleMask;
          col += vec3(1.0) * sparkle * 0.22 * liveMul * uFancyFx;

          float alpha = edge * 0.62;
          gl_FragColor = vec4(col * alpha * uDim, alpha);
        }
      `
      : `
        uniform sampler2D uTex;
        uniform float uTime;
        uniform float uDim;
        uniform float uFancyFx;
        uniform vec2 uUvMin;
        uniform vec2 uUvMax;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vec2 uv = mix(uUvMin, uUvMax, vUv);
          vec4 c = texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
          float rawA = c.a;
          if (rawA < 0.04) discard;

          /* Potato mode early-out — flat color, no trig. */
          if (uFancyFx < 0.5) {
            vec3 flatCol = vec3(0.18, 0.52, 0.72);
            float flatA = smoothstep(0.04, 0.12, rawA) * 0.62;
            gl_FragColor = vec4(flatCol * flatA * uDim, flatA);
            return;
          }

          /* Wobble used ONLY for the alpha smoothstep (masks the texel
             grid staircase at shorelines). Inlandness uses RAW alpha
             so deep-ocean dampening doesn't flicker as the wobble
             crosses the threshold — that flicker was the source of
             the speed/brightness seam vs global ocean. */
          float wob = sin(vWorldPos.x * 0.42 + uTime * 0.83)
                    * cos(vWorldPos.z * 0.39 + uTime * 0.71) * 0.04;
          float a = clamp(rawA + wob, 0.0, 1.0);
          /* Mainland inland-water heuristic — within mainland rectangle
             AND raw alpha is low/mid (rivers/lakes only). Steady, no
             wobble, no flicker. */
          float inMainland = step(-950.0, vWorldPos.x) * step(vWorldPos.x, 850.0)
                           * step(-646.0, vWorldPos.z) * step(vWorldPos.z, 654.0);
          float inlandness = 1.0 - smoothstep(0.40, 0.85, rawA);
          float isInland = inMainland * inlandness;
          float liveMul = mix(1.0, 0.25, isInland);   /* stronger dampen */
          float speedMul = mix(1.0, 0.35, isInland);  /* slower */

          /* Our base ripple shimmer + foam crests + sparkles overlay. */
          vec2 rUV = vWorldPos.xz * 0.20;
          vec2 warp = vec2(
            sin(rUV.x * 0.21 + uTime * 0.31) * 0.6,
            cos(rUV.y * 0.18 - uTime * 0.27) * 0.6
          );
          vec2 wUV = rUV + warp;
          float s1 = sin(dot(wUV, vec2( 0.71,  0.71)) * 0.42 + uTime * 0.55);
          float s2 = sin(dot(wUV, vec2(-0.55,  0.84)) * 0.31 - uTime * 0.42) * 0.85;
          float m1 = sin(dot(wUV, vec2( 0.92, -0.39)) * 1.05 + uTime * 1.10) * 0.45;
          float f1 = sin(dot(wUV, vec2(-0.88, -0.47)) * 3.10 - uTime * 2.20) * 0.18;
          float f2 = sin(dot(wUV, vec2( 0.39,  0.92)) * 4.50 + uTime * 2.80) * 0.12;
          float ripple = (s1 + s2 + m1 + f1 + f2) * 0.32 * uFancyFx;
          vec3 deep = vec3(0.18, 0.52, 0.72);
          float shimmer = 1.0 + ripple * mix(0.06, 0.025, isInland);
          vec3 col = deep * shimmer;
          vec3 foamCol = vec3(0.700, 1.000, 1.000);
          vec3 wp = vWorldPos;
          float tt = uTime * speedMul;

          float w1 = sin(wp.x * 0.43 + wp.z * 0.11 + tt * 1.8) * 0.5 + 0.5;
          float w2 = sin(wp.z * 0.37 + wp.x * 0.07 - tt * 1.4) * 0.5 + 0.5;
          float w3 = sin(wp.x * 0.31 + wp.z * 0.47 + tt * 1.1) * 0.5 + 0.5;
          float w4 = sin(wp.x * 0.17 + wp.z * 0.29 + tt * 0.8) * 0.5 + 0.5;
          float w5 = sin(wp.z * 0.41 + wp.x * 0.33 + tt * 0.9) * 0.5 + 0.5;
          float w6 = sin(wp.x * 0.67 - wp.z * 0.43 - tt * 0.5) * 0.5 + 0.5;
          float foam = w1 * w2 * w3 + w4 * w5 * w6 * 0.4;
          foam = 1.0 - smoothstep(0.002, 0.012, foam);
          col += foamCol * foam * 0.22 * liveMul * uFancyFx;

          float sp1 = sin(wp.x * 0.40 + wp.z * 0.09 + tt * 1.7);
          float sp2 = sin(wp.z * 0.35 + wp.x * 0.13 - tt * 1.4);
          float sp3 = sin(wp.x * 0.27 - wp.z * 0.17 + tt * 2.0);
          float sp4 = sin(wp.x * 0.71 - wp.z * 0.47 + tt * 0.95);
          float sparkleMask = sin(wp.x * 0.031 + wp.z * 0.047 + tt * 0.12)
                            * sin(wp.z * 0.053 - wp.x * 0.029 - tt * 0.09);
          sparkleMask = smoothstep(0.15, 0.55, sparkleMask);
          float sparkle = sp1 * sp2 * sp3 * sp4;
          sparkle = smoothstep(0.7, 0.97, sparkle) * sparkleMask;
          col += vec3(1.0) * sparkle * 0.22 * liveMul * uFancyFx;

          float alpha = smoothstep(0.04, 0.12, a) * 0.62;
          gl_FragColor = vec4(col * alpha * uDim, alpha);
        }
      `;
    /* Subtle sin wave on the water plane — same for mainland and procgen.
       The wave was previously disabled for procgen because shore cells
       flickered submerged/emerged across WATER_Y as the camera moved.
       That flicker is gone now that procgen's shoreline chain coincides
       with the mesh iso (see `_findMeshIsoSD` in procgen_island.mjs), so
       the wave can come back for the same 'water bobbing' feel mainland has. */
    /* Pass world-space XZ to the fragment so chunk water can apply the
       SAME distance-from-spawn tint as the global ocean shader (tier
       ring darkening). Without this, chunk water at procgen islands in
       outer rings reads 100% brightness while the surrounding global
       ocean reads 70-85%, producing a visible color seam at every
       chunk boundary in tier 2+. */
    /* Procgen skips the surface bob entirely — fully static water.
       Mainland keeps the bob for visual flavor. */
    const _waterVert = _chunkProcgen ? `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vWave = 0.0;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    ` : `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float w = sin(uTime * 0.5) * 0.025;
        pos.y += w;
        vWave = w;
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;
    /* Add uFancyFx uniform if not already present (shared across chunks).
       1.0 = full ripple/foam/sparkle, 0.0 = flat color only (perf mode). */
    if (!waterUniforms.uFancyFx) waterUniforms.uFancyFx = { value: 1.0 };
    const waterMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: true, depthTest: true,
      premultipliedAlpha: true,
      /* Polygon offset pushes chunk water's rasterized depth slightly
         BACK (away from camera). Combined with global ocean's depthWrite,
         chunk water consistently FAILS LESS depthTest in the chunk-vs-
         global overlap belt — only global draws there, no stacking, no
         Z-fight flicker. In the chunk hole region (global discarded),
         chunk water passes against the seabed normally and draws. */
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      /* Procgen fragment uses fwidth() for SDF screen-space AA — needs
         OES_standard_derivatives on WebGL1 (no-op on WebGL2). */
      extensions: { derivatives: _chunkProcgen },
      uniforms: {
        uTex: { value: aTex },
        uTime: waterUniforms.uTime,
        uDim: waterUniforms.uDim || (waterUniforms.uDim = { value: 1.0 }),
        uFancyFx: waterUniforms.uFancyFx,
        uUvMin: { value: new THREE.Vector2(uvMinX, uvMinY) },
        uUvMax: { value: new THREE.Vector2(uvMaxX, uvMaxY) },
      },
      vertexShader: _waterVert,
      fragmentShader: _waterFrag,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set((dxMin + dxMax) / 2, WATER_Y, (dzMin + dzMax) / 2);
    waterMesh.userData.isWaterSurface = true;
    waterMesh.renderOrder = R_WATER;
    group.add(waterMesh);
  }

  /* ── edge walls (tall cliff boundaries per side) ── */
  if (bounds && bounds.edges) {
    const wallH = 12, wallColor = "#6a6a5e";
    const wallMat = tMat(wallColor);
    const e = bounds.edges;
    const cx = (xMin + xMax) / 2, cz = (zMin + zMax) / 2;
    const w = xMax - xMin, d = zMax - zMin;
    if (e.north) { const m = new THREE.Mesh(new THREE.BoxGeometry(w + 2, wallH, 2), wallMat); m.position.set(cx, wallH / 2 - 1, zMax + 1); group.add(m); }
    if (e.south) { const m = new THREE.Mesh(new THREE.BoxGeometry(w + 2, wallH, 2), wallMat); m.position.set(cx, wallH / 2 - 1, zMin - 1); group.add(m); }
    if (e.east)  { const m = new THREE.Mesh(new THREE.BoxGeometry(2, wallH, d + 2), wallMat); m.position.set(xMax + 1, wallH / 2 - 1, cz); group.add(m); }
    if (e.west)  { const m = new THREE.Mesh(new THREE.BoxGeometry(2, wallH, d + 2), wallMat); m.position.set(xMin - 1, wallH / 2 - 1, cz); group.add(m); }
  }

  /* ── Foam strip from pre-computed shoreline normals (no seams) ── */
  if (window._enableFoam !== false && window._shorelineChains && !(bounds && bounds.isInstance)) {
    const FOAM_W = 1.5, FOAM_INLAND = 0.5, foamY = WATER_Y + 0.06;
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0x9AD4EE, transparent: true, opacity: 0.42,
      depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8,
    });
    /* owns: this chunk renders a triangle if its midpoint falls inside chunk bounds.
       Exactly one chunk owns each triangle — no overlap, no gaps. */
    const owns = (a, b) => {
      const mx = (a[0] + b[0]) * 0.5, mz = (a[1] + b[1]) * 0.5;
      return mx >= xMin && mx < xMax && mz >= zMin && mz < zMax;
    };
    const PAD = 4;
    const inPad = p => p[0] >= xMin - PAD && p[0] <= xMax + PAD && p[1] >= zMin - PAD && p[1] <= zMax + PAD;
    /* Chain-level bbox cull: once there are many chains (mainland + ~65
       procgen islands), most chains have zero intersection with any given
       chunk's padded bbox. Skipping them with a cheap AABB test drops the
       per-chunk foam-build cost from O(chains × points) to effectively
       O(nearby chains × points). chain.bbox is set at push time by either
       the mainland JSON loader OR _ensureProcgenIsland in world.js. */
    const cxLo = xMin - PAD, cxHi = xMax + PAD;
    const czLo = zMin - PAD, czHi = zMax + PAD;
    for (const chain of window._shorelineChains) {
      const b = chain.bbox;
      if (b && (b[2] < cxLo || b[0] > cxHi || b[3] < czLo || b[1] > czHi)) continue;
      const verts = [], indices = [];
      for (let i = 0; i < chain.length; i++) {
        if (!inPad(chain[i])) continue;
        const [x, z, nx, nz] = chain[i];
        const vi = verts.length / 3;
        verts.push(x - nx * FOAM_INLAND, foamY, z - nz * FOAM_INLAND);
        verts.push(x + nx * FOAM_W,      foamY, z + nz * FOAM_W);
        /* look back to find previous vert that was also in pad zone */
        if (i > 0 && inPad(chain[i - 1]) && owns(chain[i - 1], chain[i])) {
          const b = vi - 2;
          indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
      }
      if (verts.length >= 6 && indices.length > 0) {
        const fGeo = new THREE.BufferGeometry();
        fGeo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
        fGeo.setIndex(indices);
        const fMesh = new THREE.Mesh(fGeo, foamMat);
        fMesh.renderOrder = R_FOAM;
        fMesh.raycast = () => {};
        fMesh.userData._isFoam = true;
        if (window._enableFoam === false) fMesh.visible = false;
        group.add(fMesh);
      }
    }
  }

  /* freeze world matrices — terrain is static, skip per-frame recalc */
  group.updateMatrixWorld(true);
  group.traverse(o => { o.matrixAutoUpdate = false; });

  return group;
}

/* ═══════════════════════════════════════════
   buildProps — scatter decorations
   ═══════════════════════════════════════════ */

export function buildProps(lib, scene) {
  const group = new THREE.Group();
  group.name = "props";
  const rng = mulberry32(42);
  const rand = (lo, hi) => lo + rng() * (hi - lo);

  function place(key, x, z, scale, rotY) {
    const tmpl = lib[key];
    if (!tmpl) return;
    const m = tmpl.clone();
    m.scale.setScalar(TILE_S * scale);
    m.position.set(x, getMeshSurfaceY(x, z), z);
    m.rotation.y = rotY;
    group.add(m);
  }

  const grassKeys = ["grassClump1", "grassClump2", "grassClump3", "grassClump4"];
  const flowerKeys = ["flowerDaisy", "flowerRose", "flowerSunflower", "flowerTulip"];
  const cattailKeys = ["cattail1", "cattail2"];
  const mushKeys = ["mushroom1", "mushroom2"];
  const shellKeys = ["shell1", "shell2", "starfish1", "starfish2"];
  const palmKeys = ["palmTree1", "palmTree2"];

  for (let i = 0; i < 80; i++) {
    const x = rand(-36, 28), z = rand(-34, 36);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width + 1.5) continue;
    if (isBeach(x, z)) continue;
    if (inVillage(x, z, 3)) continue;
    if (isOnPath(x, z)) continue;
    place(grassKeys[i % grassKeys.length], x, z, rand(0.7, 1.1), rng() * Math.PI * 2);
  }

  for (let i = 0; i < 40; i++) {
    const x = rand(-34, 26), z = rand(-30, 34);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width + 2) continue;
    if (isBeach(x, z)) continue;
    if (inVillage(x, z, 4)) continue;
    if (isOnPath(x, z)) continue;
    place(flowerKeys[i % flowerKeys.length], x, z, rand(0.6, 1.0), rng() * Math.PI * 2);
  }

  for (let i = 0; i < 15; i++) {
    const x = rand(-10, 30), z = rand(-16, 38);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width || rq.dist > rq.width + 3) continue;
    place(cattailKeys[i % cattailKeys.length], x, z, rand(0.8, 1.2), rng() * Math.PI * 2);
  }

  for (let i = 0; i < 10; i++) {
    const x = rand(-32, 34), z = rand(10, 34);
    const rq = riverQuery(x, z);
    if (rq.dist < rq.width + 1) continue;
    if (isOnPath(x, z)) continue;
    place(mushKeys[i % mushKeys.length], x, z, rand(0.6, 1.0), rng() * Math.PI * 2);
  }

  for (let i = 0; i < 8; i++) {
    const x = rand(32, 46), z = rand(-22, 2);
    if (isInRiver(x, z)) continue;
    place(shellKeys[i % shellKeys.length], x, z, rand(0.5, 0.9), rng() * Math.PI * 2);
  }
  for (let i = 0; i < 4; i++) {
    const x = rand(34, 44), z = rand(-20, 0);
    if (isInRiver(x, z)) continue;
    place(palmKeys[i % palmKeys.length], x, z, rand(0.8, 1.2), rng() * Math.PI * 2);
  }

  const stumpSpots = [[22, 20], [26, 26], [-24, 20], [-18, 24], [30, 24]];
  for (const [sx, sz] of stumpSpots) {
    const ox = sx + rand(-2, 2), oz = sz + rand(-2, 2);
    place("stump", ox, oz, rand(0.7, 1.0), rng() * Math.PI * 2);
  }

  place("hollowTrunk", -28, 18, 0.9, rand(0, Math.PI * 2));

  scene.add(group);
  return group;
}

/* ═══════════════════════════════════════════
   buildBridge — log bridge crossing the river
   ═══════════════════════════════════════════ */

export function buildBridge(lib) {
  const group = new THREE.Group();
  group.name = "bridge";
  const bz = 8;
  const deckY = WATER_Y + 0.35;

  /*  Bridge runs along X at z=8.  All pieces use rotation.y = π/2.
      Model defaults: ramp descends toward local -Z, railing on local -X.
      After π/2 rotation: ramp → west (-X), railing → north (+Z).
      scale.x flips railing side:  +1 = north,  -1 = south
      scale.z flips ramp direction: +1 = west (left end), -1 = east (right end) */

  const xs = [-4, -2, 0, 2, 4];
  for (let i = 0; i < xs.length; i++) {
    const isEnd = i === 0 || i === xs.length - 1;
    const isRightEnd = i === xs.length - 1;

    /* main plank — only end pieces have a ramp to flip */
    const tmpl = isEnd ? lib.bridgeEnd : lib.bridgeMid;
    if (tmpl) {
      const m = tmpl.clone();
      m.scale.setScalar(TILE_S);
      m.position.set(xs[i], deckY, bz);
      m.rotation.y = isRightEnd ? -Math.PI / 2 : Math.PI / 2;
      group.add(m);
    }

    /* edge railings — scale.x for side, scale.z for ramp direction */
    const eTmpl = isEnd ? lib.bridgeEndE : lib.bridgeMidE;
    if (eTmpl) {
      const flipZ = (isEnd && isRightEnd) ? -1 : 1;
      for (const side of [1, -1]) {
        const e = eTmpl.clone();
        e.scale.set(side * TILE_S, TILE_S, flipZ * TILE_S);
        e.position.set(xs[i], deckY, bz + side * TILE_S * 0.5);
        e.rotation.y = Math.PI / 2;
        group.add(e);
      }
    }
  }

  /* support posts at each end */
  const endXs = [xs[0], xs[xs.length - 1]];
  for (let ei = 0; ei < endXs.length; ei++) {
    const px = endXs[ei];
    const flipZ = ei === 1 ? -1 : 1;
    for (const side of [1, -1]) {
      if (lib.bridgePost) {
        const p = lib.bridgePost.clone();
        p.scale.set(side * TILE_S, TILE_S, flipZ * TILE_S);
        p.position.set(px, WATER_Y - 0.3, bz + side * TILE_S * 0.4);
        p.rotation.y = Math.PI / 2;
        group.add(p);
      }
      if (lib.bridgePostT) {
        const pt = lib.bridgePostT.clone();
        pt.scale.set(side * TILE_S, TILE_S, flipZ * TILE_S);
        pt.position.set(px, deckY, bz + side * TILE_S * 0.4);
        pt.rotation.y = Math.PI / 2;
        group.add(pt);
      }
    }
  }

  /* invisible walkable deck */
  const span = (xs[xs.length - 1] - xs[0]) + TILE_S;
  const cx = (xs[0] + xs[xs.length - 1]) / 2;
  const deckGeo = new THREE.BoxGeometry(span + 3, 0.4, TILE_S * 2.5);
  const deckMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.set(cx, deckY + 0.1, bz);
  deck.name = "bridge_deck";
  group.add(deck);

  group.renderOrder = R_DECOR;
  group.traverse(o => { if (o.isMesh) o.renderOrder = R_DECOR; });
  return group;
}

/* ═══════════════════════════════════════════
   buildDock — wooden dock on the beach
   ═══════════════════════════════════════════ */

export function buildDock(lib) {
  const group = new THREE.Group();
  group.name = "dock";
  const dx = 40, dz = 4, count = 4;
  const deckY = WATER_Y + 0.15;

  /* entry steps at shore end — faces from shore out to water */
  if (lib.dockSteps) {
    const st = lib.dockSteps.clone();
    st.scale.setScalar(TILE_S);
    st.position.set(dx - TILE_S, deckY, dz);
    st.rotation.y = Math.PI / 2;
    group.add(st);
  }

  /* straight sections — planks sit low, supports extend above */
  for (let i = 0; i < count; i++) {
    if (lib.dockStr) {
      const m = lib.dockStr.clone();
      m.scale.setScalar(TILE_S);
      m.position.set(dx + i * TILE_S, deckY, dz);
      m.rotation.y = Math.PI / 2;
      group.add(m);
    }
    /* supports placed at deck level — model geometry extends above and below */
    if (lib.dockStrSup) {
      for (const rot of [Math.PI / 2, -Math.PI / 2]) {
        const s = lib.dockStrSup.clone();
        s.scale.setScalar(TILE_S);
        s.position.set(dx + i * TILE_S, deckY, dz);
        s.rotation.y = rot;
        group.add(s);
      }
    }
  }

  /* invisible walkable deck — at plank surface level */
  const deckTop = deckY + 0.1;
  const dockDeckMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const fullLen = count * TILE_S + 2;
  const deckGeo = new THREE.BoxGeometry(fullLen, 0.4, TILE_S * 2.5);
  const deck = new THREE.Mesh(deckGeo, dockDeckMat);
  deck.position.set(dx + count * TILE_S * 0.5, deckTop, dz);
  deck.name = "dock_deck";
  group.add(deck);

  /* invisible walkable ramp for stairs */
  const stairLen = TILE_S * 3;
  const stairGeo = new THREE.BoxGeometry(stairLen, 0.4, TILE_S * 2.5);
  const stairDeck = new THREE.Mesh(stairGeo, dockDeckMat.clone());
  const shoreY = getMeshSurfaceY(dx - TILE_S * 2, dz);
  stairDeck.position.set(dx - TILE_S, (shoreY + deckTop) / 2, dz);
  stairDeck.rotation.z = Math.atan2(deckTop - shoreY, stairLen);
  stairDeck.name = "dock_deck";
  group.add(stairDeck);

  group.renderOrder = R_DECOR;
  /* renderOrder on a Group does NOT propagate to child Meshes in Three.js —
     you have to set it on every renderable. Without this, dock planks/supports
     render at default 0 (before water at order 2), so water + foam paints
     over them. */
  group.traverse(o => { if (o.isMesh) o.renderOrder = R_DECOR; });
  return group;
}

/* ═══════════════════════════════════════════
   buildFences — wooden fences along paths
   ═══════════════════════════════════════════ */

export function buildFences(lib) {
  const group = new THREE.Group();
  group.name = "fences";
  const boardTmpl = lib.fenceBoard1 || lib.fenceBoard2;
  const postTmpl  = lib.fencePost1 || lib.fencePost2;
  if (!boardTmpl) return group;

  /* fence runs — none currently */
  const runs = [
  ];

  for (const run of runs) {
    for (let i = 0; i < run.length - 1; i++) {
      const [ax, az] = run[i], [bx, bz] = run[i + 1];
      const dx = bx - ax, dz = bz - az;
      const segLen = Math.hypot(dx, dz);
      const steps = Math.max(1, Math.round(segLen / TILE_S));
      const rot = Math.atan2(dx, dz);

      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const x = ax + dx * t, z = az + dz * t;
        const y = getMeshSurfaceY(x, z);

        /* board at this position, extending forward one tile */
        const b = boardTmpl.clone();
        b.scale.setScalar(TILE_S);
        b.position.set(x, y, z);
        b.rotation.y = rot + Math.PI / 2;
        group.add(b);

        /* post at same position */
        if (postTmpl) {
          const p = postTmpl.clone();
          p.scale.setScalar(TILE_S);
          p.position.set(x, y, z);
          p.rotation.y = rot + Math.PI / 2;
          group.add(p);
        }
      }
      /* final post at end of segment */
      if (postTmpl && i === run.length - 2) {
        const p = postTmpl.clone();
        p.scale.setScalar(TILE_S);
        p.position.set(bx, getMeshSurfaceY(bx, bz), bz);
        p.rotation.y = rot + Math.PI / 2;
        group.add(p);
      }
    }
  }

  group.renderOrder = R_DECOR;
  group.traverse(o => { if (o.isMesh) o.renderOrder = R_DECOR; });
  return group;
}

/* ═══════════════════════════════════════════
   buildSteppingStones — gray stones in the river
   ═══════════════════════════════════════════ */

export function buildSteppingStones() {
  const group = new THREE.Group();
  group.name = "stepping_stones";
  const geo = new THREE.CylinderGeometry(0.55, 0.65, 0.25, 8);
  const mat = tMat("#8a8a82");
  for (const [x, z] of [[0,20],[-1,18],[1,16],[4,-1],[8,-4],[12,-7]]) {
    const s = new THREE.Mesh(geo, mat);
    s.position.set(x, WATER_Y - 0.05, z);
    s.rotation.y = Math.random() * Math.PI;
    s.renderOrder = R_WATER + 1;
    group.add(s);
  }
  return group;
}

/* ═══════════════════════════════════════════
   addWaterfall — cascading from north cliff
   ═══════════════════════════════════════════ */

export function addWaterfall(scene, waterUniforms) {
  const cx = 0, topZ = 40.9, endZ = 34.4;
  const topY = terrainH(cx, 40) + 4.8, botY = WATER_Y + 0.16;
  const midZ = (topZ + endZ) / 2, midY = topY * 0.58 + botY * 0.42;

  const makeMat = (phase, alpha = 1) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: waterUniforms.uTime, uPhase: { value: phase }, uAlpha: { value: alpha } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime,uPhase,uAlpha;
      void main(){
        float t=fract(vUv.y*2.2-uTime*0.45+uPhase);
        float streak=smoothstep(0.0,0.24,t)*smoothstep(1.0,0.62,t);
        float edge=smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x);
        vec3 col=mix(vec3(0.62,0.86,0.97),vec3(0.80,0.95,1.0),streak*0.65);
        float a=edge*(0.26+streak*0.48)*uAlpha;
        gl_FragColor=vec4(col,clamp(a,0.0,0.85)); }`,
  });

  const addRibbon = (rx, w, phase, alpha = 1) => {
    const pts = [[rx, topY, topZ], [rx, midY, midZ], [rx, botY, endZ]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
      const len = Math.hypot(y1 - y0, z1 - z0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len, 1, 12), makeMat(phase + i * 0.17, alpha));
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, y1 - y0, z1 - z0).normalize());
      m.renderOrder = R_DECOR + 1;
      scene.add(m);
    }
  };
  addRibbon(cx, 3.6, 0, 1);
  addRibbon(cx - 1.05, 1.4, 0.22, 0.7);
  addRibbon(cx + 1.05, 1.4, 0.41, 0.7);

  const lip = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.9), tMat("#8a8f92"));
  lip.position.set(cx, topY + 0.02, topZ + 0.2);
  lip.renderOrder = R_DECOR;
  scene.add(lip);

  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(2.25, 20),
    new THREE.MeshBasicMaterial({ color: "#dff6ff", transparent: true, opacity: 0.42, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(cx, WATER_Y + 0.03, endZ + 0.15);
  foam.renderOrder = R_FOAM;
  scene.add(foam);
}

/* ═══════════════════════════════════════════
   Placement data for world.js
   ═══════════════════════════════════════════ */

export const TREE_SPOTS = [
  [20,18,2.2,1.8],[28,28,2.4,3.6],[18,28,2.1,0.9],[32,20,1.9,2.4],[24,32,2.3,4.2],
  [-22,18,2.0,1.0],[-30,24,1.9,5.2],[-20,26,2.2,4.5],[-16,-18,1.7,2.1],[14,-18,1.6,0.7],[-8,-42,2.4,3.3],
  /* more natural spread */
  [10,30,1.8,0.5],[-10,22,2.0,3.1],[36,28,1.7,4.4],[-34,16,1.9,1.6],[-26,8,1.8,5.7],
  [6,24,1.6,2.3],[-6,16,1.7,0.2],[16,10,1.5,4.0],[-12,32,2.1,2.9],[26,14,1.8,5.1],
  [-28,-8,1.6,3.7],[22,-8,1.5,1.3],[-4,28,1.9,4.6],[30,8,1.7,0.8],[-18,4,1.6,2.5],
];
export const ROCK_MAJOR_SPOTS = [
  [-28,26,1.6,1.4],[-14,8,1.45,2.1],[-20,-6,1.4,0.9],
];
export const ROCK_SMALL_SPOTS = [
  [22,34,1.04,3.2],[-26,30,1.0,4.1],[34,22,0.98,5.0],[-32,18,0.95,2.6],
  [-10,14,0.95,1.7],[-16,10,1.0,5.3],[8,20,0.9,0.5],[14,12,1.05,3.9],
  [-22,-2,0.92,2.4],[-18,-10,0.98,4.6],[6,8,0.88,1.2],[-8,4,1.02,3.5],
  [12,24,0.96,5.8],[-24,16,0.94,0.3],
];
export const BUSH_SPOTS = [
  [-12,-28,1.1,0.4],[12,-28,1.12,2.8],[20,-10,1.1,1.9],[-18,-12,1.08,5.0],[8,-38,1.0,3.8],
];
export const CLIFF_ROCK_SPOTS = [
  [-38,38,4.2,0],[0,42,3.8,1.6],[38,38,4.5,3.1],[-36,40,4.0,4.7],[36,40,3.6,0.8],
  [-42,20,4.1,2.3],[-42,4,3.9,5.5],[-42,-12,4.4,3.9],[-42,-28,3.5,1.2],
  [0,-40,4.3,4.1],[-18,-40,3.7,2.8],[18,-40,4.0,5.8],[-34,-38,4.6,0.4],[28,-38,3.8,3.5],
];
export const FISHING_SPOT_POSITIONS = [
  { x:-4, z:14, phase:0 },{ x:4, z:4, phase:1.2 },{ x:8, z:-4, phase:2.4 },
];

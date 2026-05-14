/* Mainland continent definition.

   This is the SOLE source of truth for the new mainland's geometry, river,
   biome zones, and plaza zones. The bake script feeds these to procgen
   helpers to produce chunk JSONs and the runtime imports it for height/
   biome queries.

   World convention (matches terrainHeight.js):
     North = +z, East = +x, world units = 1u.
     CHUNK_SIZE = 100, TILE_S = 2, GRASS_Y = 0.40, WATER_Y = 0.00.

   Coordinates are WORLD coords (not chunk-local). Center of continent is
   at world (0, 0). Bounds: roughly x ∈ [-880, 700], z ∈ [-620, 620].
*/

import { mulberry32, hash32, createNoise, chaikinSmooth } from '../procgen/procgen_island.mjs';

/* ─── Continent silhouette ─────────────────────────────────────────────────
   COAST_RAW is auto-generated from the LIVE deployed mainland's
   shoreline (docs/shoreline_chains.json) — union of its two main
   land bodies, dilated to bridge the river gap, then traced + simplified.
   To regenerate: `node docs/tools/align_from_live.mjs`
   This keeps the new continent's silhouette anchored to what's already
   live so the rebuild "feels familiar" while everything else changes. */
export { COAST_RAW, COAST_BBOX, OASES, OFFSHORE_ISLETS } from './mainland_coast_from_live.mjs';
import { COAST_RAW as _COAST_RAW, COAST_BBOX as _COAST_BBOX, OASES as _OASES, OFFSHORE_ISLETS as _OFFSHORE_ISLETS } from './mainland_coast_from_live.mjs';

/* ─── River polyline ───────────────────────────────────────────────────────
   The river enters the continent on the NE coast, curves SW through the
   highland and central plains, expands into a lake at (50, 50), then
   continues SE and exits on the SE coast. Catmull-Rom interpolated at bake
   time for a smooth curve. */
export const RIVER_POLYLINE = [
  /* River runs N→S through the body, MEANDERING along the same path the
     live mainland's river takes (between live chain 0 and chain 1). The
     dilation that closed the gap when generating the polygon is what
     this river's depression re-opens visually. */
  [   30,  500],   /* enters N coast, just east of N peninsula */
  [   24,  400],
  [  -31,  300],
  [  -53,  200],
  [  -52,  100],
  [ -100,   50],   /* lake bulge here */
  [ -117,    0],
  [ -150,  -50],
  [ -198, -100],
  [ -135, -150],
  [  -75, -200],
  [   -2, -300],
  [  -10, -400],   /* exits S coast */
];

export const RIVER_WIDTH = 25;      /* half-width — total channel ~50u, matches live mainland gap */
export const RIVER_DEPTH = 1.4;
export const RIVER_BANK_RAMP = 8;

/* ─── Lake (single, along the river) ──────────────────────────────────────
   Oval depression. Carved as a separate feature so river+lake combine into
   one connected water body where they overlap. */
export const LAKE = {
  cx: -100, cz: 50,         /* on the river meander, above center */
  rx: 130, rz: 80,
  depth: 2.0,
  edgeIrregularity: 0.10,
  edgeFreq: 0.04,
};

/* ─── Reference points ─────────────────────────────────────────────────────
   Plain (x, z) coords used by world.js to place buildings/spawn. NOT
   flat-zone height overrides — buildings sit on natural procgen terrain. */
/* Village on the EAST side of the river (live mainland's east body has the
   village), near the lake bend. Dock on SE coast where savanna meets sea. */
export const VILLAGE_CENTER = { x:  80, z:  60 };
export const DOCK_POINT     = { x: 280, z: -260 };
export const SPAWN_POINT    = { x:  80, z:  60 };

/* ─── Biome zones ──────────────────────────────────────────────────────────
   Each zone has a center, falloff radius, and palette. biomeAt(wx, wz)
   blends the four palettes by inverse-distance weight, producing smooth
   borders. The zone with strongest weight at a position determines its
   primary biome (used for prop selection). */

const PALETTE_TAIGA = {
  name: 'taiga',
  sand:  [0.700, 0.720, 0.740],
  grass: [0.740, 0.760, 0.780],   /* slightly cooler snow */
  hill:  [0.620, 0.640, 0.680],
  peak:  [0.880, 0.900, 0.920],
  beachWidth: 5,
  /* Snowy conifers + ice props */
  props: [
    'Pine_Tree_Snow', 'Pine_Tree_Snow', 'Pine_Tree_Snow',
    'Birch_Tree_Snow', 'Birch_Tree_Dead_Snow',
    'Ice_Pine', 'Ice_Oak',
    'Frost_Bush', 'Berry_Bush',
    'Rock_3_A', 'Rock_3_C', 'Rock_3_E',
    'Ice_Block', 'Crystal_1',
    'Glacial_Rock',
  ],
  rareProps: [
    'Ice_Spire', 'Snowdrift_Cairn', 'Petrified_Tree',
    'Rocks_Ore_Silver', 'Rocks_Ore_Moonstone',
  ],
};

const PALETTE_PLAINS = {
  name: 'plains',
  sand:  [0.860, 0.770, 0.560],
  grass: [0.150, 0.420, 0.140],   /* deep forest green */
  hill:  [0.220, 0.380, 0.160],
  peak:  [0.480, 0.440, 0.320],
  beachWidth: 8,
  props: [
    'Toon_Oak', 'Toon_Oak', 'Toon_Willow',
    'Birch_Tree', 'Autumn_Tree',
    'Prop_Tree_Oak_1', 'Prop_Tree_Oak_2',
    'Prop_Stump', 'Prop_Hollow_Trunk',
    'Berry_Bush', 'Bush', 'Prop_Bush_1', 'Prop_Bush_2',
    'Rock_3_A', 'Rock_3_C', 'Rock_3_E', 'Rock_3_G',
    'Rock_1_A', 'Rock_2_A',
    'Mossy_Rock',
  ],
  rareProps: [
    'Mossy_Log', 'Wildflower_Patch',
    'Rocks_Ore_Tin', 'Rocks_Ore_Copper',
  ],
};

const PALETTE_MISTWOOD = {
  name: 'mistwood',
  sand:  [0.660, 0.620, 0.480],
  grass: [0.180, 0.480, 0.240],   /* deep moss/oak green */
  hill:  [0.220, 0.420, 0.200],
  peak:  [0.520, 0.560, 0.500],
  beachWidth: 7,
  props: [
    'Toon_Pine', 'Toon_Pine', 'Toon_Willow',
    'Mushroom_Tree', 'Giant_Toadstool',
    'Spore_Pod', 'Crystal_Bloom',
    'Mossy_Log', 'Prop_Hollow_Trunk',
    'Bush', 'Berry_Bush', 'Prop_Bush_2', 'Prop_Bush_3',
    'Rock_3_A', 'Rock_3_C', 'Rock_3_E',
    'Mossy_Rock', 'Spore_Rock',
  ],
  rareProps: [
    'Roots', 'Tree_Spiral_1',
    'Rocks_Ore_Jade', 'Rocks_Ore_Opal',
  ],
};

const PALETTE_SAVANNA = {
  name: 'savanna',
  sand:  [0.780, 0.700, 0.500],
  grass: [0.580, 0.520, 0.260],   /* drier mustard-tan */
  hill:  [0.520, 0.420, 0.260],
  peak:  [0.580, 0.500, 0.400],
  beachWidth: 7,
  props: [
    'Cactus', 'Cactus_Flowers', 'Desert_Yucca',
    'Toon_Willow',                    /* lone savanna tree */
    'Prop_Stump', 'Prop_Branch_1', 'Prop_Branch_2',
    'Bush', 'Prop_Bush_1',
    'Rock_3_A', 'Rock_3_C', 'Rock_3_G',
    'Rock_2_A', 'Rock_4',
    'Sandstone_Pillar',
    'Bone_Skull',
  ],
  rareProps: [
    'Sandstone_Arch',
    'Rocks_Ore_Copper', 'Rocks_Ore_Sunstone',
  ],
};

const PALETTE_STONE = {
  name: 'stone',
  sand:  [0.580, 0.580, 0.560],
  grass: [0.380, 0.400, 0.400],   /* deeper slate */
  hill:  [0.300, 0.320, 0.340],
  peak:  [0.660, 0.680, 0.700],
  beachWidth: 4,
  props: [
    /* Heavy on rocks — stone biome is exposed bedrock */
    'Rock_3_A', 'Rock_3_A', 'Rock_3_C', 'Rock_3_C', 'Rock_3_E', 'Rock_3_G',
    'Rock_1_A', 'Rock_2_A', 'Rock_4',
    'Prop_Cliff_Rock_1', 'Prop_Cliff_Rock_2',
    'Mossy_Rock', 'Glacial_Rock',
    'Prop_Stump', 'Prop_Hollow_Trunk',
    'Bush',
    'Crystal_1', 'Crystal_2',
  ],
  rareProps: [
    'Sandstone_Pillar',
    'Rocks_Ore_Tin', 'Rocks_Ore_Copper', 'Rocks_Ore_Silver',
    'Rocks_Ore_Cobalt', 'Rocks_Ore_Titanium',
    'Crystal_3', 'Crystal_Bloom',
  ],
};

const PALETTE_DIRT = {
  name: 'dirt',
  sand:  [0.660, 0.560, 0.420],
  grass: [0.400, 0.300, 0.180],   /* rich earth brown */
  hill:  [0.340, 0.260, 0.180],
  peak:  [0.480, 0.400, 0.300],
  beachWidth: 6,
  props: [
    /* Sparse — dirt is a barren transitional biome */
    'Prop_Stump', 'Prop_Stump',
    'Prop_Hollow_Trunk',
    'Prop_Branch_1', 'Prop_Branch_2', 'Prop_Branch_3',
    'Bush', 'Prop_Bush_1',
    'Rock_3_A', 'Rock_3_C',
    'Rock_1_A',
    'Mossy_Log',
  ],
  rareProps: [
    'Roots',
    'Rocks_Ore_Tin', 'Rocks_Ore_Copper',
    'Wildflower_Patch',
  ],
};

/* Biome zones — each is a Voronoi-ish point with a palette. biomeAt picks
   the zone whose distance-weighted score is highest. Non-circular shapes
   are achieved by placing multiple anchor points per zone. */
/* ─── Height anchors ─────────────────────────────────────────────────────
   Same shape as BIOME_ZONES but contribute elevation. Sum of contributions
   from all anchors gives the height delta at (wx, wz). Positive = hill,
   negative = depression (lake bowl). Falloff: smooth 4th-power. */
export const HEIGHT_ANCHORS = [];

/* Smooth height contribution at (wx, wz). Returns elevation DELTA above
   GRASS_Y (positive=hill, negative=below ground/lake). */
export function heightAt(wx, wz) {
  let h = 0;
  for (let i = 0; i < HEIGHT_ANCHORS.length; i++) {
    const A = HEIGHT_ANCHORS[i];
    const dx = wx - A.cx, dz = wz - A.cz;
    const d2 = dx * dx + dz * dz;
    const r = A.radius || 200;
    const dn2 = d2 / (r * r);
    const dn4 = dn2 * dn2;
    const w = A.w / (1 + dn4);
    h += w * A.height;
  }
  return h;
}

/* Biome zones with explicit RADIUS so each biome's reach is independent of
   its weight. Falloff: weight / (1 + (d/radius)^3). Tweak via mainland_editor.html. */
export const BIOME_ZONES = [
  { palette: PALETTE_SAVANNA,  cx:  -110, cz:    40, w: 1.00, radius: 110 },
  { palette: PALETTE_TAIGA,    cx:   273, cz:   513, w: 1.00, radius: 220 },
  { palette: PALETTE_SAVANNA,  cx:    29, cz:  -458, w: 1.00, radius: 160 },
  { palette: PALETTE_STONE,    cx:   290, cz:    66, w: 1.00, radius: 110 },
  { palette: PALETTE_PLAINS,   cx:    81, cz:  -164, w: 1.00, radius:  40 },
  { palette: PALETTE_SAVANNA,  cx:  -359, cz:   594, w: 1.00, radius: 270 },
  { palette: PALETTE_DIRT,     cx:  -448, cz:    60, w: 1.00, radius: 130 },
  { palette: PALETTE_PLAINS,   cx:   139, cz:   181, w: 1.00, radius:  60 },
  { palette: PALETTE_PLAINS,   cx:   -96, cz:   208, w: 1.00, radius:  40 },
  { palette: PALETTE_PLAINS,   cx:    -4, cz:   216, w: 1.00, radius:  40 },
  { palette: PALETTE_SAVANNA,  cx:  -535, cz:   297, w: 1.00, radius:  70 },
  { palette: PALETTE_DIRT,     cx:   266, cz:  -169, w: 1.00, radius:  60 },
  { palette: PALETTE_MISTWOOD, cx:   379, cz:  -207, w: 1.00, radius:  90 },
  { palette: PALETTE_MISTWOOD, cx:  -273, cz:  -219, w: 1.00, radius: 130 },
  { palette: PALETTE_PLAINS,   cx:   -31, cz:   -69, w: 1.00, radius:  40 },
  { palette: PALETTE_PLAINS,   cx:    58, cz:   -82, w: 1.00, radius:  40 },
  { palette: PALETTE_PLAINS,   cx:   139, cz:    57, w: 1.00, radius:  40 },
  { palette: PALETTE_PLAINS,   cx:   140, cz:    96, w: 1.00, radius:  40 },
  { palette: PALETTE_PLAINS,   cx:   133, cz:   -84, w: 1.00, radius:  40 },
  { palette: PALETTE_PLAINS,   cx:   149, cz:   -39, w: 1.00, radius:  60 },
  { palette: PALETTE_DIRT,     cx:   -30, cz:  -115, w: 1.00, radius:  40 },
];

/* Palettes are still exported for the brush to use. */
export const MAINLAND_PALETTES = {
  taiga: PALETTE_TAIGA,
  stone: PALETTE_STONE,
  mistwood: PALETTE_MISTWOOD,
  plains: PALETTE_PLAINS,
  dirt: PALETTE_DIRT,
  savanna: PALETTE_SAVANNA,
};

/* ─── Biome paint grid ─────────────────────────────────────────────────────
   Cell-based biome map. Editor paints cells under the brush; biomeAt does
   bilinear blends across 4 corner cells for smooth boundaries. Way easier
   to author than overlapping anchors.

   Grid covers x∈[xMin,xMax], z∈[zMin,zMax] at GRID_CELL u/cell. Each cell
   stores a biome ID (0..5) or 255 (unpainted/neutral). */
const BIOME_ID = { taiga: 0, stone: 1, mistwood: 2, plains: 3, dirt: 4, savanna: 5 };
const BIOME_BY_ID = ['taiga', 'stone', 'mistwood', 'plains', 'dirt', 'savanna'];
export const GRID_CELL = 16;                       /* world units per cell */
export const GRID_BBOX = { xMin: -700, xMax: 700, zMin: -640, zMax: 700 };
export const GRID_W = Math.ceil((GRID_BBOX.xMax - GRID_BBOX.xMin) / GRID_CELL);
export const GRID_H = Math.ceil((GRID_BBOX.zMax - GRID_BBOX.zMin) / GRID_CELL);
/* Live grid; runtime can mutate (editor) or preload. 255 = unpainted. */
export const BIOME_GRID = new Uint8Array(GRID_W * GRID_H).fill(255);
export const BIOME_ID_MAP = BIOME_ID;
export const BIOME_BY_ID_LIST = BIOME_BY_ID;

/* (No painted grid loaded — biomeAt falls back to BIOME_ZONES anchors.) */

/* Cell sampling. Returns biome id at integer cell (gx, gz), or 255 if out
   of bounds / unpainted. */
function _gridGet(gx, gz) {
  if (gx < 0 || gz < 0 || gx >= GRID_W || gz >= GRID_H) return 255;
  return BIOME_GRID[gz * GRID_W + gx];
}
function _palByID(id) {
  if (id === 255) return null;
  const name = BIOME_BY_ID[id];
  return MAINLAND_PALETTES[name] || null;
}

/* Replace any existing grid (used by editor/import). Tolerant of small
   length mismatches: pads with 255 (unpainted) or truncates. */
export function loadBiomeGrid(arr) {
  if (!arr) return false;
  BIOME_GRID.fill(255);
  const n = Math.min(arr.length, BIOME_GRID.length);
  for (let i = 0; i < n; i++) BIOME_GRID[i] = arr[i];
  if (arr.length !== BIOME_GRID.length) {
    console.warn('biome grid length:', arr.length, 'expected', BIOME_GRID.length, '— padded/truncated');
  }
  return true;
}

/* Editor helper: paint cells whose centers fall within `radius` u of (wx, wz)
   to biome id. Returns count painted. */
export function paintGridCircle(wx, wz, radius, biomeIdOrName) {
  const id = typeof biomeIdOrName === 'string' ? BIOME_ID[biomeIdOrName] : biomeIdOrName;
  if (id === undefined || id < 0) return 0;
  const ix0 = Math.max(0, Math.floor((wx - radius - GRID_BBOX.xMin) / GRID_CELL));
  const ix1 = Math.min(GRID_W - 1, Math.ceil((wx + radius - GRID_BBOX.xMin) / GRID_CELL));
  const iz0 = Math.max(0, Math.floor((wz - radius - GRID_BBOX.zMin) / GRID_CELL));
  const iz1 = Math.min(GRID_H - 1, Math.ceil((wz + radius - GRID_BBOX.zMin) / GRID_CELL));
  const r2 = radius * radius;
  let n = 0;
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const cx = GRID_BBOX.xMin + (ix + 0.5) * GRID_CELL;
      const cz = GRID_BBOX.zMin + (iz + 0.5) * GRID_CELL;
      const dx = cx - wx, dz = cz - wz;
      if (dx * dx + dz * dz <= r2) {
        BIOME_GRID[iz * GRID_W + ix] = id;
        n++;
      }
    }
  }
  return n;
}

/* ─── Helpers (smoothing, queries) ─────────────────────────────────────────*/

/* Catmull-Rom interpolated point along a polyline at parameter t∈[0,1]. */
function _catmullRomAt(pts, t) {
  const n = pts.length;
  const segs = n - 1;
  const f = t * segs;
  const i = Math.min(segs - 1, Math.floor(f));
  const u = f - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(n - 1, i + 2)];
  const u2 = u * u, u3 = u2 * u;
  const x = 0.5 * ((2 * p1[0]) +
    (-p0[0] + p2[0]) * u +
    (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 +
    (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3);
  const z = 0.5 * ((2 * p1[1]) +
    (-p0[1] + p2[1]) * u +
    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 +
    (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
  return [x, z];
}

/* Densify a coarse polyline via Catmull-Rom into a smooth curve. */
export function smoothPolyline(pts, samplesPerSeg = 8) {
  const out = [];
  const total = (pts.length - 1) * samplesPerSeg;
  for (let i = 0; i <= total; i++) {
    out.push(_catmullRomAt(pts, i / total));
  }
  return out;
}

/* Build the smoothed coast polygon as a flat [x,z,x,z,...] array suitable
   for procgen helpers (toShorelineChain, _buildSignedDistanceField).
   `passes` defaults to 3; editor uses 2 for speed. */
export function buildCoastPolygon(passes = 3) {
  const flat = [];
  for (let i = 0; i < _COAST_RAW.length; i++) {
    flat.push(_COAST_RAW[i][0], _COAST_RAW[i][1]);
  }
  return chaikinSmooth(flat, passes, true);
}

/* Build the smoothed river polyline (open curve, NOT closed). */
export function buildRiverPolyline(samplesPerSeg = 6) {
  return smoothPolyline(RIVER_POLYLINE, samplesPerSeg);
}

/* Distance from (px, pz) to nearest segment of the river polyline. Returns
   the perpendicular distance in world units. Uses linear segments of the
   already-smoothed polyline. */
export function riverDistance(px, pz, polyline = null) {
  const pts = polyline || buildRiverPolyline();
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-10) continue;
    let t = ((px - ax) * dx + (pz - az) * dz) / len2;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const ex = px - (ax + t * dx);
    const ez = pz - (az + t * dz);
    const d2 = ex * ex + ez * ez;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

/* Lake distance: SDF for the lake oval (with edge irregularity). Returns
   normalized distance — negative inside, positive outside. */
const _lakeNoise = createNoise(hash32(0xCAFEBABE, 0x1A1E5));
export function lakeSignedDist(px, pz) {
  const dx = px - LAKE.cx, dz = pz - LAKE.cz;
  const nx = dx / LAKE.rx, nz = dz / LAKE.rz;
  const r2 = nx * nx + nz * nz;
  /* Convert normalized r² to world-distance-ish via gradient mag */
  const r = Math.sqrt(r2);
  /* Edge perturbation (noise on the angle around the lake) */
  const en = _lakeNoise.fbm2(dx * LAKE.edgeFreq, dz * LAKE.edgeFreq, 3);
  const rEff = r - en * LAKE.edgeIrregularity;
  /* Convert back to approx world distance: gradient |∇| ≈ avg(rx, rz)⁻¹ */
  const avgR = (LAKE.rx + LAKE.rz) * 0.5;
  return (rEff - 1) * avgR;
}

/* Neutral fallback palette used when a position is far from every anchor
   (or when there are no anchors at all). */
const _NEUTRAL = {
  name: 'neutral',
  sand:  [0.55, 0.55, 0.55],
  grass: [0.55, 0.55, 0.55],
  hill:  [0.50, 0.50, 0.50],
  peak:  [0.65, 0.65, 0.65],
  beachWidth: 5,
};
const _NEUTRAL_RESULT = {
  name: 'neutral', palette: _NEUTRAL,
  grass: _NEUTRAL.grass, sand: _NEUTRAL.sand,
  hill: _NEUTRAL.hill, peak: _NEUTRAL.peak,
  beachWidth: _NEUTRAL.beachWidth,
};

/* GRID-BASED biome lookup with bilinear palette blend.
   Returns the same shape as biomeAt, OR null if all 4 corners are
   unpainted (signals fallback to anchor system). */
export function biomeAtGrid(px, pz) {
  const fx = (px - GRID_BBOX.xMin) / GRID_CELL - 0.5;
  const fz = (pz - GRID_BBOX.zMin) / GRID_CELL - 0.5;
  const ix0 = Math.floor(fx), iz0 = Math.floor(fz);
  const ix1 = ix0 + 1, iz1 = iz0 + 1;
  const tx = Math.max(0, Math.min(1, fx - ix0));
  const tz = Math.max(0, Math.min(1, fz - iz0));
  const w00 = (1 - tx) * (1 - tz);
  const w10 = tx * (1 - tz);
  const w01 = (1 - tx) * tz;
  const w11 = tx * tz;
  const ids = [_gridGet(ix0, iz0), _gridGet(ix1, iz0), _gridGet(ix0, iz1), _gridGet(ix1, iz1)];
  const ws = [w00, w10, w01, w11];
  let totalW = 0;
  let R = 0, G = 0, B = 0;
  let sR = 0, sG = 0, sB = 0;
  let hR = 0, hG = 0, hB = 0;
  let pR = 0, pG = 0, pB = 0;
  let beachW = 0;
  let dominantPal = _NEUTRAL, dominantW = 0;
  for (let k = 0; k < 4; k++) {
    const pal = _palByID(ids[k]);
    if (!pal) continue;
    const w = ws[k];
    if (w <= 0) continue;
    totalW += w;
    R += pal.grass[0] * w; G += pal.grass[1] * w; B += pal.grass[2] * w;
    sR += pal.sand[0] * w; sG += pal.sand[1] * w; sB += pal.sand[2] * w;
    hR += pal.hill[0] * w; hG += pal.hill[1] * w; hB += pal.hill[2] * w;
    pR += pal.peak[0] * w; pG += pal.peak[1] * w; pB += pal.peak[2] * w;
    beachW += pal.beachWidth * w;
    if (w > dominantW) { dominantW = w; dominantPal = pal; }
  }
  if (totalW < 0.05) return null;
  const inv = 1 / totalW;
  return {
    name: dominantPal.name,
    palette: dominantPal,
    grass: [R * inv, G * inv, B * inv],
    sand:  [sR * inv, sG * inv, sB * inv],
    hill:  [hR * inv, hG * inv, hB * inv],
    peak:  [pR * inv, pG * inv, pB * inv],
    beachWidth: beachW * inv,
  };
}

/* Biome lookup. SHARP-DOMINANT: pure dominant biome inside radius; thin
   blend at borders with second-place neighbour. Returns neutral grey for
   positions far from every anchor (so unpainted areas stay obviously
   unpainted instead of one biome flooding the entire map). */
export function biomeAt(px, pz) {
  /* Grid takes precedence — if any cell is painted near here, use it. */
  const g = biomeAtGrid(px, pz);
  if (g) return g;
  /* Anchor fallback. Returns nearest anchor's palette even when "far" so
     callers (minimap raster, in-game ground paint) never read NEUTRAL —
     that was the source of "ugly green bars" at the boundaries. */
  if (BIOME_ZONES.length === 0) return _NEUTRAL_RESULT;
  const ws = new Array(BIOME_ZONES.length);
  let bestW = 0, bestI = 0;
  for (let i = 0; i < BIOME_ZONES.length; i++) {
    const Z = BIOME_ZONES[i];
    const dx = px - Z.cx, dz = pz - Z.cz;
    const d2 = dx * dx + dz * dz;
    const r = Z.radius || 250;
    const dn2 = d2 / (r * r);
    const dn8 = dn2 * dn2 * dn2 * dn2;
    const w = Z.w / (1 + dn8);
    ws[i] = w;
    if (w > bestW) { bestW = w; bestI = i; }
  }
  /* Far from every anchor → return neutral. Threshold = 1% of full strength. */
  if (bestW < 0.01) {
    return {
      name: 'neutral', palette: _NEUTRAL,
      grass: _NEUTRAL.grass, sand: _NEUTRAL.sand,
      hill: _NEUTRAL.hill, peak: _NEUTRAL.peak,
      beachWidth: _NEUTRAL.beachWidth,
    };
  }
  const top = BIOME_ZONES[bestI];
  /* Find best zone of a DIFFERENT palette (for cross-biome edge blends).
     Same-palette anchors don't blend — they're just "stacked" influence
     of one biome region. */
  let crossW = 0, crossI = -1;
  for (let i = 0; i < BIOME_ZONES.length; i++) {
    if (BIOME_ZONES[i].palette.name === top.palette.name) continue;
    if (ws[i] > crossW) { crossW = ws[i]; crossI = i; }
  }
  if (crossI < 0 || crossW < bestW * 0.15) {
    /* Pure dominant biome — no blending. */
    return {
      name: top.palette.name,
      palette: top.palette,
      grass: top.palette.grass,
      sand:  top.palette.sand,
      hill:  top.palette.hill,
      peak:  top.palette.peak,
      beachWidth: top.palette.beachWidth,
    };
  }
  /* Edge blend with the closest different-biome neighbour. */
  const cross = BIOME_ZONES[crossI];
  const sum = bestW + crossW;
  const t = crossW / sum;             /* 0 = pure top, 0.5 = even mix at exact border */
  const lerp = (a, b) => [a[0]*(1-t)+b[0]*t, a[1]*(1-t)+b[1]*t, a[2]*(1-t)+b[2]*t];
  return {
    name: top.palette.name,
    palette: top.palette,
    grass: lerp(top.palette.grass, cross.palette.grass),
    sand:  lerp(top.palette.sand,  cross.palette.sand),
    hill:  lerp(top.palette.hill,  cross.palette.hill),
    peak:  lerp(top.palette.peak,  cross.palette.peak),
    beachWidth: top.palette.beachWidth * (1 - t) + cross.palette.beachWidth * t,
  };
}

/* ─── Continent metadata ──────────────────────────────────────────────────*/

export const CONTINENT_META = {
  /* Center of the bounding box — used by procgen helpers expecting a center.
     Continent is centered at (0, 0). */
  worldX: 0,
  worldZ: 0,
  /* World-space bounds — pulled from the auto-generated coast bbox. */
  bounds: _COAST_BBOX,
  /* Spawn point — placed at the village center. */
  spawn: { x: SPAWN_POINT.x, z: SPAWN_POINT.z },
  seed: 0xC0DECAFE,
};

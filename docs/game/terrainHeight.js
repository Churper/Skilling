import * as THREE from "three";

/* ══════════════════════════════════════════════════════════
   terrainHeight.js  –  height system for modular tile terrain

   The map is a grid of tiles.  Each tile occupies TILE_S × TILE_S
   world-units.  Heights are stored per-grid-cell and queried via
   bilinear interpolation so entities walk on a smooth surface.
   ══════════════════════════════════════════════════════════ */

/* ── Constants ── */
export const TILE_S     = 2;          // world-units per tile
export const WATER_Y    = 0.00;       // water surface at tile base level (tiles placed at y=0)
export const GRASS_Y    = 0.40;       // grass surface (Grass_Flat top 0.20 × TILE_S)
export const HILL_Y     = 2.40;       // hilltop surface (1.20 × TILE_S)
export const PATH_Y     = 0.00;       // path surface (Path_Center top 0.00 × TILE_S)

/* grid extents (inclusive) */
export const GX_MIN = -24, GX_MAX = 24;
export const GZ_MIN = -22, GZ_MAX = 26;

/* ── River centre-line [worldX, worldZ, halfWidth_world] ── */
const RP = [
  [ 0, 40, 2.5],
  [ 0, 34, 2.5],
  [ 0, 26, 2.8],
  [ 0, 18, 3.0],
  [ 0, 12, 3.2],
  [ 0,  6, 3.5],
  [ 2,  2, 3.5],
  [ 6, -2, 4.0],
  [12, -6, 4.5],
  [20,-10, 5.0],
  [28,-14, 5.5],
  [36,-14, 6.5],
  [48,-14, 8.0],
];

export function riverQuery(px, pz) {
  let best = { dist: 1e9, t: 0, width: 3 };
  for (let i = 0; i < RP.length - 1; i++) {
    const [ax, az, aw] = RP[i], [bx, bz, bw] = RP[i + 1];
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
    const t = len2 > 0
      ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2))
      : 0;
    const d = Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
    if (d < best.dist)
      best = { dist: d, t: (i + t) / (RP.length - 1), width: aw + (bw - aw) * t };
  }
  return best;
}

export function isInRiver(x, z) {
  const q = riverQuery(x, z);
  return q.dist < q.width;
}

/* ── Zone tests (world coords) ── */
export function isCliffNorth(x, z) { return z >= 40; }
export function isCliffWest(x, z)  { return x <= -40; }
export function isCliffSouth(x, z) { return z <= -38; }

function hillNEDist(x, z) { return Math.hypot(x - 24, z - 24); }
function hillNWDist(x, z) { return Math.hypot(x + 26, z - 22); }
const HILL_R = 16;

export function isHillNE(x, z) { return hillNEDist(x, z) < HILL_R; }
export function isHillNW(x, z) { return hillNWDist(x, z) < HILL_R; }

export function isBeach(x, z) { return x > 20 && z < 10; }

/* ── Flatten zones (village + paths) ── */
const SVC = [
  { x: 0, z: -32, r: 14 },
  { x: 18, z: -35, r: 10 },
  { x: -22, z: -34, r: 8 },
];
const PATH_CLS = [
  [[0, -28], [0, -16], [0, -4], [0, 8], [0, 12]],
  [[10, -30], [20, -26], [30, -22], [40, -18], [46, -16]],
  [[0, 14], [0, 22], [0, 34], [0, 40]],
];

export function distToPath(x, z) {
  let md = 1e9;
  for (const pts of PATH_CLS)
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
      md = Math.min(md, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
    }
  return md;
}

export function isOnPath(x, z) { return distToPath(x, z) < 3.0; }

/* ── Surface elevation (world Y) for a given world (x,z) ── */
export function terrainH(x, z) {
  const s = THREE.MathUtils.smoothstep;
  const rq = riverQuery(x, z);

  /* ─ cliffs ─ */
  if (isCliffNorth(x, z)) {
    const t = s(z, 40, 48);
    return GRASS_Y + t * t * 12 + (Math.sin(x * 0.3) * 0.5 + 0.5) * t * 3;
  }
  if (isCliffWest(x, z)) {
    const t = s(-x, 40, 48);
    return GRASS_Y + t * t * 8 + (Math.sin(z * 0.25) * 0.5 + 0.5) * t * 2;
  }
  if (isCliffSouth(x, z)) {
    const t = s(-z, 38, 46);
    return GRASS_Y + t * t * 6;
  }

  /* ─ hills ─ */
  const neD = hillNEDist(x, z);
  const nwD = hillNWDist(x, z);
  let h = GRASS_Y;

  if (neD < HILL_R) {
    const ht = Math.pow(1 - s(neD, 0, HILL_R), 1.0);
    const ridge = Math.sin((x + z) * 0.35) * 0.05 * ht;
    h = Math.max(h, THREE.MathUtils.lerp(GRASS_Y, HILL_Y * 0.7, ht) + ridge);
  }
  if (nwD < HILL_R) {
    const ht = Math.pow(1 - s(nwD, 0, HILL_R), 1.0);
    const ridge = Math.sin((x - z) * 0.33 + 0.9) * 0.05 * ht;
    h = Math.max(h, THREE.MathUtils.lerp(GRASS_Y, HILL_Y * 0.7, ht) + ridge);
  }

  /* ─ beach slopes down to water ─ */
  if (isBeach(x, z)) {
    const bt = s(x, 20, 32);
    h = THREE.MathUtils.lerp(h, WATER_Y + 0.05, bt);
  }

  /* ─ flatten for village / paths ─ */
  let flat = 0;
  for (const sv of SVC)
    flat = Math.max(flat, 1 - s(Math.hypot(x - sv.x, z - sv.z), sv.r - 2, sv.r + 5));
  const pd = distToPath(x, z);
  flat = Math.max(flat, 1 - s(pd, 0, 2.8));
  if (flat > 0) h = THREE.MathUtils.lerp(h, GRASS_Y, flat);

  /* ─ river channel + bank carve (narrow — visual bank is Hill_Side tiles) ─ */
  const bankLo = rq.width;
  const bankHi = rq.width + TILE_S;          // only 1 tile beyond river edge
  if (rq.dist < bankHi) {
    const center = 1 - s(rq.dist, 0, rq.width);
    const bank = 1 - s(rq.dist, bankLo, bankHi);
    const bed = WATER_Y - 0.72 - 0.48 * center;
    h = THREE.MathUtils.lerp(h, bed, Math.max(center, bank * 0.45));
    h -= bank * 0.18;
    if (rq.dist < rq.width + 0.5) h = Math.min(h, WATER_Y - 0.10);
  }

  /* ─ gentle rolling noise ─ */
  const riverQuiet = 1 - s(rq.dist, rq.width + 1, rq.width + 4);
  const noiseA = (1 - flat) * (1 - 0.75 * riverQuiet);
  h += (Math.sin(x * 0.042) * 0.12 + Math.cos(z * 0.038) * 0.10) * noiseA;

  return h;
}

/* ── Public API ── */
export function getWorldSurfaceHeight(x, z) {
  const h = terrainH(x, z);
  /* In flat areas keep entities above grass-tile surface; hills use real height */
  if (h < GRASS_Y && !isInRiver(x, z) && !isHillNE(x, z) && !isHillNW(x, z))
    return GRASS_Y;
  return h;
}

export function getWaterSurfaceHeight(x, z, time = 0) {
  /* river */
  const rq = riverQuery(x, z);
  if (rq.dist < rq.width + 1)
    return WATER_Y
      + Math.sin(x * 0.14 + z * 0.10 + time * 0.7) * 0.02
      + Math.cos(x * 0.09 + z * 0.22 - time * 0.5) * 0.015;
  /* ocean (east edge) */
  if (x > 34 && terrainH(x, z) < WATER_Y)
    return WATER_Y
      + Math.sin(x * 0.08 + time * 0.5) * 0.03
      + Math.cos(z * 0.12 + time * 0.3) * 0.02;
  return -Infinity;
}

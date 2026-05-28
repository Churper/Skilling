/* slimeGiant.js — Procgen slime giant + dragon-slime + chicken-slime.

   All three variants share the SAME displaced-sphere body equation as
   the player's createSlimeGeometry. Type-specific base features (horns,
   snout, jaw rumps, beak, comb, wattle, stub wings, tail nub) are
   baked into the body's radial displacement as gaussian bumps —
   meaning a dragon-slime IS a slime, just with horn-shaped lumps of
   the same skin growing out of the same mesh.

   Readability pieces such as dragon wings/tail/horn tips and chicken
   beak/comb/wattle are separate low-poly meshes. They are intentionally
   simple silhouettes, attached to the exact displaced body surface. */

import * as THREE from "three";

/* ─── Mouth styles ─── */
export const MOUTH_STYLES = [
  "smile", "grin", "frown", "o", "dash", "fang", "smirk", "tongue", "wide",
];

/* ─── Random color palettes per creature type ─── */
export const COLOR_PALETTES = {
  slime: [
    "#58df78", "#3ad690", "#7fe3a8", "#9fdb55", "#5fc97a",
    "#3ec9a8", "#65b8e6", "#a07ce8", "#e87cc6", "#f0a04a",
    "#c4d24a", "#d24a4a", "#d2b34a", "#4ac9d2", "#7fd24a",
  ],
  dragon: [
    "#4a7a3a", "#356b4f", "#2d5d8a", "#5a3a7a", "#7a3a3a",
    "#3a5e7a", "#8a5a3a", "#6e3a5a", "#3a7a6e", "#5a6a3a",
    "#a04040", "#404a8a", "#6a8a3a", "#3a6a8a", "#6a3a8a",
  ],
  chicken: [
    "#fff6d8", "#fde9b3", "#ffe2a8", "#f5e8c8", "#fce3c0",
    "#f0d090", "#e8c878", "#d0a05a", "#fff0f0", "#f8d2a0",
    "#d8d0c0", "#ffeebb", "#f0e0a0", "#ffeed6", "#e8d0b0",
  ],
};

export const DEFAULT_OPTS = {
  type: "slime",                // "slime" | "dragon" | "chicken"

  /* Size — per-axis stretches let dragon and chicken have proportions
     that differ from the slime giant's base sphere. */
  radius: 1.05,
  heightMult: 1.45,             // Y stretch (after squat-flatten)
  bodyStretchX: 1.00,           // horizontal width (×)
  bodyStretchZ: 1.00,           // front-back depth (×)
  squat: 0.30,
  bottomBias: 0.0,              // 0..1 — pulls the upper half inward (egg shape)
  frontBias:  0.0,              // 0..1 — elongates lower-front (dragon belly)

  /* Player-slime equivalent bulge (latitudinal) */
  baseBulge: 0.18,

  /* Seamless shape variation — harmonic displacement of the sphere.
     Bumped a touch from the original (carves are more pronounced). */
  rumpAmp: 0.22,
  rumpFreq: 2.0,
  rumpBiasLower: 1.0,           // 0..1 — how strongly rumps cluster at the bottom
  curveAmp: 0.11,
  curveFreq: 3.5,
  microAmp: 0.028,
  microFreq: 7.0,

  /* Tesselation */
  widthSeg: 18,
  heightSeg: 14,

  /* Look */
  color: "#58df78",
  opacity: 0.92,
  shininess: 28,
  specular: "#bfffd0",

  /* Face — angular placement on the body surface (radians).
     CONVENTION: front of the creature = +Z direction = theta=π/2.
     Body's long axis (bodyStretchZ) runs front-back.
     Wings sit on the ±X sides — perpendicular to front-back. */
  face: true,
  faceColor: "#0d110f",
  faceTheta: Math.PI / 2,       // which side of the body the face is on (+Z = front)
  eyeSize: 0.085,
  eyeAzimuth: 0.36,             // ±theta OFFSET from faceTheta where eyes sit
  eyePhi: 0.24,                 // phi (vertical angle) for eyes
  eyeOutOffset: 0.0,            // face decals stay nearly flush with the surface

  /* Mouth */
  mouthStyle: "smile",
  mouthSize: 0.20,              // relative to radius
  mouthPhi: -0.06,              // phi (vertical angle) for mouth
  mouthOutOffset: 0.004,        // tiny anti-z-fight lift, not a visible hover

  /* Idle anim */
  idleSpeed: 1.6,
  idleSquish: 0.045,

  /* ─── Dragon-specific bump params ─── */
  hornHeight: 0.55,             // gaussian bump height (radial multiplier)
  hornSpread: 0.32,             // horizontal anchor offset
  hornWidth: 0.20,              // sigma (smaller = sharper)
  headDomeHeight: 0.32,         // big upper-front bump = pronounced head
  headDomeWidth: 0.42,          // narrower → head reads as its own mass
  neckDepth: 0.18,              // NEGATIVE bump between head and body — creates a neck constriction
  neckWidth: 0.30,
  snoutHeight: 0.50,
  snoutWidth: 0.55,
  jawRumpHeight: 0.18,
  jawRumpCount: 3,
  spineHeight: 0.22,
  spineCount: 0,                // 0 by default — stego bumps replace these
  shoulderBulge: 0.20,          // lateral muscle pads near front
  hipBulge: 0.18,               // lateral muscle pads near back
  bellyFold: 0.15,              // negative carve at lower-front (defines chest/belly)
  chestBulge: 0.18,             // forward-bottom muscle
  /* Dragon-only mesh-resolution override — intentionally low-poly so
     the creature reads as simple game geometry instead of a smooth blob. */
  dragonWidthSeg: 18,
  dragonHeightSeg: 14,

  /* ─── Stegosaurus plates — baked INTO the body geometry as tall
     elongated bumps. Wider in theta (along the spine direction) and
     narrower in phi (across the spine) so each one reads as a plate. */
  stegoCount: 5,
  stegoHeight: 0.55,
  stegoSigmaT: 0.10,            // length along the spine
  stegoSigmaP: 0.06,            // width across the spine (small = sharp)

  /* ─── Dragon mouth (built into the body, colored per face) ─── */
  dragonBuiltInMouth: true,     // dragon uses built-in mouth (skip the separate mesh)
  mouthCarveDepth: 0.18,        // negative bump = mouth cavity
  mouthCarveWidth: 0.18,        // mouth width (theta)
  mouthCarveHeight: 0.06,       // mouth height (phi)
  dragonUpperJawHeight: 0.16,   // positive lips around mouth cavity
  dragonLowerJawHeight: 0.22,
  dragonJawSeparation: 0.06,
  mouthInsideColor: "#b51d1d",  // solid face color inside the mouth carve
  dragonHornMeshes: true,
  dragonHornColor: "#edd88a",
  dragonHornMeshHeight: 0.38,
  dragonHornMeshRadius: 0.105,

  /* ─── Brow ridges (above the eyes) ─── */
  browHeight: 0.10,
  browWidth: 0.10,
  wings: true,                  // enable flying wings (dragon only)
  wingSpan: 0.95,
  wingFingers: 4,
  wingColor: "",                // "" = derive from body color (darker)
  dragonTail: true,
  dragonTailLength: 1.10,
  dragonTailThickness: 0.22,
  dragonTailLift: 0.20,

  /* ─── Chicken-specific bump params ─── */
  beakHeight: 0.55,
  beakWidth: 0.20,
  beakColor: "#f1a93a",
  beakMesh: true,
  beakMeshLength: 0.50,
  beakMeshWidth: 0.26,
  beakMeshHeight: 0.18,
  combHeight: 0.12,
  combWidth: 0.10,
  combCount: 3,
  combColor: "#d4361f",
  combMesh: true,
  chickenMouth: false,
  wattleHeight: 0.08,
  wattleColor: "#d4361f",
  wattleMesh: false,
  stubWingHeight: 0.24,
  chickenWings: false,
  chickenWingMeshSize: 0.65,
  tailNubHeight: 0.0,
  tailNubCount: 0,
  tailNubColor: "",             // "" = derive from body color
  chickenTailMesh: false,
  chickenTailLength: 0.34,

  /* PRNG */
  seed: 1,

  name: "SlimeGiant",
};

/* Tiny deterministic PRNG (mulberry32). */
function rngFromSeed(seed) {
  let a = (seed | 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* angular distance on -π..π with wrap */
function angWrap(d) {
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/* Gaussian falloff around an anchor point on the sphere.
   color: optional 3-element vec; if provided, also contributes to vertex
   color blend weighted by this bump's strength. */
function evalBumps(theta, phi, bumps) {
  let total = 0;
  let cR = 0, cG = 0, cB = 0, cW = 0;
  let hardColor = null;
  let hardW = 0;
  for (const b of bumps) {
    const dt = angWrap(theta - b.theta);
    const dp = phi - b.phi;
    const k = Math.exp(-(dt * dt) / (2 * b.sigmaT * b.sigmaT)
                       -(dp * dp) / (2 * b.sigmaP * b.sigmaP));
    total += b.height * k;
    if (b.color) {
      if (b.hardColor) {
        const threshold = b.colorThreshold ?? 0.16;
        const priorityW = k * (b.colorPriority ?? 1);
        if (k >= threshold && priorityW > hardW) {
          hardW = priorityW;
          hardColor = b.color;
        }
      } else {
        cR += b.color[0] * k; cG += b.color[1] * k; cB += b.color[2] * k; cW += k;
      }
    }
  }
  return { disp: total, cR, cG, cB, cW, hardColor };
}

/* Per-seed harmonic state — reused by both the geometry builder and
   the surface sampler, so eye/mouth placement matches the actual mesh.

   IMPORTANT: theta-frequencies on the body harmonics must be INTEGER
   so sin/cos(theta * f + phase) is exactly 2π-periodic, otherwise the
   sphere's seam at theta=±π doesn't close and you get a visible
   vertical line down the body. We achieve per-seed variation through
   phase offsets + amplitude jitter, NOT continuous frequency jitter. */
function _harmonicState(opts) {
  const rng = rngFromSeed(opts.seed);
  const intRumpFreq  = Math.max(1, Math.round(opts.rumpFreq));
  const intCurveFreq = Math.max(1, Math.round(opts.curveFreq));
  const intMicroFreq = Math.max(1, Math.round(opts.microFreq));
  /* Pick an additional small integer offset per seed for variety */
  const rumpOffset  = (rng() * 3) | 0;             // 0..2 extra periods
  const curveOffset = (rng() * 3) | 0;
  return {
    phA: rng() * Math.PI * 2,
    phB: rng() * Math.PI * 2,
    phC: rng() * Math.PI * 2,
    phD: rng() * Math.PI * 2,
    rumpF:  intRumpFreq + rumpOffset,
    curveF: intCurveFreq + curveOffset,
    microF: intMicroFreq,
    ampJitterRump:  0.7 + rng() * 0.6,
    ampJitterCurve: 0.7 + rng() * 0.6,
  };
}

/* Returns the radial multiplier at (theta, phi) — same formula as
   makeBodyGeo so eyes/mouth can be placed exactly on the surface. */
function _surfaceMul(theta, phi, opts, st, localBumps) {
  /* yNorm matches the per-vertex calc: yNorm = (sin(phi) + 1) / 2 */
  const yNorm = (Math.sin(phi) + 1) / 2;
  const baseBulge = 1.0 + opts.baseBulge * Math.sin(yNorm * Math.PI);
  const lobeShape = Math.cos(phi) * (0.6 + 0.4 * Math.cos(phi));
  const lowerBias = 0.5 + 0.5 * Math.cos(yNorm * Math.PI);
  /* All theta-frequencies are INTEGERS so sin/cos are exactly 2π-periodic
     and the sphere seam closes cleanly with no visible vertical line. */
  const rump = Math.sin(theta * st.rumpF + st.phA)
             * Math.cos(phi * 1.4 + st.phB);
  const biasMix = (1 - opts.rumpBiasLower) + opts.rumpBiasLower * lowerBias;
  const rumpDisp = rump * opts.rumpAmp * st.ampJitterRump * lobeShape * (0.5 + 0.7 * biasMix);
  const curve = Math.sin(theta * st.curveF + st.phC)
              * Math.sin(phi * 2.0 + st.phD);
  const curveDisp = curve * opts.curveAmp * st.ampJitterCurve * Math.cos(phi);
  const micro = Math.sin(theta * st.microF + st.phA * 3)
              * Math.cos(phi * st.microF + st.phB * 3);
  const microDisp = micro * opts.microAmp * Math.cos(phi); // fade at poles
  const be = evalBumps(theta, phi, localBumps);
  return baseBulge + rumpDisp + curveDisp + microDisp + be.disp;
}

/* Projects an angular face anchor (theta, phi) into body-local 3D,
   applying the same axis stretches the body geometry uses, plus an
   outward push so the part visibly pokes past the silhouette. */
function _surfacePoint(theta, phi, opts, st, localBumps, outOffset) {
  const mul = _surfaceMul(theta, phi, opts, st, localBumps);
  const r = opts.radius;
  let x = r * Math.cos(phi) * Math.cos(theta) * mul * opts.bodyStretchX;
  let y = r * Math.sin(phi);
  let z = r * Math.cos(phi) * Math.sin(theta) * mul * opts.bodyStretchZ;
  /* squat-flatten lower hemisphere */
  if (y < 0) y *= opts.squat;
  /* bottom-bias: narrow upper hemisphere (egg shape) */
  if (opts.bottomBias && y > 0) {
    const k = 1 - opts.bottomBias * (y / (r * 0.8));
    x *= Math.max(0.4, k); z *= Math.max(0.4, k);
  }
  /* front-bias: stretch lower-front (dragon belly/snout base) */
  if (opts.frontBias && z > 0 && y < 0) {
    z *= 1 + opts.frontBias * (-y / (r * 0.7));
  }
  y *= opts.heightMult;
  /* outward push along the (x, z) plane normal, plus a touch of y */
  const len = Math.hypot(x, y, z);
  if (len > 1e-4 && outOffset) {
    const push = r * outOffset;
    const inv = 1 / len;
    x += x * inv * push;
    y += y * inv * push;
    z += z * inv * push;
  }
  return { x, y, z };
}

function _chickenBeakFaceMask(theta, phi, opts) {
  if (opts.type !== "chicken") return false;
  const halfW = Math.max(0.045, opts.beakWidth * 0.98);
  const halfH = Math.max(0.040, opts.beakWidth * 0.74);
  const dt = Math.abs(angWrap(theta - opts.faceTheta)) / halfW;
  const dp = (phi - 0.05) / halfH;
  if (dp < -0.95 || dp > 0.95) return false;
  const taper = 1.0 - Math.max(0, dp) * 0.45 - Math.max(0, -dp) * 0.18;
  return dt <= taper;
}

function _dragonMouthInteriorMask(theta, phi, opts, scale = 1) {
  if (opts.type !== "dragon" || !opts.dragonBuiltInMouth || opts.mouthCarveDepth <= 0) return false;
  const halfW = Math.max(0.045, opts.mouthCarveWidth * 1.02) * scale;
  const x = Math.abs(angWrap(theta - opts.faceTheta)) / halfW;
  if (x > 1) return false;

  const x2 = x * x;
  const top = opts.mouthPhi + opts.mouthCarveHeight * (0.08 + 0.08 * (1 - x2));
  const bottom = opts.mouthPhi - opts.mouthCarveHeight * (1.22 - 0.36 * x);
  if (phi > top || phi < bottom) return false;

  const mid = (top + bottom) * 0.5;
  const halfH = Math.max(0.018, (top - bottom) * 0.5);
  const y = Math.abs((phi - mid) / halfH);
  const carve = Math.exp(
    -(angWrap(theta - opts.faceTheta) ** 2) / (2 * opts.mouthCarveWidth * opts.mouthCarveWidth)
    -((phi - opts.mouthPhi) ** 2) / (2 * Math.pow(opts.mouthCarveHeight * 1.12, 2))
  );
  return y <= 1 && carve > 0.22;
}

function _anglesFromDeformedBodyPoint(x, y, z, opts) {
  const sx = x / Math.max(0.001, opts.bodyStretchX);
  const sy = y / Math.max(0.001, opts.heightMult);
  const sz = z / Math.max(0.001, opts.bodyStretchZ);
  return { theta: Math.atan2(sz, sx), phi: Math.atan2(sy, Math.hypot(sx, sz)) };
}

/* Builds the displaced sphere body. localBumps[] = creature features,
   each {theta, phi, sigmaT, sigmaP, height, color?}. */
function makeBodyGeo(opts, localBumps = []) {
  let geo = new THREE.SphereGeometry(opts.radius, opts.widthSeg, opts.heightSeg);
  const pos = geo.attributes.position;

  const st = _harmonicState(opts);

  const r = opts.radius;
  const baseRGB = new THREE.Color(opts.color);
  const colors = new Float32Array(pos.count * 3);
  let anyTint = false;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    /* player-slime base shape */
    if (y < 0) y *= opts.squat;
    const yNorm = (y + r) / (2 * r);

    /* spherical coords */
    const theta = Math.atan2(z, x);
    const xz = Math.hypot(x, z);
    const phi = Math.atan2(y, xz);

    /* re-use the central surface multiplier formula */
    const totalMul = _surfaceMul(theta, phi, opts, st, localBumps);
    const bumpEval = evalBumps(theta, phi, localBumps);  // for color only

    /* axis-aware scaling: dragon = wider z, chicken = narrower xz/taller y */
    x *= totalMul * opts.bodyStretchX;
    z *= totalMul * opts.bodyStretchZ;

    /* bottomBias: narrow upper half (egg shape) */
    if (opts.bottomBias && y > 0) {
      const k = 1 - opts.bottomBias * (y / (r * 0.8));
      x *= Math.max(0.4, k); z *= Math.max(0.4, k);
    }
    /* frontBias: stretch lower-front (dragon belly) */
    if (opts.frontBias && z > 0 && y < 0) {
      z *= 1 + opts.frontBias * (-y / (r * 0.7));
    }

    y *= opts.heightMult;

    pos.setXYZ(i, x, y, z);

    /* per-vertex color: dragonhide gets subtle seed-stable variation.
       Hard-colored feature bumps still replace this below. */
    let cr = baseRGB.r, cg = baseRGB.g, cb = baseRGB.b;
    if (opts.type === "dragon") {
      const broad = Math.sin(theta * st.rumpF + st.phA) * Math.cos(phi * 1.5 + st.phB);
      const scaleFlecks = Math.sin(theta * (st.curveF + 2) + st.phC)
                        * Math.sin(phi * 4.0 + st.phD);
      const topShade = 0.5 + 0.5 * Math.sin(phi + 0.8);
      const shade = 0.90 + broad * 0.075 + scaleFlecks * 0.045 + topShade * 0.035;
      cr = Math.min(1, Math.max(0, baseRGB.r * shade));
      cg = Math.min(1, Math.max(0, baseRGB.g * shade));
      cb = Math.min(1, Math.max(0, baseRGB.b * shade));
      anyTint = true;
    }
    if (bumpEval.hardColor) {
      [cr, cg, cb] = bumpEval.hardColor;
      anyTint = true;
    } else if (bumpEval.cW > 0.08) {
      cr = bumpEval.cR / bumpEval.cW;
      cg = bumpEval.cG / bumpEval.cW;
      cb = bumpEval.cB / bumpEval.cW;
      anyTint = true;
    }
    colors[i * 3]     = cr;
    colors[i * 3 + 1] = cg;
    colors[i * 3 + 2] = cb;
  }

  if (anyTint) geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  if (opts.type === "dragon" && opts.dragonBuiltInMouth && opts.mouthCarveDepth > 0) {
    geo = geo.toNonIndexed();
    const p2 = geo.attributes.position;
    const c2 = geo.attributes.color;
    const mouthC = new THREE.Color(opts.mouthInsideColor || "#b51d1d");

    for (let i = 0; i < p2.count; i += 3) {
      const cx = (p2.getX(i) + p2.getX(i + 1) + p2.getX(i + 2)) / 3;
      const cy = (p2.getY(i) + p2.getY(i + 1) + p2.getY(i + 2)) / 3;
      const cz = (p2.getZ(i) + p2.getZ(i + 1) + p2.getZ(i + 2)) / 3;
      const ac = _anglesFromDeformedBodyPoint(cx, cy, cz, opts);
      const a0 = _anglesFromDeformedBodyPoint(p2.getX(i), p2.getY(i), p2.getZ(i), opts);
      const a1 = _anglesFromDeformedBodyPoint(p2.getX(i + 1), p2.getY(i + 1), p2.getZ(i + 1), opts);
      const a2 = _anglesFromDeformedBodyPoint(p2.getX(i + 2), p2.getY(i + 2), p2.getZ(i + 2), opts);
      const hits =
        (_dragonMouthInteriorMask(a0.theta, a0.phi, opts, 0.98) ? 1 : 0) +
        (_dragonMouthInteriorMask(a1.theta, a1.phi, opts, 0.98) ? 1 : 0) +
        (_dragonMouthInteriorMask(a2.theta, a2.phi, opts, 0.98) ? 1 : 0);
      if (!_dragonMouthInteriorMask(ac.theta, ac.phi, opts, 1.04) && hits < 2) continue;
      for (let j = 0; j < 3; j++) c2.setXYZ(i + j, mouthC.r, mouthC.g, mouthC.b);
    }
    c2.needsUpdate = true;
    anyTint = true;
  }

  if (opts.type === "chicken") {
    if (!geo.attributes.color) {
      const baseColors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        baseColors[i * 3] = baseRGB.r;
        baseColors[i * 3 + 1] = baseRGB.g;
        baseColors[i * 3 + 2] = baseRGB.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(baseColors, 3));
    }

    geo = geo.toNonIndexed();
    const p2 = geo.attributes.position;
    const c2 = geo.attributes.color;
    const beakC = new THREE.Color(opts.beakColor || "#f1a93a");

    for (let i = 0; i < p2.count; i += 3) {
      const cx = (p2.getX(i) + p2.getX(i + 1) + p2.getX(i + 2)) / 3;
      const cy = (p2.getY(i) + p2.getY(i + 1) + p2.getY(i + 2)) / 3;
      const cz = (p2.getZ(i) + p2.getZ(i + 1) + p2.getZ(i + 2)) / 3;
      const sx = cx / Math.max(0.001, opts.bodyStretchX);
      const sy = cy / Math.max(0.001, opts.heightMult);
      const sz = cz / Math.max(0.001, opts.bodyStretchZ);
      const theta = Math.atan2(sz, sx);
      const phi = Math.atan2(sy, Math.hypot(sx, sz));
      if (!_chickenBeakFaceMask(theta, phi, opts)) continue;
      for (let j = 0; j < 3; j++) {
        c2.setXYZ(i + j, beakC.r, beakC.g, beakC.b);
      }
    }
    c2.needsUpdate = true;
    anyTint = true;
  }

  geo.computeVertexNormals();
  geo.userData.anyTint = anyTint;
  return geo;
}

/* ────────── Feature contributions per type (gaussian bumps) ────────── */

function dragonBumps(opts) {
  const bumps = [];
  const ft = opts.faceTheta;          // +Z front
  const bt = ft + Math.PI;             // back (-Z direction)

  /* head dome: broad bump at upper-front that bulks out the head */
  if (opts.headDomeHeight > 0) {
    bumps.push({
      theta: ft, phi: 0.50,
      sigmaT: opts.headDomeWidth, sigmaP: opts.headDomeWidth * 0.85,
      height: opts.headDomeHeight,
    });
  }
  /* NECK: negative bump just below the head — creates a constriction */
  if (opts.neckDepth > 0) {
    bumps.push({
      theta: ft, phi: 0.05,
      sigmaT: opts.neckWidth, sigmaP: opts.neckWidth * 0.55,
      height: -opts.neckDepth,
    });
  }
  /* horns: two on the head dome, symmetric around faceTheta */
  const hornPhi = Math.PI * 0.42;
  const hornOff = opts.hornSpread * Math.PI;
  bumps.push({
    theta: ft + hornOff, phi: hornPhi,
    sigmaT: opts.hornWidth, sigmaP: opts.hornWidth * 0.8,
    height: opts.hornHeight,
  });
  bumps.push({
    theta: ft - hornOff, phi: hornPhi,
    sigmaT: opts.hornWidth, sigmaP: opts.hornWidth * 0.8,
    height: opts.hornHeight,
  });
  /* snout: broad forward bump, below head dome */
  bumps.push({
    theta: ft, phi: -0.20,
    sigmaT: opts.snoutWidth, sigmaP: opts.snoutWidth * 0.55,
    height: opts.snoutHeight,
  });
  /* jaw rumps under the snout — small spread around faceTheta */
  const jr = Math.max(0, opts.jawRumpCount | 0);
  for (let i = 0; i < jr; i++) {
    const t = (i + 0.5) / jr;
    const offT = (t - 0.5) * 0.7;
    bumps.push({
      theta: ft + offT, phi: -0.55 - 0.08 * Math.cos(t * Math.PI),
      sigmaT: 0.28, sigmaP: 0.20,
      height: opts.jawRumpHeight,
    });
  }
  /* dorsal spine: bumps running along the top from just behind the
     head (theta = ft - 0.4) to the tail */
  const sc = Math.max(0, opts.spineCount | 0);
  for (let i = 0; i < sc; i++) {
    const t = (i + 1) / (sc + 1);
    const spineTheta = ft - 0.4 - t * (Math.PI - 0.6);
    bumps.push({
      theta: spineTheta, phi: Math.PI * 0.30,
      sigmaT: 0.18, sigmaP: 0.18,
      height: opts.spineHeight * (0.7 + 0.5 * Math.sin(t * Math.PI)),
    });
  }
  /* SHOULDER muscle pads — lateral bulges near the front, mid-height */
  if (opts.shoulderBulge > 0) {
    bumps.push({ theta: ft + 0.55, phi: 0.10,
      sigmaT: 0.35, sigmaP: 0.30, height: opts.shoulderBulge });
    bumps.push({ theta: ft - 0.55, phi: 0.10,
      sigmaT: 0.35, sigmaP: 0.30, height: opts.shoulderBulge });
  }
  /* HIP muscle pads — lateral bulges near the back, mid-height */
  if (opts.hipBulge > 0) {
    bumps.push({ theta: bt + 0.55, phi: 0.05,
      sigmaT: 0.40, sigmaP: 0.30, height: opts.hipBulge });
    bumps.push({ theta: bt - 0.55, phi: 0.05,
      sigmaT: 0.40, sigmaP: 0.30, height: opts.hipBulge });
  }
  /* BELLY FOLD — negative carve at lower-front, defines chest from belly */
  if (opts.bellyFold > 0) {
    bumps.push({ theta: ft, phi: -0.65,
      sigmaT: 0.32, sigmaP: 0.20, height: -opts.bellyFold });
  }
  /* CHEST bulge — forward-bottom muscle puff just under the neck */
  if (opts.chestBulge > 0) {
    bumps.push({ theta: ft, phi: -0.30,
      sigmaT: 0.45, sigmaP: 0.25, height: opts.chestBulge });
  }

  /* STEGO PLATES baked into body geometry — tall elongated bumps along
     the top centerline. sigmaT > sigmaP so each plate is long along
     the spine and narrow across (a real plate shape, not a spike). */
  const sN = Math.max(0, opts.stegoCount | 0);
  for (let i = 0; i < sN; i++) {
    const t = (i + 0.5) / sN;
    /* size envelope: small at neck/tail, biggest in the middle */
    const sizeMul = 0.45 + 0.55 * Math.sin(t * Math.PI);
    /* sweep along the back: theta from just-behind-the-neck to just-before-the-tail */
    const plateTheta = ft - 0.45 - t * (Math.PI - 0.75);
    bumps.push({
      theta: plateTheta,
      phi:   Math.PI * 0.42,           // up near the top centerline
      sigmaT: opts.stegoSigmaT,        // length along the spine
      sigmaP: opts.stegoSigmaP,        // width across the spine
      height: opts.stegoHeight * sizeMul,
    });
  }

  /* MOUTH CARVE — negative bump opens the cavity. The red interior is
     painted later per triangle so whole mouth faces stay flat-colored. */
  if (opts.dragonBuiltInMouth && opts.mouthCarveDepth > 0) {
    const jawSep = opts.dragonJawSeparation ?? 0.06;
    const upperJawHeight = opts.dragonUpperJawHeight ?? 0.16;
    const lowerJawHeight = opts.dragonLowerJawHeight ?? 0.22;
    const upperPhi = opts.mouthPhi + opts.mouthCarveHeight * 0.92 + jawSep;
    const lowerPhi = opts.mouthPhi - opts.mouthCarveHeight * 1.18 - jawSep * 0.85;

    if (upperJawHeight > 0) {
      bumps.push({
        theta: ft,
        phi: upperPhi,
        sigmaT: opts.mouthCarveWidth * 1.02,
        sigmaP: Math.max(0.045, opts.mouthCarveHeight * 0.66),
        height: upperJawHeight,
      });
      bumps.push({
        theta: ft,
        phi: upperPhi + opts.mouthCarveHeight * 0.95,
        sigmaT: opts.mouthCarveWidth * 0.72,
        sigmaP: Math.max(0.035, opts.mouthCarveHeight * 0.46),
        height: upperJawHeight * 0.44,
      });
    }
    if (lowerJawHeight > 0) {
      bumps.push({
        theta: ft,
        phi: lowerPhi,
        sigmaT: opts.mouthCarveWidth * 1.08,
        sigmaP: Math.max(0.050, opts.mouthCarveHeight * 0.82),
        height: lowerJawHeight,
      });
      bumps.push({
        theta: ft,
        phi: lowerPhi - opts.mouthCarveHeight * 1.00,
        sigmaT: opts.mouthCarveWidth * 0.84,
        sigmaP: Math.max(0.040, opts.mouthCarveHeight * 0.60),
        height: lowerJawHeight * 0.55,
      });
    }

    bumps.push({
      theta: ft, phi: opts.mouthPhi,
      sigmaT: opts.mouthCarveWidth, sigmaP: opts.mouthCarveHeight * 1.12,
      height: -opts.mouthCarveDepth,
    });

  }

  /* BROW RIDGES — small bumps above each eye. */
  if (opts.browHeight > 0) {
    const browPhi = opts.eyePhi + 0.16;
    bumps.push({
      theta: ft + opts.eyeAzimuth, phi: browPhi,
      sigmaT: opts.browWidth, sigmaP: opts.browWidth * 0.7,
      height: opts.browHeight,
    });
    bumps.push({
      theta: ft - opts.eyeAzimuth, phi: browPhi,
      sigmaT: opts.browWidth, sigmaP: opts.browWidth * 0.7,
      height: opts.browHeight,
    });
  }
  return bumps;
}

function chickenBumps(opts) {
  const bumps = [];
  const ft = opts.faceTheta;              // +Z front
  const bt = ft + Math.PI;                // back

  /* beak root: baked into the main mesh. It cannot detach because the
     protrusion and orange beak color are both part of the body geometry. */
  const beakColor = new THREE.Color(opts.beakColor);
  const beakRoot = {
    theta: ft, phi: 0.05,
    sigmaT: opts.beakWidth * 0.86, sigmaP: opts.beakWidth * 0.58,
    height: opts.beakHeight,
    color: [beakColor.r, beakColor.g, beakColor.b],
    hardColor: true,
    colorThreshold: 0.16,
    colorPriority: 2.0,
  };
  bumps.push(beakRoot);
  /* wattle ("gobble") under the beak — own color */
  if (opts.wattleHeight > 0) {
    const wattleC = new THREE.Color(opts.wattleColor || opts.combColor);
    bumps.push({
      theta: ft, phi: -0.45,
      sigmaT: 0.22, sigmaP: 0.18,
      height: opts.wattleHeight,
      color: [wattleC.r, wattleC.g, wattleC.b],
      hardColor: true,
      colorThreshold: 0.18,
      colorPriority: 1.5,
    });
  }
  /* stub wings: lateral bumps on ±X (perpendicular to front-back axis) */
  if (opts.stubWingHeight > 0) {
    bumps.push({
      theta: 0, phi: -0.05,                 // +X side
      sigmaT: 0.40, sigmaP: 0.35,
      height: opts.stubWingHeight,
    });
    bumps.push({
      theta: Math.PI, phi: -0.05,           // -X side
      sigmaT: 0.40, sigmaP: 0.35,
      height: opts.stubWingHeight,
    });
  }
  /* tail nubs: clustered at the BACK (-Z = theta = bt) */
  const tailColor = opts.tailNubColor
    ? new THREE.Color(opts.tailNubColor)
    : null;
  const tN = Math.max(0, opts.tailNubCount | 0);
  for (let i = 0; i < tN; i++) {
    const t = tN === 1 ? 0 : (i / (tN - 1)) - 0.5;
    const b = {
      theta: bt + t * 0.4,
      phi: 0.18 + Math.abs(t) * 0.12,
      sigmaT: 0.18, sigmaP: 0.18,
      height: opts.tailNubHeight * (0.8 + 0.5 * (1 - Math.abs(t) * 2)),
    };
    if (tailColor) b.color = [tailColor.r, tailColor.g, tailColor.b];
    bumps.push(b);
  }
  return bumps;
}

/* ────────── Mouth styles ─────────
   Mouths are flat decals. The group's local -Z is aligned to the body
   normal, so the tiny negative z below is only enough to avoid z-fight. */
function buildMouth(opts) {
  const r = opts.radius;
  const size = opts.mouthSize * r;
  const thick = Math.max(size * 0.070, r * 0.006);
  const out = -Math.max(r * 0.0012, 0.001); // tiny outward push along local -Z
  const mat     = new THREE.MeshBasicMaterial({ color: opts.faceColor, side: THREE.DoubleSide });
  const inMat   = new THREE.MeshBasicMaterial({ color: "#5a1010", side: THREE.DoubleSide });
  const toothMat= new THREE.MeshBasicMaterial({ color: "#fff8e0", side: THREE.DoubleSide });
  const tonMat  = new THREE.MeshBasicMaterial({ color: "#e85070" });
  const g = new THREE.Group();
  const style = opts.mouthStyle || "smile";

  function ribbonGeo(points, halfWidth, z = out) {
    const verts = [];
    const idx = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[Math.min(points.length - 1, i + 1)];
      let tx = p1.x - p0.x;
      let ty = p1.y - p0.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len; ty /= len;
      const nx = -ty;
      const ny = tx;
      verts.push(p.x + nx * halfWidth, p.y + ny * halfWidth, z);
      verts.push(p.x - nx * halfWidth, p.y - ny * halfWidth, z);
      if (i < points.length - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2);
        idx.push(a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  function ribbon(points, width = thick, material = mat, z = out) {
    return new THREE.Mesh(ribbonGeo(points, width, z), material);
  }

  function smilePoints(width, sag, y = 0, segs = 20, flip = false, tilt = 0) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs * 2 - 1;
      const x = u * width * 0.5;
      const bend = sag * (1 - u * u);
      pts.push({ x, y: y + u * tilt + (flip ? bend : -bend) });
    }
    return pts;
  }

  function openMouth(width, height, y = size * 0.03) {
    const segs = 18;
    const shape = new THREE.Shape();
    shape.moveTo(-width * 0.5, y);
    shape.lineTo(width * 0.5, y);
    const outline = [{ x: -width * 0.5, y }, { x: width * 0.5, y }];
    for (let i = 0; i <= segs; i++) {
      const u = 1 - i / segs * 2;
      const px = u * width * 0.5;
      const py = y - height * (1 - u * u);
      shape.lineTo(px, py);
      outline.push({ x: px, y: py });
    }
    shape.closePath();
    outline.push({ x: -width * 0.5, y });
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), inMat);
    fill.position.z = out + thick * 0.05;
    g.add(fill);
    g.add(ribbon(outline, thick * 0.82, mat, out - thick * 0.02));
    return { width, height, y };
  }

  function flatRing(R) {
    const outer = new THREE.Shape();
    outer.absarc(0, 0, R, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, R * 0.55, 0, Math.PI * 2, true);
    outer.holes.push(hole);
    const ring = new THREE.Mesh(new THREE.ShapeGeometry(outer), mat);
    ring.position.z = out;
    return ring;
  }

  if (style === "smile" || style === "wide") {
    const width = size * (style === "wide" ? 1.05 : 0.78);
    const sag = size * (style === "wide" ? 0.22 : 0.18);
    g.add(ribbon(smilePoints(width, sag, size * 0.06, style === "wide" ? 24 : 18), thick));
  } else if (style === "frown") {
    g.add(ribbon(smilePoints(size * 0.78, size * 0.18, -size * 0.03, 18, true), thick));
  } else if (style === "dash") {
    const w = size * 0.82;
    g.add(ribbon([{ x: -w * 0.5, y: 0 }, { x: w * 0.5, y: 0 }], thick));
  } else if (style === "o") {
    const R = size * 0.35;
    g.add(flatRing(R));
    const inside = new THREE.Mesh(new THREE.CircleGeometry(R * 0.54, 18), inMat);
    inside.position.set(0, 0, out + thick * 0.04);
    g.add(inside);
  } else if (style === "grin") {
    const m = openMouth(size * 0.95, size * 0.36, size * 0.12);
    const toothH = size * 0.16;
    for (let i = 0; i < 4; i++) {
      const tx = (i / 3 - 0.5) * m.width * 0.62;
      const tooth = new THREE.Mesh(
        new THREE.BoxGeometry(size * 0.08, toothH, thick * 0.35), toothMat
      );
      tooth.position.set(tx, m.y - toothH * 0.48, out - thick * 0.10);
      g.add(tooth);
    }
  } else if (style === "fang") {
    const w = size * 0.82;
    g.add(ribbon([{ x: -w * 0.5, y: size * 0.04 }, { x: w * 0.5, y: size * 0.04 }], thick));
    for (const side of [-1, 1]) {
      const fang = new THREE.Mesh(
        new THREE.ConeGeometry(thick * 1.6, size * 0.32, 6, 1), toothMat
      );
      /* cone default points +Y; rotate to point -Y (down) */
      fang.rotation.z = Math.PI;
      fang.position.set(side * size * 0.27, -size * 0.14, out - thick);
      g.add(fang);
    }
  } else if (style === "smirk") {
    g.add(ribbon(smilePoints(size * 0.80, size * 0.14, size * 0.02, 18, false, size * 0.10), thick));
  } else if (style === "tongue") {
    g.add(ribbon(smilePoints(size * 0.82, size * 0.18, size * 0.06, 18), thick));
    const tongue = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.20, 10, 8), tonMat
    );
    tongue.scale.set(0.9, 0.5, 0.6);
    tongue.position.set(0, -size * 0.18, out - thick * 0.35);
    g.add(tongue);
  }

  return g;
}

function _surfaceDecalPoint(theta0, phi0, x, y, opts, st, bumps, lift = 0.003) {
  const r = Math.max(0.001, opts.radius);
  const cosPhi = Math.max(0.28, Math.cos(phi0));
  const thetaScale = r * Math.max(0.35, opts.bodyStretchX) * cosPhi;
  const phiScale = r * Math.max(0.35, opts.heightMult);
  return _surfacePoint(
    theta0 + x / thetaScale,
    phi0 + y / phiScale,
    opts,
    st,
    bumps,
    lift
  );
}

function _surfaceRibbonGeo(points, halfWidth, theta0, phi0, opts, st, bumps, lift) {
  const verts = [];
  const idx = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[Math.min(points.length - 1, i + 1)];
    let tx = p1.x - p0.x;
    let ty = p1.y - p0.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const nx = -ty;
    const ny = tx;
    const a = _surfaceDecalPoint(theta0, phi0, p.x + nx * halfWidth, p.y + ny * halfWidth, opts, st, bumps, lift);
    const b = _surfaceDecalPoint(theta0, phi0, p.x - nx * halfWidth, p.y - ny * halfWidth, opts, st, bumps, lift);
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    if (i < points.length - 1) {
      const q = i * 2;
      idx.push(q, q + 1, q + 2);
      idx.push(q + 1, q + 3, q + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function _surfaceEllipseGeo(cx, cy, rx, ry, theta0, phi0, opts, st, bumps, lift, segs = 20) {
  const verts = [];
  const idx = [];
  const c = _surfaceDecalPoint(theta0, phi0, cx, cy, opts, st, bumps, lift);
  verts.push(c.x, c.y, c.z);
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const p = _surfaceDecalPoint(theta0, phi0, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, opts, st, bumps, lift);
    verts.push(p.x, p.y, p.z);
  }
  for (let i = 0; i < segs; i++) idx.push(0, 1 + i, 1 + ((i + 1) % segs));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function _surfaceRingGeo(cx, cy, outerR, innerR, theta0, phi0, opts, st, bumps, lift, segs = 24) {
  const verts = [];
  const idx = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const o = _surfaceDecalPoint(theta0, phi0, cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR, opts, st, bumps, lift);
    const inn = _surfaceDecalPoint(theta0, phi0, cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR, opts, st, bumps, lift);
    verts.push(o.x, o.y, o.z, inn.x, inn.y, inn.z);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = ((i + 1) % segs) * 2;
    idx.push(a, a + 1, b);
    idx.push(a + 1, b + 1, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function _surfaceTriangleGeo(points, theta0, phi0, opts, st, bumps, lift) {
  const verts = [];
  for (const p of points) {
    const q = _surfaceDecalPoint(theta0, phi0, p.x, p.y, opts, st, bumps, lift);
    verts.push(q.x, q.y, q.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return geo;
}

function buildSurfaceEyeDecal(theta, phi, opts, st, bumps) {
  const r = opts.radius;
  const anchor = _surfacePoint(theta, phi, opts, st, bumps, 0.0);
  const normal = _surfaceNormalAtAngles(theta, phi, opts, st, bumps);
  const rad = Math.max(r * 0.024, opts.eyeSize * r * 0.82);
  const embedLift = Math.max(r * 0.002, rad * 0.08);
  const center = new THREE.Vector3(anchor.x, anchor.y, anchor.z)
    .addScaledVector(normal, embedLift);
  const eyeMat = new THREE.MeshBasicMaterial({
    color: opts.faceColor || "#0d110f",
    depthTest: true,
    depthWrite: true,
  });

  const eye = new THREE.Mesh(new THREE.SphereGeometry(rad, 18, 12), eyeMat);
  eye.position.copy(center);
  eye.renderOrder = 100;
  eye.frustumCulled = false;
  return eye;
}

function buildSurfaceMouth(opts, st, bumps) {
  const r = opts.radius;
  const size = opts.mouthSize * r;
  const thick = Math.max(size * 0.070, r * 0.006);
  const theta0 = opts.faceTheta;
  const phi0 = opts.mouthPhi;
  const lift = Math.min(Math.max(opts.mouthOutOffset || 0.003, 0.002), 0.006);
  const mat = new THREE.MeshBasicMaterial({ color: opts.faceColor, side: THREE.DoubleSide });
  const inMat = new THREE.MeshBasicMaterial({ color: "#5a1010", side: THREE.DoubleSide });
  const toothMat = new THREE.MeshBasicMaterial({ color: "#fff8e0", side: THREE.DoubleSide });
  const tonMat = new THREE.MeshBasicMaterial({ color: "#e85070", side: THREE.DoubleSide });
  const g = new THREE.Group();
  const style = opts.mouthStyle || "smile";

  const ribbon = (pts, width = thick, material = mat) =>
    g.add(new THREE.Mesh(_surfaceRibbonGeo(pts, width, theta0, phi0, opts, st, bumps, lift), material));

  const ellipse = (cx, cy, rx, ry, material = mat, segs = 20) =>
    g.add(new THREE.Mesh(_surfaceEllipseGeo(cx, cy, rx, ry, theta0, phi0, opts, st, bumps, lift, segs), material));

  function smilePoints(width, sag, y = 0, segs = 18, flip = false, tilt = 0) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs * 2 - 1;
      const x = u * width * 0.5;
      const bend = sag * (1 - u * u);
      pts.push({ x, y: y + u * tilt + (flip ? bend : -bend) });
    }
    return pts;
  }

  if (style === "smile" || style === "wide") {
    ribbon(smilePoints(size * (style === "wide" ? 1.05 : 0.78), size * (style === "wide" ? 0.22 : 0.18), size * 0.06, style === "wide" ? 24 : 18));
  } else if (style === "frown") {
    ribbon(smilePoints(size * 0.78, size * 0.18, -size * 0.03, 18, true));
  } else if (style === "dash") {
    const w = size * 0.82;
    ribbon([{ x: -w * 0.5, y: 0 }, { x: w * 0.5, y: 0 }]);
  } else if (style === "o") {
    g.add(new THREE.Mesh(_surfaceRingGeo(0, 0, size * 0.35, size * 0.19, theta0, phi0, opts, st, bumps, lift, 24), mat));
    ellipse(0, 0, size * 0.18, size * 0.18, inMat, 18);
  } else if (style === "grin") {
    ellipse(0, -size * 0.03, size * 0.45, size * 0.18, inMat, 22);
    ribbon(smilePoints(size * 0.92, size * 0.08, size * 0.08, 18));
    for (let i = 0; i < 4; i++) {
      const tx = (i / 3 - 0.5) * size * 0.52;
      g.add(new THREE.Mesh(_surfaceTriangleGeo([
        { x: tx - size * 0.035, y: size * 0.05 },
        { x: tx + size * 0.035, y: size * 0.05 },
        { x: tx, y: -size * 0.07 },
      ], theta0, phi0, opts, st, bumps, lift + 0.001), toothMat));
    }
  } else if (style === "fang") {
    const w = size * 0.82;
    ribbon([{ x: -w * 0.5, y: size * 0.04 }, { x: w * 0.5, y: size * 0.04 }]);
    for (const side of [-1, 1]) {
      g.add(new THREE.Mesh(_surfaceTriangleGeo([
        { x: side * size * 0.22 - size * 0.045, y: size * 0.02 },
        { x: side * size * 0.22 + size * 0.045, y: size * 0.02 },
        { x: side * size * 0.22, y: -size * 0.22 },
      ], theta0, phi0, opts, st, bumps, lift + 0.001), toothMat));
    }
  } else if (style === "smirk") {
    ribbon(smilePoints(size * 0.80, size * 0.14, size * 0.02, 18, false, size * 0.10));
  } else if (style === "tongue") {
    ribbon(smilePoints(size * 0.82, size * 0.18, size * 0.06, 18));
    ellipse(0, -size * 0.16, size * 0.18, size * 0.09, tonMat, 18);
  }

  return g;
}

/* ────────── Face (eyes + mouth) ──────────
   Eyes use the local deformed-surface normal. Mouth ribbons still sample
   the procedural surface so they follow warped low-poly body variants. */
function buildFace(opts, st, localBumps, skipMouth = false) {
  const g = new THREE.Group();
  const ft = opts.faceTheta;
  const eyeAz = opts.type === "dragon" ? Math.min(opts.eyeAzimuth, 0.24) : opts.eyeAzimuth;
  for (const side of [-1, 1]) {
    g.add(buildSurfaceEyeDecal(ft + side * eyeAz, opts.eyePhi, opts, st, localBumps));
  }

  if (!skipMouth) {
    g.add(buildSurfaceMouth(opts, st, localBumps));
  }

  return g;
}

/* Wing material: cloned from the body so wings read as the same skin.
   Optional darken keeps a subtle wing/body contrast. */
function _wingMaterial(opts, darken = 0.85) {
  const c = new THREE.Color(opts.color).multiplyScalar(darken);
  return new THREE.MeshPhongMaterial({
    color: c,
    transparent: opts.opacity < 1, opacity: opts.opacity,
    shininess: opts.shininess,
    specular: new THREE.Color(opts.specular),
    flatShading: true,
    side: THREE.DoubleSide,
  });
}

function _featureMaterial(color, opts, side = THREE.FrontSide) {
  return new THREE.MeshPhongMaterial({
    color: new THREE.Color(color),
    transparent: opts.opacity < 1,
    opacity: opts.opacity,
    shininess: Math.max(8, opts.shininess * 0.7),
    specular: new THREE.Color(opts.specular),
    flatShading: true,
    side,
  });
}

function _surfaceNormalFromPoint(p) {
  const n = new THREE.Vector3(p.x, p.y, p.z);
  if (n.lengthSq() < 1e-6) return new THREE.Vector3(0, 1, 0);
  return n.normalize();
}

function _surfaceNormalAtAngles(theta, phi, opts, st, localBumps) {
  const dt = 0.018;
  const dp = 0.018;
  const center = _surfacePoint(theta, phi, opts, st, localBumps, 0.0);
  const a = _surfacePoint(theta + dt, phi, opts, st, localBumps, 0.0);
  const b = _surfacePoint(theta - dt, phi, opts, st, localBumps, 0.0);
  const c = _surfacePoint(theta, phi + dp, opts, st, localBumps, 0.0);
  const d = _surfacePoint(theta, phi - dp, opts, st, localBumps, 0.0);
  const tTheta = new THREE.Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
  const tPhi = new THREE.Vector3(c.x - d.x, c.y - d.y, c.z - d.z);
  const n = tPhi.cross(tTheta);
  const radial = new THREE.Vector3(center.x, center.y, center.z);
  if (n.lengthSq() < 1e-8) return _surfaceNormalFromPoint(center);
  if (radial.lengthSq() > 1e-8 && n.dot(radial) < 0) n.negate();
  return n.normalize();
}

function _orientLocalAxis(mesh, fromAxis, toAxis) {
  mesh.quaternion.setFromUnitVectors(fromAxis, toAxis);
}

/* Builds a wing as a custom fan geometry. Every vertex lies in the
   +X half-space (pivot at origin, vertices extend toward +X only),
   with chord in Z and thin Y. No half-sphere ambiguity. */
function _buildWingGeo(span, fingers, scallopAmt = 0.06, chordRatio = 0.38) {
  const verts = [];
  const idx = [];
  const RINGS = 5;
  const RADIALS = 9;

  /* pivot vertex at origin */
  verts.push(0, 0, 0);

  for (let ri = 0; ri < RINGS; ri++) {
    const t = (ri + 1) / RINGS;
    for (let ai = 0; ai < RADIALS; ai++) {
      /* sweep from -π/2 (back edge) to +π/2 (front edge) */
      const a = ((ai / (RADIALS - 1)) - 0.5) * Math.PI;
      const baseR = span * t;
      /* rib bumps extend the outer edge slightly where cos(a*fingers) peaks */
      const rib = Math.cos(a * fingers);
      const outerPush = (t > 0.5) ? rib * 0.10 * (t - 0.5) : 0;
      const r = baseR * (1 + outerPush);
      /* primary: +X axis is wing span; Z axis is chord; chord shortened */
      let x = r * Math.cos(a);
      let z = r * Math.sin(a) * chordRatio;
      /* scallop trailing edge by pulling +/- Z slightly inward at scallop nodes */
      const scallop = -scallopAmt * Math.max(0, Math.sin(a * fingers * 1.5)) * t;
      z += scallop * span;
      /* small Y thickness so it isn't a paper-thin shell; ribs vary it */
      let y = rib * span * 0.04 * t;
      verts.push(x, y, z);
    }
  }

  /* triangulate: pivot → first ring */
  const ringStart = (ri) => 1 + ri * RADIALS;
  for (let ai = 0; ai < RADIALS - 1; ai++) {
    idx.push(0, ringStart(0) + ai, ringStart(0) + ai + 1);
  }
  /* between rings */
  for (let ri = 0; ri < RINGS - 1; ri++) {
    for (let ai = 0; ai < RADIALS - 1; ai++) {
      const a0 = ringStart(ri) + ai;
      const a1 = a0 + 1;
      const b0 = ringStart(ri + 1) + ai;
      const b1 = b0 + 1;
      idx.push(a0, b0, a1);
      idx.push(a1, b0, b1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ────────── Stegosaurus-style back plates ──────────
   N standing pentagonal plates along the spine, sized by a sine
   envelope (small at neck/tail, biggest in the middle). Each plate's
   broadside faces ±X so the row reads as a saw-tooth ridge from
   the side view. */
function buildStegoPlates(opts, st, bumps) {
  const N = Math.max(0, opts.stegoPlateCount | 0);
  if (N === 0) return null;

  const grp = new THREE.Group();
  const r = opts.radius;
  const ft = opts.faceTheta;

  /* material — match body skin, slightly darker by default */
  const plateMat = (opts.stegoPlateColor && opts.stegoPlateColor !== "")
    ? new THREE.MeshPhongMaterial({
        color: new THREE.Color(opts.stegoPlateColor),
        transparent: opts.opacity < 1, opacity: opts.opacity,
        shininess: opts.shininess,
        specular: new THREE.Color(opts.specular),
        flatShading: true, side: THREE.DoubleSide,
      })
    : _wingMaterial(opts, 0.78);

  const Hmax = opts.stegoPlateHeight * r;
  const Wmax = opts.stegoPlateWidth * r;
  const thick = opts.stegoPlateThickness * r;

  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N;
    /* size envelope — large in middle, small at ends */
    const sizeMul = 0.45 + 0.55 * Math.sin(t * Math.PI);
    const h = Hmax * sizeMul;
    const w = Wmax * sizeMul;

    /* Pentagonal plate shape — wider at the base, peak at top */
    const shape = new THREE.Shape();
    shape.moveTo(-w * 0.50, 0);
    shape.lineTo(-w * 0.55, h * 0.55);
    shape.lineTo( 0,        h);
    shape.lineTo( w * 0.55, h * 0.55);
    shape.lineTo( w * 0.50, 0);
    shape.lineTo(-w * 0.50, 0);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thick, bevelEnabled: false,
    });
    /* Center extrusion thickness on Z=0 (so plate's mid-plane is the body's X axis) */
    geo.translate(0, 0, -thick / 2);
    geo.computeVertexNormals();

    const plate = new THREE.Mesh(geo, plateMat);

    /* Place along the spine — sweep theta from just-behind-the-neck to the tail */
    const spineTheta = ft - 0.35 - t * (Math.PI - 0.55);
    const p = _surfacePoint(spineTheta, Math.PI * 0.30, opts, st, bumps, 0);
    plate.position.set(p.x, p.y, p.z);
    /* Rotate plate so its broadside faces ±X (visible from the sides).
       After this rotation:
         local X (plate width)     → world Z (along body length)
         local Y (plate height)    → world Y (sticking up)
         local Z (plate thickness) → world X (across body) */
    plate.rotation.y = Math.PI / 2;

    grp.add(plate);
  }
  return grp;
}

/* ────────── Dragon wings — flat-shaded body material, custom +X fan
   geometry guarantees wings extend strictly LATERALLY (not into the
   body or out of the front/back). ────────── */
function buildDragonWings(opts, _bodyColorHex) {
  const grp = new THREE.Group();
  const r = opts.radius;
  const ws = opts.wingSpan * r;

  const wingMat = (opts.wingColor && opts.wingColor !== "")
    ? new THREE.MeshPhongMaterial({
        color: new THREE.Color(opts.wingColor),
        transparent: opts.opacity < 1, opacity: opts.opacity,
        shininess: opts.shininess,
        specular: new THREE.Color(opts.specular),
        flatShading: true, side: THREE.DoubleSide,
      })
    : _wingMaterial(opts, 0.85);

  const fingers = Math.max(2, opts.wingFingers | 0);
  const baseGeo = _buildWingGeo(ws, fingers, 0.08, 0.40);

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(baseGeo, wingMat);
    /* mirror to left side by rotating 180° about Y, not negative scale */
    if (side === -1) wing.rotation.y = Math.PI;
    /* attach at arm-pit on the lateral/back side of the body */
    const shoulderX = side * r * opts.bodyStretchX * 1.03;
    wing.position.set(shoulderX, r * 0.26, -r * opts.bodyStretchZ * 0.10);
    /* readable bat-wing silhouette: swept back, lifted at the tip */
    wing.rotation.y += side * -0.20;
    wing.rotation.z = side * 0.18;
    wing.userData._wingSide = side;
    grp.add(wing);
  }
  return grp;
}

function buildDragonHorns(opts, st, bumps) {
  if (!opts.dragonHornMeshes) return null;
  const grp = new THREE.Group();
  const r = opts.radius;
  const ft = opts.faceTheta;
  const hornPhi = Math.PI * 0.42;
  const hornOff = opts.hornSpread * Math.PI;
  const h = Math.max(0.02, opts.dragonHornMeshHeight * r);
  const base = Math.max(0.01, opts.dragonHornMeshRadius * r);
  const mat = _featureMaterial(opts.dragonHornColor || "#edd88a", opts);
  const geo = new THREE.ConeGeometry(base, h, 5, 1);

  for (const side of [-1, 1]) {
    const p = _surfacePoint(ft + side * hornOff, hornPhi, opts, st, bumps, 0.03);
    const n = _surfaceNormalFromPoint(p);
    const horn = new THREE.Mesh(geo, mat);
    _orientLocalAxis(horn, new THREE.Vector3(0, 1, 0), n);
    horn.position.set(
      p.x + n.x * h * 0.42,
      p.y + n.y * h * 0.42,
      p.z + n.z * h * 0.42
    );
    grp.add(horn);
  }
  return grp;
}

function _buildDragonTailGeo(length, thickness, lift) {
  const verts = [];
  const idx = [];
  const rings = 7;
  const segs = 8;

  for (let ri = 0; ri < rings; ri++) {
    const t = ri / (rings - 1);
    const taper = Math.pow(1 - t, 0.85);
    const radX = thickness * taper * (1 - 0.08 * t);
    const radY = thickness * 0.72 * taper;
    const centerY = lift * Math.sin(t * Math.PI * 0.80) + lift * 0.28 * t;
    const centerZ = -length * t;
    for (let si = 0; si < segs; si++) {
      const a = (si / segs) * Math.PI * 2;
      const x = Math.cos(a) * radX;
      const y = centerY + Math.sin(a) * radY;
      verts.push(x, y, centerZ);
    }
  }

  for (let ri = 0; ri < rings - 1; ri++) {
    const a0 = ri * segs;
    const b0 = (ri + 1) * segs;
    for (let si = 0; si < segs; si++) {
      const a = a0 + si;
      const b = a0 + ((si + 1) % segs);
      const c = b0 + si;
      const d = b0 + ((si + 1) % segs);
      idx.push(a, c, b);
      idx.push(b, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildDragonTail(opts, st, bumps) {
  if (!opts.dragonTail) return null;
  const r = opts.radius;
  const length = Math.max(0.05, opts.dragonTailLength * r);
  const thick = Math.max(0.01, opts.dragonTailThickness * r);
  const lift = opts.dragonTailLift * r;
  const geo = _buildDragonTailGeo(length, thick, lift);
  const mat = _wingMaterial(opts, 0.92);
  const tail = new THREE.Mesh(geo, mat);
  const p = _surfacePoint(opts.faceTheta + Math.PI, -0.20, opts, st, bumps, 0.00);
  tail.position.set(p.x, p.y, p.z);
  return tail;
}

/* Simple chicken wing — small flattened ovoid, oriented to sit
   against the body's lateral side. */
function _buildChickenWingGeo(ws) {
  const g = new THREE.SphereGeometry(ws, 6, 4);
  /* thin against body (X), modest height (Y), elongated chord (Z) */
  g.scale(0.28, 0.75, 1.30);
  /* slight rounded back-taper */
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (z < 0) {
      const k = 1 - Math.min(1, -z / (ws * 1.3)) * 0.30;
      x *= k; y *= k;
    }
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

/* Chicken wings — single small ovoid per side, attached at the body's
   lateral surface. Pivot moved INSIDE the ovoid so its inner face
   actually meets the body geometry instead of floating off it. */
function buildChickenWings(opts, st, bumps) {
  const grp = new THREE.Group();
  const r = opts.radius;
  const ws = opts.chickenWingMeshSize * r;
  const wingMat = _wingMaterial(opts, 0.94);
  const baseGeo = _buildChickenWingGeo(ws);

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(baseGeo, wingMat);
    /* place the wing's center ON the body's lateral surface */
    const lateralTheta = side > 0 ? 0 : Math.PI;   // +X or -X
    const p = _surfacePoint(lateralTheta, -0.05, opts, st, bumps, 0);
    /* push the ovoid OUTWARD by half its X-scale-extent so its inner
       edge sits ~flush with the body surface */
    const outwardX = side * ws * 0.28 * 0.5;
    wing.position.set(p.x + outwardX, p.y, p.z);
    /* mirror left side via rotation */
    if (side === -1) wing.rotation.y = Math.PI;
    /* small back/down tilt — folded against the body */
    wing.rotation.y += side * -0.08;
    wing.rotation.z = side * 0.18;
    wing.userData._wingSide = side;
    grp.add(wing);
  }
  return grp;
}

function buildChickenBeak(opts, st, bumps) {
  if (!opts.beakMesh) return null;
  const r = opts.radius;
  const len = Math.max(0.02, opts.beakMeshLength * r);
  const ft = opts.faceTheta;
  const fp = 0.055;
  const halfTheta = Math.max(0.035, opts.beakMeshWidth * 0.42);
  const halfPhi = Math.max(0.025, opts.beakMeshHeight * 0.42);
  const baseInset = -0.115;

  const center = _surfacePoint(ft, fp, opts, st, bumps, baseInset);
  const left   = _surfacePoint(ft - halfTheta, fp, opts, st, bumps, baseInset);
  const right  = _surfacePoint(ft + halfTheta, fp, opts, st, bumps, baseInset);
  const top    = _surfacePoint(ft, fp + halfPhi, opts, st, bumps, baseInset);
  const bottom = _surfacePoint(ft, fp - halfPhi, opts, st, bumps, baseInset);
  const n = _surfaceNormalFromPoint(center);
  const tip = {
    x: center.x + n.x * len,
    y: center.y + n.y * len,
    z: center.z + n.z * len,
  };

  const verts = new Float32Array([
    left.x, left.y, left.z,
    top.x, top.y, top.z,
    right.x, right.y, right.z,
    bottom.x, bottom.y, bottom.z,
    tip.x, tip.y, tip.z,
  ]);
  const idx = [
    0, 1, 4,
    1, 2, 4,
    2, 3, 4,
    3, 0, 4,
    0, 3, 1,
    1, 3, 2,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, _featureMaterial(opts.beakColor || "#f1a93a", opts));
}

function buildChickenComb(opts, st, bumps) {
  if (!opts.combMesh) return null;
  const grp = new THREE.Group();
  const r = opts.radius;
  const ft = opts.faceTheta;
  const mat = _featureMaterial(opts.combColor || "#d4361f", opts);
  const count = Math.min(4, Math.max(0, opts.combCount | 0));

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const theta = ft - t * 0.46;
    const phi = Math.PI * (0.36 + t * 0.07);
    const side = Math.max(0.018, opts.combWidth * 0.34);
    const pL = _surfacePoint(theta - side, phi, opts, st, bumps, 0.035);
    const pR = _surfacePoint(theta + side, phi, opts, st, bumps, 0.035);
    const mid = _surfacePoint(theta, phi, opts, st, bumps, 0.040);
    const n = _surfaceNormalFromPoint(mid);
    const h = r * opts.combHeight * (0.58 + 0.28 * Math.sin(t * Math.PI));
    const top = new THREE.Vector3(mid.x, mid.y, mid.z).addScaledVector(n, h);
    const verts = new Float32Array([
      pL.x, pL.y, pL.z,
      pR.x, pR.y, pR.z,
      top.x, top.y, top.z,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.setIndex([0, 1, 2]);
    geo.computeVertexNormals();
    const plate = new THREE.Mesh(geo, mat);
    plate.renderOrder = 4;
    grp.add(plate);
  }
  return grp;
}

function buildChickenWattles(opts, st, bumps) {
  if (!opts.wattleMesh || opts.wattleHeight <= 0) return null;
  const grp = new THREE.Group();
  const r = opts.radius;
  const mat = _featureMaterial(opts.wattleColor || opts.combColor || "#d4361f", opts);
  const size = Math.max(0.01, r * opts.wattleHeight * 0.40);
  const geo = new THREE.SphereGeometry(size, 8, 6);

  for (const side of [-1, 1]) {
    const p = _surfacePoint(opts.faceTheta + side * 0.09, -0.28, opts, st, bumps, 0.06);
    const wattle = new THREE.Mesh(geo, mat);
    wattle.scale.set(0.78, 1.45, 0.72);
    wattle.position.set(p.x, p.y, p.z);
    grp.add(wattle);
  }
  return grp;
}

function buildChickenTail(opts, st, bumps) {
  if (!opts.chickenTailMesh || opts.tailNubCount <= 0) return null;
  const grp = new THREE.Group();
  const r = opts.radius;
  const bt = opts.faceTheta + Math.PI;
  const color = opts.tailNubColor || `#${new THREE.Color(opts.color).multiplyScalar(0.95).getHexString()}`;
  const mat = _featureMaterial(color, opts);
  const nubs = Math.min(5, Math.max(1, opts.tailNubCount | 0));
  const len = Math.max(0.02, opts.chickenTailLength * r);
  const base = Math.max(0.01, opts.tailNubHeight * r * 0.30);
  const geo = _buildDragonTailGeo(len, base, len * 0.28);

  for (let i = 0; i < nubs; i++) {
    const u = nubs === 1 ? 0 : (i / (nubs - 1)) - 0.5;
    const p = _surfacePoint(bt + u * 0.28, 0.12 + Math.abs(u) * 0.10, opts, st, bumps, 0.04);
    const feather = new THREE.Mesh(geo, mat);
    feather.rotation.y = u * 0.45;
    feather.rotation.x = -0.30;
    feather.position.set(p.x, p.y, p.z);
    grp.add(feather);
  }
  return grp;
}

/* ────────── Main builder ────────── */
export function buildSlimeGiant(optsIn = {}) {
  const opts = { ...DEFAULT_OPTS, ...optsIn };

  /* dragons need more vertices so sharp built-in features (stego plates,
     fangs, mouth carve) actually resolve */
  if (opts.type === "dragon") {
    opts.widthSeg  = Math.max(opts.widthSeg,  opts.dragonWidthSeg, 18);
    opts.heightSeg = Math.max(opts.heightSeg, opts.dragonHeightSeg, 14);
  }

  const root = new THREE.Group();
  root.name = opts.name || "SlimeGiant";

  /* collect creature-feature bumps */
  let bumps = [];
  if (opts.type === "dragon") bumps = dragonBumps(opts);
  else if (opts.type === "chicken") bumps = chickenBumps(opts);

  /* harmonic state shared by body geo + surface sampling for face */
  const st = _harmonicState(opts);

  const bodyGeo = makeBodyGeo(opts, bumps);
  const usingVC = !!bodyGeo.userData.anyTint;

  const bodyMat = new THREE.MeshPhongMaterial({
    color: usingVC ? "#ffffff" : opts.color,
    vertexColors: usingVC,
    transparent: opts.opacity < 1,
    opacity: opts.opacity,
    shininess: opts.shininess,
    specular: new THREE.Color(opts.specular),
    flatShading: true,
    side: THREE.FrontSide,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  /* lift so bottom sits at y=0 (after squat flatten) */
  body.position.y = opts.radius * opts.squat * opts.heightMult;
  root.add(body);

  let face = null;
  if (opts.face) {
    /* dragons with built-in mouth: build face with mouth suppressed */
    const builtInMouth = (opts.type === "dragon" && opts.dragonBuiltInMouth);
    const chickenBeakMouth = (opts.type === "chicken" && opts.chickenMouth === false);
    face = buildFace(opts, st, bumps, /*skipMouth=*/builtInMouth || chickenBeakMouth);
    body.add(face);
  }

  /* type-specific wing meshes — share the body material */
  let wings = null;
  if (opts.type === "dragon" && opts.wings) {
    wings = buildDragonWings(opts, opts.color);
    body.add(wings);
  } else if (opts.type === "chicken" && opts.chickenWings) {
    wings = buildChickenWings(opts, st, bumps);
    body.add(wings);
  }

  if (opts.type === "dragon") {
    const horns = buildDragonHorns(opts, st, bumps);
    if (horns) body.add(horns);
    const tail = buildDragonTail(opts, st, bumps);
    if (tail) body.add(tail);
  } else if (opts.type === "chicken") {
    const beak = buildChickenBeak(opts, st, bumps);
    if (beak) body.add(beak);
    const comb = buildChickenComb(opts, st, bumps);
    if (comb) body.add(comb);
    const wattles = buildChickenWattles(opts, st, bumps);
    if (wattles) body.add(wattles);
    const tail = buildChickenTail(opts, st, bumps);
    if (tail) body.add(tail);
  }

  let t = 0;
  function update(dt) {
    t += dt;
    const sq = opts.idleSquish;
    const sy = 1 + Math.sin(t * opts.idleSpeed) * sq;
    const sxz = 1 - Math.sin(t * opts.idleSpeed) * sq * 0.5;
    body.scale.y = sy;
    body.scale.x = sxz;
    body.scale.z = sxz;

    if (wings) {
      /* chickens flutter faster + smaller; dragons flap slower + bigger */
      const isChicken = opts.type === "chicken";
      const speed = isChicken ? 7.0 : 3.0;
      const amp   = isChicken ? 0.18 : 0.35;
      const rest  = isChicken ? 0.25 : 0.15;
      const flap = Math.sin(t * speed) * amp;
      wings.traverse(c => {
        if (c.userData?._wingSide) {
          c.rotation.z = c.userData._wingSide * (rest - flap);
        }
      });
    }
  }

  return { root, update, body, face, wings, opts };
}

/* ────────── Helpers exported for the editor ────────── */
export function randomColor(rng, type = "slime") {
  const pal = COLOR_PALETTES[type] || COLOR_PALETTES.slime;
  return pal[(rng() * pal.length) | 0];
}

export function randomMouthStyle(rng) {
  return MOUTH_STYLES[(rng() * MOUTH_STYLES.length) | 0];
}

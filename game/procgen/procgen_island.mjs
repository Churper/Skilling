// Procgen islands — pure ES module, runs in Node and browser.
// Fully deterministic: same seed + opts = identical island.
// Optimized for zero allocations in hot loops; typed arrays throughout.

// ─── PRNG (Mulberry32 — small, fast, decent) ──────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a 32-bit hash of integer args. Used to derive child seeds.
export function hash32(...nums) {
  let h = 0x811C9DC5 >>> 0;
  for (let i = 0; i < nums.length; i++) {
    let v = nums[i] >>> 0;
    for (let b = 0; b < 4; b++) {
      h ^= v & 0xFF;
      h = Math.imul(h, 0x01000193) >>> 0;
      v >>>= 8;
    }
  }
  return h >>> 0;
}

// ─── 2D Value-Noise (fast, seeded, good enough for terrain) ───────────────
// Actual simplex is overkill for our needs. Value-noise w/ smoothstep looks great
// for island heightmaps and is ~2x faster.
export function createNoise(seed) {
  const rand = mulberry32(seed);
  const PERM = new Uint16Array(512);
  const GRAD = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    PERM[i] = i;
    GRAD[i] = rand() * 2 - 1;
  }
  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    const t = PERM[i]; PERM[i] = PERM[j]; PERM[j] = t;
  }
  for (let i = 0; i < 256; i++) PERM[i + 256] = PERM[i];

  // Smooth value noise. Returns [-1, 1].
  function value2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const xi8 = xi & 255, yi8 = yi & 255;
    const a = GRAD[PERM[(xi8 + PERM[yi8]) & 255]];
    const b = GRAD[PERM[(xi8 + 1 + PERM[yi8]) & 255]];
    const c = GRAD[PERM[(xi8 + PERM[(yi8 + 1) & 255]) & 255]];
    const d = GRAD[PERM[(xi8 + 1 + PERM[(yi8 + 1) & 255]) & 255]];
    const ab = a + u * (b - a);
    const cd = c + u * (d - c);
    return ab + v * (cd - ab);
  }

  // Fractal brownian motion: multi-octave value noise, returns ~[-1, 1].
  function fbm2(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * value2(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
  return { value2, fbm2 };
}

// ─── Biome / height profiles ──────────────────────────────────────────────
// Palette entries are Three.js-style linear RGB floats (match chunk format).
export const BIOMES = {
  tropical: {
    tint: [0.92, 0.86, 0.45],
    sand:  [0.62, 0.50, 0.32],
    grass: [0.16, 0.52, 0.18],   // saturated tropical green
    hill:  [0.18, 0.36, 0.16],   // green-leaning jungle hillside
    peak:  [0.42, 0.40, 0.36],   // grey-brown stone
    peakHeight: 9.0, beachWidth: 7, hillSteepness: 1.2, noiseScale: 0.015,
    shoreIrregularity: 0.22, propDensity: 0.9,
    /* No grass or flowers — user wants rocks, trees, bushes only. */
    props: [
      /* trees (weighted by count) */
      'Palm_Tree', 'Palm_Tree', 'Palm_Tree_1', 'Palm_Tree_2',
      'Prop_Tree_Palm_1', 'Prop_Tree_Palm_2', 'Prop_Tree_Palm_3',
      /* stumps / hollow trunks / branches — landscape detail */
      'Prop_Stump', 'Prop_Hollow_Trunk',
      'Prop_Branch_1', 'Prop_Branch_2', 'Prop_Branch_3',
      /* bushes (mixed) */
      'Tropical_Fern', 'Pineapple_Plant', 'Coconut_Pile',
      'Prop_Bush_1', 'Prop_Bush_2', 'Prop_Bush_3', 'Bush',
      /* rocks — stick with Rock_3_A/C/E/G (user-approved) + a few Rock_1_A/2_A
         and a couple Prop_Rock variants. No Golem_Rocks, no Rock_1_J/K. */
      'Rock_3_A', 'Rock_3_A', 'Rock_3_C', 'Rock_3_E', 'Rock_3_G',
      'Rock_1_A', 'Rock_2_A',
      'Prop_Rock_1', 'Prop_Rock_2',
      'Coral_Rock', 'Coral_Rock',
    ],
    rareProps: [
      'Mossy_Log', 'Crystal_Bloom',
      'Rocks_Ore_Tin', 'Rocks_Ore_Copper', 'Rocks_Ore_Silver',
      'Volcanic_Tree',
      'Svc_Forage_Elder',
      'Coral_Rock', 'Pineapple_Bush', 'Coconut_Pile',
    ],
  },
  temperate: {
    tint: [0.62, 0.78, 0.50],
    sand:  [0.60, 0.52, 0.36],
    grass: [0.18, 0.50, 0.22],   // saturated forest green
    hill:  [0.20, 0.36, 0.18],   // green-leaning hillside
    peak:  [0.45, 0.43, 0.40],   // grey stone
    peakHeight: 10.0, beachWidth: 6, hillSteepness: 1.3, noiseScale: 0.016,
    shoreIrregularity: 0.20, propDensity: 1.0,
    props: [
      /* trees */
      'Toon_Oak', 'Toon_Willow', 'Toon_Pine',
      'Prop_Tree_Oak_1', 'Prop_Tree_Oak_2', 'Prop_Tree_Oak_3',
      'Prop_Tree_Cedar_1', 'Prop_Tree_Cedar_2',
      'Birch_Tree', 'Autumn_Tree',
      /* stumps / hollow trunks / branches */
      'Prop_Stump', 'Prop_Hollow_Trunk',
      'Prop_Branch_1', 'Prop_Branch_2', 'Prop_Branch_3',
      /* bushes (mixed) */
      'Berry_Bush', 'Bush', 'Prop_Bush_1', 'Prop_Bush_2', 'Prop_Bush_3',
      /* rocks — only Rock_3_* and a couple alternates. No Golem, no J/K. */
      'Rock_3_A', 'Rock_3_A', 'Rock_3_C', 'Rock_3_E', 'Rock_3_G',
      'Rock_1_A', 'Rock_2_A', 'Rock_4',
      'Prop_Rock_1', 'Prop_Rock_2',
      'Mossy_Rock', 'Mossy_Rock',
    ],
    rareProps: [
      'Mossy_Log', 'Mossy_Log',
      'Rocks_Ore_Copper', 'Rocks_Ore_Silver', 'Rocks_Ore_Platinum',
      'Rocks_Ore_Moonstone', 'Rocks_Ore_Celestial', 'Rocks_Ore_Sunstone',
      'Tree_Spiral_1', 'Tree_Spiral_2', 'Tree_Spiral_3',
      'Steelbark', 'Steelbark',
      'Roots', 'Candy_Spire',
      'Emberheart_Tree',
      'Spiritwood', 'Spiritwood',
      'Starbloom_Bush',
      'Rocks_Ore_Holystone',
      'Svc_Forage_Elder', 'Svc_Forage_Golden',
      'Mossy_Rock', 'Mossy_Rock', 'Mossy_Rock',
      'Wildflower_Patch',
    ],
  },
  snow: {
    tint: [0.85, 0.90, 0.98],
    sand:  [0.70, 0.78, 0.86],   // slate-blue snow shore (darker, B clearly > R)
    grass: [0.62, 0.74, 0.84],   // packed snow with shadow
    hill:  [0.72, 0.82, 0.90],
    peak:  [0.88, 0.92, 0.98],
    peakHeight: 13.0, beachWidth: 5, hillSteepness: 1.5, noiseScale: 0.018,
    shoreIrregularity: 0.25, propDensity: 0.7,
    props: [
      /* trees */
      'Ice_Pine', 'Ice_Oak', 'Ice_Stump',
      'Pine_Tree_Snow', 'Birch_Tree_Snow', 'Birch_Tree_Dead_Snow',
      /* stumps / trunks / branches */
      'Prop_Stump', 'Prop_Hollow_Trunk',
      'Prop_Branch_1', 'Prop_Branch_2',
      /* bushes (mixed) */
      'Frost_Bush', 'Berry_Bush', 'Prop_Bush_1', 'Prop_Bush_2',
      /* rocks — Rock_3_* primary + crystals + ice. No Golem/J/K. */
      'Rock_3_A', 'Rock_3_C', 'Rock_3_E', 'Rock_3_G',
      'Rock_1_A', 'Rock_2_A',
      'Ice_Block', 'Crystal_1', 'Crystal_2',
      'Prop_Rock_1',
      'Glacial_Rock', 'Glacial_Rock',
    ],
    rareProps: [
      'Ice_Spire', 'Snowdrift_Cairn',
      'Rocks_Ore_Silver', 'Rocks_Ore_Platinum',
      'Rocks_Ore_Moonstone', 'Rocks_Ore_Moonstone',
      'Svc_Forage_Frost', 'Svc_Forage_Crystal',
      'Glacial_Rock', 'Ice_Stump',
      'Petrified_Tree', 'Dusk_Tree',
      'Rocks_Ore_Twilight', 'Rocks_Ore_Twilight',
      'Rocks_Ore_Void', 'Rocks_Ore_Void',
    ],
  },
  desert: {
    tint: [0.85, 0.72, 0.42],
    sand:  [0.62, 0.50, 0.32],   // muted dune (was too bright when noise added on top)
    grass: [0.52, 0.40, 0.22],   // dry scrub
    hill:  [0.50, 0.40, 0.28],   // canyon
    peak:  [0.46, 0.40, 0.32],   // sandstone
    peakHeight: 7.0, beachWidth: 10, hillSteepness: 0.9, noiseScale: 0.012,
    shoreIrregularity: 0.20, propDensity: 0.5,
    props: [
      /* trees / flora */
      'Cactus', 'Cactus_Flowers', 'Desert_Yucca',
      'Bone_Skull',
      /* stumps / branches — dead driftwood vibe */
      'Prop_Stump', 'Prop_Branch_1', 'Prop_Branch_2', 'Prop_Branch_3',
      /* bushes (mixed) */
      'Bush', 'Prop_Bush_1', 'Prop_Bush_2',
      /* rocks — Rock_3_* primary, cliff rocks fit desert, no Golem */
      'Rock_3_A', 'Rock_3_C', 'Rock_3_E', 'Rock_3_G',
      'Rock_1_A', 'Rock_2_A', 'Rock_4',
      'Prop_Cliff_Rock_1', 'Prop_Cliff_Rock_2',
      'Sandstone_Pillar', 'Sandstone_Pillar',
    ],
    rareProps: [
      'Sandstone_Arch',
      'Rocks_Ore_Copper', 'Rocks_Ore_Titanium', 'Rocks_Ore_Sunstone',
      'Rocks_Ore_Volcanic',
      'Svc_Forage_Ember', 'Svc_Forage_Golden',
      'Sandstone_Pillar', 'Yucca_Bush',
    ],
  },
  volcanic: {
    tint: [0.50, 0.22, 0.18],
    sand:  [0.22, 0.18, 0.16],   // ash bed
    grass: [0.26, 0.16, 0.12],   // scorched earth
    hill:  [0.20, 0.12, 0.10],   // charcoal
    peak:  [0.62, 0.24, 0.10],   // glowing lava cap
    peakHeight: 16.0, beachWidth: 4, hillSteepness: 1.8, noiseScale: 0.020,
    shoreIrregularity: 0.30, propDensity: 0.6,
    props: [
      /* trees / dead things */
      'Ash_Stump', 'Obsidian_Cluster', 'Dead_Trees',
      /* stumps / branches — burnt landscape detail */
      'Prop_Stump', 'Prop_Hollow_Trunk',
      'Prop_Branch_1', 'Prop_Branch_2', 'Prop_Branch_3',
      /* bushes (mixed) */
      'Bush', 'Prop_Bush_3',
      /* rocks — Rock_3_* primary, cliff rocks for volcanic vibe */
      'Rock_3_A', 'Rock_3_C', 'Rock_3_E', 'Rock_3_G', 'Rock_4',
      'Rock_2_A',
      'Prop_Cliff_Rock_1', 'Prop_Cliff_Rock_2',
      'Bone_Skull',
      'Volcanic_Tree', 'Volcanic_Tree',
    ],
    /* Removed Rocks_Ore_Meteor — meteor is a global server-driven event,
       not a procgen-island resource. */
    rareProps: [
      'Lava_Vent',
      'Rocks_Ore_Volcanic', 'Rocks_Ore_Cobalt', 'Rocks_Ore_Celestial',
      'Rocks_Ore_Twilight', 'Rocks_Ore_Void',
      'Rocks_Ore_Starite',
      'Svc_Forage_Ember', 'Svc_Forage_Shadow',
      'Volcanic_Tree',
      'Petrified_Tree', 'Emberheart_Tree',
    ],
  },
  mushroom: {
    tint: [0.50, 0.38, 0.62],
    sand:  [0.36, 0.30, 0.42],   // deep mauve, no orange
    grass: [0.28, 0.16, 0.38],   // deep violet
    hill:  [0.22, 0.12, 0.32],   // dark shadowed
    peak:  [0.42, 0.28, 0.52],   // deep cap (no bright pink)
    peakHeight: 8.5, beachWidth: 6, hillSteepness: 1.1, noiseScale: 0.017,
    shoreIrregularity: 0.40, propDensity: 1.1,
    props: [
      /* trees / mushroom flora */
      'Mushroom_Tree', 'Giant_Toadstool', 'Spore_Pod',
      'Crystal_Bloom', 'Mossy_Log',
      /* stumps / trunks */
      'Prop_Stump', 'Prop_Hollow_Trunk',
      /* bushes (mixed) */
      'Bush', 'Berry_Bush', 'Prop_Bush_2', 'Prop_Bush_3',
      /* rocks — Rock_3_* primary, plus crystals */
      'Rock_3_A', 'Rock_3_C', 'Rock_3_E',
      'Rock_1_A', 'Rock_2_A',
      'Crystal_1', 'Crystal_2', 'Crystal_3',
      'Spore_Rock', 'Spore_Rock',
    ],
    rareProps: [
      'Giant_Toadstool', 'Crystal_Bloom',
      'Rocks_Ore_Jade', 'Rocks_Ore_Opal',
      'Shroombark', 'Shroombark',
      'Candy_Spire', 'Roots',
      'Dusk_Tree', 'Dusk_Tree',
      'Nebula_Fruit_Plant', 'Nebula_Fruit_Plant',
      'Void_Blossom_Bush',
      'Svc_Forage_Shadow', 'Svc_Forage_Crystal',
      'Spore_Rock', 'Glow_Cap_Prop',
    ],
  },
  ribbon: {
    tint: [0.88, 0.65, 0.78],
    sand:  [0.72, 0.58, 0.46],   // rose-cream shore
    grass: [0.32, 0.52, 0.24],   // candied lush green
    hill:  [0.30, 0.40, 0.22],   // sage shadow
    peak:  [0.46, 0.42, 0.36],   // warm stone
    peakHeight: 9.0, beachWidth: 8, hillSteepness: 1.0, noiseScale: 0.013,
    shoreIrregularity: 0.35, propDensity: 0.8,
    props: [
      /* trees / flora */
      'Candy_Spire', 'Crystal_Bloom', 'Mossy_Log',
      'Toon_Willow',
      /* stumps / branches */
      'Prop_Stump', 'Prop_Branch_1', 'Prop_Branch_2',
      /* bushes (mixed) */
      'Bush', 'Berry_Bush', 'Prop_Bush_1', 'Prop_Bush_3',
      /* rocks — Rock_3_* primary, plus crystals. No Golem/J/K. */
      'Rock_3_A', 'Rock_3_C', 'Rock_3_G',
      'Rock_1_A', 'Rock_2_A',
      'Crystal_1', 'Crystal_2', 'Crystal_3',
    ],
    rareProps: [
      'Candy_Spire', 'Crystal_Bloom',
      'Tree_Spiral_1', 'Tree_Spiral_2', 'Tree_Spiral_3',
      'Roots', 'Rocks_Ore_Holystone', 'Rocks_Ore_Glowstone',
      'Spiritwood', 'Svc_Forage_Void', 'Svc_Forage_Crystal',
      'Astral_Tree', 'Starbloom_Bush',
      'Petrified_Tree', 'Rocks_Ore_Starite',
    ],
  },
  elder: {
    tint: [0.32, 0.48, 0.62],
    sand:  [0.40, 0.42, 0.40],   // weathered slate
    grass: [0.20, 0.36, 0.28],   // mossy shadow
    hill:  [0.16, 0.28, 0.24],   // dark moss
    peak:  [0.28, 0.42, 0.48],   // misty stone
    peakHeight: 14.0, beachWidth: 5, hillSteepness: 1.6, noiseScale: 0.018,
    shoreIrregularity: 0.25, propDensity: 0.7,
    props: [
      'Toon_Oak', 'Toon_Willow', 'Toon_Pine',
      'Prop_Tree_Oak_1', 'Prop_Tree_Oak_2',
      'Prop_Stump', 'Prop_Hollow_Trunk',
      'Prop_Branch_1', 'Prop_Branch_2', 'Prop_Branch_3',
      'Bush', 'Prop_Bush_1', 'Prop_Bush_2', 'Prop_Bush_3',
      'Rock_3_A', 'Rock_3_C', 'Rock_3_E', 'Rock_3_G',
      'Rock_1_A', 'Rock_2_A',
      'Crystal_1', 'Crystal_2', 'Crystal_3',
    ],
    /* Trimmed: removed duplicates and resources that already live in
       other biomes (Tree_Spiral→ribbon, Candy_Spire→ribbon/temperate,
       Roots→temperate, Astral_Tree second copy). Elder stays the
       endgame cluster but no longer hoards every mid-tier rare. */
    rareProps: [
      'Elder_Tree', 'Elder_Tree', 'Star_Ore', 'Star_Ore',
      'Astral_Tree', 'Astral_Berry_Bush',
      'Shroombark',
      'Nebula_Fruit_Plant', 'Void_Blossom_Bush',
      'Rocks_Ore_Twilight', 'Rocks_Ore_Void',
    ],
  },
};

export const BIOME_WEIGHTS = {
  tropical: 3, temperate: 4, snow: 1.5, desert: 1.5,
  volcanic: 0.8, mushroom: 0.6, ribbon: 0.4, elder: 0.2,
};

/* Max gather level allowed per island tier. Tiers are clamped to 2-6 by
   the catalog generator to match the minimap T1-T6 dropdown UI. Tightened
   so each ring stays distinct (no 350+ resources leaking into T2 or T3):
     T2 (inner): up to 270 — Tree_Spiral(235), Candy_Spire(270), Volcanic Ore(235), Celestial Ore(270)
     T3:        up to 325 — adds Roots(310), Petrified(325), Starite(325), Sunstone(310)
     T4 (mid):   up to 400 — adds Steelbark(350), Moonstone(350), Starbloom(350),
                              Emberheart(375), Twilight(375), Shroombark(400), Glowstone(400), Nebula(400)
     T5:        up to 450 — adds Dusk(425), Void Ore(425), Spiritwood(450), Holystone(450), Void Blossom(450)
     T6 (outer): up to 500 — adds Astral(475), Elder(500), Star Ore(500), Astral Berry(500) */
const TIER_MAX_LEVEL = [0, 200, 270, 325, 400, 450, 500, 500, 500, 500, 500];

const PROP_GATHER_LEVEL = {
  'Rocks_Ore_Tin': 1, 'Rocks_Ore_Copper': 15, 'Rocks_Ore_Quartz': 30,
  'Rocks_Ore_Silver': 50, 'Rocks_Ore_Platinum': 75, 'Rocks_Ore_Cobalt': 100,
  'Rocks_Ore_Jade': 135, 'Rocks_Ore_Titanium': 170, 'Rocks_Ore_Opal': 185,
  'Crystal_Ore_Gem': 200, 'Rocks_Ore_Volcanic': 235, 'Rocks_Ore_Celestial': 270,
  'Rocks_Ore_Meteor': 200, 'Rocks_Ore_Sunstone': 310, 'Rocks_Ore_Moonstone': 350,
  'Rocks_Ore_Glowstone': 400, 'Rocks_Ore_Holystone': 450, 'Star_Ore': 500,
  'Rocks_Ore_Starite': 325, 'Rocks_Ore_Twilight': 375, 'Rocks_Ore_Void': 425,
  'Tree_Spiral_1': 235, 'Tree_Spiral_2': 235, 'Tree_Spiral_3': 235,
  'Candy_Spire': 270, 'Roots': 310,
  'Steelbark': 350, 'Shroombark': 400, 'Spiritwood': 450,
  'Astral_Tree': 475, 'Elder_Tree': 500,
  'Petrified_Tree': 325, 'Emberheart_Tree': 375, 'Dusk_Tree': 425,
  'Svc_Forage_Elder': 50, 'Svc_Forage_Golden': 80, 'Svc_Forage_Crystal': 120,
  'Svc_Forage_Shadow': 160, 'Svc_Forage_Ember': 200, 'Svc_Forage_Frost': 250,
  'Svc_Forage_Void': 300,
  'Starbloom_Bush': 350, 'Nebula_Fruit_Plant': 400,
  'Void_Blossom_Bush': 450, 'Astral_Berry_Bush': 500,
};

/* Tier-aligned biome boosts. Practical procgen range is tiers 1-8 (worldRadius=
   6.3 × tierRaw=1.35 caps ~8.5), so we don't waste boosts on tiers 9-10 —
   those slots almost never generate.
   Per-resource biome audit:
     ribbon  owns: Tree_Spiral(235), Candy_Spire(270), Petrified(325),
                   Glowstone(400), Spiritwood(450), Holystone(450),
                   Astral(475), Starite(325), Starbloom(350)
     volcanic owns: Volcanic Ore(235), Celestial Ore(270)
     mushroom owns: Shroombark(400) (also has Roots/Steelbark/Candy as rare)
     elder    owns: Emberheart(375), Twilight(375), Dusk(425), Void Ore(425),
                    Void Blossom(450), Elder Tree(500), Star Ore(500),
                    Nebula(400), Astral Berry(500)
     desert  owns: Sunstone(310) — base weight 1.5 already gives ~12%, OK
     snow    owns: Moonstone(350) — base weight 1.5, OK
     temperate owns: Roots(310), Steelbark(350) as rares — base 4 gives ~33%, OK
   Underweighted biomes: ribbon(0.4), mushroom(0.6), volcanic(0.8), elder(0.2).
   Boosts target those four to redistribute mid-tier resources across rings. */
/* Boosts compressed to tiers 2-6 since procgen tier formula now caps at 6.
   Inner rings stay common-biome heavy (no boost), outer rings flavor toward
   the rare biomes that own that tier's gate resources. */
const TIER_BIOME_BOOST = {
  4: { ribbon: 1, mushroom: 1 },
  5: { ribbon: 2, mushroom: 2, elder: 1 },
  6: { elder: 4, ribbon: 2, mushroom: 1 },
};

export function pickBiome(seed, tier = 1) {
  const rand = mulberry32(seed ^ 0xB10ABBAA);
  const boost = TIER_BIOME_BOOST[tier] || {};
  const entries = Object.entries(BIOME_WEIGHTS);
  let total = 0;
  const weights = [];
  for (let i = 0; i < entries.length; i++) {
    const w = entries[i][1] + (boost[entries[i][0]] || 0);
    weights.push(w);
    total += w;
  }
  let r = rand() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= weights[i];
    if (r <= 0) return entries[i][0];
  }
  return 'temperate';
}

// ─── Constants matching the game's terrain system ────────────────────────
export const TILE_S = 2;
export const WATER_Y = 0.00;
export const GRASS_Y = 0.40;
export const HILL_Y = 2.40;
export const CHUNK_SIZE = 100;
export const HEIGHT_STEP = 4; // step used in chunk heightOffsets / colorOverrides

export const SIZE_TO_CHUNKS = { small: 3, medium: 4, large: 5 };

/* OSRS_V2 tunable parameters — live-mutable for the island_editor.html
   tuner page. Values here are read by the closures created in
   _makeOsrsInlandHeight and _makeHeightFn at island-generation time, so
   editing them and re-calling generateHeightmap picks up the new values
   immediately without a module reload.

   Defaults are the values the game ships with. */
export const PROCGEN_PARAMS = {
  /* DEAD PARAMS — kept exposed for the editor sliders but no longer
     read by the quantizer (the sd-distance beachExtent gate was removed
     because it produced polygon-parallel ring cliffs). The shore cradle
     in heightFn is now hardcoded 0.5u wide to align with FOAM_INLAND. */
  shoreFoamMin:       1.5,
  beachExtentBase:    2.0,
  beachExtentVar:     0.5,
  beachNoiseScale:    0.019,

  /* User-tuned defaults (commit e780e3e6 follow-up). */
  nearWaterPad:       0.0,
  levelJitterAmp:     0.4,
  levelNoiseScale:    0.11,
  peakHeightMult:     2.5,
  hillSteepnessMult:  1.75,
  macroShapeScale:    0.02,
  macroShapeAmp:      0.32,
  microElevAmp:       0.04,
  peakBiasAmp:        0.7,
  lowsDamp:           0.1,
  numPeaks:           4,
  peakFlatTop:        0.3,
};

// ─── Heightmap generation (POLYGON-FIRST) ────────────────────────────────
// Pipeline:
//   1. Build a SMOOTH shape field (shape archetype + low-freq noise only).
//   2. Extract iso-0 polygon → CCW → chaikin smooth. This is the shoreline.
//   3. Compute signed distance from every heightmap cell to the polygon.
//   4. Synthesize heights as a function of signed distance + inland noise.
//      High-frequency noise is gated behind BEACH_WIDTH so it can never
//      push a cell across WATER_Y — shore stays smooth by construction.
// Returns { heights, W, H, step, halfSize, biome, seed, polygon } — the
// polygon is the already-smoothed shoreline; generateIsland reuses it
// directly instead of re-extracting from heights.
export async function generateHeightmap(opts) {
  const { seed, sizeChunks = 2, biome = 'temperate', shape = 'round' } = opts;
  const B = BIOMES[biome] || BIOMES.temperate;

  const step = HEIGHT_STEP;
  const halfSize = (sizeChunks * CHUNK_SIZE) / 2;
  const edgeGuard = 16;
  const fadeZone = 10;
  const W = Math.floor((halfSize * 2) / step) + 1;
  const H = W;

  const noise = createNoise(seed);
  const noise2 = createNoise(hash32(seed, 0x1337));
  const shapeSeed = mulberry32(hash32(seed, 0xDEADBEEF));
  const shapeCfg = computeShapeCfg(shape, shapeSeed);

  const maxR = halfSize - edgeGuard;
  const irreg = B.shoreIrregularity;

  // ── STEP 1: Evaluate smooth shape field at FINE resolution (1u) so the
  //    polygon has 1u fundamental frequency. Extracting at step=4 gave a
  //    visible ~4u sawtooth no amount of chaikin could hide — the rounding
  //    was local to each corner, not global. Closed-form fbm, fast enough.
  const EXTRACT_STEP = 1;
  const eW = Math.floor((halfSize * 2) / EXTRACT_STEP) + 1;
  const eH = eW;
  const shapeFine = new Float32Array(eW * eH);
  const _pStep1 = _phaseStart(`hm-${seed}-step1-shapeField-${eW}x${eH}`);
  for (let j = 0; j < eH; j++) {
    const lz = -halfSize + j * EXTRACT_STEP;
    for (let i = 0; i < eW; i++) {
      const lx = -halfSize + i * EXTRACT_STEP;
      const shaped = applyShape(lx, lz, shapeCfg);
      let r = shaped.r;
      const nShape = noise2.fbm2(lx * 0.012, lz * 0.012, 3) * irreg;
      r *= (1.0 + nShape);
      let sf = 1.0 - r / maxR;
      const edgeDist = Math.min(halfSize - Math.abs(lx), halfSize - Math.abs(lz));
      if (edgeDist < edgeGuard) {
        sf = Math.min(sf, -0.1 - (edgeGuard - edgeDist) * 0.02);
      } else if (edgeDist < edgeGuard + fadeZone) {
        const t = (edgeDist - edgeGuard) / fadeZone;
        const fade = t * t * (3 - 2 * t);
        sf = sf * fade + Math.min(sf, -0.05) * (1 - fade);
      }
      shapeFine[j * eW + i] = sf;
    }
  }
  _phaseEnd(_pStep1);
  /* Yield after STEP 1 — the eW×eH fbm-noise loop is the single heaviest
     phase (~150-250ms for a 4-chunk island). Without this yield the
     minimap rasterizer produces 330ms long tasks on cold islands. */
  await _yieldFrame();

  const _pStep2 = _phaseStart(`hm-${seed}-step2-polygon`);
  // ── STEP 2: Extract iso-0 polygon at 1u, CCW, chaikin smooth it.
  const rawPoly = _extractIsoPolygon(shapeFine, eW, eH, EXTRACT_STEP, halfSize, 0);
  const ccw = _ensureCCW(rawPoly);
  const polygon = ccw.length >= 8 ? chaikinSmooth(ccw, 2, true) : ccw;
  _phaseEnd(_pStep2);

  const _pStep3 = _phaseStart(`hm-${seed}-step3-sdf`);
  // ── STEP 3: Build 1u SDF from polygon once. Reused by islandToChunks and
  //    by step-4 heightmap population below — single source of truth.
  const localChain = polygon.length >= 6 ? toShorelineChain(polygon, 0, 0) : null;
  const sdfLocal = localChain ? _buildSignedDistanceField(localChain, halfSize) : null;
  _phaseEnd(_pStep3);
  /* Yield after STEP 3 (SDF build) — STEP 4's heightmap population loop
     can also hit ~80-120ms on larger islands, so split the freeze here. */
  await _yieldFrame();

  // ── STEP 4: Populate step-4 heightmap from the 1u SDF via heightFn.
  //    The step-4 heightmap is what minimap/paintColors consume; the actual
  //    in-game mesh samples the SDF directly at 1u in islandToChunks.
  const heightFn = _makeHeightFn(B, noise, noise2, halfSize, edgeGuard, seed);
  const heights = new Float32Array(W * H);
  /* OSRS_V2 — osrsInlandHeight wraps heightFn. Ocean / shore strip / lakes
     pass through verbatim. Inland above water snaps to per-tile plateau
     levels so adjacent tiles read as cliffs and flats, not a single ramp.
     osrsInlandHeight is exposed on hm so islandToChunks reproduces the
     identical y per vertex. Dual-site trap noted in
     memory/procgen_islandToChunks_heightFn_trap.md. */
  const osrsInlandHeight = _makeOsrsInlandHeight(seed, halfSize, heightFn, sdfLocal);
  const _pStep4 = _phaseStart(`hm-${seed}-step4-heights-${W}x${H}`);
  for (let j = 0; j < H; j++) {
    const lz = -halfSize + j * step;
    for (let i = 0; i < W; i++) {
      const lx = -halfSize + i * step;
      const sd = _sampleSDF(sdfLocal, lx, lz, halfSize);
      heights[j * W + i] = osrsInlandHeight(lx, lz, sd);
    }
  }
  _phaseEnd(_pStep4);

  return { heights, W, H, step, halfSize, biome, seed, polygon, heightFn, sdfLocal, osrsInlandHeight };
}

/* OSRS_V2 inland height closure — shared between generateHeightmap and
   islandToChunks so chunk heightOffsets match the heightmap exactly.
   Wraps heightFn so all the rich shape (lakes, peaks, macro morphology,
   beach ramp, foam-aligned shore) is preserved. Three pass-through zones,
   one quantized zone:
     1. Shore strip (sd > -beachExtent): heightFn raw. beachExtent is
        per-position FBM-noise driven [1.5, 7]u — some beaches reach
        deep with a gentle ramp, others quantize right at the water for
        natural cliff-shores. No uniform-ring beach.
     2. Near-water (baseY < WATER_Y + 0.3): heightFn raw. Lakes have
        noise-perturbed boundaries; this stops the inland quantizer from
        rounding lake-edge concavities up to GRASS_Y and making land
        islands inside lakes.
     3. Inland above water: FBM-driven plateau quantization. Adjacent
        vertices within a noise blob round to the same level → smooth
        plateau patch with irregular organic boundary; vertices across
        blob transitions round to different levels → cliff at irregular
        angle. NO tile grid → no square cube look. */
function _makeOsrsInlandHeight(seed, halfSize, heightFn, sdfLocal) {
  const levelNoise = createNoise(hash32(seed, 0xABCDABCD));
  return (lx, lz, sd) => {
    const P = PROCGEN_PARAMS;
    const baseY = heightFn(lx, lz, sd);
    /* No sd-gate. The previous `if (sd > -beachExtent) return baseY`
       was a per-position sd-distance threshold — locally polygon-parallel
       within each beachNoise patch — so quantization at its boundary
       still showed a ring on big enough patches.

       Now: only baseY-based gates. Below water (lakes / sand-clamped
       low areas) pass through smooth; above the waterPad threshold,
       quantize. The waterPad contour is a baseY contour, which is 2D
       (heightFn is now pure-2D), so the contour itself is irregular
       and the quantizer-on boundary cannot trace a ring. */
    if (P.levelJitterAmp <= 0) return baseY;
    if (baseY < WATER_Y + P.nearWaterPad) return baseY;
    const jitter = levelNoise.fbm2(lx * P.levelNoiseScale, lz * P.levelNoiseScale, 2) * P.levelJitterAmp;
    const level = Math.max(0, Math.round(baseY - GRASS_Y + jitter));
    return GRASS_Y + level;
  };
}

// Sample the 1u SDF at an arbitrary local coord. + = water, − = land.
// Returns +halfSize as a "far water" sentinel if lookup is out of range or
// the SDF is missing (tiny islands with too-short polygons).
function _sampleSDF(sdf, lx, lz, halfSize) {
  if (!sdf) return halfSize;
  const ix = Math.round(lx) - sdf.dfMinX;
  const iz = Math.round(lz) - sdf.dfMinZ;
  if (ix < 0 || ix >= sdf.dfW || iz < 0 || iz >= sdf.dfH) return halfSize;
  const dfi = iz * sdf.dfW + ix;
  return sdf.distField[dfi] * (sdf.signField[dfi] || 1);
}

// Closure over biome/noise constants so islandToChunks can call heightFn
// at arbitrary (lx, lz, signedDist) triples and get the EXACT same y as
// generateHeightmap produces for its step-4 grid. Avoids any bilinear
// re-sampling that could wobble across WATER_Y at sub-step coordinates.
function _makeHeightFn(B, noise, noise2, halfSize, edgeGuard, seed = 0) {
  // MAINLAND-STYLE shore: mesh crosses WATER_Y right AT the polygon so the
  // foam ribbon (which covers sd ∈ [-0.5, +1.5]) sits exactly over the
  // mesh-iso-Y=0. The foam's ±1u-ish coverage hides the 1u mesh sampling
  // staircase — same trick mainland uses for its crisp shores.
  //
  // Previous design (SUBMERGE_BUFFER + FLAT_SHORE) kept the mesh submerged
  // for 1.5u past the polygon then ramped up over 2u, so mesh-iso-Y=0
  // landed at sd ≈ -2.4 — WAY outside the foam's -0.5u land-side reach.
  // Foam rendered, but the actual sand-emerges-from-water edge was still
  // visible 2u further inland, 1u-staircased.
  //
  // Mesh y at sd=0 sits WATER_OFFSET below WATER_Y. The value is chosen so
  // that a 1u-mesh triangle straddling the iso cannot linear-interp above
  // y=WATER_Y in its interior (which would poke mesh teeth through the
  // opaque water plane). With WATER_OFFSET=-0.4, the water side vertex is
  // already 0.4u below water, and the depth at sd=0 exceeds FADE_W=0.2 so
  // the water alpha is at full opacity right at the shore — any residual
  // mesh poke-through is covered by the opaque water. sd_iso (where mesh
  // y crosses 0) lands around -0.8u inland; the shoreline chain is offset
  // to that iso so foam still sits along the visible shore.
  const WATER_OFFSET = -0.4;          // mesh at sd=0; steep enough to hide 1u iso teeth under opaque water
  const BEACH_RISE = 1.0;             // mesh climbs from WATER_Y+WATER_OFFSET to SAND_Y over this
  /* Narrow walkable sand strip — was 2u, created a visibly flat ring.
     0.5u keeps a step of sand the player can stand on without dominating
     the coastal look. */
  const FLAT_SHORE = 0.5;
  const BEACH_WIDTH = B.beachWidth;
  const SAND_Y = WATER_Y + 0.05;
  const DEEP_WIDTH = 16;
  const DEEP_MAX = 3.0;
  /* Short fade-in so macro/peak shape kicks in right after the sand, not
     6u later — removes the "uniform shelf first" look. */
  const TRANSITION = 2;
  const INLAND_SPAN = Math.max(
    halfSize - (BEACH_RISE + FLAT_SHORE + BEACH_WIDTH) - edgeGuard,
    20
  );
  /* Per-island variation so two temperate islands don't read as identical.
     Deterministic from seed. */
  const _jr = mulberry32(hash32(seed, 0xAAFF11));
  const peakJitter = 0.7 + _jr() * 0.6;   // 0.7 .. 1.3
  const steepJitter = 0.8 + _jr() * 0.4;  // 0.8 .. 1.2
  /* Dome strength jitter: [0.3, 1.1] — all islands rise to some peak.
     Interior lakes are now placed as dedicated oval depressions (see
     lakeSpots below) rather than emerging as byproducts of negative
     dome + noise, so the basin-island mode is retired. Keeps shape
     variety via macroShape, peakBias, and lakes themselves. */
  const domeStrength = 0.3 + _jr() * 0.8;
  /* Lake placement: 0-2 oval lakes per island, at seed-chosen interior
     spots. Each is a parabolic depression that punches through the
     base elevation to create a proper rounded/oval pond. Rings-from-
     noise can no longer form since the elevation floor is hard +0.05. */
  /* ─── Lake generation (professional rebuild) ──────────────────────
     Every island gets 1-3 lakes, placed deliberately in the interior,
     with noise-perturbed irregular boundaries (not perfect ovals). The
     lake system is the AUTHORITATIVE source of below-water interior
     mesh — macroShape contributes elevation variation above water but
     cannot carve water itself. This keeps lake shapes intentional and
     visually clean. */
  const _lakeR = mulberry32(hash32(seed, 0x1A1E5));
  const lakeCount = 1 + Math.floor(_lakeR() * 3); /* always 1-3 */
  /* Dedicated per-island noise used to perturb lake shorelines so each
     lake has an irregular organic boundary instead of a clean ellipse.
     Same seed-family as generator so shapes are deterministic. */
  const _lakeShapeNoise = createNoise(hash32(seed, 0x1A1E5 ^ 0xB0A1));
  const lakeSpots = [];
  const _SHORE_KEEPOUT = 30; /* lakes stay 30u clear of polygon edge so even noise-perturbed boundaries don't reach the beach band */
  for (let i = 0; i < lakeCount; i++) {
    const a = _lakeR() * Math.PI * 2;
    /* Lake sizing: 15-25% of halfSize base, with 20% chance of 1.3×
       big-oasis multiplier. Intentionally smaller than v13-v21 which
       were making lakes 30-40% of halfSize — that filled the whole
       interior, making small islands look like donut rings around
       a central lake. Now lakes are a feature IN the island, not
       the island's defining shape.
       For halfSize=150: normal 45-75u diameter, big up to 97u.
       For halfSize=200: normal 60-100u diameter, big up to 130u. */
    /* BIGGER LAKES — 25-40% halfSize base, 30% big-oasis 1.5× so
       some seeds get genuinely dramatic centerpiece lakes.
       halfSize=150: normal 75-120u diameter, big up to 180u.
       halfSize=200: normal 100-160u diameter, big up to 240u. */
    const big = _lakeR() < 0.30 ? 1.5 : 1.0;
    const aMin = 0.25 * halfSize, aMax = 0.40 * halfSize;
    const rxBase = (aMin + _lakeR() * (aMax - aMin)) * big;
    const rzBase = (aMin + _lakeR() * (aMax - aMin)) * big;
    /* Push lakes OFF-CENTER: 25-55% of halfSize from island center.
       Combined with smaller axes, no single lake dominates the
       middle. Shore-keepout calc unchanged. */
    const maxAxis = Math.max(rxBase, rzBase);
    const safeMax = halfSize - _SHORE_KEEPOUT - maxAxis * 1.3;
    const targetR = (0.25 + _lakeR() * 0.30) * halfSize;
    const rRadius = Math.max(0, Math.min(targetR, safeMax));
    lakeSpots.push({
      cx: Math.cos(a) * rRadius,
      cz: Math.sin(a) * rRadius,
      rx: rxBase,
      rz: rzBase,
      /* Uniformly deeper: 2.0-3.5u (was 1.5-3.5u min). No shallow
         puddle-tier lakes anymore; all read as proper lakes. */
      depth: 2.0 + _lakeR() * 1.5,
      /* Unique per-lake noise phase offset so repeated lakes in one
         island have different irregular patterns. */
      px: _lakeR() * 1000, pz: _lakeR() * 1000,
      /* SMOOTHER LAKES — biased heavily toward clean edges.
         - 60% perfectly smooth circular/oval (edgeAmp = 0)
         - 30% slight organic perturbation
         - 10% heavily irregular
         User asked for mostly nice smooth lakes with occasional
         variation for visual interest. */
      edgeAmp: (() => {
        const r = _lakeR();
        if (r < 0.60) return 0;                         /* perfectly smooth */
        if (r < 0.90) return 0.06 + _lakeR() * 0.08;    /* slight */
        return 0.18 + _lakeR() * 0.14;                  /* heavy */
      })(),
    });
  }
  /* Rivers removed per user request — islands are pure lakes + terrain
     now, no waterway system. Simpler and cleaner. */
  /* Off-center peak location: the island's high point is shifted by up to
     45% of halfSize in a random direction. Combined with the macro noise
     below, this breaks the "radially-symmetric dome" feel: some islands
     peak near one coast, some have a central ridge, some are bowl-like. */
  /* Multi-peak: scatter 1..numPeaks peak points across the island. Each
     gets its own (cx, cz, fallR, weight). At each vertex peakBias = max
     contribution across all peaks, so islands can have multi-summit
     terrain instead of one radial dome. */
  const _peakCount = Math.max(1, Math.min(4, Math.round(PROCGEN_PARAMS.numPeaks)));
  const _peaks = [];
  for (let p = 0; p < _peakCount; p++) {
    const a = _jr() * Math.PI * 2;
    const m = _jr() * 0.55 * halfSize;
    const fallScale = 0.5 + _jr() * 0.5;   // 0.5..1.0 — varied per-peak influence radius
    const weight = 0.7 + _jr() * 0.5;       // 0.7..1.2 per-peak height weight
    _peaks.push({ cx: Math.cos(a) * m, cz: Math.sin(a) * m, fallScale, weight });
  }
  /* Legacy single-peak vars still computed (used by polygon-shift logic). */
  const peakCX = _peaks[0].cx;
  const peakCZ = _peaks[0].cz;
  /* Dedicated macro-shape noise keyed off a separate seed. This adds
     island-scale morphological structure (ridges, valleys, basins) that
     differs between islands of the same biome — the thing a radial dome
     alone can never produce. Wavelength ~85u (fbm at scale 0.012) keeps
     features island-scale rather than micro-detail. */
  const macroNoise = createNoise(hash32(seed, 0xBEEFC0DE));
  /* OSRS_V2: peaks lower + slope softer so quantized inland sits in 2-4
     plateau levels rather than dozens. Multipliers live in PROCGEN_PARAMS
     so the editor can dial them. */
  const peakH = B.peakHeight * peakJitter * PROCGEN_PARAMS.peakHeightMult;
  const steep = B.hillSteepness * steepJitter * PROCGEN_PARAMS.hillSteepnessMult;
  const nScale = B.noiseScale;
  /* Peak-bias falloff radius: features attenuate past this distance from
     the shifted peak. 0.85 * halfSize reaches roughly to the far shore. */
  const peakFallR = halfSize * 0.85;
  /* Carve lakes (parabolic depressions at seed-chosen spots). Called
     from the inland zone only, so beach + shore geometry stays clean. */
  function _applyWaterFeatures(lx, lz, y) {
    for (let k = 0; k < lakeSpots.length; k++) {
      const L = lakeSpots[k];
      const dxL = lx - L.cx, dzL = lz - L.cz;
      const nxL = dxL / L.rx, nzL = dzL / L.rz;
      const d2 = nxL * nxL + nzL * nzL;
      if (d2 > 2.5) continue;
      const en = _lakeShapeNoise.fbm2((dxL + L.px) * 0.08, (dzL + L.pz) * 0.08, 3);
      const effD2 = d2 - en * L.edgeAmp;
      if (effD2 < 1) {
        const localF = (1 - effD2) * (1 - effD2);
        const targetY = -L.depth;
        if (targetY < y) y = y * (1 - localF) + targetY * localF;
      }
    }
    return y;
  }
  return function heightFn(lx, lz, sd) {
    if (sd >= 0) {
      // Water side — mesh already below global ocean at sd=0 (y=-0.07).
      // Simple smoothstep drop from SHORE_Y to -DEEP_MAX over DEEP_WIDTH.
      const t = Math.min(1, sd / DEEP_WIDTH);
      const e = t * t * (3 - 2 * t);
      const y = WATER_Y + WATER_OFFSET - e * (DEEP_MAX + WATER_OFFSET);
      /* No water features in the open ocean — early return to skip
         expensive river/lake distance checks per ocean texel. */
      return y;
    }
    /* PURE 2D INLAND.
       The whole point: heights past the polygon depend ONLY on (lx, lz),
       NOT on sd. Any sd-distance dependence (sand fade, beachBlend,
       fadeWidth blend, ir ramp) produces level-boundary contours that
       are at least partly polygon-parallel — those become ring cliffs
       once quantization picks them up.

       Now: at the polygon edge a vertex can be flat (low macroShape →
       y=0.1, naturally rendering as sand) or 5u tall (high macroShape +
       peakBias → cliff at water). The "is there a beach here" question
       is answered by 2D macroShape alone, NOT by inland-distance.

       Foam coherence: the underwater "cradle" that the old water-to-sand
       ramp produced is gone, but the foam ribbon overlay is rendered
       directly on the polygon line by terrainLayout, so foam still
       aligns. Mesh is always ≥ 0.1u at sd<0 so the polygon iso (where
       mesh y = 0) sits very slightly inside sd=0 — water plane covers
       any tiny gap. */
    /* PURE 2D inland targetY — no sd-distance dependence in the
       per-position elevation. peakBias provides off-center radial
       elevation (2D circles, NOT polygon-offsets); macroShape is 2D
       fbm; microElev is 2D detail. */

    /* Multi-peak bias with lake-proximity attenuation. Without the lake
       fade, a peak placed near (or over) a lake elevates the surrounding
       land high — when the lake carves down to -depth, its shoreline
       sits at the bottom of a ravine instead of cleanly meeting flat
       ground. lakeFade smoothly cancels peak influence within ~1.5×
       the lake's max axis so terrain is gentle around every lake. */
    let lakeFade = 0;
    for (let li = 0; li < lakeSpots.length; li++) {
      const L = lakeSpots[li];
      const dxL = lx - L.cx, dzL = lz - L.cz;
      const nxL = dxL / (L.rx * 1.5), nzL = dzL / (L.rz * 1.5);
      const dN = nxL * nxL + nzL * nzL;
      if (dN < 1) {
        const f = (1 - dN);
        const fSm = f * f * (3 - 2 * f);
        if (fSm > lakeFade) lakeFade = fSm;
      }
    }
    /* SUM across peaks instead of MAX so distant peaks still contribute
       a small amount — eliminates the 'flat between peaks' problem.
       Capped at 1.0 so summit isn't doubled when peaks overlap. */
    let peakBiasSum = 0;
    const flatTopT = Math.min(0.9, Math.max(0, PROCGEN_PARAMS.peakFlatTop));
    const peakClip = 1 - flatTopT;
    for (let p = 0; p < _peaks.length; p++) {
      const pk = _peaks[p];
      const dpx = lx - pk.cx, dpz = lz - pk.cz;
      const pd = Math.sqrt(dpx * dpx + dpz * dpz);
      /* 2D-noise-warped falloff radius — kills the perfect-circle peak
         silhouette. Each peak gets a unique noise pattern via the cx/cz
         offset. ±45% radius wobble lets the peak bulge out in some
         directions and pull in elsewhere → organic, irregular hills. */
      const wob = macroNoise.fbm2(lx * 0.035 + pk.cx * 0.01, lz * 0.035 + pk.cz * 0.01, 2);
      const r = peakFallR * pk.fallScale * (1 + wob * 0.45);
      let raw = 1 - Math.min(1, pd / r);
      if (raw > peakClip) raw = peakClip;
      raw = raw / peakClip;
      peakBiasSum += raw * raw * (3 - 2 * raw) * pk.weight;
    }
    const peakBias = Math.min(1, peakBiasSum) * (1 - lakeFade);

    /* Macro shape — pure 2D noise. Frequency tunable. */
    const macroShape = macroNoise.fbm2(lx * PROCGEN_PARAMS.macroShapeScale, lz * PROCGEN_PARAMS.macroShapeScale, 4) * 1.5;

    /* Micro detail — fine 2D noise. */
    const detail = noise.fbm2(lx * nScale, lz * nScale, 4) * 0.22;
    const m2     = noise.fbm2(lx * nScale * 0.35, lz * nScale * 0.35, 3) * 0.18;
    const mega   = noise2.fbm2(lx * nScale * 0.15, lz * nScale * 0.15, 2) * 0.12;
    const microElev = detail + m2 + mega;

    /* Split elevation into peak (always positive) + macro/micro
       (signed). Damp ONLY the macro/micro half when negative so we
       still get rolling-hills-style dips far from peaks instead of
       collapsing every low region to GRASS_Y. */
    const peakContrib = peakBias * peakH * PROCGEN_PARAMS.peakBiasAmp * domeStrength;
    let macroVariation = macroShape * peakH * PROCGEN_PARAMS.macroShapeAmp
                       + microElev  * peakH * PROCGEN_PARAMS.microElevAmp;
    if (macroVariation < 0) macroVariation *= PROCGEN_PARAMS.lowsDamp;
    const variation = peakContrib + macroVariation;
    const computed = GRASS_Y + variation;
    /* Floor at WATER_Y + 0.04 — just below foam y (WATER_Y + 0.06) so
       foam stays above mesh. */
    const targetY = Math.max(WATER_Y + 0.04, computed);

    /* SHORE CRADLE — 0.5u wide, matches FOAM_INLAND in terrainLayout
       so the mesh emerges from water exactly where the foam ribbon's
       inland edge ends. Wider cradle would emerge past the foam
       (gap of underwater mesh past foam end); narrower would emerge
       inside the foam (mesh sticking through foam ribbon).
       Below water portion is hidden by water plane; above-water
       extent is driven by 2D targetY (cliff-at-water vs sandy beach
       falls out naturally). */
    const inland = -sd;
    const CRADLE_W = 0.5;
    if (inland >= CRADLE_W) {
      return _applyWaterFeatures(lx, lz, targetY);
    }
    const ct = inland / CRADLE_W;
    const ce = ct * ct * (3 - 2 * ct);
    const cradleY = (WATER_Y + WATER_OFFSET) * (1 - ce) + targetY * ce;
    return _applyWaterFeatures(lx, lz, cradleY);
  };
}

// Marching squares extraction parameterized on iso value + field. Same
// coord convention as `extractShoreline` (cell (i,j) at -halfSize+i*step).
function _extractIsoPolygon(field, W, H, step, halfSize, iso) {
  const segs = [];
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const idx = j * W + i;
      const tl = field[idx];
      const tr = field[idx + 1];
      const bl = field[idx + W];
      const br = field[idx + W + 1];
      let code = 0;
      if (tl >= iso) code |= 1;
      if (tr >= iso) code |= 2;
      if (br >= iso) code |= 4;
      if (bl >= iso) code |= 8;
      if (code === 0 || code === 15) continue;
      const x0 = -halfSize + i * step;
      const z0 = -halfSize + j * step;
      const x1 = x0 + step, z1 = z0 + step;
      const topX = x0 + step * ((iso - tl) / (tr - tl));
      const rgtZ = z0 + step * ((iso - tr) / (br - tr));
      const botX = x0 + step * ((iso - bl) / (br - bl));
      const lftZ = z0 + step * ((iso - tl) / (bl - tl));
      switch (code) {
        case 1:  segs.push(topX, z0,   x0,   lftZ); break;
        case 2:  segs.push(topX, z0,   x1,   rgtZ); break;
        case 3:  segs.push(x0,   lftZ, x1,   rgtZ); break;
        case 4:  segs.push(x1,   rgtZ, botX, z1);   break;
        case 5:  segs.push(topX, z0,   x1,   rgtZ); segs.push(botX, z1,   x0,   lftZ); break;
        case 6:  segs.push(topX, z0,   botX, z1);   break;
        case 7:  segs.push(x0,   lftZ, botX, z1);   break;
        case 8:  segs.push(x0,   lftZ, botX, z1);   break;
        case 9:  segs.push(topX, z0,   botX, z1);   break;
        case 10: segs.push(topX, z0,   x0,   lftZ); segs.push(x1,   rgtZ, botX, z1);   break;
        case 11: segs.push(x1,   rgtZ, botX, z1);   break;
        case 12: segs.push(x0,   lftZ, x1,   rgtZ); break;
        case 13: segs.push(topX, z0,   x1,   rgtZ); break;
        case 14: segs.push(topX, z0,   x0,   lftZ); break;
      }
    }
  }
  return _chainSegments(segs);
}

// Chain segment list into a single (longest) closed polyline.
function _chainSegments(segs) {
  const quant = (v) => Math.round(v * 100) / 100;
  const key = (x, z) => `${quant(x)},${quant(z)}`;
  const adjacency = new Map();
  for (let i = 0; i < segs.length; i += 4) {
    const ax = segs[i], az = segs[i + 1], bx = segs[i + 2], bz = segs[i + 3];
    const ka = key(ax, az), kb = key(bx, bz);
    if (!adjacency.has(ka)) adjacency.set(ka, []);
    if (!adjacency.has(kb)) adjacency.set(kb, []);
    adjacency.get(ka).push({ x: bx, z: bz, k: kb });
    adjacency.get(kb).push({ x: ax, z: az, k: ka });
  }
  const chains = [];
  const visited = new Set();
  for (const [startK, neighbors] of adjacency) {
    if (visited.has(startK)) continue;
    if (neighbors.length === 0) continue;
    const chain = [];
    const parts = startK.split(',');
    let cx = parseFloat(parts[0]), cz = parseFloat(parts[1]);
    let ck = startK;
    chain.push(cx, cz);
    visited.add(ck);
    while (true) {
      const nbs = adjacency.get(ck);
      if (!nbs || nbs.length === 0) break;
      let next = null;
      for (let i = 0; i < nbs.length; i++) {
        if (!visited.has(nbs[i].k)) { next = nbs[i]; break; }
      }
      if (!next) break;
      cx = next.x; cz = next.z; ck = next.k;
      chain.push(cx, cz);
      visited.add(ck);
    }
    if (chain.length >= 8) chains.push(chain);
  }
  chains.sort((a, b) => b.length - a.length);
  return chains[0] || [];
}

// Per-cell signed distance to polygon. + = outside (water), − = inside (land).
// Uses min-distance-to-segment for magnitude and horizontal-ray winding for sign.
// Cost: O(W*H*N). For sizeChunks=4 (W=51, N~150) this is ~390k ops ≈ a few ms.
function _signedDistanceGrid(polygon, W, H, step, halfSize) {
  const out = new Float32Array(W * H);
  const n = polygon.length / 2;
  if (n < 3) { out.fill(halfSize); return out; }
  for (let j = 0; j < H; j++) {
    const lz = -halfSize + j * step;
    for (let i = 0; i < W; i++) {
      const lx = -halfSize + i * step;
      let minD2 = Infinity;
      let inside = false;
      for (let k = 0; k < n; k++) {
        const ax = polygon[k * 2], az = polygon[k * 2 + 1];
        const kk = (k + 1) % n;
        const bx = polygon[kk * 2], bz = polygon[kk * 2 + 1];
        const dx = bx - ax, dz = bz - az;
        const len2 = dx * dx + dz * dz;
        let t;
        if (len2 < 1e-10) t = 0;
        else {
          t = ((lx - ax) * dx + (lz - az) * dz) / len2;
          if (t < 0) t = 0; else if (t > 1) t = 1;
        }
        const ex = lx - (ax + t * dx), ez = lz - (az + t * dz);
        const d2 = ex * ex + ez * ez;
        if (d2 < minD2) minD2 = d2;
        if ((az > lz) !== (bz > lz)) {
          const xIsect = (bx - ax) * (lz - az) / (bz - az) + ax;
          if (lx < xIsect) inside = !inside;
        }
      }
      const d = Math.sqrt(minD2);
      out[j * W + i] = inside ? -d : d;
    }
  }
  return out;
}

function computeShapeCfg(shape, rand) {
  switch (shape) {
    case 'round':    return { type: 0 };
    case 'peninsula':return { type: 1, angle: rand() * Math.PI * 2, stretch: 0.45 + rand() * 0.2 };
    case 'crescent': return { type: 2, angle: rand() * Math.PI * 2, bite: 0.35 + rand() * 0.15 };
    case 'jagged':   return { type: 3, bumpiness: 0.25 + rand() * 0.15 };
    case 'bay':      return { type: 4, angle: rand() * Math.PI * 2, depth: 0.3 + rand() * 0.15 };
    default:         return { type: 0 };
  }
}

function applyShape(lx, lz, cfg) {
  const baseR = Math.sqrt(lx * lx + lz * lz);
  if (cfg.type === 0) return { r: baseR };
  if (cfg.type === 1) {
    // Peninsula: stretch along angle axis
    const cs = Math.cos(cfg.angle), sn = Math.sin(cfg.angle);
    const along = lx * cs + lz * sn;
    const across = -lx * sn + lz * cs;
    return { r: Math.sqrt(along * along * cfg.stretch + across * across / cfg.stretch) };
  }
  if (cfg.type === 2) {
    // Crescent: subtract a circle offset in -angle direction to carve a bay
    const cs = Math.cos(cfg.angle), sn = Math.sin(cfg.angle);
    const bx = lx + cs * 35, bz = lz + sn * 35;
    const bite = Math.sqrt(bx * bx + bz * bz);
    const carve = Math.max(0, 30 - bite) * cfg.bite;
    return { r: baseR + carve };
  }
  if (cfg.type === 3) {
    // Jagged: radial bumpiness via angle-dependent offset
    const ang = Math.atan2(lz, lx);
    const bump = Math.cos(ang * 5) * cfg.bumpiness * 25 + Math.cos(ang * 9) * cfg.bumpiness * 15;
    return { r: baseR + bump };
  }
  if (cfg.type === 4) {
    // Bay: inset on one side
    const cs = Math.cos(cfg.angle), sn = Math.sin(cfg.angle);
    const bx = lx + cs * 28, bz = lz + sn * 28;
    const bite = Math.sqrt(bx * bx + bz * bz);
    const carve = Math.max(0, 22 - bite) * cfg.depth;
    return { r: baseR + carve };
  }
  return { r: baseR };
}

// ─── Shoreline extraction — marching squares at Y=WATER_Y ─────────────────
// Returns array of chains, each a flat [x0,z0,x1,z1,...] polyline.
// For island generation we expect ONE closed chain (clipInset guarantees this).
export function extractShoreline(hm) {
  const { heights, W, H, step, halfSize } = hm;
  const iso = WATER_Y + 0.02;
  const segs = [];

  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const idx = j * W + i;
      const tl = heights[idx];
      const tr = heights[idx + 1];
      const bl = heights[idx + W];
      const br = heights[idx + W + 1];
      let code = 0;
      if (tl >= iso) code |= 1;
      if (tr >= iso) code |= 2;
      if (br >= iso) code |= 4;
      if (bl >= iso) code |= 8;
      if (code === 0 || code === 15) continue;

      const x0 = -halfSize + i * step;
      const z0 = -halfSize + j * step;
      const x1 = x0 + step;
      const z1 = z0 + step;

      // Edge crossings, inlined. `step *` scales the unit lerp.
      const topX = x0 + step * ((iso - tl) / (tr - tl));
      const rgtZ = z0 + step * ((iso - tr) / (br - tr));
      const botX = x0 + step * ((iso - bl) / (br - bl));
      const lftZ = z0 + step * ((iso - tl) / (bl - tl));

      switch (code) {
        case 1:  segs.push(topX, z0,   x0,   lftZ); break;
        case 2:  segs.push(topX, z0,   x1,   rgtZ); break;
        case 3:  segs.push(x0,   lftZ, x1,   rgtZ); break;
        case 4:  segs.push(x1,   rgtZ, botX, z1);   break;
        case 5:  segs.push(topX, z0,   x1,   rgtZ); segs.push(botX, z1,   x0,   lftZ); break;
        case 6:  segs.push(topX, z0,   botX, z1);   break;
        case 7:  segs.push(x0,   lftZ, botX, z1);   break;
        case 8:  segs.push(x0,   lftZ, botX, z1);   break;
        case 9:  segs.push(topX, z0,   botX, z1);   break;
        case 10: segs.push(topX, z0,   x0,   lftZ); segs.push(x1,   rgtZ, botX, z1);   break;
        case 11: segs.push(x1,   rgtZ, botX, z1);   break;
        case 12: segs.push(x0,   lftZ, x1,   rgtZ); break;
        case 13: segs.push(topX, z0,   x1,   rgtZ); break;
        case 14: segs.push(topX, z0,   x0,   lftZ); break;
      }
    }
  }

  // Chain segments into polylines. Quantize endpoints to 0.01 for dedup.
  const quant = (v) => Math.round(v * 100) / 100;
  const key = (x, z) => `${quant(x)},${quant(z)}`;
  const adjacency = new Map(); // key -> array of other-end {x,z} points
  for (let i = 0; i < segs.length; i += 4) {
    const ax = segs[i], az = segs[i + 1], bx = segs[i + 2], bz = segs[i + 3];
    const ka = key(ax, az), kb = key(bx, bz);
    if (!adjacency.has(ka)) adjacency.set(ka, []);
    if (!adjacency.has(kb)) adjacency.set(kb, []);
    adjacency.get(ka).push({ x: bx, z: bz, k: kb });
    adjacency.get(kb).push({ x: ax, z: az, k: ka });
  }

  const chains = [];
  const visited = new Set();
  for (const [startK, neighbors] of adjacency) {
    if (visited.has(startK)) continue;
    if (neighbors.length === 0) continue;
    // Walk the chain starting from startK
    const chain = [];
    const parts = startK.split(',');
    let cx = parseFloat(parts[0]), cz = parseFloat(parts[1]);
    let ck = startK;
    chain.push(cx, cz);
    visited.add(ck);
    while (true) {
      const nbs = adjacency.get(ck);
      if (!nbs || nbs.length === 0) break;
      let next = null;
      for (let i = 0; i < nbs.length; i++) {
        if (!visited.has(nbs[i].k)) { next = nbs[i]; break; }
      }
      if (!next) break;
      cx = next.x; cz = next.z; ck = next.k;
      chain.push(cx, cz);
      visited.add(ck);
    }
    if (chain.length >= 8) chains.push(chain);
  }

  // Keep only the longest chain (the island's perimeter)
  chains.sort((a, b) => b.length - a.length);
  return chains;
}

// Return a polyline wound CCW (positive signed area in Y-up XZ plane).
// `extractShoreline` can emit either direction depending on where marching
// squares starts the chain; downstream code (normal computation, signed
// distance field) assumes CCW, so we normalize here.
function _ensureCCW(polyline) {
  const n = polyline.length / 2;
  if (n < 3) return polyline;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polyline[i * 2] * polyline[j * 2 + 1] - polyline[j * 2] * polyline[i * 2 + 1];
  }
  if (area >= 0) return polyline;      // already CCW
  const rev = new Array(polyline.length);
  for (let i = 0; i < n; i++) {
    rev[i * 2]     = polyline[(n - 1 - i) * 2];
    rev[i * 2 + 1] = polyline[(n - 1 - i) * 2 + 1];
  }
  return rev;
}

// Chaikin's corner-cutting smoothing. 2 passes = nicely rounded but preserves shape.
export function chaikinSmooth(polyline, passes = 2, closed = true) {
  let pts = polyline;
  for (let p = 0; p < passes; p++) {
    const n = pts.length / 2;
    const out = new Array((n * 2) * 2);
    let oi = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = pts[i * 2], az = pts[i * 2 + 1];
      const bx = pts[j * 2], bz = pts[j * 2 + 1];
      out[oi++] = ax * 0.75 + bx * 0.25;
      out[oi++] = az * 0.75 + bz * 0.25;
      out[oi++] = ax * 0.25 + bx * 0.75;
      out[oi++] = az * 0.25 + bz * 0.75;
    }
    if (!closed) {
      out[0] = pts[0]; out[1] = pts[1];
      out[out.length - 2] = pts[pts.length - 2];
      out[out.length - 1] = pts[pts.length - 1];
    }
    pts = out;
  }
  return pts;
}

// Convert polyline to game shoreline chain format: [[x,z,nx,nz], ...]
// Normals point outward (toward water) for foam shader.
export function toShorelineChain(polyline, worldOx = 0, worldOz = 0) {
  const n = polyline.length / 2;
  const chain = [];
  for (let i = 0; i < n; i++) {
    const pi = (i - 1 + n) % n;
    const ni = (i + 1) % n;
    const px = polyline[pi * 2], pz = polyline[pi * 2 + 1];
    const cx = polyline[i * 2],  cz = polyline[i * 2 + 1];
    const nx = polyline[ni * 2], nz = polyline[ni * 2 + 1];
    // Tangent: (next - prev) / 2
    const tx = (nx - px) * 0.5, tz = (nz - pz) * 0.5;
    // Outward normal: rotate tangent 90° clockwise in XZ plane
    let ox = tz, oz = -tx;
    const l = Math.hypot(ox, oz) || 1;
    ox /= l; oz /= l;
    chain.push([
      +(cx + worldOx).toFixed(2),
      +(cz + worldOz).toFixed(2),
      +ox.toFixed(3),
      +oz.toFixed(3),
    ]);
  }
  return chain;
}

// ─── Distance-to-shore field (BFS from shoreline cells) ───────────────────
export function distanceField(hm, iso = WATER_Y + 0.02) {
  const { heights, W, H } = hm;
  const dist = new Float32Array(W * H);
  const INF = 1e9;
  for (let i = 0; i < dist.length; i++) dist[i] = INF;

  // Seed: any cell adjacent to a shoreline transition
  const queue = [];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const idx = j * W + i;
      const h = heights[idx];
      if (h < iso) continue;
      let isBorder = false;
      if (i > 0     && heights[idx - 1] < iso) isBorder = true;
      else if (i < W-1 && heights[idx + 1] < iso) isBorder = true;
      else if (j > 0     && heights[idx - W] < iso) isBorder = true;
      else if (j < H-1 && heights[idx + W] < iso) isBorder = true;
      if (isBorder) { dist[idx] = 0; queue.push(idx); }
    }
  }

  // Multi-source BFS (Manhattan distance — good enough for biome blending)
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const d = dist[idx];
    const j = (idx / W) | 0;
    const i = idx - j * W;
    if (i > 0) {
      const n = idx - 1;
      if (heights[n] >= iso && dist[n] > d + 1) { dist[n] = d + 1; queue.push(n); }
    }
    if (i < W - 1) {
      const n = idx + 1;
      if (heights[n] >= iso && dist[n] > d + 1) { dist[n] = d + 1; queue.push(n); }
    }
    if (j > 0) {
      const n = idx - W;
      if (heights[n] >= iso && dist[n] > d + 1) { dist[n] = d + 1; queue.push(n); }
    }
    if (j < H - 1) {
      const n = idx + W;
      if (heights[n] >= iso && dist[n] > d + 1) { dist[n] = d + 1; queue.push(n); }
    }
  }
  return dist;
}

// ─── Vertex colors ────────────────────────────────────────────────────────
export function paintColors(hm, dist, opts) {
  const { heights, W, H, step } = hm;
  const biome = opts.biome || 'temperate';
  const B = BIOMES[biome] || BIOMES.temperate;
  const noise = createNoise(hash32(opts.seed, 0xC010C010));
  const { sand, grass, hill, peak } = B;

  const colors = new Float32Array(W * H * 3);
  const BEACH_CELLS = Math.max(2, (B.beachWidth / step) | 0);

  /* Pre-compute slope + curvature for OSRS-style per-vertex shading.
     Slope = height diff to neighbours (steep = darker).
     Curvature = laplacian (concave = darker, convex = brighter). */
  const slope = new Float32Array(W * H);
  const curve = new Float32Array(W * H);
  for (let j = 1; j < H - 1; j++) {
    for (let i = 1; i < W - 1; i++) {
      const idx = j * W + i;
      const c = heights[idx];
      const hL = heights[idx - 1], hR = heights[idx + 1];
      const hU = heights[idx - W], hD = heights[idx + W];
      const dx = (hR - hL) * 0.5 / step;
      const dz = (hD - hU) * 0.5 / step;
      slope[idx] = Math.sqrt(dx * dx + dz * dz);
      curve[idx] = (hL + hR + hU + hD - 4 * c) / (step * step);
    }
  }

  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const idx = j * W + i;
      const h = heights[idx];
      const d = dist[idx];

      let r, g, b;
      if (h < WATER_Y + 0.02) {
        const depth = (WATER_Y + 0.02) - h;
        const SHALLOW = 1.2;
        if (depth < SHALLOW) {
          const t = depth / SHALLOW;
          const e = t * t * (3 - 2 * t);
          const seaR = 0.10, seaG = 0.25, seaB = 0.30;
          r = sand[0] * (1 - e) + seaR * e;
          g = sand[1] * (1 - e) + seaG * e;
          b = sand[2] * (1 - e) + seaB * e;
        } else {
          r = 0.10; g = 0.25; b = 0.30;
        }
      } else if (d < BEACH_CELLS) {
        const t = d / BEACH_CELLS;
        const e = t * t * (3 - 2 * t);
        r = sand[0] * (1 - e) + grass[0] * e;
        g = sand[1] * (1 - e) + grass[1] * e;
        b = sand[2] * (1 - e) + grass[2] * e;
      } else if (h < HILL_Y) {
        /* Grass with noise patches + height-stepped color bands */
        const n = noise.fbm2(i * 0.18, j * 0.18, 3) * 0.08;
        const band = Math.floor(h * 3) * 0.02;
        r = grass[0] + n + band;
        g = grass[1] + n * 1.1 + band * 0.8;
        b = grass[2] + n * 0.6;
      } else if (h < HILL_Y + 1.5) {
        const t = (h - HILL_Y) / 1.5;
        r = grass[0] * (1 - t) + hill[0] * t;
        g = grass[1] * (1 - t) + hill[1] * t;
        b = grass[2] * (1 - t) + hill[2] * t;
      } else {
        const t = Math.min(1, (h - HILL_Y - 1.5) / 2);
        r = hill[0] * (1 - t) + peak[0] * t;
        g = hill[1] * (1 - t) + peak[1] * t;
        b = hill[2] * (1 - t) + peak[2] * t;
      }

      /* Slope darkening — steep faces get darker (cliff toon shading) */
      const sl = slope[idx];
      if (sl > 0.3) {
        const dark = Math.min(0.25, (sl - 0.3) * 0.5);
        r -= dark; g -= dark; b -= dark;
      }

      /* Curvature AO — concave areas (valleys, crevices) slightly darker,
         convex areas (ridges, plateaus) slightly brighter */
      const cv = curve[idx];
      const ao = Math.max(-0.08, Math.min(0.06, cv * 0.15));
      r += ao; g += ao; b += ao;

      /* Noise dither — break up remaining uniformity */
      const dither = noise.fbm2(i * 0.35 + 100, j * 0.35 + 100, 2) * 0.03;
      r += dither; g += dither * 0.8; b += dither * 0.5;

      colors[idx * 3] = Math.max(0, Math.min(1, r));
      colors[idx * 3 + 1] = Math.max(0, Math.min(1, g));
      colors[idx * 3 + 2] = Math.max(0, Math.min(1, b));
    }
  }
  return colors;
}

// ─── Poisson disk sampling (Bridson) for prop placement ──────────────────
export function poissonDisk(opts) {
  const { seed, halfSize, minDist, maxPoints = 2000 } = opts;
  const rand = mulberry32(seed);
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil((halfSize * 2) / cellSize);
  const gridH = gridW;
  const grid = new Int32Array(gridW * gridH).fill(-1);
  const points = []; // [x, z, ...]
  const active = [];

  // Initial point at origin-ish
  const px0 = (rand() - 0.5) * halfSize * 0.5;
  const pz0 = (rand() - 0.5) * halfSize * 0.5;
  points.push(px0, pz0);
  active.push(0);
  const gi0 = Math.floor((px0 + halfSize) / cellSize);
  const gj0 = Math.floor((pz0 + halfSize) / cellSize);
  grid[gj0 * gridW + gi0] = 0;

  const K = 20;
  while (active.length > 0 && points.length / 2 < maxPoints) {
    const ai = (rand() * active.length) | 0;
    const pi = active[ai];
    const px = points[pi * 2], pz = points[pi * 2 + 1];
    let found = false;
    for (let k = 0; k < K; k++) {
      const angle = rand() * Math.PI * 2;
      const r = minDist * (1 + rand());
      const nx = px + Math.cos(angle) * r;
      const nz = pz + Math.sin(angle) * r;
      if (nx < -halfSize || nx >= halfSize || nz < -halfSize || nz >= halfSize) continue;
      const gi = Math.floor((nx + halfSize) / cellSize);
      const gj = Math.floor((nz + halfSize) / cellSize);
      let ok = true;
      for (let dj = -2; dj <= 2 && ok; dj++) {
        const sj = gj + dj;
        if (sj < 0 || sj >= gridH) continue;
        for (let di = -2; di <= 2 && ok; di++) {
          const si = gi + di;
          if (si < 0 || si >= gridW) continue;
          const pid = grid[sj * gridW + si];
          if (pid === -1) continue;
          const ex = points[pid * 2], ez = points[pid * 2 + 1];
          const d2 = (ex - nx) * (ex - nx) + (ez - nz) * (ez - nz);
          if (d2 < minDist * minDist) ok = false;
        }
      }
      if (ok) {
        const newId = points.length / 2;
        points.push(nx, nz);
        active.push(newId);
        grid[gj * gridW + gi] = newId;
        found = true;
        break;
      }
    }
    if (!found) {
      active[ai] = active[active.length - 1];
      active.pop();
    }
  }
  return points;
}

// Sample heightmap at world coord via bilinear interpolation.
export function sampleHeight(hm, x, z) {
  const { heights, W, H, step, halfSize } = hm;
  const fx = (x + halfSize) / step;
  const fz = (z + halfSize) / step;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= W - 1 || j >= H - 1) return WATER_Y - 2;
  const tx = fx - i, tz = fz - j;
  const idx = j * W + i;
  const a = heights[idx];
  const b = heights[idx + 1];
  const c = heights[idx + W];
  const d = heights[idx + W + 1];
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

// Sample distance field at world coord.
export function sampleDist(hm, dist, x, z) {
  const { W, H, step, halfSize } = hm;
  const i = Math.round((x + halfSize) / step);
  const j = Math.round((z + halfSize) / step);
  if (i < 0 || j < 0 || i >= W || j >= H) return 0;
  return dist[j * W + i];
}

// ─── Prop placement — biome-weighted, masked by shore + elevation ────────
export function placeProps(hm, dist, opts) {
  const { seed, biome, tier = 1 } = opts;
  const B = BIOMES[biome] || BIOMES.temperate;
  const rand = mulberry32(hash32(seed, 0xF00DCAFE));

  const minDist = 12.0 / B.propDensity;
  const raw = poissonDisk({ seed: hash32(seed, 0xABCDEF), halfSize: hm.halfSize, minDist });

  const rareChance = Math.min(0.5, 0.05 + (tier - 1) * 0.05);
  const maxLv = TIER_MAX_LEVEL[tier] || 200;
  const rareList = (B.rareProps || []).filter(p => (PROP_GATHER_LEVEL[p] || 0) <= maxLv);

  const maxProps = 80;
  const props = [];
  for (let i = 0; i < raw.length; i += 2) {
    if (props.length >= maxProps) break;
    const x = raw[i], z = raw[i + 1];
    const y = sampleHeight(hm, x, z);
    if (y < WATER_Y + 0.15) continue;
    const d = sampleDist(hm, dist, x, z);
    if (d < 1) continue;
    /* Pick from rare list if roll succeeds AND rare list non-empty;
       otherwise from common biome props. */
    const useRare = rareList.length > 0 && rand() < rareChance;
    const pool = useRare ? rareList : B.props;
    const type = pool[(rand() * pool.length) | 0];
    const isStarfish = type.startsWith('Prop_Starfish');
    if (isStarfish && d > 3) continue; // keep starfish near beach
    if (!isStarfish && d < 2) continue; // keep trees off beach
    /* Scale variation per prop: wider range than before (was 0.8-1.4).
       Bushes + branches get wider 0.6-1.6 (dramatic size mix); rocks
       0.7-1.5; trees 0.85-1.3 (trees shouldn't feel tiny or giant). */
    const isBush = type.startsWith('Prop_Bush') || type === 'Bush' ||
                   type === 'Berry_Bush' || type === 'Frost_Bush' ||
                   type.startsWith('Prop_Branch');
    const isRock = type.startsWith('Rock_') || type.startsWith('Prop_Rock') ||
                   type.startsWith('Prop_Cliff_Rock') || type.startsWith('Golem_Rock') ||
                   type.startsWith('Crystal_');
    let scaleMin, scaleRange;
    if (isBush) { scaleMin = 0.60; scaleRange = 1.00; }
    else if (isRock) { scaleMin = 0.70; scaleRange = 0.80; }
    else { scaleMin = 0.85; scaleRange = 0.45; }
    props.push({
      type,
      x: +x.toFixed(2),
      z: +z.toFixed(2),
      y: +y.toFixed(2),
      scale: +(scaleMin + rand() * scaleRange).toFixed(2),
      rot: +(rand() * Math.PI * 2).toFixed(2),
    });
  }
  /* Guaranteed-spawn pass for rare RESOURCE props (ores, foragables).
     Without this, sailing tasks can ask "Mine 35x Moonstone on Slick
     Shoals" but the rareChance roll only spawns ~0.5 Moonstones per
     island — task is unwinnable. Each rare resource type is force-
     placed N times so every catalogued biome rock/forage is reliably
     gatherable. Decorative rares (Ice_Spire, Sandstone_Arch, etc) are
     skipped — only spawn-on-resource items matter. */
  const _isResourceRare = (t) => t.startsWith('Rocks_Ore_') || t.startsWith('Svc_Forage_');
  const resourceRares = rareList.filter(_isResourceRare);
  if (resourceRares.length) {
    /* Pull from the SAME poisson-disk candidate stream so positions
       remain deterministic and don't overlap each other. Skip cells
       already used by the random pass above — track via a dist² check. */
    const minSpawnsPerType = 6;          /* enough headroom for collect tasks */
    const usedXZ = props.map(p => [p.x, p.z]);
    const _farFromUsed = (x, z) => {
      for (let k = 0; k < usedXZ.length; k++) {
        const dx = usedXZ[k][0] - x, dz = usedXZ[k][1] - z;
        if (dx * dx + dz * dz < 36) return false;   /* 6u min spacing */
      }
      return true;
    };
    let candIdx = 0;
    for (const rType of resourceRares) {
      let placed = 0;
      while (placed < minSpawnsPerType && candIdx < raw.length) {
        const x = raw[candIdx], z = raw[candIdx + 1];
        candIdx += 2;
        const y = sampleHeight(hm, x, z);
        if (y < WATER_Y + 0.15) continue;
        const d = sampleDist(hm, dist, x, z);
        if (d < 2) continue;
        if (!_farFromUsed(x, z)) continue;
        usedXZ.push([+x.toFixed(2), +z.toFixed(2)]);
        props.push({
          type: rType,
          x: +x.toFixed(2),
          z: +z.toFixed(2),
          y: +y.toFixed(2),
          scale: +(0.85 + rand() * 0.30).toFixed(2),
          rot: +(rand() * Math.PI * 2).toFixed(2),
        });
        placed++;
      }
    }
  }
  return props;
}

// ─── Per-biome mob pools ─────────────────────────────────────────────────
// Each biome has 1-2 native slime types. Higher tiers get a small chance
// at a Brute_Slime mini-boss regardless of biome. Used by placeMobs.
const BIOME_MOBS = {
  tropical:  ['Tiny_Slime', 'Snail_Slime'],
  temperate: ['Snail_Slime', 'Tiny_Slime'],
  snow:      ['Frost_Slime'],
  desert:    ['Stone_Slime', 'Snail_Slime'],
  volcanic:  ['Magma_Slime', 'Obsidian_Slime'],
  mushroom:  ['Slime_Slug', 'Spike_Slime'],
  ribbon:    ['Brute_Slime'],
  elder:     ['Brute_Slime', 'Obsidian_Slime'],
};

// ─── Mob placement ─ 4-8 slimes per island (combat encounters) ───────────
// Deterministic from islandSeed — same island always spawns same mobs in
// same positions. Counts scale with tier; higher tiers get a chance at a
// Brute_Slime mini-boss.
export function placeMobs(hm, dist, opts) {
  const { seed, biome, tier = 1 } = opts;
  const rand = mulberry32(hash32(seed, 0x4D0B5));
  const { W, H, step, halfSize } = hm;

  const pool = BIOME_MOBS[biome] || BIOME_MOBS.tropical;
  /* Mob count must beat the Sailing Master kill-task count so tasks are
     winnable. Task formula: 3 + floor(tier*0.7). Spawn ~3x that across
     the biome pool so even single-mob-type targets have headroom. */
  const taskCountAtTier = 3 + Math.floor(tier * 0.7);
  const count = Math.max(8, taskCountAtTier * Math.max(2, pool.length) + 4);

  // Gather candidate land cells: above water, inland from shore, flat.
  const candidates = [];
  for (let j = 2; j < H - 2; j++) {
    for (let i = 2; i < W - 2; i++) {
      const idx = j * W + i;
      const h = hm.heights[idx];
      if (h < WATER_Y + 0.2 || h > HILL_Y - 0.2) continue;
      const d = dist[idx];
      if (d < 4) continue; // keep mobs off the beach
      const x = -halfSize + i * step;
      const z = -halfSize + j * step;
      candidates.push({ x, z, y: h });
    }
  }
  if (candidates.length === 0) return [];

  const out = [];
  /* Cluster spawning: pick a center point, then place 2-3 mobs of the
     SAME type within a small radius. Easier to find + feels alive
     vs 1 lone slime per spot. `count` here is the TARGET total count;
     loop until reached so cluster sizes don't undershoot. */
  while (out.length < count) {
    const c = candidates[Math.floor(rand() * candidates.length)];
    let type = pool[Math.floor(rand() * pool.length)];
    if (tier >= 4 && rand() < 0.08 && type !== 'Brute_Slime') type = 'Brute_Slime';
    /* Snake_Boss + Brute_Slime are minibosses — always solo. Other
       slimes spawn as a 2-3 mob cluster around the center point. */
    const isMiniboss = (type === 'Brute_Slime' || type === 'Snake_Boss');
    const clusterSize = isMiniboss ? 1 : (2 + Math.floor(rand() * 2));   /* 2 or 3 */
    for (let k = 0; k < clusterSize; k++) {
      if (out.length >= count) break;
      /* Offset within ~3-4u of cluster center; jitter via rand. */
      const angle = rand() * Math.PI * 2;
      const radius = k === 0 ? 0 : (1.5 + rand() * 2.5);
      const cx = c.x + Math.cos(angle) * radius;
      const cz = c.z + Math.sin(angle) * radius;
      out.push({
        type,
        x: +cx.toFixed(2),
        z: +cz.toFixed(2),
        y: +c.y.toFixed(2),
        scale: 1,
        rot: +(rand() * Math.PI * 2).toFixed(3),
      });
    }
  }
  return out;
}

// ─── POI placement ─ one Slime_Statue per island (teleport anchor) ──────
// Each island gets exactly one Slime_Statue placed CLOSE TO THE SHORE,
// facing INLAND (eyes toward island center). Used as the teleport-back-
// to-mainland anchor — clickable, channels 4s, then teleports.
export function placePOIs(hm, dist, opts) {
  const { seed } = opts;
  const rand = mulberry32(hash32(seed, 0x5EA7A7EE));

  const { W, H, step, halfSize } = hm;
  const candidates = [];
  for (let j = 2; j < H - 2; j++) {
    for (let i = 2; i < W - 2; i++) {
      const idx = j * W + i;
      const h = hm.heights[idx];
      /* Above water + not high peak. Widened from GRASS_Y (0.4) so
         the zone just past the beach (sand→grass blend, y≈0.1-0.4)
         also qualifies. Prior range rejected all near-shore cells
         → statue never placed. */
      if (h < WATER_Y + 0.2 || h > HILL_Y - 0.3) continue;
      const d = dist[idx];
      /* Place plaza CLOSER TO SHORE — 3-10u from shore puts it on the
         dirt ring at the seaward edge of the island's plaza. Bumped
         from 2-12u so we still have room for both statue + bank
         side-by-side without one falling into water. */
      if (d < 3 || d > 10) continue;
      const hL = hm.heights[idx - 1], hR = hm.heights[idx + 1];
      const hU = hm.heights[idx - W], hD = hm.heights[idx + W];
      const vmax = Math.max(hL, hR, hU, hD);
      const vmin = Math.min(hL, hR, hU, hD);
      if (vmax - vmin > 0.25) continue;
      const x = -halfSize + i * step;
      const z = -halfSize + j * step;
      candidates.push({ x, z, y: h });
    }
  }
  if (candidates.length === 0) return [];
  const c = candidates[Math.floor(rand() * candidates.length)];
  /* Face INLAND: rotation such that the model's forward axis points
     toward the island center (0, 0). Both statue + bank face the SAME
     way (parallel side-by-side layout, both looking inland). */
  const rotInland = Math.atan2(-c.x, -c.z);
  /* Bank offset PERPENDICULAR to the radial-from-center direction —
     i.e. tangent to the shoreline contour. This keeps both structures
     at the SAME distance from shore (true side-by-side, not bank-
     in-front-of-statue). 10u gap so they read as separate buildings.
     Falls back to opposite-perpendicular then radial-inland if the
     primary direction lands in water (narrow / curvy island edge
     cases like "Shoals" formations where one tangent shoots offshore). */
  const BANK_GAP = 10;
  const radialMag = Math.hypot(c.x, c.z) || 1;
  const radX = c.x / radialMag, radZ = c.z / radialMag;
  /* Heightmap sampler at island-local (x, z) — used to verify the bank's
     candidate position is on land (h > WATER_Y + 0.1). */
  const _sampleHm = (lx, lz) => {
    const fx = (lx + halfSize) / step;
    const fz = (lz + halfSize) / step;
    const i = Math.max(0, Math.min(W - 1, Math.round(fx)));
    const j = Math.max(0, Math.min(H - 1, Math.round(fz)));
    return hm.heights[j * W + i];
  };
  /* Candidate bank offsets in priority order: perpendicular(+10),
     perpendicular(-10), radial-inland(10). First one that lands on
     dry land wins. If all three fail (extremely narrow island), fall
     back to the original perpendicular(+10) and accept the visual. */
  const _bankOffsets = [
    [-radZ * BANK_GAP,  radX * BANK_GAP],  // +perpendicular (original)
    [ radZ * BANK_GAP, -radX * BANK_GAP],  // -perpendicular (opposite side)
    [-radX * BANK_GAP, -radZ * BANK_GAP],  // radial-inland
  ];
  let bankOffX = _bankOffsets[0][0], bankOffZ = _bankOffsets[0][1];
  for (const [ox, oz] of _bankOffsets) {
    if (_sampleHm(c.x + ox, c.z + oz) > WATER_Y + 0.1) {
      bankOffX = ox; bankOffZ = oz;
      break;
    }
  }
  const out = [{
    type: 'Slime_Statue',
    x: +c.x.toFixed(2),
    z: +c.z.toFixed(2),
    y: +c.y.toFixed(2),
    scale: 2.5,
    rot: +rotInland.toFixed(3),
  }, {
    type: 'Island_Bank',
    x: +(c.x + bankOffX).toFixed(2),
    z: +(c.z + bankOffZ).toFixed(2),
    y: +c.y.toFixed(2),
    scale: 1.8,
    rot: +rotInland.toFixed(3),
  }];
  /* Treasure prop — exactly ONE per island, deterministic per islandSeed.
     Placed near the island center (small jittered offset), on land
     above WATER_Y. Heightmap is sampled at the chosen cell. Used for
     Sailing Master "treasure" tasks — clicking it completes the find. */
  const tRand = mulberry32(hash32(seed, 0x7E2510));
  const propType = tRand() < 0.5 ? 'Slime_Fountain' : 'Slime_Birdbath';
  /* Try strict constraints first, then progressively relax. Tiny / hilly /
     narrow islands fail the strict pass — they were ending up with no
     treasure at all, breaking Sailing Master "find treasure" tasks for
     those islands. Each tier loosens one constraint; the final tier
     accepts ANY land cell so every island gets a treasure. */
  const PASSES = [
    { minDist: 8, maxFlat: 0.3, hMin: WATER_Y + 0.2, hMax: HILL_Y - 0.3 },  // strict: inland + flat
    { minDist: 5, maxFlat: 0.5, hMin: WATER_Y + 0.2, hMax: HILL_Y - 0.3 },  // relaxed
    { minDist: 2, maxFlat: 1.0, hMin: WATER_Y + 0.2, hMax: HILL_Y - 0.3 },  // looser
    { minDist: 0, maxFlat: 99,  hMin: WATER_Y + 0.05, hMax: 9999 },          // any land
  ];
  let tCandidates = [];
  for (const pass of PASSES) {
    for (let j = 2; j < H - 2; j++) {
      for (let i = 2; i < W - 2; i++) {
        const idx = j * W + i;
        const h = hm.heights[idx];
        if (h < pass.hMin || h > pass.hMax) continue;
        const d = dist[idx];
        if (d < pass.minDist) continue;
        const x = -halfSize + i * step;
        const z = -halfSize + j * step;
        const hL = hm.heights[idx - 1], hR = hm.heights[idx + 1];
        const hU = hm.heights[idx - W], hD = hm.heights[idx + W];
        const vmax = Math.max(hL, hR, hU, hD);
        const vmin = Math.min(hL, hR, hU, hD);
        if (vmax - vmin > pass.maxFlat) continue;
        tCandidates.push({ x, z, y: h });
      }
    }
    if (tCandidates.length > 0) break;
  }
  if (tCandidates.length > 0) {
    const t = tCandidates[Math.floor(tRand() * tCandidates.length)];
    out.push({
      type: propType,
      x: +t.x.toFixed(2),
      z: +t.z.toFixed(2),
      y: +t.y.toFixed(2),
      scale: 1.4,
      rot: +(tRand() * Math.PI * 2).toFixed(3),
    });
  }
  /* Fishing spots — 1-2 per island in shallow OFFSHORE water just past
     the beach. Candidate must be:
       1. A water cell (height < WATER_Y)
       2. ALL 8 immediate neighbors also water (so the spot mesh sits
          fully OUT of any beach/sand pixel — not half-on-land)
       3. Within 4-6 cells of land (close enough to walk-fish from
          shore, far enough to be unambiguously in the ocean)
     The procgen distance field is only valid for LAND cells (water
     = INF), so the "near land" check is a small neighborhood scan. */
  const fRand = mulberry32(hash32(seed, 0xF1591A6E));
  const fishCandidates = [];
  const _waterIso = WATER_Y;
  const _landIso = WATER_Y + 0.02;
  for (let j = 6; j < H - 6; j++) {
    for (let i = 6; i < W - 6; i++) {
      const idx = j * W + i;
      const h = hm.heights[idx];
      if (h >= _waterIso) continue;
      /* All 8 neighbors must also be water — keeps the spot fully
         clear of the shoreline and away from sand/beach pixels. */
      let allWater = true;
      for (let dj = -1; dj <= 1 && allWater; dj++) {
        for (let di = -1; di <= 1 && allWater; di++) {
          if (di === 0 && dj === 0) continue;
          const nh = hm.heights[(j + dj) * W + (i + di)];
          if (nh >= _waterIso) allWater = false;
        }
      }
      if (!allWater) continue;
      /* Land within 4-6 cells = shoreline-adjacent ocean. */
      let nearLand = false;
      outer: for (let dj = -6; dj <= 6; dj++) {
        for (let di = -6; di <= 6; di++) {
          const r2 = di * di + dj * dj;
          if (r2 < 9 || r2 > 36) continue;       /* ring 3-6 cells */
          const nh = hm.heights[(j + dj) * W + (i + di)];
          if (nh >= _landIso) { nearLand = true; break outer; }
        }
      }
      if (!nearLand) continue;
      const x = -halfSize + i * step;
      const z = -halfSize + j * step;
      fishCandidates.push({ x, z });
    }
  }
  /* 1-2 spots, sampled with min separation so they don't overlap. */
  const fishCount = 1 + Math.floor(fRand() * 2);
  const placedFish = [];
  for (let n = 0; n < fishCount && fishCandidates.length > 0; n++) {
    let pick = null, picksTried = 0;
    while (picksTried < 24 && !pick) {
      const c = fishCandidates[Math.floor(fRand() * fishCandidates.length)];
      const farEnough = placedFish.every(p => {
        const dx = p.x - c.x, dz = p.z - c.z;
        return dx * dx + dz * dz > 100;       /* 10u apart minimum */
      });
      if (farEnough) pick = c;
      picksTried++;
    }
    if (!pick) break;
    placedFish.push(pick);
    out.push({
      type: 'Svc_FishingSpot',
      x: +pick.x.toFixed(2),
      z: +pick.z.toFixed(2),
      y: +WATER_Y.toFixed(2),
      scale: 1,
      rot: 0,
    });
  }
  return out;
}

// ─── Orchestrator ────────────────────────────────────────────────────────
/* Yield helper — macrotask gap so the browser can paint a frame between
   heavy phases. setTimeout(0) clamps to ~4ms in nested timers, which is
   fine: we just need rAF to fire between phases so the channel UI ticks
   smoothly and other game loops don't starve. */
const _yieldFrame = () => new Promise(r => setTimeout(r, 0));

/* Per-phase timing — captures durations into window.__procgenPhases so
   we can see which phase is the actual hitch source. Toggle off by
   setting window._procgenPhasePerf = false. Cheap when off (string
   compare + no-op). */
const _phaseStart = (label) => {
  if (typeof window !== "undefined" && window._procgenPhasePerf !== false) {
    return { label, t0: performance.now() };
  }
  return null;
};
const _phaseEnd = (h) => {
  if (!h) return;
  const dt = performance.now() - h.t0;
  if (typeof window !== "undefined") {
    if (!window.__procgenPhases) window.__procgenPhases = [];
    window.__procgenPhases.push({ phase: h.label, ms: +dt.toFixed(1), at: +h.t0.toFixed(0) });
  }
};

export async function generateIsland(opts) {
  const {
    seed = 0xCAFEBABE,
    sizeChunks = 2,
    biome = 'temperate',
    shape = 'round',
    tier = 1,
    worldX = 0, worldZ = 0,
  } = opts;

  const _pSeed = _phaseStart(`island-${seed}-hm`);
  const hm = await generateHeightmap({ seed, sizeChunks, biome, shape });
  _phaseEnd(_pSeed);
  /* generateHeightmap is now async and yields internally (after STEP 1
     and STEP 3), so the previous extra yield-after-heightmap here is
     redundant. */

  // ── MAINLAND-STYLE ALIGNMENT ──────────────────────────────────────────
  // Mainland's shoreline_chains.json is derived from "where the mesh
  // crosses WATER_Y", so its foam + alpha texture + mesh iso all coincide
  // at the same curve by construction. No gap for teeth to leak through.
  //
  // Our procgen polygon comes from the shape-field iso-0, which is NOT
  // where the mesh crosses WATER_Y — heightFn intentionally puts the
  // mesh iso at sd = sd_iso < 0 (slightly inland) to avoid z-fighting
  // with the water plane at y=WATER_Y. So we solve numerically for
  // sd_iso and offset the shoreline chain inland by exactly that
  // distance. Now chain coincides with mesh iso, foam covers mesh iso,
  // waterAlpha bake happens relative to mesh iso — same as mainland.
  const sd_iso = hm.heightFn ? _findMeshIsoSD(hm.heightFn) : 0;
  /* Foam chain: still offset the polygon inland by |sd_iso| so foam
     visually sits on the mesh iso. This CAN self-intersect on spiky
     shapes (high shoreIrregularity + peninsula/jagged), but the SDF is
     no longer rebuilt from this polygon — any folds here are cosmetic
     to foam only, and can't produce "pointed rocks" in the mesh. */
  const polygonOnMeshIso = (hm.polygon && hm.polygon.length >= 6)
    ? _offsetPolygonAlongNormals(hm.polygon, sd_iso, hm.heightFn)
    : (hm.polygon || []);
  const shorelineChain = toShorelineChain(polygonOnMeshIso, worldX, worldZ);

  /* Reuse the ORIGINAL-polygon SDF built by generateHeightmap. Previously
     we rebuilt the SDF from the offset polygon so that `signed=0` coincided
     with the mesh iso — but a self-intersecting offset polygon then
     produced corrupted SDF regions that the mesh rendered as pointed
     rocks. By keeping the SDF on the clean original polygon, callers just
     subtract sd_iso to get mesh-iso-relative SD where they need it
     (alpha bake, color paint). Bonus: one fewer O(W*H*N) SDF build per
     island — meaningful for world-load time. */
  const sdfLocal = hm.sdfLocal;

  const _pDist = _phaseStart(`island-${seed}-distField`);
  const dist = distanceField(hm);
  _phaseEnd(_pDist);
  /* Yield after distance field — second-heaviest phase. */
  await _yieldFrame();
  const _pColors = _phaseStart(`island-${seed}-paintColors`);
  const colors = paintColors(hm, dist, { seed, biome });
  _phaseEnd(_pColors);
  /* Yield after color paint — frees the main thread before prop placement
     and POI math runs. */
  await _yieldFrame();
  /* ACTUALLY CALL the prop + POI placers — they were defined but never
     invoked, leaving every procgen island with zero trees/rocks/bushes/
     starfish and no services. placeProps returns biome-appropriate
     prop records; placePOIs returns bank/store/shop positions. */
  const props = placeProps(hm, dist, { seed, biome, tier });
  const pois = placePOIs(hm, dist, { seed, biome, tier });
  /* Per-biome combat slimes — bundled into POI list so they ride the same
     chunk-loading path as Slime_Statue. */
  const mobs = placeMobs(hm, dist, { seed, biome, tier });
  for (let i = 0; i < mobs.length; i++) pois.push(mobs[i]);

  /* ─── Dock spot: radial outward from island center ──────
     From the shore chain point closest to the statue, point the dock
     straight away from the island center. Simple, always faces ocean. */
  let dockSpot = null;
  if (shorelineChain && shorelineChain.length >= 4) {
    const _statuePoi = pois.find(p => p.type === 'Slime_Statue');
    if (_statuePoi) {
      const sLX = _statuePoi.x, sLZ = _statuePoi.z;
      let bestI = 0, bestDist = Infinity;
      for (let i = 0; i < shorelineChain.length; i++) {
        const cx = shorelineChain[i][0] - worldX;
        const cz = shorelineChain[i][1] - worldZ;
        const d = Math.hypot(cx - sLX, cz - sLZ);
        if (d < bestDist) { bestDist = d; bestI = i; }
      }
      const cP = shorelineChain[bestI];
      const shoreLX = cP[0] - worldX;
      const shoreLZ = cP[1] - worldZ;
      const len = Math.hypot(shoreLX, shoreLZ) || 1;
      dockSpot = {
        x: +shoreLX.toFixed(2),
        z: +shoreLZ.toFixed(2),
        dirX: +(shoreLX / len).toFixed(4),
        dirZ: +(shoreLZ / len).toFixed(4),
      };
    }
  }

  return {
    meta: { seed, sizeChunks, biome, shape, tier, worldX, worldZ },
    hm,
    dist,
    colors,
    shoreline: polygonOnMeshIso,
    shorelineChain,
    sdfLocal,
    sd_iso,           // expose so islandToChunks' heightFn calls can shift sd
    props,
    pois,
    dockSpot,         // { x, z, dirX, dirZ } in island-local coords; baked, deterministic
  };
}

// Find sd where heightFn returns WATER_Y (0). Uses bisection on the beach-
// rise zone where heightFn is monotonic and crosses 0. Returns a negative
// value (the mesh emerges above water slightly inland of the polygon).
function _findMeshIsoSD(heightFn) {
  // heightFn is monotonic across sd ∈ [-5, +5] near the shore. Bisect.
  let lo = -5, hi = 5;
  // Ensure bracketing: heightFn(lo) > 0 (land above water), heightFn(hi) < 0.
  for (let iter = 0; iter < 32; iter++) {
    const mid = (lo + hi) * 0.5;
    const y = heightFn(0, 0, mid);
    if (y > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) * 0.5;
}

// Offset a closed polygon inward (toward land) so each vertex lands ON
// the local mesh-water-crossing iso line. Per-vertex bisection of
// heightFn(vx, vz, sd) means the offset polygon traces the ACTUAL
// visible mesh waterline — works regardless of biome peakHeight or
// per-position 2D targetY variation. Replaces the broken
// island-center-only sd_iso scheme that misaligned foam everywhere
// off-center.
function _offsetPolygonAlongNormals(polygon, sd_iso, heightFn) {
  const n = polygon.length / 2;
  if (n < 3) return polygon;
  const out = new Array(polygon.length);
  for (let i = 0; i < n; i++) {
    const pi = (i - 1 + n) % n;
    const ni = (i + 1) % n;
    const px = polygon[pi * 2], pz = polygon[pi * 2 + 1];
    const nx = polygon[ni * 2], nz = polygon[ni * 2 + 1];
    const cx = polygon[i * 2],  cz = polygon[i * 2 + 1];
    // Outward normal via tangent rotation (CCW polygon: rotate CW = outward).
    const tx = (nx - px) * 0.5, tz = (nz - pz) * 0.5;
    let ox = tz, oz = -tx;
    const l = Math.hypot(ox, oz) || 1;
    ox /= l; oz /= l;
    let localIso = sd_iso;
    if (heightFn) {
      // Bisect: find local sd where heightFn(cx, cz, sd) = 0.
      // sd=0 means at-polygon (water side, mesh below water);
      // sd<0 means inland (mesh climbing toward targetY).
      let lo = -2, hi = 0.1;
      for (let it = 0; it < 14; it++) {
        const mid = (lo + hi) * 0.5;
        const y = heightFn(cx, cz, mid);
        if (y > 0) lo = mid; else hi = mid;
      }
      localIso = (lo + hi) * 0.5;
    }
    out[i * 2]     = cx + ox * localIso;
    out[i * 2 + 1] = cz + oz * localIso;
  }
  return out;
}

// Build a signed distance field covering the island's heightmap grid.
// Returns { distField, signField, dfW, dfH, dfMinX, dfMinZ } in LOCAL
// island-space coords. +ve = outward (water side) relative to polygon.
// EXPORTED for use by mainland bake.
export function _buildSignedDistanceField(localChain, halfSize) {
  if (!localChain || localChain.length < 3) return null;
  let shMinX = Infinity, shMaxX = -Infinity, shMinZ = Infinity, shMaxZ = -Infinity;
  for (let i = 0; i < localChain.length; i++) {
    const p = localChain[i];
    if (p[0] < shMinX) shMinX = p[0]; if (p[0] > shMaxX) shMaxX = p[0];
    if (p[1] < shMinZ) shMinZ = p[1]; if (p[1] > shMaxZ) shMaxZ = p[1];
  }
  // Cover the entire heightmap (±halfSize) so the smoothing pass can decide
  // "far from shore" consistently for every cell.
  const dfMinX = Math.floor(Math.min(shMinX, -halfSize)) - 2;
  const dfMinZ = Math.floor(Math.min(shMinZ, -halfSize)) - 2;
  const dfMaxX = Math.ceil(Math.max(shMaxX, halfSize)) + 2;
  const dfMaxZ = Math.ceil(Math.max(shMaxZ, halfSize)) + 2;
  const dfW = dfMaxX - dfMinX + 1;
  const dfH = dfMaxZ - dfMinZ + 1;
  const distField = new Float32Array(dfW * dfH);
  const signField = new Int8Array(dfW * dfH);
  const FAR = 1e6;
  for (let i = 0; i < distField.length; i++) distField[i] = FAR;

  // MARGIN controls how far from a segment we rasterize. Needs to cover
  // SHORE_R (~18u) + whatever max distance matters for colour/waterAlpha
  // lookups (PAINT_R=8, ALPHA_REACH≈2.5). 24u is generous.
  const MARGIN = 24;
  const n = localChain.length;
  for (let si = 0; si < n; si++) {
    const a = localChain[si];
    const b = localChain[(si + 1) % n];
    const ax = a[0], az = a[1], bx = b[0], bz = b[1];
    const nx = a[2], nz = a[3];
    const sxMin = Math.floor(Math.min(ax, bx)) - MARGIN;
    const sxMax = Math.ceil(Math.max(ax, bx)) + MARGIN;
    const szMin = Math.floor(Math.min(az, bz)) - MARGIN;
    const szMax = Math.ceil(Math.max(az, bz)) + MARGIN;
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    for (let wz = szMin; wz <= szMax; wz++) {
      if (wz < dfMinZ || wz >= dfMinZ + dfH) continue;
      for (let wx = sxMin; wx <= sxMax; wx++) {
        if (wx < dfMinX || wx >= dfMinX + dfW) continue;
        let t;
        if (len2 < 1e-10) t = 0;
        else {
          t = ((wx - ax) * dx + (wz - az) * dz) / len2;
          if (t < 0) t = 0; else if (t > 1) t = 1;
        }
        const ex = wx - (ax + t * dx), ez = wz - (az + t * dz);
        const d = Math.sqrt(ex * ex + ez * ez);
        const idx = (wz - dfMinZ) * dfW + (wx - dfMinX);
        if (d < distField[idx]) {
          distField[idx] = d;
          signField[idx] = (ex * nx + ez * nz) >= 0 ? 1 : -1;
        }
      }
    }
  }
  // Scan-line fill for the SIGN of cells outside MARGIN's reach. Without this
  // the island's interior (>24u from any shore segment) reads as signField=0,
  // which shoreSignedF treats as + (water) — mesh sinks to DEEP_MAX, global
  // ocean covers it, and the island renders as a hollow donut. PIP by parity
  // of polygon crossings on each row. Cells already marked by the MARGIN pass
  // are untouched; only ambiguous cells get filled. Distance stays at FAR for
  // these cells, which is fine because heightFn/colors clamp to inland plateau
  // at |sd| > BEACH_RISE + FLAT_SHORE + BEACH_WIDTH anyway.
  const crossings = new Array(dfH);
  for (let iz = 0; iz < dfH; iz++) crossings[iz] = [];
  for (let si = 0; si < n; si++) {
    const a = localChain[si];
    const b = localChain[(si + 1) % n];
    const az = a[1], bz = b[1];
    if (az === bz) continue;
    const zLo = Math.ceil(Math.min(az, bz));
    const zHi = Math.floor(Math.max(az, bz));
    const ax = a[0], bx = b[0];
    for (let wz = zLo; wz <= zHi; wz++) {
      if (wz <= Math.min(az, bz) || wz > Math.max(az, bz)) continue;
      const iz = wz - dfMinZ;
      if (iz < 0 || iz >= dfH) continue;
      const t = (wz - az) / (bz - az);
      crossings[iz].push(ax + t * (bx - ax));
    }
  }
  for (let iz = 0; iz < dfH; iz++) {
    const xs = crossings[iz];
    if (xs.length === 0) continue;
    xs.sort((a, b) => a - b);
    let xi = 0, inside = false;
    const rowBase = iz * dfW;
    for (let ix = 0; ix < dfW; ix++) {
      const wx = ix + dfMinX;
      while (xi < xs.length && xs[xi] < wx) { inside = !inside; xi++; }
      const idx = rowBase + ix;
      if (signField[idx] === 0) signField[idx] = inside ? -1 : 1;
    }
  }
  return { distField, signField, dfW, dfH, dfMinX, dfMinZ };
}

// Laplacian blur of hm.heights in the shore band (|signed distance| < SHORE_R).
// Mirrors mainland smooth_shores.mjs: iterative 5-point blur with center
// weighted 2× to keep convergence stable. Cells outside the band are
// untouched so inland hills + deep ocean keep their variety. More passes
// = more thoroughly damped noise near the waterline (beach holes / sand
// flecks become less likely). Mainland uses 50; we use 40 + a slightly
// wider SHORE_R to offset not having hand-tuned input heights.
function _smoothShoreHeights(hm, sdfLocal, shoreR, passes) {
  const { heights, W, H, step, halfSize } = hm;
  const { distField, signField, dfW, dfH, dfMinX, dfMinZ } = sdfLocal;
  const mask = new Uint8Array(W * H);
  const sgn = new Int8Array(W * H);
  let shoreCells = 0;
  for (let j = 0; j < H; j++) {
    const lz = -halfSize + j * step;
    for (let i = 0; i < W; i++) {
      const lx = -halfSize + i * step;
      const ix = Math.round(lx) - dfMinX;
      const iz = Math.round(lz) - dfMinZ;
      if (ix < 0 || ix >= dfW || iz < 0 || iz >= dfH) continue;
      const dfi = iz * dfW + ix;
      const d = distField[dfi];
      sgn[j * W + i] = signField[dfi];
      if (d < shoreR) { mask[j * W + i] = 1; shoreCells++; }
    }
  }
  if (!shoreCells) return;

  const tmp = new Float32Array(W * H);
  for (let p = 0; p < passes; p++) {
    tmp.set(heights);
    for (let j = 1; j < H - 1; j++) {
      for (let i = 1; i < W - 1; i++) {
        if (!mask[j * W + i]) continue;
        const idx = j * W + i;
        const c = heights[idx];
        const sum = c * 2
          + heights[idx - 1] + heights[idx + 1]
          + heights[idx - W] + heights[idx + W];
        tmp[idx] = sum / 6;
      }
    }
    heights.set(tmp);
  }

  // (Violation clamp deliberately absent. Previous attempts snapped
  //  "wrong-side" cells to discrete values which created micro-cliffs
  //  that bilinear sampling to step=1 mesh propagated across ~4u of
  //  shore. With step=1 mesh the few remaining "sand teeth" are 1u
  //  wide and barely visible, and the blurred slope stays smooth.)
}

// ─── Shoreline distance helpers (mirrors paint_shores.mjs + bake_water_alpha.mjs) ──
// Build a spatial-hash grid of a shoreline polygon chain's line segments so
// per-pixel distance queries are O(1) instead of O(N_segments). Matches the
// SG_CELL / segGrid pattern in bake_water_alpha.mjs.
function _buildShoreSegGrid(chain, cellSize = 4) {
  const grid = Object.create(null);
  const segs = [];
  for (let i = 0; i < chain.length; i++) {
    const a = chain[i];
    const b = chain[(i + 1) % chain.length];
    const seg = { ax: a[0], az: a[1], bx: b[0], bz: b[1] };
    const si = segs.length;
    segs.push(seg);
    const x0 = Math.floor(Math.min(seg.ax, seg.bx) / cellSize) - 1;
    const x1 = Math.floor(Math.max(seg.ax, seg.bx) / cellSize) + 1;
    const z0 = Math.floor(Math.min(seg.az, seg.bz) / cellSize) - 1;
    const z1 = Math.floor(Math.max(seg.az, seg.bz) / cellSize) + 1;
    for (let gz = z0; gz <= z1; gz++) {
      for (let gx = x0; gx <= x1; gx++) {
        const k = gx + ',' + gz;
        (grid[k] || (grid[k] = [])).push(si);
      }
    }
  }
  return { grid, segs, cellSize };
}
function _distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-10) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
function _shoreDist(segGrid, wx, wz) {
  const { grid, segs, cellSize } = segGrid;
  const gx = Math.floor(wx / cellSize);
  const gz = Math.floor(wz / cellSize);
  let minD = Infinity;
  // 7×7 neighbour cells covers up to ~28u search radius at CELL_SIZE=4
  for (let dz = -3; dz <= 3; dz++) {
    for (let dx = -3; dx <= 3; dx++) {
      const list = grid[(gx + dx) + ',' + (gz + dz)];
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const s = segs[list[i]];
        const d = _distToSeg(wx, wz, s.ax, s.az, s.bx, s.bz);
        if (d < minD) minD = d;
      }
    }
  }
  return minD;
}

// Uint8Array → base64 (browser-safe, no Buffer).
function _u8ToB64(buf) {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

// Underwater cells get painted with this flat linear-RGB colour so if any
// of the seabed bleeds through semi-transparent water, it reads as "more
// water" instead of sand/dirt. Matches the chunk water's deep shader
// colour so there's effectively no visible boundary between the seabed
// and the chunk-water plane above it.
const _SEABED_COLOR = [0.06, 0.18, 0.38];

// ─── Splitting into chunk JSONs ──────────────────────────────────────────
// Given an island and its world position, returns array of
// { cx, cz, json } — chunk JSON in the same format as docs/chunks/*.json.
// Mirrors the mainland pipeline's per-pixel paint + water-alpha baking so
// procgen shorelines get the same smooth quality as hand-authored land.
export async function islandToChunks(island) {
  const { hm, colors, shorelineChain, props, pois, meta } = island;
  const { sizeChunks, worldX, worldZ } = meta;
  const halfSize = (sizeChunks * CHUNK_SIZE) / 2;
  const _pITC = _phaseStart(`islandToChunks-${meta.seed}-${sizeChunks}ch`);
  /* Wrap the entire return in a finally-equivalent — we capture the end
     time just before returning the chunks dict at the bottom. */
  const _captureITCend = (result) => { _phaseEnd(_pITC); return result; };

  // Chunk local-coord ranges MUST match the game's buildTerrainMesh grid,
  // which uses chunkBounds() from terrainHeight.js:
  //   lx ∈ [(GX_MIN-1)*TILE_S .. (GX_MAX+1)*TILE_S]  = [-50 .. +50]
  //   lz ∈ [(GZ_MIN-1)*TILE_S .. (GZ_MAX+1)*TILE_S]  = [-46 .. +54]   (asymmetric!)
  const LX_MIN = -50, LX_MAX = 50;
  const LZ_MIN = -46, LZ_MAX = 54;

  // Binary water alpha — fully opaque over water zone, discarded over land.
  // No gradient, no fade, no soft shore band. That's what was producing
  // "sometimes solid, sometimes see-through" water: the gradient's thinner
  // alpha at the shore exposed the underlying terrain paint at angle-
  // dependent strengths. Hard cutoff is deterministic per pixel.
  const WATER_ALPHA = 0.95;   // just shy of 1 so GPU still respects transparent path
  const ALPHA_PAD = 8;        // PAD in water alpha texture (matches mainland)

  // Shoreline AABB — used for chunk-level cull decisions.
  let shMinX = Infinity, shMaxX = -Infinity, shMinZ = Infinity, shMaxZ = -Infinity;
  if (shorelineChain) {
    for (let i = 0; i < shorelineChain.length; i++) {
      const p = shorelineChain[i];
      if (p[0] < shMinX) shMinX = p[0]; if (p[0] > shMaxX) shMaxX = p[0];
      if (p[1] < shMinZ) shMinZ = p[1]; if (p[1] > shMaxZ) shMaxZ = p[1];
    }
  }

  // Reuse the signed distance field `generateIsland` built (in local island
  // coords). Convert queries from world to local by subtracting worldX/Z.
  const sdf = island.sdfLocal;
  const shoreDistF = (wx, wz) => {
    if (!sdf) return 1e6;
    const lx = Math.round(wx - worldX);
    const lz = Math.round(wz - worldZ);
    const ix = lx - sdf.dfMinX, iz = lz - sdf.dfMinZ;
    if (ix < 0 || ix >= sdf.dfW || iz < 0 || iz >= sdf.dfH) return 1e6;
    return sdf.distField[iz * sdf.dfW + ix];
  };
  const shoreSignedF = (wx, wz) => {
    if (!sdf) return 1e6;
    const lx = Math.round(wx - worldX);
    const lz = Math.round(wz - worldZ);
    const ix = lx - sdf.dfMinX, iz = lz - sdf.dfMinZ;
    if (ix < 0 || ix >= sdf.dfW || iz < 0 || iz >= sdf.dfH) return 1e6;
    const s = sdf.signField[iz * sdf.dfW + ix] || 1;
    return sdf.distField[iz * sdf.dfW + ix] * s;
  };
  const distField = sdf ? sdf.distField : null;
  /* shoreSignedF now returns SD relative to the ORIGINAL shape polygon
     (sdfLocal is the un-offset SDF). heightFn is calibrated in that same
     frame → pass `signed` directly. For anything that needs mesh-iso-
     relative SD (alpha bake, color paint), subtract sd_iso. */
  const sd_iso = island.sd_iso || 0;

  // Derive chunk range from the island's actual world extent, NOT from a
  // fixed sizeChunks×sizeChunks grid centered on round(worldX/CHUNK_SIZE).
  // When worldX isn't a multiple of CHUNK_SIZE, the heightmap's 2×halfSize
  // extent slips past the fixed grid on one side, leaving the land beyond
  // it unrendered (hard vertical chunk-boundary cuts in-game). Using the
  // extent gives us `sizeChunks` chunks when aligned and `sizeChunks+1` when
  // offset — either way the full heightmap is covered.
  const cxLo = Math.round((worldX - halfSize) / CHUNK_SIZE);
  const cxHi = Math.round((worldX + halfSize) / CHUNK_SIZE);
  const czLo = Math.round((worldZ - halfSize) / CHUNK_SIZE);
  const czHi = Math.round((worldZ + halfSize) / CHUNK_SIZE);

  // Per-vertex paint inputs: biome palette + continuous grass noise so
  // coloring is driven by smooth functions of (y, signedDist, worldXZ)
  // instead of sampled from the step-4 `colors` array. The old sampling
  // used Math.round() which snapped four adjacent 1u mesh vertices to the
  // same step-4 color cell, producing the visible 4u grass/sand staircase.
  const B = BIOMES[meta.biome] || BIOMES.temperate;
  /* Per-island palette jitter: small seed-derived offsets applied to the
     biome base palette so two islands of the same biome don't look
     identical. Offsets are intentionally subtle (±0.04 per channel) to
     preserve biome identity while giving each island its own warmth/
     coolness character. */
  /* Cool-palette detection — set BEFORE per-island jitter so the jitter
     itself can be biased to keep cool biomes cool. */
  const _isCool = B.sand[2] >= B.sand[0] - 0.05;
  /* Per-island palette jitter. For warm biomes, jitter independently per
     channel for variety. For cool biomes, force B-channel jitter ≥ R-channel
     jitter so the island can't end up randomly warmer than its base — that
     was the source of leftover yellow-on-snow even after the per-channel
     noise fix. */
  const _paletteJ = mulberry32(hash32(meta.seed, 0xC01D11));
  let _rJit = (_paletteJ() - 0.5) * 0.08;
  let _gJit = (_paletteJ() - 0.5) * 0.06;
  let _bJit = (_paletteJ() - 0.5) * 0.08;
  if (_isCool) {
    /* Bias all three channels in the same direction (overall lightness
       shift only) so cool palettes don't drift warm/cool randomly. */
    const lightShift = (_rJit + _gJit + _bJit) / 3;
    _rJit = _gJit = _bJit = lightShift;
  }
  const _tint = (c) => [c[0] + _rJit, c[1] + _gJit, c[2] + _bJit];
  const sand = _tint(B.sand), grass = _tint(B.grass), hill = _tint(B.hill), peak = _tint(B.peak);
  const _nwG = _isCool ? 1.0 : 0.9;     // green noise weight (cool: uniform; warm: slight R bias)
  const _nwB = _isCool ? 1.0 : 0.6;     // blue noise weight
  /* Mid-altitude meadow: a slight LIGHTER & DRIER variant of grass —
     lifts brightness uniformly, no specific R-shift. Previous formula
     (grass*0.75 + [0.32, 0.18, 0.05]) was pushing meadow toward
     piss-yellow on every biome. Now: just lighten grass toward 0.5
     gray by 30%, preserving its hue. */
  const meadow = [
    grass[0] * 0.7 + 0.5 * 0.3,
    grass[1] * 0.7 + 0.5 * 0.3,
    grass[2] * 0.7 + 0.45 * 0.3,
  ];
  /* Stone plaza color — consistent medium-grey so the plaza visually
     stands out from any biome ground, regardless of the biome's
     palette. No per-island jitter applied — the plaza should read
     as 'paved' (uniform stone), not as biome-specific terrain. */
  /* Aztec-temple stone — warm sandstone base with noise variation
      applied at paint time so the plaza reads as weathered paving rather
      than a flat grey disc. */
  const _stoneCol = [0.72, 0.62, 0.46];
  /* Bigger plaza: 16u radius (32u diameter) with 4u fade ring so it's
     unambiguously visible as a stoneworked area. Larger than the
     statue+bank footprint by ~3× so the plaza reads clearly even when
     the camera is pulled back. */
  const STATUE_GROUND_RADIUS = 16;
  const STATUE_FADE = 1;       // tight edge — wider smoothstep got sliced into rings by toon banding
  const _statueSpots = [];
  for (let i = 0; i < pois.length; i++) {
    const p = pois[i];
    if (p.type === 'Slime_Statue' || p.type === 'Island_Bank') {
      _statueSpots.push({ x: p.x + worldX, z: p.z + worldZ });
    }
  }
  // Match heightFn's zones (mainland-style: mesh crosses WATER_Y at sd=0).
  const BEACH_RISE = 1.0;
  const FLAT_SHORE = 2;
  const BEACH_WIDTH = B.beachWidth;
  const SAND_EXTENT = BEACH_RISE + FLAT_SHORE;
  const grassNoise = createNoise(hash32(meta.seed, 0xC010C010));

  const out = [];
  let _cxYieldCounter = 0;
  for (let cz = czLo; cz <= czHi; cz++) {
    /* Yield between cz rows — splits the ~264ms total serialization
       across multiple frames (each row is ~30-90ms depending on island
       size). Without this, islandToChunks is the single largest sync
       blob in the whole procgen pipeline. */
    if (cz > czLo) await _yieldFrame();
    for (let cx = cxLo; cx <= cxHi; cx++) {
      /* Sub-row yield every 2 cx iterations — each chunk's per-vertex
         heightOffsets + colorOverrides + waterAlpha bake is ~15-45ms,
         so 2 chunks back-to-back can hit ~80ms (visible as bar stutter
         around 20% of fill). Yielding every 2 cuts the worst-case row
         long task in half without ballooning total wallclock with too
         many yields. */
      if (++_cxYieldCounter >= 2) { _cxYieldCounter = 0; await _yieldFrame(); }
      // Island-local coords of the chunk's (lx=0, lz=0) origin — i.e. the
      // world position cx*CHUNK_SIZE expressed relative to the island center.
      // Using cx directly (instead of the old ccx-based math) is correct even
      // when worldX/worldZ aren't multiples of CHUNK_SIZE.
      const chunkOriginLx = cx * CHUNK_SIZE - worldX;
      const chunkOriginLz = cz * CHUNK_SIZE - worldZ;

      // STEP-1 mesh resolution for procgen chunks. 1u spacing means the
      // rendered iso follows the chaikin-smoothed shoreline polygon at
      // nearly pixel-level fidelity — shore curves read as actual curves,
      // not step-2 micro-teeth or step-4 macro-teeth. Mainland stays at
      // step=4 (its hand-authored shores don't need the extra verts).
      const MESH_STEP = 1;
      const heightOffsets = {};
      const colorOverrides = {};
      const heightFn = hm.heightFn;
      /* OSRS_V2: chunk-vertex heights pass through osrsInlandHeight, the
         same closure that populated the step-4 heightmap. It internally
         routes ocean/shore/lakes through heightFn raw and quantizes only
         the inland-above-water plateau levels. Without using this exact
         closure, chunk heightOffsets diverge from the heightmap and
         reintroduce per-vertex micro-ramps. */
      const osrsInland = hm.osrsInlandHeight || null;
      for (let lz = LZ_MIN; lz <= LZ_MAX; lz += MESH_STEP) {
        for (let lx = LX_MIN; lx <= LX_MAX; lx += MESH_STEP) {
          const ix = chunkOriginLx + lx;
          const iz = chunkOriginLz + lz;
          // Water/land classification: polygon signed distance (1u SDF).
          const wx = cx * CHUNK_SIZE + lx, wz = cz * CHUNK_SIZE + lz;
          const signed = shoreSignedF(wx, wz);
          const sdMesh = signed - sd_iso;
          let y;
          if (osrsInland) {
            y = osrsInland(ix, iz, signed);
          } else if (heightFn) {
            y = heightFn(ix, iz, signed);
          } else {
            y = sampleHeight(hm, ix, iz);
          }
          heightOffsets[`${lx},${lz}`] = y > WATER_Y - 3
            ? +(y - GRASS_Y).toFixed(3)
            : -1.5;
          // Paint — driven by actual mesh y, NOT by sdMesh. sd_iso is
          // computed at island center (0,0) but local targetY varies
          // across the island, so sdMesh = signed - sd_iso lies for
          // off-center positions (mesh can be above water at sdMesh>0
          // when local targetY is high → bug: seabed paint on visibly
          // emerged land past the foam ribbon). Using y directly makes
          // paint zones match what's actually rendered.
          let r, g, b;
          const surfaceNoise = grassNoise.fbm2(wx * 0.09, wz * 0.09, 3);
          const macroNoise   = grassNoise.fbm2(wx * 0.025, wz * 0.025, 2);
          /* Wide-wavelength tonal (~80u patches) for macro brightness blobs. */
          const tonal = grassNoise.fbm2(wx * 0.012, wz * 0.012, 2) * 0.10;
          /* Fine-grained per-face noise (~2u wavelength) — every flat-shaded
             face gets its own distinct shade so large flat expanses (ice
             plains, sandy beaches, grass plateaus) don't read as a single
             blob. Uniform brightness, hue preserved. */
          const fine = grassNoise.fbm2(wx * 0.45, wz * 0.45, 1) * 0.05;
          const SHALLOW_DEPTH = 0.6;   // y range below water that fades sand → seabed
          /* UNIFORM neutral warm-sand color used for the shallow underwater
             blend — same across all biomes so we don't reintroduce the
             biome-specific seabed colors (ice teal, desert ochre, etc.)
             that motivated removing the per-biome sand[] blend. Matches
             mainland's cSand (#F0D28A) = (0.941, 0.824, 0.541) so procgen
             coast and mainland coast read as the same shore tone. */
          const _SHORE_SAND_R = 0.941, _SHORE_SAND_G = 0.824, _SHORE_SAND_B = 0.541;
          if (y < WATER_Y - SHALLOW_DEPTH) {
            /* Deep band — pure unified seabed color */
            r = _SEABED_COLOR[0];
            g = _SEABED_COLOR[1];
            b = _SEABED_COLOR[2];
          } else if (y < WATER_Y) {
            /* Shallow band — uniform warm-sand → seabed smoothstep so
               every island has the natural sandy shore fade visible
               under the chunk water shore-fade alpha. */
            const t = (WATER_Y - y) / SHALLOW_DEPTH;
            const e = t * t * (3 - 2 * t);
            r = _SHORE_SAND_R * (1 - e) + _SEABED_COLOR[0] * e;
            g = _SHORE_SAND_G * (1 - e) + _SEABED_COLOR[1] * e;
            b = _SHORE_SAND_B * (1 - e) + _SEABED_COLOR[2] * e;
          } else {
            const distShore = -sdMesh;
            if (distShore < SAND_EXTENT) {
              const nv = surfaceNoise * 0.07;
              const wet = macroNoise;
              const wetDarken = Math.max(0, -wet) * 0.10;
              /* Wet sand R-warm-bias and B-cool-bias only on warm
                 biomes — cool biomes were inheriting yellow sand
                 patches because the wet*0.02 R add fired regardless
                 of palette. */
              const wetWarm = _isCool ? 0 : wet * 0.02;
              const wetCool = _isCool ? 0 : wet * 0.01;
              const wDk    = _isCool ? wetDarken : wetDarken;
              const wDkB   = _isCool ? wetDarken : wetDarken * 0.7;
              r = sand[0] + nv + wetWarm - wDk + tonal + fine;
              g = sand[1] + nv * _nwG - wDk + tonal + fine;
              b = sand[2] + nv * _nwB - wetCool - wDkB + tonal + fine;
            } else if (distShore < SAND_EXTENT + BEACH_WIDTH) {
              const t = (distShore - SAND_EXTENT) / BEACH_WIDTH;
              const e = t * t * (3 - 2 * t);
              const nv = surfaceNoise * 0.06;
              r = sand[0] * (1 - e) + grass[0] * e + nv + tonal + fine;
              g = sand[1] * (1 - e) + grass[1] * e + nv + tonal + fine;
              b = sand[2] * (1 - e) + grass[2] * e + nv + tonal + fine;
            } else if (y < HILL_Y - 1.0) {
              /* UNIFORM noise on grass — preserves green saturation
                 regardless of brightening or darkening direction. */
              const nv = surfaceNoise * 0.10;
              const macro = macroNoise * 0.06;
              r = grass[0] + nv + macro + tonal + fine;
              g = grass[1] + nv + macro + tonal + fine;
              b = grass[2] + nv + macro + tonal + fine;
            } else if (y < HILL_Y) {
              const t = (y - (HILL_Y - 1.0)) / 1.0;
              const e = t * t * (3 - 2 * t);
              const nv = surfaceNoise * 0.09;
              r = grass[0] * (1 - e) + meadow[0] * e + nv + tonal + fine;
              g = grass[1] * (1 - e) + meadow[1] * e + nv + tonal + fine;
              b = grass[2] * (1 - e) + meadow[2] * e + nv + tonal + fine;
            } else if (y < HILL_Y + 1.5) {
              const t = (y - HILL_Y) / 1.5;
              const nv = surfaceNoise * 0.07;
              r = meadow[0] * (1 - t) + hill[0] * t + nv + tonal + fine;
              g = meadow[1] * (1 - t) + hill[1] * t + nv + tonal + fine;
              b = meadow[2] * (1 - t) + hill[2] * t + nv + tonal + fine;
            } else {
              const t = Math.min(1, (y - HILL_Y - 1.5) / 2);
              const nv = surfaceNoise * 0.06;
              const darken = Math.min(0.08, Math.max(0, (y - HILL_Y - 3.5)) * 0.02);
              r = hill[0] * (1 - t) + peak[0] * t + nv - darken + tonal + fine;
              g = hill[1] * (1 - t) + peak[1] * t + nv - darken + tonal + fine;
              b = hill[2] * (1 - t) + peak[2] * t + nv - darken + tonal + fine;
            }
          }
          /* Statue-plaza ground override: vertices inside STATUE_GROUND_RADIUS
             of any plaza POI fade toward _stoneCol so the area around the
             statue/bank reads as a paved stone plaza, distinct from the
             surrounding biome ground. Only applies above water. */
          if (y >= WATER_Y && _statueSpots.length) {
            for (let si = 0; si < _statueSpots.length; si++) {
              const sp = _statueSpots[si];
              const dx = wx - sp.x, dz = wz - sp.z;
              const sd2 = Math.sqrt(dx * dx + dz * dz);
              /* Full-stone inside the radius (no inward fade), then a
                 1u smooth ring OUTSIDE the radius for AA. Old logic
                 ate the outer 1u of the plaza to a partial blend,
                 leaving a "almost filled but not quite" rim under
                 OSRS_V2 per-face averaging. */
              if (sd2 < STATUE_GROUND_RADIUS + STATUE_FADE) {
                /* Aztec-stone shading: per-face brightness/hue variation so
                   the plaza reads as weathered paving rather than uniform
                   colored disc. surfaceNoise drives main shade,
                   macroNoise drives gold/grey patches, fine adds
                   per-face variation. */
                const shade = surfaceNoise * 0.10 - macroNoise * 0.04;
                const goldTint = macroNoise * 0.06;
                const sR = _stoneCol[0] + shade + goldTint + tonal * 0.5 + fine;
                const sG = _stoneCol[1] + shade + goldTint * 0.6 + tonal * 0.5 + fine;
                const sB = _stoneCol[2] + shade + tonal * 0.5 + fine;
                if (sd2 < STATUE_GROUND_RADIUS) {
                  r = sR; g = sG; b = sB;
                } else {
                  const t = 1 - (sd2 - STATUE_GROUND_RADIUS) / STATUE_FADE;
                  const fSm = t * t * (3 - 2 * t);
                  r = r * (1 - fSm) + sR * fSm;
                  g = g * (1 - fSm) + sG * fSm;
                  b = b * (1 - fSm) + sB * fSm;
                }
                break;
              }
            }
          }
          colorOverrides[`${lx},${lz}`] = [
            +Math.max(0, Math.min(1, r)).toFixed(4),
            +Math.max(0, Math.min(1, g)).toFixed(4),
            +Math.max(0, Math.min(1, b)).toFixed(4),
          ];
        }
      }

      // Bake SIGNED DISTANCE into the alpha channel (procgen-only).
      // The water shader unpacks sd and does screen-space fwidth AA for a
      // 1-pixel-wide shore edge. This avoids the 1u-mesh/1u-texel grid
      // artifacts that depth-based bakes suffer from:
      //   - depth-based + shallow mesh ramp: smooth alpha, but mesh teeth
      //     poke through semi-transparent water at shore
      //   - depth-based + steep mesh ramp: alpha transition compresses into
      //     1 texel, producing visible staircase along the curved polygon
      // SDF bake + fwidth AA sidesteps both: sd varies linearly in world
      // space (so neighboring texels differ by ~1 per u, multi-texel
      // gradient regardless of mesh), and the visible edge is always 1
      // pixel wide on screen.
      //
      // Packing: u8 = clamp(128 + signed * 20), range ±6.35u, precision
      // ~0.05u/step. Shader unpacks as sd = (a*255 - 128)/20.
      let waterAlpha = null;
      if (distField) {
        const chunkLoX = cx * CHUNK_SIZE;
        const chunkLoZ = cz * CHUNK_SIZE;
        const aNx = (LX_MAX - LX_MIN + 1) + ALPHA_PAD * 2;
        const aNz = (LZ_MAX - LZ_MIN + 1) + ALPHA_PAD * 2;
        const buf = new Uint8Array(aNx * aNz * 4);
        const seabedR = (_SEABED_COLOR[0] * 255) | 0;
        const seabedG = (_SEABED_COLOR[1] * 255) | 0;
        const seabedB = (_SEABED_COLOR[2] * 255) | 0;
        for (let tz = 0; tz < aNz; tz++) {
          for (let tx = 0; tx < aNx; tx++) {
            const wx = chunkLoX + LX_MIN - ALPHA_PAD + tx;
            const wz = chunkLoZ + LZ_MIN - ALPHA_PAD + tz;
            const signed = shoreSignedF(wx, wz);
            /* shoreSD: positive = water side of shore. Shader sd=0 at
               mesh iso → subtract sd_iso to convert original-polygon
               frame to mesh-iso frame. */
            const shoreSD = signed - sd_iso;
            /* INTERIOR LAKES: if the mesh at this texel dips below
               WATER_Y (inland basin), override the SD with the depth so
               the shader renders a lake surface there too. Scale ×3 so
               even 0.2u-deep shallows cross the fwidth threshold
               (opaque center, screen-space AA at the lake edge). */
            const ix = wx - worldX, iz = wz - worldZ;
            const my = heightFn ? heightFn(ix, iz, signed) : 0;
            const depthSD = (WATER_Y - my) * 3;
            /* Combined: MAX gives water wherever EITHER shore is outside
               OR mesh is underwater. Negative only where mesh is above
               water AND inside the polygon = exposed land. */
            const sd = Math.max(shoreSD, depthSD);
            const sdPacked = Math.max(0, Math.min(255, Math.round(128 + sd * 20)));
            /* Lake mask in R channel: this fragment is a lake (not ocean)
               when the polygon-interior depth check wins over shore SD.
               Shader uses this to skip wobble + dampen waves so lake
               surfaces look calm and stylized rather than getting the
               same staircase-masking animation as the ocean. */
            const isLake = (depthSD > shoreSD && shoreSD < 0) ? 255 : 0;
            const ti = (tz * aNx + tx) * 4;
            buf[ti]     = isLake;
            buf[ti + 1] = seabedG;
            buf[ti + 2] = seabedB;
            buf[ti + 3] = sdPacked;
          }
        }
        waterAlpha = _u8ToB64(buf);
      }

      // Filter props whose world position falls inside this chunk's world extent.
      const chunkMinWX = cx * CHUNK_SIZE + LX_MIN;
      const chunkMaxWX = cx * CHUNK_SIZE + LX_MAX;
      const chunkMinWZ = cz * CHUNK_SIZE + LZ_MIN;
      const chunkMaxWZ = cz * CHUNK_SIZE + LZ_MAX;
      const chunkProps = [];
      for (const list of [props, pois]) {
        for (let p = 0; p < list.length; p++) {
          const pr = list[p];
          const prWX = pr.x + worldX;  // props are stored in island-local coords
          const prWZ = pr.z + worldZ;
          if (prWX >= chunkMinWX && prWX < chunkMaxWX &&
              prWZ >= chunkMinWZ && prWZ < chunkMaxWZ) {
            chunkProps.push({
              type: pr.type,
              // Chunk loader expects x/z in LOCAL chunk coords (world - cx*CHUNK_SIZE)
              x: +(prWX - cx * CHUNK_SIZE).toFixed(2),
              z: +(prWZ - cz * CHUNK_SIZE).toFixed(2),
              y: pr.y,
              scale: pr.scale ?? 1,
              rot: pr.rot ?? 0,
            });
          }
        }
      }

      const chunkJson = {
        version: 2,
        chunk: [cx, cz],
        tileSize: TILE_S,
        water: false,
        /* Procgen islands are open-ocean terrain; hard edge walls create
           invisible "boundary" collisions while sailing between chunks. */
        edges: { north: false, south: false, east: false, west: false },
        baseType: 'water',
        procgen: { seed: meta.seed, biome: meta.biome, tier: meta.tier, shape: meta.shape },
        objects: chunkProps,
        heightOffsets,
        colorOverrides,
      };
      if (waterAlpha) chunkJson.waterAlpha = waterAlpha;
      out.push({ cx, cz, json: chunkJson });
    }
  }
  return _captureITCend(out);
}

// ─── World catalog: where islands live in a 16×16 sea grid ───────────────
export const WORLD_GRID = 14;        // 14×14 slots
export const SLOT_SIZE = 1400;       // world units per slot
// Population density now falls off with distance from spawn — cluster of
// starter islands close to the main world, fewer expedition islands out far.
export const WORLD_POP_NEAR = 0.70;  // pop rate just past spawn buffer
export const WORLD_POP_FAR  = 0.18;  // pop rate at world edge
export const WORLD_RADIUS = 6.3;     // circular world radius in slots (reined in ~12%)
export const SPAWN_BUFFER = 1.2;     // no procgen islands within this radius of spawn

// Deterministic island catalog from a world seed.
// Uses Poisson-disk sampling for organic scatter instead of a visible
// grid. Minimum inter-island distance grows with distance from spawn, so
// starter islands cluster tightly and far-out islands feel isolated.
export function generateWorldCatalog(worldSeed) {
  const worldExtent = WORLD_RADIUS * SLOT_SIZE; // e.g. 10080u for 7.2 × 1400
  const spawnRadius = SPAWN_BUFFER * SLOT_SIZE;

  // Variable min-distance: tight near spawn (dense cluster), loose far out (sparse).
  // Reined in ~15% from the original tuning per playtest feedback.
  const distNear = SLOT_SIZE * 0.85;   // tighter cluster near spawn
  const distFar  = SLOT_SIZE * 1.50;   // farther-apart expedition islands
  function localMinDist(fromSpawn) {
    const t = Math.max(0, Math.min(1, (fromSpawn - spawnRadius) / (worldExtent - spawnRadius)));
    // smoothstep for a gentler near→far transition
    const s = t * t * (3 - 2 * t);
    return distNear * (1 - s) + distFar * s;
  }

  const rand = mulberry32(worldSeed ^ 0xC0FFEE);
  const K = 30;
  // Grid acceleration: cellSize based on smallest min-distance
  const cellSize = distNear / Math.SQRT2;
  const gridW = Math.ceil((worldExtent * 2) / cellSize) + 2;
  const grid = new Int32Array(gridW * gridW).fill(-1);
  const pts = []; // { x, z, fromSpawn }
  const active = [];

  function addPoint(x, z) {
    const id = pts.length;
    pts.push({ x, z, fromSpawn: Math.hypot(x, z) });
    active.push(id);
    const gi = ((x + worldExtent) / cellSize) | 0;
    const gj = ((z + worldExtent) / cellSize) | 0;
    grid[gj * gridW + gi] = id;
    return id;
  }

  // Seed ring: 8 points around the spawn buffer (gives guaranteed starter cluster)
  const seedCount = 8;
  for (let i = 0; i < seedCount; i++) {
    const a = (i / seedCount) * Math.PI * 2 + rand() * 0.4;
    const r = spawnRadius * (1.05 + rand() * 0.25);
    addPoint(Math.cos(a) * r, Math.sin(a) * r);
  }

  while (active.length) {
    const ai = (rand() * active.length) | 0;
    const p = pts[active[ai]];
    const md = localMinDist(p.fromSpawn);
    let placed = false;
    for (let k = 0; k < K; k++) {
      const a = rand() * Math.PI * 2;
      const r = md * (1 + rand()); // between md and 2md
      const nx = p.x + Math.cos(a) * r;
      const nz = p.z + Math.sin(a) * r;
      const fs = Math.hypot(nx, nz);
      if (fs > worldExtent) continue;
      if (fs < spawnRadius) continue;
      const nmd = localMinDist(fs);
      const gi = ((nx + worldExtent) / cellSize) | 0;
      const gj = ((nz + worldExtent) / cellSize) | 0;
      if (gi < 0 || gj < 0 || gi >= gridW || gj >= gridW) continue;
      // Check neighborhood against existing points
      const searchR = Math.ceil((Math.max(md, nmd) * 2) / cellSize);
      let ok = true;
      for (let dj = -searchR; dj <= searchR && ok; dj++) {
        const sj = gj + dj;
        if (sj < 0 || sj >= gridW) continue;
        for (let di = -searchR; di <= searchR && ok; di++) {
          const si = gi + di;
          if (si < 0 || si >= gridW) continue;
          const oid = grid[sj * gridW + si];
          if (oid === -1) continue;
          const o = pts[oid];
          const d = Math.hypot(o.x - nx, o.z - nz);
          const reqD = Math.max(localMinDist(o.fromSpawn), nmd) * 0.9;
          if (d < reqD) ok = false;
        }
      }
      if (ok) { addPoint(nx, nz); placed = true; break; }
    }
    if (!placed) { active[ai] = active[active.length - 1]; active.pop(); }
  }

  // Convert points to island records. Seeds derive from rounded coords
  // so replays produce identical results even though scatter is non-grid.
  const islands = [];
  for (const p of pts) {
    const ix = Math.round(p.x);
    const iz = Math.round(p.z);
    const islandSeed = hash32(worldSeed, ix, iz, 0xA110C);
    const r2 = mulberry32(islandSeed);
    const shapes = ['round', 'peninsula', 'crescent', 'jagged', 'bay'];
    const shape = shapes[(r2() * shapes.length) | 0];
    const sizeKey = r2() < 0.55 ? 'small' : r2() < 0.85 ? 'medium' : 'large';
    const sizeChunks = SIZE_TO_CHUNKS[sizeKey];
    const slotDist = p.fromSpawn / SLOT_SIZE;
    /* Balanced tier distribution across T2-T6. Pure distance-band tiering
       overloaded T6 (52% of islands at 5704+ because that band covers the
       entire outer half of the world). Noisy formula gives balanced counts
       (T2=15/T3=11/T4=13/T5=9/T6=17) at the cost of slight visual-ring drift. */
    const tierRaw = slotDist * 1.0 + (r2() - 0.5) * 0.8;
    const tier = Math.max(2, Math.min(6, Math.round(tierRaw)));
    const biome = pickBiome(islandSeed, tier);
    islands.push({
      slot: [Math.round(ix / SLOT_SIZE), Math.round(iz / SLOT_SIZE)],
      worldX: ix,
      worldZ: iz,
      seed: islandSeed,
      biome, shape, size: sizeKey, sizeChunks, tier,
    });
  }
  return islands;
}

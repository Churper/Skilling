export const TOOL_FOR_RESOURCE = {
  fishing: "fishing",
  mining: "pickaxe",
  woodcutting: "axe",
};

export const TOOL_LABEL = {
  axe: "Axe",
  pickaxe: "Pickaxe",
  fishing: "Fishing Pole",
  sword: "Sword",
  bow: "Bow",
  staff: "Staff",
};

export const SKILL_BY_RESOURCE = {
  fishing: "fishing",
  mining: "mining",
  woodcutting: "woodcutting",
};

export const INVENTORY_BY_RESOURCE = {
  fishing: "fish",
  mining: "ore",
  woodcutting: "logs",
};

export const XP_BY_RESOURCE = {
  fishing: 18,
  mining: 16,
  woodcutting: 16,
};

export const GATHER_DURATION_BY_RESOURCE = {
  fishing: 0.95,
  mining: 0.72,
  woodcutting: 0.72,
};

export const BAG_CAPACITY = 28;

export const TOOL_UPGRADE_BASE_COST = 28;
export const TOOL_UPGRADE_COST_STEP = 24;
export const TOOL_UPGRADE_MAX_LEVEL = 8;

export const HOUSE_BUILD_TARGET = {
  logs: 120,
  ore: 80,
};

export const PRAYERS = {
  // Offensive
  clarity: { label: "Clarity of Thought", type: "offensive", icon: "\u2694\uFE0F", desc: "+5% melee accuracy" },
  sharp_eye: { label: "Sharp Eye", type: "offensive", icon: "\uD83C\uDFF9", desc: "+5% ranged accuracy" },
  mystic_will: { label: "Mystic Will", type: "offensive", icon: "\uD83D\uDD2E", desc: "+5% magic accuracy" },
  burst_str: { label: "Burst of Strength", type: "offensive", icon: "\uD83D\uDCAA", desc: "+5% melee damage" },
  superhuman: { label: "Superhuman Strength", type: "offensive", icon: "\u26A1", desc: "+10% melee damage" },
  eagle_eye: { label: "Eagle Eye", type: "offensive", icon: "\uD83E\uDDE0", desc: "+10% ranged accuracy" },
  // Defensive (overhead)
  protect_melee: { label: "Protect from Melee", type: "overhead", icon: "\uD83D\uDEE1\uFE0F", desc: "Block melee attacks", exclusive: "overhead" },
  protect_range: { label: "Protect from Range", type: "overhead", icon: "\uD83C\uDFF9", desc: "Block ranged attacks", exclusive: "overhead" },
  protect_mage: { label: "Protect from Magic", type: "overhead", icon: "\uD83D\uDD25", desc: "Block magic attacks", exclusive: "overhead" },
};

export const ANIMAL_DAMAGE = {
  Pig: [2, 4], Cow: [3, 6], Sheep: [2, 5], Llama: [3, 6],
  Horse: [4, 8], Zebra: [5, 10], Pug: [1, 3],
};

export const POTION_SHOP = [
  { id: "health_potion", label: "Health Potion", icon: "\u2764\uFE0F", cost: 25, item: "Health Potion", heal: 40 },
  { id: "mana_potion", label: "Mana Potion", icon: "\uD83D\uDCA7", cost: 20, item: "Mana Potion", mana: 30 },
];

export const CAMPFIRE_LOG_COST = 3;

export const COOKING_RECIPES = {
  "fish":      { result: "Cooked Fish",  xp: 20, burnChance: 0.35 },
  "Raw Beef":  { result: "Cooked Beef",  xp: 25, burnChance: 0.30 },
  "Raw Pork":  { result: "Cooked Pork",  xp: 22, burnChance: 0.32 },
};

/* ── Equipment System ── */
export const EQUIPMENT_TIERS = {
  bronze:  { level: 1,  color: "#cd7f32", label: "Bronze",  tint: "rgba(180,140,80,0.12)" },
  iron:    { level: 5,  color: "#a8a8a8", label: "Iron",    tint: "rgba(100,200,100,0.13)" },
  steel:   { level: 10, color: "#b0c4de", label: "Steel",   tint: "rgba(70,130,255,0.15)" },
  mithril: { level: 20, color: "#4169e1", label: "Mithril", tint: "rgba(150,80,255,0.16)" },
  adamant: { level: 30, color: "#2e8b57", label: "Adamant", tint: "rgba(255,140,30,0.16)" },
  rune:    { level: 40, color: "#40e0d0", label: "Rune",    tint: "rgba(255,220,50,0.18)" },
};

const TIER_KEYS = ["bronze","iron","steel","mithril","adamant","rune"];
const _atkScale = [4, 8, 14, 20, 27, 34];
const _defScale = [5, 10, 18, 28, 40, 52];
const _accScale = [2, 4, 7, 10, 14, 18];

function _eqItem(slot, tierIdx, tierKey, atk, def) {
  const t = EQUIPMENT_TIERS[tierKey];
  return { slot, tier: tierKey, level: t.level, color: t.color, label: `${t.label} ${slot[0].toUpperCase()+slot.slice(1)}`, atk, def, icon: null };
}

export const EQUIPMENT_ITEMS = {};

// Weapons: sword, bow, staff — primarily atk
for (let i = 0; i < 6; i++) {
  const t = TIER_KEYS[i];
  EQUIPMENT_ITEMS[`${t}_sword`]  = _eqItem("sword",  i, t, _atkScale[i], 0);
  EQUIPMENT_ITEMS[`${t}_bow`]    = _eqItem("bow",    i, t, _atkScale[i], 0);
  EQUIPMENT_ITEMS[`${t}_staff`]  = _eqItem("staff",  i, t, _atkScale[i], 0);
  EQUIPMENT_ITEMS[`${t}_body`]   = _eqItem("body",   i, t, 0, _defScale[i]);
  EQUIPMENT_ITEMS[`${t}_shield`] = _eqItem("shield", i, t, 0, _defScale[i]);
}

// Accessories: cape, ring, amulet — 3 tiers each
const _capeTiers = [
  { id: "leather_cape",  slot: "cape", tier: "bronze",  level: 1,  label: "Leather Cape",  atk: 1, def: 2, color: "#cd7f32" },
  { id: "wool_cape",     slot: "cape", tier: "iron",    level: 5,  label: "Wool Cape",     atk: 2, def: 4, color: "#a8a8a8" },
  { id: "silk_cape",     slot: "cape", tier: "steel",   level: 10, label: "Silk Cape",     atk: 3, def: 6, color: "#b0c4de" },
];
const _ringTiers = [
  { id: "bronze_ring",   slot: "ring", tier: "bronze",  level: 1,  label: "Bronze Ring",   atk: 2, def: 1, color: "#cd7f32" },
  { id: "iron_ring",     slot: "ring", tier: "iron",    level: 5,  label: "Iron Ring",     atk: 3, def: 2, color: "#a8a8a8" },
  { id: "steel_ring",    slot: "ring", tier: "steel",   level: 10, label: "Steel Ring",    atk: 5, def: 3, color: "#b0c4de" },
];
const _amuletTiers = [
  { id: "bone_amulet",   slot: "amulet", tier: "bronze", level: 1,  label: "Bone Amulet",   atk: 1, def: 1, color: "#cd7f32" },
  { id: "hide_amulet",   slot: "amulet", tier: "iron",   level: 5,  label: "Hide Amulet",   atk: 2, def: 3, color: "#a8a8a8" },
  { id: "jewel_amulet",  slot: "amulet", tier: "steel",  level: 10, label: "Jewel Amulet",  atk: 4, def: 5, color: "#b0c4de" },
];

for (const acc of [..._capeTiers, ..._ringTiers, ..._amuletTiers]) {
  EQUIPMENT_ITEMS[acc.id] = { slot: acc.slot, tier: acc.tier, level: acc.level, label: acc.label, atk: acc.atk, def: acc.def, color: acc.color, icon: null };
}

// Icons for equipment
const _slotIcons = { sword: "\u2694\uFE0F", bow: "\uD83C\uDFF9", staff: "\uD83E\uDE84", body: "\uD83D\uDC55", shield: "\uD83D\uDEE1\uFE0F", cape: "\uD83E\uDDE3", ring: "\uD83D\uDC8D", amulet: "\uD83D\uDCFF" };
for (const [id, item] of Object.entries(EQUIPMENT_ITEMS)) {
  item.icon = _slotIcons[item.slot] || "?";
}

// Crafting recipes
const _orePerTier = [3, 8, 15, 25, 40, 55];
export const EQUIPMENT_RECIPES = {};
for (let i = 0; i < 6; i++) {
  const t = TIER_KEYS[i];
  EQUIPMENT_RECIPES[`${t}_sword`]  = { materials: { ore: _orePerTier[i] }, level: EQUIPMENT_TIERS[t].level };
  EQUIPMENT_RECIPES[`${t}_bow`]    = { materials: { logs: Math.ceil(_orePerTier[i]*0.7), ore: Math.ceil(_orePerTier[i]*0.3) }, level: EQUIPMENT_TIERS[t].level };
  EQUIPMENT_RECIPES[`${t}_staff`]  = { materials: { logs: Math.ceil(_orePerTier[i]*0.5), ore: Math.ceil(_orePerTier[i]*0.5) }, level: EQUIPMENT_TIERS[t].level };
  EQUIPMENT_RECIPES[`${t}_body`]   = { materials: { ore: Math.ceil(_orePerTier[i]*1.2) }, level: EQUIPMENT_TIERS[t].level };
  EQUIPMENT_RECIPES[`${t}_shield`] = { materials: { ore: _orePerTier[i] }, level: EQUIPMENT_TIERS[t].level };
}
EQUIPMENT_RECIPES["leather_cape"] = { materials: { "Horse Hide": 2 }, level: 1 };
EQUIPMENT_RECIPES["wool_cape"]    = { materials: { "Wool": 4, ore: 2 }, level: 5 };
EQUIPMENT_RECIPES["silk_cape"]    = { materials: { "Llama Wool": 5, ore: 4 }, level: 10 };
EQUIPMENT_RECIPES["bronze_ring"]  = { materials: { ore: 2 }, level: 1 };
EQUIPMENT_RECIPES["iron_ring"]    = { materials: { ore: 5 }, level: 5 };
EQUIPMENT_RECIPES["steel_ring"]   = { materials: { ore: 10 }, level: 10 };
EQUIPMENT_RECIPES["bone_amulet"]  = { materials: { "Bone": 3 }, level: 1 };
EQUIPMENT_RECIPES["hide_amulet"]  = { materials: { "Bone": 2, "Horse Hide": 2 }, level: 5 };
EQUIPMENT_RECIPES["jewel_amulet"] = { materials: { "Bone": 3, ore: 8 }, level: 10 };

// Star enhancement system (MapleStory-style)
export const STAR_MAX = 10;
export const STAR_COSTS =       [15, 30, 50, 80, 120, 200, 350, 600, 1000, 1800];
export const STAR_SUCCESS =     [95, 90, 85, 75,  65,  55,  45,  35,   25,   18]; // base %
export const STAR_DESTROY =     [0,  0,  0,  0,    3,   6,  10,  18,   25,   35]; // destroy %
export const STAR_DOWNGRADE =   [0,  0,  0,  0,   0,   0,   0,   40,   50,   60]; // % chance to lose 1 star on fail (not destroy)
export const STAR_ATK_PER =     [1,  1,  2,  2,   3,   3,   4,    5,    6,    8];  // bonus atk per star
export const STAR_DEF_PER =     [1,  1,  2,  2,   3,   3,   4,    5,    6,    8];  // bonus def per star
export const STAR_TIMING_BONUS = 15; // max % bonus from timing bar

// Monster equipment drops
export const MONSTER_EQUIPMENT_DROPS = {
  Cow:   { chance: 0.08, items: ["leather_cape", "bone_amulet"] },
  Horse: { chance: 0.07, items: ["leather_cape", "bronze_ring"] },
  Llama: { chance: 0.06, items: ["bone_amulet", "wool_cape"] },
  Pig:   { chance: 0.10, items: ["bone_amulet"] },
  Pug:   { chance: 0.12, items: ["bronze_ring"] },
  Sheep: { chance: 0.08, items: ["wool_cape", "bone_amulet"] },
  Zebra: { chance: 0.05, items: ["hide_amulet", "iron_ring", "iron_ring"] },
};

/* Equipment items sold in the general store (id → buy cost) */
export const SHOP_EQUIPMENT = [
  { id: "bronze_sword", cost: 30 },
  { id: "bronze_bow",   cost: 30 },
  { id: "bronze_staff", cost: 30 },
  { id: "bronze_body",  cost: 40 },
  { id: "bronze_shield",cost: 40 },
  { id: "bronze_ring",  cost: 20 },
  { id: "leather_cape", cost: 25 },
  { id: "bone_amulet",  cost: 25 },
  { id: "iron_sword",   cost: 80 },
  { id: "iron_bow",     cost: 80 },
  { id: "iron_body",    cost: 100 },
  { id: "iron_shield",  cost: 100 },
  { id: "iron_ring",    cost: 50 },
];

export const BAG_ITEM_KEYS = ["fish", "ore", "logs", "Raw Beef", "Raw Pork", "Wool", "Horse Hide", "Llama Wool", "Bone", "Striped Hide", "Health Potion", "Mana Potion", "Cooked Fish", "Cooked Beef", "Cooked Pork", "Burnt Food",
  "Bird Nest", "Uncut Gem", "Golden Fish",
  ...Object.keys(EQUIPMENT_ITEMS)];

export const SELL_PRICE_BY_ITEM = {
  fish: 4, ore: 7, logs: 5, "Raw Beef": 8, "Raw Pork": 6,
  "Wool": 5, "Horse Hide": 10, "Llama Wool": 7, "Bone": 3, "Striped Hide": 12,
  "Cooked Fish": 8, "Cooked Beef": 14, "Cooked Pork": 10, "Burnt Food": 1,
  "Bird Nest": 25, "Uncut Gem": 30, "Golden Fish": 35,
  ...Object.fromEntries(Object.entries(EQUIPMENT_ITEMS).map(([id, item]) => {
    const tierIdx = ["bronze","iron","steel","mithril","adamant","rune"].indexOf(item.tier);
    return [id, Math.max(3, 5 + tierIdx * 8 + (item.atk + item.def))];
  })),
};

/* ── Item rarity for non-equipment items ── */
export const ITEM_RARITY = {
  fish:           { rarity: "common",   tint: "rgba(180,180,180,0.08)", color: "#b0b0b0" },
  ore:            { rarity: "common",   tint: "rgba(180,180,180,0.08)", color: "#b0b0b0" },
  logs:           { rarity: "common",   tint: "rgba(180,180,180,0.08)", color: "#b0b0b0" },
  "Raw Beef":     { rarity: "uncommon", tint: "rgba(100,200,100,0.10)", color: "#6ec86e" },
  "Raw Pork":     { rarity: "uncommon", tint: "rgba(100,200,100,0.10)", color: "#6ec86e" },
  "Wool":         { rarity: "common",   tint: "rgba(180,180,180,0.08)", color: "#b0b0b0" },
  "Horse Hide":   { rarity: "uncommon", tint: "rgba(100,200,100,0.10)", color: "#6ec86e" },
  "Llama Wool":   { rarity: "uncommon", tint: "rgba(100,200,100,0.10)", color: "#6ec86e" },
  "Bone":         { rarity: "common",   tint: "rgba(180,180,180,0.08)", color: "#b0b0b0" },
  "Striped Hide": { rarity: "rare",     tint: "rgba(70,130,255,0.12)",  color: "#5ea0ff" },
  "Health Potion": { rarity: "uncommon", tint: "rgba(255,100,100,0.10)", color: "#ff6b6b" },
  "Mana Potion":  { rarity: "uncommon", tint: "rgba(100,150,255,0.10)", color: "#6b9fff" },
  "Cooked Fish":  { rarity: "uncommon", tint: "rgba(100,200,100,0.10)", color: "#6ec86e" },
  "Cooked Beef":  { rarity: "rare",     tint: "rgba(70,130,255,0.12)",  color: "#5ea0ff" },
  "Cooked Pork":  { rarity: "uncommon", tint: "rgba(100,200,100,0.10)", color: "#6ec86e" },
  "Burnt Food":   { rarity: "common",   tint: "rgba(100,100,100,0.06)", color: "#888" },
  "Bird Nest":    { rarity: "rare",     tint: "rgba(70,130,255,0.12)",  color: "#5ea0ff" },
  "Uncut Gem":    { rarity: "rare",     tint: "rgba(180,80,255,0.14)",  color: "#b050ff" },
  "Golden Fish":  { rarity: "rare",     tint: "rgba(255,200,50,0.14)",  color: "#ffcc33" },
};

/* ── Rare bonus drops from gathering (pop out onto ground) ── */
export const RARE_GATHER_DROPS = {
  woodcutting: { item: "Bird Nest",   chance: 0.04 },
  mining:      { item: "Uncut Gem",   chance: 0.035 },
  fishing:     { item: "Golden Fish", chance: 0.03 },
};

export const TASK_BOARD_TASKS = [
  { id: "logs_10",      label: "Collect 10 Logs",     require: { item: "logs", qty: 10 },    reward: { xp: { woodcutting: 200 }, coins: 50 } },
  { id: "ore_10",       label: "Collect 10 Ore",      require: { item: "ore", qty: 10 },     reward: { xp: { mining: 200 }, coins: 50 } },
  { id: "fish_10",      label: "Collect 10 Fish",     require: { item: "fish", qty: 10 },    reward: { xp: { fishing: 200 }, coins: 50 } },
  { id: "beef_5",       label: "Collect 5 Raw Beef",  require: { item: "Raw Beef", qty: 5 }, reward: { xp: { combat: 150 }, coins: 40 } },
  { id: "kill_cow_3",   label: "Kill 3 Cows",         require: { kill: "Cow", qty: 3 },      reward: { xp: { combat: 250 }, coins: 60 } },
  { id: "kill_pig_5",   label: "Kill 5 Pigs",         require: { kill: "Pig", qty: 5 },      reward: { xp: { combat: 200 }, coins: 45 } },
  { id: "kill_horse_2", label: "Kill 2 Horses",       require: { kill: "Horse", qty: 2 },    reward: { xp: { combat: 300 }, coins: 75 } },
  { id: "kill_zebra_3", label: "Kill 3 Zebras",       require: { kill: "Zebra", qty: 3 },    reward: { xp: { combat: 400 }, coins: 100 } },
  { id: "logs_25",      label: "Collect 25 Logs",     require: { item: "logs", qty: 25 },    reward: { xp: { woodcutting: 500 }, coins: 120 } },
  { id: "ore_25",       label: "Collect 25 Ore",      require: { item: "ore", qty: 25 },     reward: { xp: { mining: 500 }, coins: 120 } },
];

export const SLIME_COLOR_SHOP = [
  { id: "lime", label: "Lime", color: "#58df78", cost: 0 },
  { id: "mint", label: "Mint", color: "#79f0b2", cost: 40 },
  { id: "aqua", label: "Aqua", color: "#62e4d9", cost: 55 },
  { id: "sunset", label: "Sunset", color: "#f5b35f", cost: 60 },
  { id: "violet", label: "Violet", color: "#af89f6", cost: 75 },
  { id: "rose", label: "Rose", color: "#f57fb3", cost: 90 },
  /* multi-color pattern skins */
  { id: "fire", label: "Fire", color: "fire", cost: 120, pattern: true },
  { id: "ice", label: "Ice", color: "ice", cost: 120, pattern: true },
  { id: "galaxy", label: "Galaxy", color: "galaxy", cost: 150, pattern: true },
  { id: "toxic", label: "Toxic", color: "toxic", cost: 100, pattern: true },
  { id: "lava", label: "Lava", color: "lava", cost: 130, pattern: true },
  { id: "ocean", label: "Ocean", color: "ocean", cost: 110, pattern: true },
  { id: "rainbow", label: "Rainbow", color: "rainbow", cost: 200, pattern: true },
  { id: "gold", label: "Gold", color: "gold", cost: 250, pattern: true },
  { id: "stained", label: "Stained Glass", color: "stained", cost: 300, pattern: true },
];

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

export const BAG_ITEM_KEYS = ["fish", "ore", "logs", "Raw Beef", "Raw Pork", "Wool", "Horse Hide", "Llama Wool", "Bone", "Striped Hide"];

export const SELL_PRICE_BY_ITEM = {
  fish: 4,
  ore: 7,
  logs: 5,
  "Raw Beef": 8,
  "Raw Pork": 6,
  "Wool": 5,
  "Horse Hide": 10,
  "Llama Wool": 7,
  "Bone": 3,
  "Striped Hide": 12,
};

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

export const SLIME_COLOR_SHOP = [
  { id: "lime", label: "Lime", color: "#58df78", cost: 0 },
  { id: "mint", label: "Mint", color: "#79f0b2", cost: 40 },
  { id: "aqua", label: "Aqua", color: "#62e4d9", cost: 55 },
  { id: "sunset", label: "Sunset", color: "#f5b35f", cost: 60 },
  { id: "violet", label: "Violet", color: "#af89f6", cost: 75 },
  { id: "rose", label: "Rose", color: "#f57fb3", cost: 90 },
];

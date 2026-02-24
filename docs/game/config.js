export const TOOL_FOR_RESOURCE = {
  fishing: "fishing",
  mining: "pickaxe",
  woodcutting: "axe",
};

export const TOOL_LABEL = {
  axe: "Axe",
  pickaxe: "Pickaxe",
  fishing: "Fishing Pole",
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

export const BAG_ITEM_KEYS = ["fish", "ore", "logs"];

export const SELL_PRICE_BY_ITEM = {
  fish: 4,
  ore: 7,
  logs: 5,
};

export const TOOL_UPGRADE_BASE_COST = 28;
export const TOOL_UPGRADE_COST_STEP = 24;
export const TOOL_UPGRADE_MAX_LEVEL = 8;

export const HOUSE_BUILD_TARGET = {
  logs: 120,
  ore: 80,
};

export const SLIME_COLOR_SHOP = [
  { id: "lime", label: "Lime", color: "#58df78", cost: 0 },
  { id: "mint", label: "Mint", color: "#79f0b2", cost: 40 },
  { id: "aqua", label: "Aqua", color: "#62e4d9", cost: 55 },
  { id: "sunset", label: "Sunset", color: "#f5b35f", cost: 60 },
  { id: "violet", label: "Violet", color: "#af89f6", cost: 75 },
  { id: "rose", label: "Rose", color: "#f57fb3", cost: 90 },
];

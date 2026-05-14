/* Skill metadata — order, label, emoji icon, accent color.
   Single source of truth used by every page that lists skills. */
export const SKILLS = [
  { id: "fishing",     label: "Fishing",     icon: "\u{1F41F}", color: "#4aa9d8" },
  { id: "mining",      label: "Mining",      icon: "⛏️", color: "#9aa0a8" },
  { id: "woodcutting", label: "Woodcutting", icon: "\u{1F332}", color: "#5da350" },
  { id: "melee",       label: "Melee",       icon: "⚔️", color: "#c14b4b" },
  { id: "bow",         label: "Bow",         icon: "\u{1F3F9}", color: "#88c060" },
  { id: "mage",        label: "Mage",        icon: "\u{1F52E}", color: "#a060d8" },
  { id: "cooking",     label: "Cooking",     icon: "\u{1F373}", color: "#e69850" },
  { id: "hitpoints",   label: "Hitpoints",   icon: "❤️", color: "#ed5060" },
  { id: "survival",    label: "Survival",    icon: "\u{1F3D5}️", color: "#80a070" },
  { id: "farming",     label: "Farming",     icon: "\u{1F33E}", color: "#a8c860" },
  { id: "scribing",    label: "Scribing",    icon: "\u{1F4DC}", color: "#d0b070" },
  { id: "faith",       label: "Faith",       icon: "\u{1F64F}", color: "#f0d460" },
  { id: "explorer",    label: "Explorer",    icon: "\u{1F9ED}", color: "#5fb8c8" },
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));
export const SKILL_IDS = SKILLS.map(s => s.id);

export function skillIcon(id) { return SKILL_BY_ID[id]?.icon || "✨"; }
export function skillLabel(id) { return SKILL_BY_ID[id]?.label || id; }
export function skillColor(id) { return SKILL_BY_ID[id]?.color || "#888"; }

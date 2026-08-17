/* Mirror of the game's progression curve so the site can show level + %
   to next level without round-tripping to the server. Stays in sync with
   docs/game/systems/progression.js — the formula constant 34 is sacred. */

const _MAX_DISPLAY = 5000;
const _displayToXp = new Float64Array(_MAX_DISPLAY + 1);
const _combatDisplayToXp = new Float64Array(_MAX_DISPLAY + 1);
const _COMBAT_CURVE_SKILLS = new Set(["melee", "bow", "mage", "hitpoints"]);
{
  let raw = 1, combatRaw = 1;
  _displayToXp[1] = 0;
  _combatDisplayToXp[1] = 0;
  for (let lv = 2; lv <= _MAX_DISPLAY; lv++) {
    const mult = lv <= 100 ? 1 : Math.min(10, 1 + Math.pow((lv - 1 - 100) / 60, 1.8));
    raw += mult;
    const r = Math.round(raw);
    _displayToXp[lv] = 34 * (r - 1) * (r - 1);
    combatRaw += lv <= 1000 ? mult : 10 + Math.pow((lv - 1 - 1000) / 60, 1.8);
    const cr = Math.round(combatRaw);
    _combatDisplayToXp[lv] = 34 * (cr - 1) * (cr - 1);
  }
}

function xpToLevelFrom(table, xp) {
  let lo = 1, hi = _MAX_DISPLAY;
  const target = Math.max(0, Number(xp) || 0);
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (table[mid] <= target) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export function xpToLevel(xp) {
  return xpToLevelFrom(_displayToXp, xp);
}

export function xpForLevel(level) {
  const l = Math.max(1, Math.min(level | 0, _MAX_DISPLAY));
  return _displayToXp[l];
}

export function xpToLevelForSkill(skillKey, xp) {
  return xpToLevelFrom(_COMBAT_CURVE_SKILLS.has(String(skillKey || "")) ? _combatDisplayToXp : _displayToXp, xp);
}

export function xpForLevelForSkill(skillKey, level) {
  const l = Math.max(1, Math.min(level | 0, _MAX_DISPLAY));
  return (_COMBAT_CURVE_SKILLS.has(String(skillKey || "")) ? _combatDisplayToXp : _displayToXp)[l];
}

/** Returns 0..1 progress between current level and next. */
export function levelProgress(xp) {
  const lv = xpToLevel(xp);
  if (lv >= _MAX_DISPLAY) return 1;
  const cur = _displayToXp[lv];
  const next = _displayToXp[lv + 1];
  if (next <= cur) return 1;
  return Math.min(1, Math.max(0, (xp - cur) / (next - cur)));
}

export function levelProgressForSkill(skillKey, xp) {
  const lv = xpToLevelForSkill(skillKey, xp);
  if (lv >= _MAX_DISPLAY) return 1;
  const cur = xpForLevelForSkill(skillKey, lv);
  const next = xpForLevelForSkill(skillKey, lv + 1);
  if (next <= cur) return 1;
  return Math.min(1, Math.max(0, (xp - cur) / (next - cur)));
}

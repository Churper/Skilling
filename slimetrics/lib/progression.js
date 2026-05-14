/* Mirror of the game's progression curve so the site can show level + %
   to next level without round-tripping to the server. Stays in sync with
   docs/game/systems/progression.js — the formula constant 34 is sacred. */

const _MAX_DISPLAY = 5000;
const _displayToXp = new Float64Array(_MAX_DISPLAY + 1);
{
  let raw = 1;
  _displayToXp[1] = 0;
  for (let lv = 2; lv <= _MAX_DISPLAY; lv++) {
    const mult = lv <= 100 ? 1 : Math.min(10, 1 + Math.pow((lv - 1 - 100) / 60, 1.8));
    raw += mult;
    const r = Math.round(raw);
    _displayToXp[lv] = 34 * (r - 1) * (r - 1);
  }
}

export function xpToLevel(xp) {
  let lo = 1, hi = _MAX_DISPLAY;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (_displayToXp[mid] <= xp) lo = mid; else hi = mid - 1;
  }
  return lo;
}

export function xpForLevel(level) {
  const l = Math.max(1, Math.min(level | 0, _MAX_DISPLAY));
  return _displayToXp[l];
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

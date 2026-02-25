import * as THREE from "three";

export function xpToLevel(xp) {
  return Math.floor(Math.sqrt(xp / 34)) + 1;
}

export function xpForLevel(level) {
  const l = Math.max(1, level);
  return 34 * (l - 1) * (l - 1);
}

export function getGatherFailChance(skillLevel) {
  const lvl = Math.max(1, skillLevel || 1);
  const chance = 0.44 - (lvl - 1) * 0.015;
  return THREE.MathUtils.clamp(chance, 0.04, 0.44);
}

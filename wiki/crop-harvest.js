(function initCropCalculators(calculate) {
  const format = value => Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  for (const root of document.querySelectorAll('[data-crop-harvest]')) {
    const crop = JSON.parse(root.dataset.crop);
    const form = root.querySelector('form');
    const update = () => {
      const result = calculate(crop, form.elements.level.value, {
        yieldMult: form.elements.compost.selectedOptions[0].dataset.yield,
        extraCropPct: form.elements.extra.value,
      });
      const locked = root.querySelector('[data-crop-locked]');
      locked.hidden = result.unlocked;
      locked.textContent = result.unlocked ? '' : `Requires Farming level ${format(crop.level)}.`;
      root.querySelector('[data-crop-summary]').hidden = !result.unlocked;
      root.querySelector('.crop-outcomes').hidden = !result.unlocked;
      if (!result.unlocked) return;
      root.querySelector('[data-crop-range]').textContent = result.min === result.max ? format(result.min) : `${format(result.min)}–${format(result.max)}`;
      root.querySelector('[data-crop-average]').textContent = format(result.expected);
      const rows = result.distribution.map(({ quantity, probability }) => {
        const row = document.createElement('tr');
        for (const value of [format(quantity), `${format(probability * 100)}%`]) {
          const cell = document.createElement('td');
          cell.textContent = value;
          row.append(cell);
        }
        return row;
      });
      root.querySelector('[data-crop-outcomes]').replaceChildren(...rows);
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', event => event.preventDefault());
    update();
  }
})(function calculateCropHarvest(crop, level, { yieldMult = 1, extraCropPct = 0 } = {}) {
  const required = crop.level, farmingLevel = Math.max(1, Math.floor(Number(level) || 1));
  if (farmingLevel < required) return { unlocked: false, min: 0, max: 0, expected: 0, distribution: [] };
  const over = Math.max(0, farmingLevel - required), range = crop.yield[1] - crop.yield[0];
  const bias = Math.min(1, over / crop.harvestRules.biasLevels), bonus = Math.floor(over / crop.harvestRules.bonusLevels);
  const multiplier = Math.max(0, Number(yieldMult) || 1), extra = Math.max(0, Number(extraCropPct) || 0) / 100;
  const distribution = new Map();
  for (let rolled = 0; rolled <= range; rolled++) {
    const probability = range === 0 ? 1 : Math.max(0, Math.min(1, (rolled + 0.5) / range) - Math.max(bias, 0, (rolled - 0.5) / range)) + (rolled === Math.round(range * bias) ? bias : 0);
    if (!probability) continue;
    const quantity = Math.floor((crop.yield[0] + rolled + bonus) * multiplier + 1e-10);
    const added = quantity * extra, whole = Math.floor(added + 1e-10), fraction = Math.max(0, added - whole);
    const low = quantity + whole;
    distribution.set(low, (distribution.get(low) || 0) + probability * (1 - fraction));
    if (fraction > 1e-10) distribution.set(low + 1, (distribution.get(low + 1) || 0) + probability * fraction);
  }
  const rows = [...distribution].filter(([, p]) => p > 1e-12).sort((a, b) => a[0] - b[0]);
  return { unlocked: true, level: farmingLevel, over, bias, bonus, min: rows[0][0], max: rows.at(-1)[0], expected: rows.reduce((sum, [quantity, probability]) => sum + quantity * probability, 0), distribution: rows.map(([quantity, probability]) => ({ quantity, probability })) };
});

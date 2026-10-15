(function initMoneyCalculator(calculate,plantingCosts){
 const form=document.querySelector('[data-money-farming]');if(!form)return;
 const fmt=v=>Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
 const tiers=JSON.parse(form.dataset.compost);
 const update=()=>{
  const level=Math.max(1,Math.floor(Number(form.elements.level.value)||1)),tier=tiers[Number(form.elements.compost.value)]||tiers[0],extraCropPct=Math.max(0,Number(form.elements.extra.value)||0);
  for(const label of document.querySelectorAll('[data-money-crop]')){
   const crop=JSON.parse(label.dataset.moneyCrop),row=label.closest('tr'),result=calculate(crop,level,{yieldMult:tier.yieldMult,extraCropPct}),cost=plantingCosts(crop,tier);
   row.hidden=!result.unlocked&&!form.elements.locked.checked;
   const values=result.unlocked?{time:Math.round(crop.growMs*tier.growMult)/60000,yield:result.expected,gross:result.expected*crop.salePrice,seeds:cost.seedCost,compost:cost.requiredCharges,margin:result.expected*crop.salePrice-cost.seedCost}:{};
   for(const node of row.querySelectorAll('[data-money-field]')){const value=values[node.dataset.moneyField];node.textContent=value===undefined?'Locked':fmt(value);node.closest('td').dataset.sortValue=value===undefined?'-1':String(value);}
  }
 };
 form.addEventListener('input',update);form.addEventListener('change',update);form.addEventListener('submit',e=>e.preventDefault());update();
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
},function(crop,tier){const compostMult = crop.compostMult != null
    ? crop.compostMult
    : (1 + Math.floor(crop.level / 100));
  let requiredCharges = tier.charges * compostMult;
  let seedCost = tier.freeSeed ? 0 : crop.seedCost;
  if (crop.fixedCompost != null) { requiredCharges = crop.fixedCompost; seedCost = 0; }
  return {seedCost,requiredCharges};});

(function initSalvageBundles(calculate){
 const format=value=>Number(value).toLocaleString(undefined,{maximumFractionDigits:3});
 for(const root of document.querySelectorAll('[data-salvage-bundle]')){
  const data=JSON.parse(root.dataset.salvageBundle),form=root.querySelector('form');
  const update=()=>{
   const level=Math.max(1,Math.floor(Number(form.elements.level.value)||1));
   const rewards=new Map(calculate(data.resources,level,data.rules).map(row=>[row.item,row]));
   const rows=new Map();
   let available=0;
   for(const label of root.querySelectorAll('[data-bundle-resource]')){
    const reward=rewards.get(label.dataset.bundleResource),row=label.closest('tr'),chance=row.querySelector('[data-bundle-chance]'),cell=chance.closest('td');
    row.hidden=!reward.available&&!form.elements.locked.checked;
    if(reward.available)available++;
    chance.textContent=reward.available?`${format(reward.chance*100)}%`:'Locked';
    cell.dataset.sortValue=String(reward.available?reward.chance:-1);
    cell.className=reward.available?`chance-cell chance-${reward.chance>=1?'always':reward.chance>=.1?'common':reward.chance>=.01?'uncommon':reward.chance>=.001?'rare':'very-rare'}`:'chance-cell';
    row.toggleAttribute('data-bundle-locked',!reward.available);
    rows.set(reward.item,row);
   }
   const ordered=[...rewards.values()].sort((a,b)=>Number(b.available)-Number(a.available)||b.chance-a.chance||(a.available?b.level-a.level:a.level-b.level));
   root.querySelector('tbody').append(...ordered.map(reward=>rows.get(reward.item)));
   root.querySelectorAll('thead th').forEach((th,index)=>th.setAttribute('aria-sort',index===1?'descending':'none'));
   root.querySelector('[data-bundle-summary]').textContent=`${available} possible ${available===1?'resource':'resources'} at ${data.skillName} level ${format(level)}. Chances total ${format([...rewards.values()].reduce((sum,r)=>sum+r.chance,0)*100)}%.`;
  };
  form.addEventListener('input',update);form.addEventListener('change',update);form.addEventListener('submit',event=>event.preventDefault());update();
 }
})(function calculateBundleRewards(resources,level,rules){
 const currentLevel=Math.max(1,Math.floor(Number(level)||1));
 // The export is already ordered by SQL level,item. Keep its item tie order
 // when reversing level groups for the server's ORDER BY level DESC,item.
 const unlocked=resources.map((resource,index)=>({...resource,index})).filter(r=>r.level<=currentLevel);
 const recent=new Set([...unlocked].sort((a,b)=>b.level-a.level||a.index-b.index).slice(0,rules.recentCount).map(r=>r.item));
 return resources.map(resource=>{
  const available=resource.level<=currentLevel;
  const chance=available?(1-rules.recentChance)/unlocked.length+(recent.has(resource.item)?rules.recentChance/recent.size:0):0;
  return{...resource,available,chance,quantityMin:resource.level>=rules.highGate?rules.highMin:rules.ordinaryMin,quantityMax:resource.level>=rules.highGate?rules.highMax:rules.ordinaryMax};
 });
});

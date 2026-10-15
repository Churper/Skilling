(function initSlimePowerCalculators(calculate){
 const fmt=value=>Number(value).toLocaleString(undefined,{maximumFractionDigits:2});
 for(const root of document.querySelectorAll('[data-slimepower-costs]')){
  const data=JSON.parse(root.dataset.slimepowerCosts),form=root.querySelector('form'),body=root.querySelector('tbody');
  const update=()=>{
   const result=calculate(data,form.elements.equipment.value,form.elements.current.value,form.elements.target.value,{useScrolls:form.elements.scrolls.checked,failures:form.elements.failures.value});
   form.elements.current.value=String(result.current);form.elements.target.value=String(result.target);form.elements.target.min=String(result.current);
   form.elements.failures.disabled=!result.guarantee;form.elements.failures.max=String(Math.max(0,result.guarantee-1));
   if(!result.guarantee)form.elements.failures.value='0';else form.elements.failures.value=String(Math.min(Number(form.elements.failures.value)||0,result.guarantee-1));
   const values={minimum:fmt(result.minimumCoins),average:fmt(result.averageCoins),maximum:result.maximumCoins===null?'No fixed maximum below SP15':fmt(result.maximumCoins),scrolls:fmt(result.scrolls),ancient:fmt(result.ancientCoins),power:`SP${result.target}: +${fmt(result.targetAtk)} ATK, +${fmt(result.targetDef)} DEF`};
   for(const node of root.querySelectorAll('[data-sp-result]'))node.textContent=values[node.dataset.spResult];
   body.replaceChildren(...result.rows.map(row=>{
    const tr=document.createElement('tr'),strings=[`SP${row.step} → SP${row.step+1}`,row.method==='scroll'?'SlimePower Scroll':'Coin enhance',row.method==='scroll'?`${row.scrolls} Scroll`:`${fmt(row.coins)} coins`,`${fmt(row.chance*100)}%`,row.remaining===null?'No fixed limit':fmt(row.remaining),fmt(row.averageCoins)];
    strings.forEach((text,index)=>{const td=document.createElement(index===0?'th':'td');if(index===0)td.scope='row';if(index===1&&row.method==='scroll'){const a=document.createElement('a');a.href=root.dataset.scrollRoute;a.textContent=text;td.append(a);}else td.textContent=text;if(index===3)td.className=`chance-cell chance-${row.chance>=1?'always':row.chance>=.1?'common':row.chance>=.01?'uncommon':'rare'}`;tr.append(td);});return tr;
   }));
   root.querySelector('[data-sp-empty]').hidden=result.rows.length>0;
  };
  form.addEventListener('input',update);form.addEventListener('change',update);form.addEventListener('submit',e=>e.preventDefault());update();
 }
})(function calculateSlimePowerCosts(data,itemKey,current,target,{useScrolls=false,failures=0}={}){
 const cap=data.ladder.length,item=data.items.find(i=>i.key===itemKey);
 if(!item)throw Error('Unknown SlimePower equipment');
 current=Math.max(0,Math.min(cap,Math.floor(Number(current)||0)));
 target=Math.max(current,Math.min(cap,Math.floor(Number(target)||0)));
 const price=step=>Math.ceil(data.ladder[step].coin_cost*(step<data.safeLevel?(item.baseMultiplier??1):Math.max(item.advancedMultiplier??1,item.slot==='cape'?data.capeFloors[step-data.safeLevel]:data.advancedFloor)));
 function averageToNext(step){
  // Solve E = cost + Q E for all states below the next success level.
  const size=step+1,matrix=Array.from({length:size},()=>Array(size+1).fill(0));
  for(let i=0;i<size;i++){
   const rung=data.ladder[i],p=rung.success_pct/100,safe=i<item.safeBelow,d=safe?0:rung.destroy_pct/100,down=safe?0:rung.downgrade_pct/100;
   matrix[i][i]=1;matrix[i][size]=price(i);
   const add=(dest,chance)=>{if(dest<size)matrix[i][dest]-=chance;};
   add(i+1,p);add(Math.max(i-rung.destroy_drop,rung.destroy_floor),(1-p)*d);
   add(Math.max(i-rung.downgrade_drop,0),(1-p)*(1-d)*down);add(i,(1-p)*(1-d)*(1-down));
  }
  for(let column=0;column<size;column++){
   let pivot=column;for(let row=column+1;row<size;row++)if(Math.abs(matrix[row][column])>Math.abs(matrix[pivot][column]))pivot=row;
   [matrix[column],matrix[pivot]]=[matrix[pivot],matrix[column]];
   const divisor=matrix[column][column];if(Math.abs(divisor)<1e-14)throw Error('SlimePower expected-cost system is singular');
   for(let j=column;j<=size;j++)matrix[column][j]/=divisor;
   for(let row=0;row<size;row++)if(row!==column){const mult=matrix[row][column];for(let j=column;j<=size;j++)matrix[row][j]-=mult*matrix[column][j];}
  }
  return matrix[step][size];
 }
 const rows=[];let minimumCoins=0,averageCoins=0,maximumCoins=0,scrolls=0;
 for(let step=current;step<target;step++){
  const rung=data.ladder[step];
  if(useScrolls&&step<data.scroll.cap){scrolls+=data.scroll.perUpgrade;rows.push({step,method:'scroll',coins:0,scrolls:data.scroll.perUpgrade,chance:1,remaining:1,averageCoins:0});continue;}
  const coins=price(step),progress=step===current?Math.max(0,Math.min(rung.guarantee_rolls-1,Math.floor(Number(failures)||0))):0,remaining=rung.guarantee_rolls?Math.max(1,rung.guarantee_rolls-progress):null,p=rung.success_pct/100;
  const average=rung.guarantee_rolls?coins*(p>0?(1-Math.pow(1-p,remaining))/p:remaining):averageToNext(step);
  rows.push({step,method:'coins',coins,scrolls:0,chance:remaining===1?1:p,remaining,averageCoins:average});
  minimumCoins+=coins;averageCoins+=average;
  if(remaining===null)maximumCoins=null;else if(maximumCoins!==null)maximumCoins+=coins*remaining;
 }
 const bonus=data.bonuses[item.tier][target];
 return{current,target,cap,rows,minimumCoins,averageCoins,maximumCoins,scrolls,ancientCoins:scrolls/data.scroll.outputQty*data.scroll.price,targetAtk:bonus.atk,targetDef:bonus.def,guarantee:data.ladder[current]?.guarantee_rolls||0};
});

(function initLodgeCalculators(){
 const whole=v=>Math.floor(v).toLocaleString('en-US'),dec=v=>Number(v).toLocaleString('en-US',{maximumFractionDigits:1});
 const time=h=>h<1?`${Math.max(1,Math.round(h*60))} min`:h<24?`${dec(h)} hours`:`${dec(h/24)} days`;
 for(const root of document.querySelectorAll('[data-lodge-calc]')){
  const data=JSON.parse(root.dataset.lodgeCalc),form=root.querySelector('form'),set=(k,v)=>{root.querySelector(`[data-lodge-out="${k}"]`).textContent=v;};
  const fuels=new Map(data.fuels.map(f=>[f.key,f])),latches=new Map(data.latches.map(l=>[l.key,l]));
  const update=()=>{
   const f=fuels.get(form.elements.fuel.value),l=latches.get(form.elements.latch.value),qty=Math.max(0,Math.floor(Number(form.elements.qty.value)||0));
   const fur=Math.floor(qty*f.fur+1e-9),progress=qty*(l.level>=data.boostLevel?f.boosted:f.progress);
   const chance=progress>=l.pity?1:1-Math.exp(-progress*data.rate/l.pity);
   set('fur',whole(fur));
   set('furSell',`${whole(fur*data.furSell)} coins`);
   set('furAlch',data.furAlch==null?'Cannot alch':`${whole(fur*data.furAlch)} coins`);
   set('progress',`${whole(progress)} / ${whole(l.pity)}`);
   set('chance',`${dec(chance*100)}%`);
   set('time',qty?time(qty/data.perDay*24):'-');
   const parts=[];
   if(f.sell!=null)parts.push(`Selling the ${f.name} instead: ${whole(qty*f.sell)} coins.`);
   if(f.alch!=null)parts.push(`Alching them: ${whole(qty*f.alch)} coins.`);
   if(qty>data.capacity)parts.push(`A machine holds ${whole(data.capacity)} at a time.`);
   set('compare',parts.join(' '));
  };
  form.addEventListener('input',update);form.addEventListener('change',update);form.addEventListener('submit',e=>e.preventDefault());update();
 }
})();

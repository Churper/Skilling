(function(){
  const body=document.getElementById("sub-body");if(!body)return;
  const send=document.getElementById("sub-send"),count=document.getElementById("sub-count"),
        status=document.getElementById("sub-status"),section=document.getElementById("sub-section");
  const embedded=window.self!==window.top;
  const MSG={
    sending:"Sending...",
    sent:"Sent! Your suggestion is on the review list.",
    sentMore:"You can send {n} more today.",
    openInGame:"Open this guide from inside the game (press Z) to send suggestions.",
    noReply:"No response from the game. Try again in a moment.",
    failed:"Could not send right now. Try again later.",
    not_authenticated:"You need to be logged in to the game to send suggestions.",
    too_fast:"Please wait a minute between suggestions.",
    rate_limited:"Daily limit reached (5 per day). Try again tomorrow.",
    too_short:"Please write at least a full sentence.",
    too_long:"Please keep it under 1000 characters.",
    bad_section:"Please pick a guide section from the list.",
    offline:"No connection. Try again in a moment."
  };
  let pending=null,timer=0;
  function setStatus(msg,cls){status.textContent=msg;status.className="sub-status"+(cls?" "+cls:"")}
  body.addEventListener("input",()=>{count.textContent=body.value.length+" / 1000"});
  window.addEventListener("message",e=>{
    if(e.origin!==location.origin)return;
    const d=e.data;if(!d||d.type!=="sv-guide-suggestion-result"||d.id!==pending)return;
    pending=null;clearTimeout(timer);send.disabled=false;
    if(d.ok){
      body.value="";count.textContent="0 / 1000";
      let msg=MSG.sent;
      if(typeof d.remaining==="number"&&d.remaining>0)msg+=" "+MSG.sentMore.replace("{n}",d.remaining);
      setStatus(msg,"ok");
    }else setStatus(MSG[d.error]||MSG.failed,"err");
  });
  send.addEventListener("click",()=>{
    if(!embedded){setStatus(MSG.openInGame,"err");return}
    const text=body.value.trim();
    if(text.length<5){setStatus(MSG.too_short,"err");return}
    pending="s"+Math.random().toString(36).slice(2);
    send.disabled=true;setStatus(MSG.sending);
    window.parent.postMessage({type:"sv-guide-suggestion",id:pending,section:section.value,body:text},location.origin);
    timer=setTimeout(()=>{if(pending){pending=null;send.disabled=false;setStatus(MSG.noReply,"err")}},10000);
  });
})();
(function(){
  const canvas=document.getElementById("graph-canvas");
  if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const tooltip=document.getElementById("graph-tooltip");
  const MAX_LV=350;
  const PAD={t:20,r:16,b:32,l:56};
  let activeGraph="xp";
  let dpr=window.devicePixelRatio||1;

  // Data generators
  function _rawForLv(lv){if(lv<=100)return lv;let r=100;for(let l=100;l<lv;l++)r+=Math.min(10,1+Math.pow((l-100)/60,1.8));return Math.round(r)}
  const _xpCache={};function xpForLevel(lv){if(lv<=1)return 0;if(_xpCache[lv])return _xpCache[lv];const r=_rawForLv(lv);return _xpCache[lv]=Math.floor(34*(r-1)*(r-1))}
  document.querySelectorAll('#xp-tier-strip [data-xp-lv]').forEach(row=>{row.querySelector('.tier-name').textContent=xpForLevel(+row.dataset.xpLv).toLocaleString()+' XP';});
  function gatherRate(lv){var t=Math.min(lv/200,1);return Math.max(2,100-100*(0.02+0.48*Math.pow(1-t,1.5)))}
  /* Hitpoints display model - SINGLE SOURCE OF TRUTH for every HP number in
     this guide (the graph below + the HP-scaling tier strip, refilled from
     maxHp() at load). Mirror of docs/main.js: rawMaxHp = _rawPlayerMaxHp()
     (internal HP curve), HP_DISPLAY_SCALE = COMBAT_TUNING.numberScale. EVERY
     combat number on the HUD - your HP, hits dealt/taken, enemy HP - is shown
     at this 0.10 scale, so the guide MUST apply it or it prints 10x the real HP
     (the "1410 at Lv 141" bug). Lockstep-guarded by scripts/check_guide_hp_sync.mjs. */
  const HP_DISPLAY_SCALE=0.10;
  function rawMaxHp(lv){return lv<=140?lv*10:Math.floor(1400+(lv-140)*15+Math.pow(lv-140,2)*0.8);}
  function maxHp(lv){return Math.max(1,Math.floor(rawMaxHp(lv)*HP_DISPLAY_SCALE));}
  (function fillHpDoc(){
    var perLv=maxHp(2)-maxHp(1);
    var note=document.getElementById('hp-scaling-note');
    if(note) note.innerHTML='Levels 1&ndash;140: <strong>'+perLv+' HP per level</strong> (linear). After 140, HP ramps up quadratically - higher levels give significantly more HP per level.';
    document.querySelectorAll('#hp-tier-strip .tier-item[data-hp-lv]').forEach(function(el){
      var lv=+el.getAttribute('data-hp-lv');
      var nm=el.querySelector('.tier-name'); if(nm) nm.textContent=maxHp(lv).toLocaleString()+' HP';
      var mt=el.querySelector('.tier-meta[data-hp-auto]'); if(mt){var d=maxHp(lv)-maxHp(lv-1); mt.textContent=(lv<=140?'':'~')+d+'/lv';}
    });
  })();
  function burnChance(lv){return Math.max(1,Math.round(30*Math.pow(0.985,lv)))}

  const graphs={
    xp:{label:"XP Required",color:"#c9a84c",unit:"XP",fn:xpForLevel,fmt:v=>v>=1e6?(v/1e6).toFixed(1)+"M":v>=1e3?Math.floor(v/1e3)+"K":v},
    gather:{label:"Gather Success %",color:"#42c966",unit:"%",fn:gatherRate,fmt:v=>v.toFixed(1)+"%"},
    hp:{label:"Max Hitpoints",color:"#e85454",unit:"HP",fn:maxHp,fmt:v=>v.toLocaleString()+" HP"},
    burn:{label:"Base Burn Chance",color:"#e89040",unit:"%",fn:burnChance,fmt:v=>Math.max(0,v).toFixed(0)+"%"},
  };

  function resize(){
    const rect=canvas.getBoundingClientRect();
    canvas.width=rect.width*dpr;
    canvas.height=rect.height*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function draw(hoverLv){
    const g=graphs[activeGraph];
    const w=canvas.width/dpr, h=canvas.height/dpr;
    const gw=w-PAD.l-PAD.r, gh=h-PAD.t-PAD.b;
    ctx.clearRect(0,0,w,h);

    // Compute values
    const vals=[];
    let maxV=0;
    for(let lv=1;lv<=MAX_LV;lv++){const v=g.fn(lv);vals.push(v);if(v>maxV)maxV=v}
    if(maxV===0)maxV=1;

    // Grid lines
    ctx.strokeStyle="rgba(216,216,220,.08)";
    ctx.lineWidth=1;
    const gridN=5;
    for(let i=0;i<=gridN;i++){
      const y=PAD.t+gh*(1-i/gridN);
      ctx.beginPath();ctx.moveTo(PAD.l,y);ctx.lineTo(PAD.l+gw,y);ctx.stroke();
      ctx.fillStyle="rgba(216,216,220,.35)";
      ctx.font="10px 'Chakra Petch',sans-serif";
      ctx.textAlign="right";ctx.textBaseline="middle";
      const val=maxV*i/gridN;
      ctx.fillText(val>=1e6?(val/1e6).toFixed(1)+"M":val>=1e3?Math.floor(val/1e3)+"K":Math.floor(val),PAD.l-6,y);
    }

    // X axis labels
    ctx.fillStyle="rgba(216,216,220,.35)";
    ctx.textAlign="center";ctx.textBaseline="top";
    for(let lv=0;lv<=MAX_LV;lv+=50){
      const x=PAD.l+(lv/MAX_LV)*gw;
      ctx.fillText(lv===0?"1":"Lv "+lv,x,h-PAD.b+6);
    }

    // Draw curve
    ctx.beginPath();
    ctx.strokeStyle=g.color;ctx.lineWidth=2;
    for(let i=0;i<vals.length;i++){
      const x=PAD.l+(i/(MAX_LV-1))*gw;
      const y=PAD.t+gh*(1-vals[i]/maxV);
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();

    // Fill under curve
    const lastX=PAD.l+gw, lastY=PAD.t+gh*(1-vals[vals.length-1]/maxV);
    ctx.lineTo(lastX,PAD.t+gh);ctx.lineTo(PAD.l,PAD.t+gh);ctx.closePath();
    const grad=ctx.createLinearGradient(0,PAD.t,0,PAD.t+gh);
    grad.addColorStop(0,g.color+"40");grad.addColorStop(1,g.color+"05");
    ctx.fillStyle=grad;ctx.fill();

    // Hover crosshair
    if(hoverLv>=1&&hoverLv<=MAX_LV){
      const x=PAD.l+((hoverLv-1)/(MAX_LV-1))*gw;
      const v=g.fn(hoverLv);
      const y=PAD.t+gh*(1-v/maxV);
      ctx.strokeStyle="rgba(216,216,220,.2)";ctx.lineWidth=1;
      ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(x,PAD.t);ctx.lineTo(x,PAD.t+gh);ctx.stroke();
      ctx.setLineDash([]);
      // Dot
      ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);
      ctx.fillStyle=g.color;ctx.fill();
      ctx.strokeStyle="#111";ctx.lineWidth=2;ctx.stroke();
      tooltip.textContent="Level "+hoverLv+" - "+g.fmt(v);
    }else{
      tooltip.textContent="Hover over the graph to see values";
    }
  }

  // Events
  document.getElementById("graph-tabs").addEventListener("click",e=>{
    const btn=e.target.closest(".graph-tab");if(!btn)return;
    document.querySelectorAll(".graph-tab").forEach(t=>t.classList.remove("active"));
    btn.classList.add("active");
    activeGraph=btn.dataset.graph;
    draw(-1);
  });

  function getLvFromMouse(e){
    const rect=canvas.getBoundingClientRect();
    const mx=e.clientX-rect.left;
    const gw=rect.width-PAD.l-PAD.r;
    const ratio=(mx-PAD.l)/gw;
    return Math.max(1,Math.min(MAX_LV,Math.round(ratio*(MAX_LV-1))+1));
  }

  canvas.addEventListener("mousemove",e=>draw(getLvFromMouse(e)));
  canvas.addEventListener("touchmove",e=>{e.preventDefault();const t=e.touches[0];draw(getLvFromMouse(t))},{passive:false});
  canvas.addEventListener("mouseleave",()=>draw(-1));
  canvas.addEventListener("touchend",()=>draw(-1));

  function init(){resize();draw(-1)}
  window._resizeGraph=init;
  window.addEventListener("resize",init);
  // Draw immediately if visible, otherwise wait for tab switch
  if(canvas.offsetWidth>0)init();
})();
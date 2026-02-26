import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ── Toon material ── */
const TOON_GRAD = (() => {
  const c = document.createElement("canvas"); c.width=6; c.height=1;
  const ctx = c.getContext("2d");
  [26,68,118,176,232,255].forEach((v,i) => { ctx.fillStyle=`rgb(${v},${v},${v})`; ctx.fillRect(i,0,1,1); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace=THREE.NoColorSpace; t.minFilter=t.magFilter=THREE.NearestFilter; t.generateMipmaps=false; return t;
})();
function toonMat(color,opts={}) { return new THREE.MeshToonMaterial({color,gradientMap:TOON_GRAD,...opts}); }
function stabilizeModelLook(root) {
  if(!root) return;
  root.traverse(o => {
    if(!o?.isMesh||!o.material) return;
    (Array.isArray(o.material)?o.material:[o.material]).forEach(m => {
      if(!m) return;
      if("metalness" in m) m.metalness=0; if("roughness" in m) m.roughness=1;
      if("shininess" in m) m.shininess=0; if("envMapIntensity" in m) m.envMapIntensity=0;
      if("flatShading" in m) m.flatShading=true; m.needsUpdate=true;
    });
  });
}
function m3(geo,mat,x,y,z,ro) { const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); if(ro!=null) m.renderOrder=ro; return m; }

/* ── Layout ── */
const WATER_Y = 0.55;
const MT_START=46, MT_END=100, MAP_R=115;
const R_GND=0, R_SHORE=1, R_WATER=2, R_DECOR=3;
const SVC = Object.freeze({ plaza:{x:0,z:-32,r:14}, build:{x:18,z:-35,r:10}, train:{x:-22,z:-34,r:8} });
const KEEP_OUT = [SVC.plaza, SVC.build, SVC.train];
function inKO(x,z,pad=0) { for(const k of KEEP_OUT) if(Math.hypot(x-k.x,z-k.z)<=k.r+pad) return true; return false; }

/* ── Pool shape ── */
function poolR(a) { return 20 + Math.cos(a)*4 + Math.sin(a*2)*.8; }
function poolRAt(x,z) { return poolR(Math.atan2(z,x)); }

/* ── Terrain height ── */
function terrainH(x,z) {
  const r=Math.hypot(x,z);
  const n=Math.sin(x*.045)*.4+Math.cos(z*.037)*.38+Math.sin((x+z)*.021)*.3;
  const bowl=Math.pow(1-THREE.MathUtils.smoothstep(r,0,28),1.6)*.9;
  const amp=THREE.MathUtils.lerp(.2,.45,THREE.MathUtils.smoothstep(r,15,50));
  const flat=n*amp-bowl;
  if(r<=MT_START) return flat;
  const mt=THREE.MathUtils.smoothstep(r,MT_START,MT_END), a=Math.atan2(z,x);
  // Jagged rigid peaks — step/quantize the noise for low-poly cliff feel
  const raw=mt*mt*65+(Math.sin(a*11+x*.12)*.5+.5)*mt*10
    +(Math.cos(a*7-z*.1)*.5+.5)*mt*6+Math.sin(x*.15)*Math.cos(z*.12)*mt*4;
  const step=Math.round(raw/4)*4;
  return flat+THREE.MathUtils.lerp(raw,step,mt*.7);
}
function poolFloorH(x,z) {
  const r=Math.hypot(x,z), pr=poolRAt(x,z);
  if(r>pr) return -Infinity;
  const t=r/pr;
  return WATER_Y-(0.15+Math.pow(1-t,1.8)*1.6+THREE.MathUtils.smoothstep(t,.8,1)*.06);
}

export function getWorldSurfaceHeight(x,z) {
  const f=poolFloorH(x,z); return Number.isFinite(f)?f:terrainH(x,z);
}
export function getWaterSurfaceHeight(x,z,time=0) {
  const pr=poolRAt(x,z)+1, d=Math.hypot(x,z);
  if(d>pr) return -Infinity;
  return WATER_Y+(Math.sin(x*.14+z*.1+time*.7)*.02+Math.cos(x*.09+z*.22-time*.5)*.015);
}

/* ── Helpers ── */
function setRes(n,t,l) { n.userData.resourceType=t; n.userData.resourceLabel=l; }
function setSvc(n,t,l) { n.userData.serviceType=t; n.userData.resourceLabel=l; }
const HS_GEO=new THREE.CylinderGeometry(.9,.9,1.6,12);
const HS_MAT=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,depthTest:false});
function addHS(par,x,y,z) { const m=new THREE.Mesh(HS_GEO,HS_MAT); m.position.set(x,y,z); m.renderOrder=R_DECOR+10; par.add(m); return m; }

/* ── Sky ── */
function addSky(scene) {
  const mat=new THREE.ShaderMaterial({
    side:THREE.BackSide, fog:false,
    uniforms:{ cTop:{value:new THREE.Color("#1e78c8")}, cMid:{value:new THREE.Color("#5cbcf0")}, cBot:{value:new THREE.Color("#98d4ee")}, uTime:{value:0} },
    vertexShader:`varying vec3 vP; void main(){vP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`
      uniform vec3 cTop,cMid,cBot; uniform float uTime; varying vec3 vP;
      float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      float ns(vec2 p){vec2 i=floor(p),f=fract(p);float a=h21(i),b=h21(i+vec2(1,0)),c=h21(i+vec2(0,1)),d=h21(i+vec2(1,1));vec2 u=f*f*(3.0-2.0*f);return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;}
      float fbm(vec2 p){float v=0.0,a=0.55;for(int i=0;i<4;i++){v+=ns(p)*a;p*=2.05;a*=0.5;}return v;}
      void main(){
        float h=normalize(vP).y*.5+.5;
        vec3 c=mix(cBot,cMid,smoothstep(0.0,.62,h)); c=mix(c,cTop,smoothstep(.6,1.0,h));
        vec2 uv=normalize(vP).xz*3.2+vec2(uTime*.01,-uTime*.004);
        c=mix(c,vec3(1.0),smoothstep(.62,.9,fbm(uv+vec2(0,8)))*smoothstep(.46,.9,h)*.24);
        gl_FragColor=vec4(c,1.0);
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(420,32,18),mat));
  return mat;
}

/* ── Terrain — clean green, NO sandy shore ring ── */
function createTerrain(scene) {
  const inner=12, outer=MAP_R, aS=128, rR=55;
  const pos=[],col=[],idx=[];
  const cGrass=new THREE.Color("#4cc436");
  const cLush=new THREE.Color("#1e8a18"), cRock=new THREE.Color("#9a9a96"), cCliff=new THREE.Color("#8a8884");
  const tmp=new THREE.Color(), vpr=aS+1;

  for(let ri=0;ri<=rR;ri++){
    const r=inner+(outer-inner)*Math.pow(ri/rR,.45);
    for(let ai=0;ai<=aS;ai++){
      const a=(ai/aS)*Math.PI*2, x=Math.cos(a)*r, z=Math.sin(a)*r;
      const dist=Math.hypot(x,z), pr=poolRAt(x,z);
      let y=terrainH(x,z);
      if(dist<pr+4) { const t=THREE.MathUtils.smoothstep(dist,pr-2,pr+4); y=THREE.MathUtils.lerp(WATER_Y-.25,y,t); }
      pos.push(x,y,z);

      // Green grass, stone rim at pool edge like SA2 Chao Garden
      const stoneT=THREE.MathUtils.smoothstep(dist,pr-1,pr+1.5);
      tmp.lerpColors(new THREE.Color("#8a8a84"),cGrass,stoneT);
      const lushT=THREE.MathUtils.smoothstep(dist,30,42);
      const rockT=Math.max(THREE.MathUtils.smoothstep(dist,44,54)*.9,THREE.MathUtils.smoothstep(y,4,14)*.7);
      const cliffT=THREE.MathUtils.smoothstep(dist,56,73);

      if(lushT>0) tmp.lerp(cLush,lushT*.8);
      if(rockT>0) tmp.lerp(cRock,THREE.MathUtils.clamp(rockT,0,1));
      if(cliffT>0) tmp.lerp(cCliff,cliffT*.84);

      const ss=.8;
      const nx=-(terrainH(x+ss,z)-terrainH(x-ss,z)),ny=2,nz=-(terrainH(x,z+ss)-terrainH(x,z-ss));
      const len=Math.hypot(nx,ny,nz);
      const lit=THREE.MathUtils.clamp((nx*.54+ny*.78+nz*.31)/len*.5+.5,0,1);
      const banded=THREE.MathUtils.lerp(lit,Math.floor(lit*4.5)/4,.45);
      tmp.multiplyScalar(.92+banded*.22);
      col.push(tmp.r,tmp.g,tmp.b);
    }
  }
  for(let ri=0;ri<rR;ri++) for(let ai=0;ai<aS;ai++){
    const a=ri*vpr+ai,b=a+1,c=(ri+1)*vpr+ai,d=c+1; idx.push(a,b,c,b,d,c);
  }
  const geo=new THREE.BufferGeometry();
  geo.setIndex(idx); geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,toonMat("#fff",{vertexColors:true,fog:false}));
  mesh.renderOrder=R_GND; scene.add(mesh); return mesh;
}

/* ── Pool floor — stone bowl like SA2 Chao Garden ── */
function createPoolFloor(scene) {
  const S=48, R=16, pos=[],col=[],idx=[];
  const cDeep=new THREE.Color("#3a6a7a"), cShallow=new THREE.Color("#7a8a88");
  for(let r=0;r<=R;r++){
    const t=.05+.95*(r/R);
    for(let s=0;s<S;s++){
      const a=(s/S)*Math.PI*2, rad=(poolR(a)+6)*t;
      const x=Math.cos(a)*rad, z=Math.sin(a)*rad;
      const depth=Math.pow(1-t,1.7);
      pos.push(x,-(0.12+depth*1.5),z);
      const c=new THREE.Color().lerpColors(cDeep,cShallow,t);
      col.push(c.r,c.g,c.b);
    }
  }
  for(let r=0;r<R;r++){const a=r*S,b=(r+1)*S; for(let s=0;s<S;s++){const sn=(s+1)%S; idx.push(a+s,b+s,b+sn,a+s,b+sn,a+sn);}}
  const geo=new THREE.BufferGeometry();
  geo.setIndex(idx); geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  m.position.y=WATER_Y; m.renderOrder=R_SHORE; scene.add(m);
}

/* ── Water ── */
function createWater(scene) {
  const uni={uTime:{value:0}};
  createPoolFloor(scene);
  const S=64, R=20, wP=[],wRad=[],wI=[];
  for(let r=0;r<=R;r++){
    const t=.05+.95*(r/R);
    for(let s=0;s<S;s++){
      const a=(s/S)*Math.PI*2, rad=(poolR(a)+.8)*t;
      wP.push(Math.cos(a)*rad,0,Math.sin(a)*rad); wRad.push(t);
    }
  }
  for(let r=0;r<R;r++){const a=r*S,b=(r+1)*S; for(let s=0;s<S;s++){const sn=(s+1)%S; wI.push(a+s,b+s,b+sn,a+s,b+sn,a+sn);}}
  const geo=new THREE.BufferGeometry();
  geo.setIndex(wI); geo.setAttribute("position",new THREE.Float32BufferAttribute(wP,3));
  geo.setAttribute("aRad",new THREE.Float32BufferAttribute(wRad,1)); geo.computeVertexNormals();
  const mat=new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide, uniforms:uni,
    vertexShader:`
      attribute float aRad; varying float vR; varying vec2 vW; uniform float uTime;
      void main(){
        vR=aRad; vec3 p=position;
        p.y+=sin(p.x*.18+uTime*.6)*.015+cos(p.z*.15+uTime*.4)*.012;
        vW=p.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader:`
      varying float vR; varying vec2 vW; uniform float uTime;
      void main(){
        vec3 tint=vec3(.45,.82,.88);
        float shimmer=sin(vW.x*.6+vW.y*.4+uTime*1.2)*.02+cos(vW.x*.3-vW.y*.5+uTime*.7)*.015;
        vec3 c=tint+shimmer;
        float edgeFade=smoothstep(1.0,.85,vR);
        float a=edgeFade*.22;
        if(a<.005) discard;
        gl_FragColor=vec4(c,a);
      }`,
  });
  const water=new THREE.Mesh(geo,mat);
  water.position.y=WATER_Y+.01; water.renderOrder=R_WATER; scene.add(water);
  return {waterUniforms:uni, causticMap:null};
}

/* ── Shadow blobs ── */
const blobTex = (() => {
  const c=document.createElement("canvas"); c.width=c.height=256;
  const ctx=c.getContext("2d"); ctx.clearRect(0,0,256,256);
  const g=ctx.createRadialGradient(128,128,6,128,128,128);
  g.addColorStop(0,"rgba(255,255,255,0.82)"); g.addColorStop(.55,"rgba(255,255,255,0.32)"); g.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.minFilter=t.magFilter=THREE.LinearFilter; return t;
})();
function addBlob(scene,x,z,radius=1.8,opacity=.2) {
  const y=getWorldSurfaceHeight(x,z);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(radius*2,radius*2),
    new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false,color:"#344347",
      opacity,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
  m.rotation.x=-Math.PI/2;
  const p=Math.sin(x*12.99+z*78.23)*43758.55; m.rotation.z=(p-Math.floor(p))*Math.PI;
  m.position.set(x,y+.02,z); m.renderOrder=R_GND+1; scene.add(m); return m;
}

/* ── Models — load only what we need ── */
async function loadModels() {
  THREE.Cache.enabled=true;
  const loader=new GLTFLoader();
  const load=url=>new Promise((res,rej)=>loader.load(url,g=>res(g.scene),undefined,rej));
  const E={
    t1a:'models/Tree_1_A_Color1.gltf', t2a:'models/Tree_2_A_Color1.gltf',
    t2c:'models/Tree_2_C_Color1.gltf', t3a:'models/Tree_3_A_Color1.gltf',
    t4a:'models/Tree_4_A_Color1.gltf',
    b1a:'models/Bush_1_A_Color1.gltf', b2a:'models/Bush_2_A_Color1.gltf',
    r1j:'models/Rock_1_J_Color1.gltf', r1k:'models/Rock_1_K_Color1.gltf',
    r3a:'models/Rock_3_A_Color1.gltf', r3c:'models/Rock_3_C_Color1.gltf',
    r3e:'models/Rock_3_E_Color1.gltf', r3g:'models/Rock_3_G_Color1.gltf',
    sword:'models/sword_A.gltf', bow:'models/bow_A_withString.gltf', staff:'models/staff_A.gltf', arrow:'models/arrow_A.gltf',
  };
  const keys=Object.keys(E);
  const res=await Promise.all(keys.map(k=>load(E[k]).catch(()=>null)));
  res.forEach(m=>stabilizeModelLook(m));
  const M={}; keys.forEach((k,i)=>M[k]=res[i]);
  const f=arr=>arr.filter(Boolean);
  return {
    trees: f([M.t1a,M.t2a,M.t2c,M.t3a,M.t4a]),
    bushes: f([M.b1a,M.b2a]),
    cliffRocks: f([M.r1j,M.r1k,M.r3a,M.r3c,M.r3e,M.r3g]),
    weapons: {sword:M.sword,bow:M.bow,staff:M.staff,arrow:M.arrow},
  };
}

function placeM(scene,tmpl,x,z,s,r) {
  const m=tmpl.clone(); m.scale.setScalar(s); m.rotation.y=r;
  m.position.set(x,getWorldSurfaceHeight(x,z),z); scene.add(m); return m;
}

/* ── Trees — few, only around village, NONE near pool/spawn ── */
function placeTrees(scene,M,nodes) {
  const T=M.trees; if(!T.length) return;
  const spots = [
    // Behind village — forest backdrop
    [-14,-42,2.2,1.8], [0,-44,2.4,3.6], [12,-43,2.1,.9],
    [-26,-40,1.9,2.4], [22,-41,2.3,4.2],
    // Far sides, away from pool
    [32,-14,1.9,1], [-30,-12,2,5.2],
  ];
  spots.forEach(([x,z,s,r],i) => {
    if(inKO(x,z,3)) return;
    const m=placeM(scene,T[i%T.length],x,z,s,r);
    setRes(m,"woodcutting","Tree"); nodes.push(m); addBlob(scene,x,z,s,.15);
  });
}

/* ── Mining rocks — at mountain base, same models as cliff wall ── */
function placeRocks(scene,M,nodes) {
  const C=M.cliffRocks; if(!C.length) return;
  // Rocks at base of mountains so they look integrated
  [[44,12,1.6,.3],[42,-16,1.7,3.2],[-44,10,1.5,4.1],[-42,-14,1.6,1.4],[10,44,1.5,5],[-12,43,1.4,2.6]]
    .forEach(([x,z,s,r],i) => {
      const m=C[i%C.length].clone();
      m.scale.setScalar(s); m.rotation.y=r;
      m.position.set(x,terrainH(x,z),z); scene.add(m);
      setRes(m,"mining","Rock"); nodes.push(m);
    });
}

/* ── Mountain cliff accents — just a few large rocks on peaks ── */
function placeCliffs(scene,M) {
  const C=M.cliffRocks; if(!C.length) return;
  for(let i=0;i<8;i++){
    const a=(i/8)*Math.PI*2+Math.sin(i*3.7)*.2;
    const r=60+Math.sin(i*5.3)*5;
    const x=Math.cos(a)*r, z=Math.sin(a)*r;
    const s=5+(Math.sin(i*2.9)*.5+.5)*4;
    const m=C[i%C.length].clone();
    m.scale.setScalar(s); m.rotation.y=a+Math.PI+Math.sin(i*4.1)*.4;
    m.position.set(x,terrainH(x,z)-2,z); scene.add(m);
  }
}

/* ── Bushes — just a few near village ── */
function placeBushes(scene,M) {
  const B=M.bushes; if(!B.length) return;
  [[-12,-29,1.1,.4],[12,-29,1.12,2.8],[28,-10,1.1,1.9],[-28,-8,1.08,5],[20,-38,1,3.8]]
    .forEach(([x,z,s,r],i)=>{if(!inKO(x,z,1.5)) placeM(scene,B[i%B.length],x,z,s,r);});
}

/* ── Paths ── */
function pathGeo(curve,w,samples,yOff=.02) {
  const pos=[],uvs=[],idx=[],h=w/2;
  for(let i=0;i<=samples;i++){
    const t=i/samples,p=curve.getPointAt(t),tan=curve.getTangentAt(t);
    const sx=-tan.z,sz=tan.x,len=Math.hypot(sx,sz)||1;
    const nx=sx/len*h,nz=sz/len*h;
    const lx=p.x+nx,lz=p.z+nz,rx=p.x-nx,rz=p.z-nz;
    pos.push(lx,getWorldSurfaceHeight(lx,lz)+yOff,lz,rx,getWorldSurfaceHeight(rx,rz)+yOff,rz);
    uvs.push(t,0,t,1);
    if(i<samples){const j=i*2; idx.push(j,j+1,j+2,j+1,j+3,j+2);}
  }
  const g=new THREE.BufferGeometry(); g.setIndex(idx);
  g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2)); g.computeVertexNormals(); return g;
}
function addPath(scene,pts,opts={}) {
  if(!pts||pts.length<2) return;
  const w=opts.width??1.5,h=opts.height??.034,sm=opts.smooth??.22;
  const curve=new THREE.CatmullRomCurve3(pts.map(([x,z])=>new THREE.Vector3(x,0,z)),false,"catmullrom",sm);
  const n=Math.max(42,Math.floor(curve.getLength()*6));
  scene.add(new THREE.Mesh(pathGeo(curve,w*1.26,n,h+.006),toonMat(opts.edgeColor||"#d8c39a",{transparent:true,opacity:.66})));
  const core=new THREE.Mesh(pathGeo(curve,w,n,h+.014),toonMat(opts.color||"#b79669"));
  core.renderOrder=R_SHORE+1; scene.add(core);
}

/* ── Buildings ── */
function addBank(scene,x,z,nodes) {
  const y=getWorldSurfaceHeight(x,z), g=new THREE.Group(); g.position.set(x,y,z);
  setSvc(g,"bank","Bank Chest");
  g.add(m3(new THREE.CylinderGeometry(1.2,1.3,.3,8),toonMat("#7a9eb5"),0,.15,0,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(1.3,.7,.85),toonMat("#d4a63c"),0,.65,0,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(1.34,.08,.88),toonMat("#8b6a2f"),0,.45,0,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(1.34,.08,.88),toonMat("#8b6a2f"),0,.85,0,R_DECOR));
  const lid=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,1.32,8,1,false,0,Math.PI),toonMat("#e0b84a"));
  lid.rotation.z=Math.PI*.5; lid.position.y=1; lid.renderOrder=R_DECOR; g.add(lid);
  g.add(m3(new THREE.CylinderGeometry(.1,.1,.06,8),toonMat("#c4a24a"),0,.68,.46,R_DECOR));
  scene.add(g); addBlob(scene,x,z,1.8,.16);
  if(nodes) nodes.push(addHS(g,0,.95,.55));
}
function addStore(scene,x,z,nodes) {
  const y=getWorldSurfaceHeight(x,z), g=new THREE.Group(); g.position.set(x,y,z);
  setSvc(g,"store","General Store");
  g.add(m3(new THREE.BoxGeometry(2.6,.25,1.5),toonMat("#9a7044"),0,.12,0,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.4,1.4,.15),toonMat("#7e5a30"),0,.95,-.65,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.4,.08,1.2),toonMat("#a87a48"),0,.45,0,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.4,.08,1.2),toonMat("#a87a48"),0,1,0,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.8,.12,1.6),toonMat("#e8944a"),0,1.5,0,R_DECOR));
  const pL=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,1.25,6),toonMat("#9a7a4e"));
  pL.position.set(-1.1,.8,.55); pL.renderOrder=R_DECOR; g.add(pL);
  g.add(pL.clone().translateX(2.2));
  g.add(m3(new THREE.BoxGeometry(1,.35,.06),toonMat("#3f657d"),0,1.2,.72,R_DECOR));
  scene.add(g); addBlob(scene,x,z,1.9,.16);
  if(nodes) nodes.push(addHS(g,0,.9,.66));
}
function addSmith(scene,x,z,nodes) {
  const y=getWorldSurfaceHeight(x,z), g=new THREE.Group(); g.position.set(x,y,z);
  setSvc(g,"blacksmith","Blacksmith Forge");
  g.add(m3(new THREE.CylinderGeometry(1.4,1.5,.25,8),toonMat("#5a6068"),0,.12,0,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2,1.2,1.5),toonMat("#6e7880"),0,.85,0,R_DECOR));
  const roof=new THREE.Mesh(new THREE.ConeGeometry(1.5,.7,4),toonMat("#3e454e"));
  roof.position.y=1.82; roof.rotation.y=Math.PI*.25; roof.renderOrder=R_DECOR; g.add(roof);
  g.add(m3(new THREE.SphereGeometry(.18,8,7),toonMat("#ff8844"),0,.65,.82,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(.7,.3,.4),toonMat("#484e56"),-.8,.42,.8,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(.9,.4,.06),toonMat("#2a4050"),0,1.15,.82,R_DECOR));
  scene.add(g); addBlob(scene,x,z,2,.18);
  if(nodes) nodes.push(addHS(g,0,.95,.9));
}

function addYard(scene,x,z,nodes) {
  const y=getWorldSurfaceHeight(x,z), g=new THREE.Group(); g.position.set(x,y,z);
  setSvc(g,"construction","House Construction Yard");
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,1.45,6),toonMat("#8f6742"));
  sp.position.set(-3.8,.98,3.7); sp.renderOrder=R_DECOR; g.add(sp);
  g.add(m3(new THREE.BoxGeometry(1.85,.7,.1),toonMat("#2f536d"),-3.8,1.52,3.78,R_DECOR+1));
  const H=new THREE.Group(); H.position.set(.15,.06,-.2); g.add(H);
  const foundation=new THREE.Mesh(new THREE.BoxGeometry(4.6,.35,3.7),toonMat("#b7aea0")); foundation.position.y=.18; foundation.renderOrder=R_DECOR; H.add(foundation);
  const frame=new THREE.Group(); H.add(frame);
  const fMat=toonMat("#9c7048"), fGeo=new THREE.BoxGeometry(.2,1.5,.2);
  for(const[fx,fz] of [[-2,-1.5],[2,-1.5],[-2,1.5],[2,1.5]]){const p=new THREE.Mesh(fGeo,fMat); p.position.set(fx,1,fz); p.renderOrder=R_DECOR+1; frame.add(p);}
  const bGeo=new THREE.BoxGeometry(4.25,.2,.2);
  const bF=new THREE.Mesh(bGeo,fMat); bF.position.set(0,1.74,1.5); bF.renderOrder=R_DECOR+1; frame.add(bF);
  frame.add(bF.clone().translateZ(-3));
  const walls=new THREE.Mesh(new THREE.BoxGeometry(4.2,2,3.2),toonMat("#d8c09a")); walls.position.y=1.25; walls.renderOrder=R_DECOR+2; H.add(walls);
  const door=new THREE.Mesh(new THREE.BoxGeometry(.85,1.28,.09),toonMat("#7d5737")); door.position.set(0,.86,1.66); door.renderOrder=R_DECOR+3; door.visible=false; H.add(door);
  const wL=new THREE.Mesh(new THREE.BoxGeometry(.58,.5,.09),toonMat("#83c8df")); wL.position.set(-1.15,1.45,1.66); wL.renderOrder=R_DECOR+3; wL.visible=false; H.add(wL);
  const wR=wL.clone(); wR.position.x=1.15; H.add(wR);
  const yRoof=new THREE.Mesh(new THREE.ConeGeometry(3.08,1.38,4),toonMat("#91684e")); yRoof.position.y=2.78; yRoof.rotation.y=Math.PI*.25; yRoof.renderOrder=R_DECOR+3; H.add(yRoof);
  const chimney=new THREE.Mesh(new THREE.BoxGeometry(.34,.86,.34),toonMat("#757980")); chimney.position.set(1,3,-.4); chimney.renderOrder=R_DECOR+4; H.add(chimney);
  const logPile=new THREE.Mesh(new THREE.CylinderGeometry(.75,.92,.46,8),toonMat("#9a6d45")); logPile.position.set(-2.7,.45,-2.3); logPile.renderOrder=R_DECOR; g.add(logPile);
  const orePile=new THREE.Mesh(new THREE.DodecahedronGeometry(.72,0),toonMat("#7f878f")); orePile.position.set(2.6,.7,-2.15); orePile.scale.y=.56; orePile.renderOrder=R_DECOR; g.add(orePile);
  const glow=new THREE.Mesh(new THREE.CylinderGeometry(2.65,2.65,.05,26),toonMat("#8adfa6")); glow.position.y=.08; glow.renderOrder=R_DECOR; glow.visible=false; g.add(glow);
  let stage=-1;
  const setProgress=(p,stock={logs:0,ore:0})=>{
    p=THREE.MathUtils.clamp(p,0,1);
    foundation.scale.set(1,.5+p*.5,1);
    frame.visible=p>=.12; frame.scale.y=THREE.MathUtils.clamp((p-.12)/.22,.2,1);
    walls.visible=p>=.33; walls.scale.set(1,THREE.MathUtils.clamp((p-.33)/.28,.12,1),1);
    door.visible=p>=.44; wL.visible=wR.visible=p>=.5;
    yRoof.visible=p>=.62; yRoof.scale.setScalar(.45+THREE.MathUtils.clamp((p-.62)/.2,0,1)*.55);
    chimney.visible=p>=.82; chimney.scale.y=THREE.MathUtils.clamp((p-.82)/.18,.25,1);
    const lr=THREE.MathUtils.clamp((stock.logs||0)/120,0,1),or=THREE.MathUtils.clamp((stock.ore||0)/80,0,1);
    logPile.scale.set(.4+lr*.9,.45+lr,.4+lr*.9); orePile.scale.set(.45+or*.8,.32+or*.85,.45+or*.8);
    glow.visible=p>=1; stage=p>=1?4:p>=.82?3:p>=.62?2:p>=.33?1:0;
  };
  setProgress(0); scene.add(g); addBlob(scene,x,z,4.6,.16);
  if(nodes) nodes.push(addHS(g,-3.8,1.05,3.7));
  return {node:g,setProgress,getStage:()=>stage};
}

function addDummy(scene,x,z,nodes) {
  const g=new THREE.Group(), y=getWorldSurfaceHeight(x,z); g.position.set(x,y,z);
  const bMat=toonMat("#a07040");
  g.add(m3(new THREE.CylinderGeometry(.18,.22,1.4,8),bMat,0,.7,0));
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,1,6),bMat); arm.position.y=1.1; arm.rotation.z=Math.PI/2; g.add(arm);
  g.add(m3(new THREE.SphereGeometry(.2,8,8),toonMat("#c4a868"),0,1.6,0));
  g.add(m3(new THREE.CylinderGeometry(.28,.28,.1,10),toonMat("#8a6038"),0,.05,0));
  setSvc(g,"dummy","Training Dummy"); scene.add(g);
  nodes.push(addHS(g,0,.8,0)); addBlob(scene,x,z,.5,.18);
}

function addTrainYard(scene,x,z) {
  const y=getWorldSurfaceHeight(x,z), g=new THREE.Group(); g.position.set(x,y,z);
  const fMat=toonMat("#8f6642"), fGeo=new THREE.CylinderGeometry(.07,.08,.72,6);
  for(let i=0;i<10;i++){const a=(i/10)*Math.PI*2; const p=new THREE.Mesh(fGeo,fMat); p.position.set(Math.cos(a)*5.4,.42,Math.sin(a)*5.4); p.renderOrder=R_DECOR; g.add(p);}
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,1.3,6),toonMat("#8a6240"));
  sp.position.set(0,.74,-4.7); sp.renderOrder=R_DECOR; g.add(sp);
  g.add(m3(new THREE.BoxGeometry(1.55,.52,.08),toonMat("#3d6079"),0,1.15,-4.38,R_DECOR+1));
  scene.add(g); addBlob(scene,x,z,3.5,.13);
}

/* ── Plaza ── */
function addPlaza(scene,nodes,obstacles) {
  const tX=SVC.train.x,tZ=SVC.train.z,hX=SVC.build.x,hZ=SVC.build.z;
  const bk={x:-7,z:-32}, st={x:0,z:-32.5}, sm={x:7,z:-32};
  addPath(scene,[[-30,-29],[30,-29]],{width:3,color:"#b79063",smooth:.02});
  addPath(scene,[[0,-29],[0,-40]],{width:1.85,color:"#b58d61",smooth:.04});
  for(const p of [bk,st,sm]) addPath(scene,[[p.x,-29],[p.x,p.z+1.5]],{width:1.2,color:"#b58d61",smooth:.04});
  addPath(scene,[[8,-29],[12,-31],[hX,hZ]],{width:1.6,smooth:.2});
  addPath(scene,[[-8,-29],[-14,-31],[tX,tZ]],{width:1.6,smooth:.2});
  addBank(scene,bk.x,bk.z,nodes);
  addStore(scene,st.x,st.z,nodes);
  addSmith(scene,sm.x,sm.z,nodes);
  addTrainYard(scene,tX,tZ);
  addDummy(scene,tX+3,tZ,nodes);
  addDummy(scene,tX,tZ,nodes);
  addDummy(scene,tX-3,tZ,nodes);
  const cs=addYard(scene,hX,hZ,nodes);
  const cx=hX+.15,cz=hZ-.2;
  obstacles.push(
    {x:bk.x,z:bk.z,radius:1.35,id:"bank"},{x:st.x,z:st.z,radius:1.45,id:"store"},
    {x:sm.x,z:sm.z,radius:1.6,id:"blacksmith"},
    {x:cx,z:cz,radius:2.35,id:"house-core"},{x:cx-1.2,z:cz,radius:1.45,id:"house-left"},{x:cx+1.2,z:cz,radius:1.45,id:"house-right"}
  );
  return {constructionSite:cs};
}

/* ── Fishing ── */
const RING_GEO=new THREE.TorusGeometry(.5,.045,8,24);
const BOB_GEO=new THREE.SphereGeometry(.13,8,7);
function addFishing(scene,nodes) {
  const spots=[];
  for(const[x,z,i] of [[-5,8,0],[6,7,1],[8,-4,2],[-7,-5,3],[1,11,4]]){
    const g=new THREE.Group(); setRes(g,"fishing","Fishing Spot");
    g.userData.bobPhase=i*1.23; g.position.set(x,WATER_Y+.02,z); g.renderOrder=R_WATER+2;
    const ring=new THREE.Mesh(RING_GEO,new THREE.MeshBasicMaterial({color:"#dcf8ff",transparent:true,opacity:.72}));
    ring.rotation.x=Math.PI/2; g.add(ring);
    const bob=new THREE.Mesh(BOB_GEO,toonMat("#ffcc58")); bob.position.y=.12; g.add(bob);
    g.userData.ring=ring; scene.add(g); nodes.push(g); spots.push(g);
  }
  return spots;
}
function updateFishing(spots,t) {
  for(const s of spots){
    const p=s.userData.bobPhase||0;
    s.position.y=WATER_Y+.02+Math.sin(t*2+p)*.03;
    if(s.userData.ring){s.userData.ring.scale.setScalar(1+Math.sin(t*2.2+p)*.06); s.userData.ring.material.opacity=.62+Math.sin(t*2.4+p)*.08;}
  }
}

/* ── Lily pads — just a few ── */
function addLilies(scene) {
  [{x:-5,z:8,r:.55},{x:4,z:11,r:.5,f:"#f5a0c0"},{x:8,z:3,r:.6},{x:-8,z:-3,r:.5},{x:-3,z:-7,r:.45,f:"#f7e663"}]
    .forEach((p,i)=>{
      const m=new THREE.Mesh(new THREE.CircleGeometry(p.r,16,.2,Math.PI*2-.4),toonMat("#3a9058"));
      m.rotation.x=-Math.PI/2; m.rotation.z=(i*.73)%(Math.PI*2);
      m.position.set(p.x,WATER_Y+.01,p.z); m.renderOrder=R_WATER+1; scene.add(m);
      if(p.f){
        const f=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),toonMat(p.f));
        f.position.set(p.x+Math.sin(i*1.31)*.07,WATER_Y+.07,p.z+Math.cos(i*1.53)*.07);
        f.renderOrder=R_WATER+2; scene.add(f);
      }
    });
}

/* ── Wildflowers — sparse, away from training ── */
function addFlowers(scene) {
  const colors=["#f5a0c0","#f7e663","#c4a0f5","#ff9e7a","#a0d8f0","#ffb6d9"];
  const sGeo=new THREE.CylinderGeometry(.015,.018,.35,4), bGeo=new THREE.SphereGeometry(.06,6,6), sMat=toonMat("#3a8e38");
  [[6,30],[-8,31],[28,6],[-28,8],[30,-4],[-30,-6],[0,-42],[14,-42]]
    .forEach(([x,z],i)=>{
      if(inKO(x,z,.6)) return;
      const y=getWorldSurfaceHeight(x,z);
      scene.add(m3(sGeo.clone(),sMat,x,y+.18,z,R_DECOR));
      scene.add(m3(bGeo.clone(),toonMat(colors[i%colors.length]),x,y+.37,z,R_DECOR));
    });
}

/* ── Lounges ── */
function addLounges(scene) {
  [[-8,-25,Math.PI],[0,-25.5,Math.PI],[8,-25,Math.PI]].forEach(([x,z,rot])=>{
    const y=getWorldSurfaceHeight(x,z);
    const base=new THREE.Mesh(new THREE.BoxGeometry(2.3,.24,1.05),toonMat("#f4d93e"));
    base.position.set(x,y+.72,z); base.rotation.y=rot; base.renderOrder=R_DECOR; scene.add(base);
    const back=new THREE.Mesh(new THREE.BoxGeometry(2,.2,.7),toonMat("#f8df67"));
    back.position.set(x-Math.sin(rot)*.42,y+.98,z-Math.cos(rot)*.42);
    back.rotation.y=rot; back.rotation.x=-.28; back.renderOrder=R_DECOR; scene.add(back);
    addBlob(scene,x,z,1.7,.12);
  });
}

/* ── Entry ── */
export async function createWorld(scene) {
  const nodes=[], obstacles=[];
  const skyMat=addSky(scene);
  const ground=createTerrain(scene);
  const {waterUniforms,causticMap}=createWater(scene);

  let models=null;
  try{models=await loadModels();}catch(e){console.warn("Model load failed:",e);}

  if(models){
    placeTrees(scene,models,nodes);
    placeRocks(scene,models,nodes);
    placeBushes(scene,models);
    placeCliffs(scene,models);
  }

  addLounges(scene); addLilies(scene); addFlowers(scene);
  const fishing=addFishing(scene,nodes);
  const {constructionSite}=addPlaza(scene,nodes,obstacles);

  return {
    ground, skyMat, waterUniforms, causticMap,
    addShadowBlob:(x,z,r,o)=>addBlob(scene,x,z,r,o),
    resourceNodes:nodes, updateWorld:t=>updateFishing(fishing,t),
    constructionSite, collisionObstacles:obstacles,
    weaponModels:models?.weapons??null,
  };
}

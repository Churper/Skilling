import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/* ── Toon helpers ── */
const TOON_GRAD = (() => {
  const c = document.createElement("canvas"); c.width = 6; c.height = 1;
  const ctx = c.getContext("2d");
  [26,68,118,176,232,255].forEach((v,i) => { ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(i,0,1,1); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace; t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
})();
function toonMat(color, opts={}) { return new THREE.MeshToonMaterial({color, gradientMap:TOON_GRAD, ...opts}); }
function stabilizeModelLook(root) {
  if (!root) return;
  root.traverse(o => {
    if (!o?.isMesh || !o.material) return;
    (Array.isArray(o.material)?o.material:[o.material]).forEach(m => {
      if(!m) return;
      if("metalness" in m) m.metalness=0; if("roughness" in m) m.roughness=1;
      if("shininess" in m) m.shininess=0; if("envMapIntensity" in m) m.envMapIntensity=0;
      if("flatShading" in m) m.flatShading=true; m.needsUpdate=true;
    });
  });
}
function m3(geo,mat,x,y,z,ro) { const m=new THREE.Mesh(geo,mat); m.position.set(x,y,z); if(ro!=null) m.renderOrder=ro; return m; }

/* ── Constants ── */
const LAKE_R=24, WATER_R=25.2, BOWL_Y=0.58, WATER_Y=0.6;
const MT_START=46, MT_END=100, MAP_R=115;
const R_GND=0, R_SHORE=1, R_WATER=2, R_DECOR=3;
const SVC = Object.freeze({
  plaza:{x:0,z:-34,r:14}, build:{x:18,z:-37,r:10}, train:{x:-24,z:-36,r:10},
});
const KEEP_OUT = [SVC.plaza, SVC.build, SVC.train];
function inKO(x,z,pad=0) { for(const k of KEEP_OUT) if(Math.hypot(x-k.x,z-k.z)<=k.r+pad) return true; return false; }

/* ── Shoreline ── */
function lakeR(a) { return LAKE_R+Math.sin(a*1.7+.5)*1.05+Math.sin(a*3.4-1.2)*.65+Math.cos(a*5.1+.2)*.45; }
function waterR(a) { return lakeR(a)+(WATER_R-LAKE_R); }
function lakeRAt(x,z) { return lakeR(Math.atan2(z,x)); }
function waterRAt(x,z) { return waterR(Math.atan2(z,x)); }

/* ── Terrain height ── */
function noise(x,z) {
  return Math.sin(x*.045)*.56+Math.cos(z*.037)*.52+Math.sin((x+z)*.021)*.4
    +Math.sin(x*.12-z*.09)*.22-Math.abs(Math.sin(x*.082+z*.073))*.16;
}
function terrainH(x,z) {
  const r=Math.hypot(x,z), n=noise(x,z);
  const bowl=Math.pow(1-THREE.MathUtils.smoothstep(r,0,31),1.65)*1.15;
  const amp=THREE.MathUtils.lerp(.31,.55,THREE.MathUtils.smoothstep(r,17.5,50));
  const hill=Math.sin(x*.065+z*.048)*Math.cos(x*.031-z*.057);
  const flat=n*amp-bowl+THREE.MathUtils.smoothstep(r,26,50)*hill*.8;
  if(r<=MT_START) return flat;
  const mt=THREE.MathUtils.smoothstep(r,MT_START,MT_END), a=Math.atan2(z,x);
  return flat+mt*mt*70+(Math.sin(a*13.7+x*.15)*.5+.5)*mt*8
    +(Math.cos(a*7.3-z*.12)*.5+.5)*mt*5+Math.sin(x*.18)*Math.cos(z*.14)*mt*3;
}
function lakeFloorH(x,z) {
  const r=Math.hypot(x,z), lr=lakeRAt(x,z);
  if(r>lr) return -Infinity;
  const t=r/lr, d=Math.pow(1-t,1.82);
  return BOWL_Y-(0.1+d*1.95+THREE.MathUtils.smoothstep(t,.74,1)*.08);
}
export function getWorldSurfaceHeight(x,z) {
  const f=lakeFloorH(x,z); return Number.isFinite(f)?f:terrainH(x,z);
}
export function getWaterSurfaceHeight(x,z,time=0) {
  const d=Math.hypot(x,z); if(d>waterRAt(x,z)) return -Infinity;
  const damp=1-(d/waterRAt(x,z))*.18;
  return WATER_Y+(Math.sin(x*.16+z*.12+time*.82)*.032+Math.sin(x*.28-z*.22+time*.65)*.022+Math.cos(x*.11+z*.34-time*.74)*.026)*damp;
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

/* ── Terrain — lush vibrant greens ── */
function createTerrain(scene) {
  const inner=WATER_R-3, outer=MAP_R, aS=128, rR=55;
  const pos=[],col=[],idx=[];
  const cSand=new THREE.Color("#d4be7a"), cGrass=new THREE.Color("#4cc436");
  const cLush=new THREE.Color("#1e8a18"), cRock=new THREE.Color("#6e7e65"), cCliff=new THREE.Color("#5a5247");
  const tmp=new THREE.Color(), vpr=aS+1;

  for(let ri=0;ri<=rR;ri++){
    const r=inner+(outer-inner)*Math.pow(ri/rR,.45);
    for(let ai=0;ai<=aS;ai++){
      const a=(ai/aS)*Math.PI*2;
      const x=Math.cos(a)*r, z=Math.sin(a)*r;
      const dist=Math.hypot(x,z), wr=waterRAt(x,z);
      let y=terrainH(x,z);
      // Smooth dip well under water — eliminates clipping
      if(dist<wr+2) { const t=THREE.MathUtils.smoothstep(dist,wr-3,wr+2); y=THREE.MathUtils.lerp(WATER_Y-.18,y,t); }
      pos.push(x,y,z);

      const sandEdge=wr+.8;
      const sandT=THREE.MathUtils.smoothstep(dist,sandEdge,sandEdge+.6);
      const lushT=THREE.MathUtils.smoothstep(dist,30,42);
      const rockT=Math.max(THREE.MathUtils.smoothstep(dist,44,54)*.9, THREE.MathUtils.smoothstep(y,3,12)*.72);
      const cliffT=THREE.MathUtils.smoothstep(dist,56,73);

      tmp.copy(cSand).lerp(cGrass,sandT);
      if(lushT>0) tmp.lerp(cLush,lushT*.8);
      if(rockT>0) tmp.lerp(cRock,THREE.MathUtils.clamp(rockT,0,1));
      if(cliffT>0) tmp.lerp(cCliff,cliffT*.84);

      const ss=.8;
      const nx=-(terrainH(x+ss,z)-terrainH(x-ss,z)), ny=2, nz=-(terrainH(x,z+ss)-terrainH(x,z-ss));
      const len=Math.hypot(nx,ny,nz);
      const lit=THREE.MathUtils.clamp((nx*.54+ny*.78+nz*.31)/len*.5+.5,0,1);
      const banded=THREE.MathUtils.lerp(lit,Math.floor(lit*4.5)/4,.45);
      tmp.multiplyScalar(.92+banded*.22);
      col.push(tmp.r,tmp.g,tmp.b);
    }
  }
  for(let ri=0;ri<rR;ri++) for(let ai=0;ai<aS;ai++){
    const a=ri*vpr+ai,b=a+1,c=(ri+1)*vpr+ai,d=c+1;
    idx.push(a,b,c,b,d,c);
  }
  const geo=new THREE.BufferGeometry();
  geo.setIndex(idx); geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,toonMat("#fff",{vertexColors:true,fog:false}));
  mesh.renderOrder=R_GND; scene.add(mesh); return mesh;
}

/* ── Lake bowl ── */
function createBowl(scene) {
  const S=80, R=20, pos=[],col=[],idx=[];
  const deep=new THREE.Color("#1a6b8a"), shelf=new THREE.Color("#4aab92");
  for(let r=0;r<=R;r++){
    const t=.03+.97*(r/R);
    for(let s=0;s<S;s++){
      const a=(s/S)*Math.PI*2, rad=lakeR(a)*t;
      const x=Math.cos(a)*rad, z=Math.sin(a)*rad;
      const d=Math.pow(1-t,1.72);
      pos.push(x,-(0.16+d*1.78+THREE.MathUtils.smoothstep(t,.72,1)*.05),z);
      const c=new THREE.Color().copy(shelf).lerp(deep,THREE.MathUtils.smoothstep(d,.1,.7));
      col.push(c.r,c.g,c.b);
    }
  }
  for(let r=0;r<R;r++){ const a=r*S,b=(r+1)*S; for(let s=0;s<S;s++){const sn=(s+1)%S; idx.push(a+s,b+s,b+sn,a+s,b+sn,a+sn);}}
  const geo=new THREE.BufferGeometry();
  geo.setIndex(idx); geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,toonMat("#fff",{vertexColors:true,side:THREE.DoubleSide}));
  m.position.y=BOWL_Y; m.renderOrder=R_SHORE; scene.add(m);
}

/* ── Water — opaque vibrant turquoise, Chao Garden style ── */
function createWater(scene) {
  const uni={uTime:{value:0}};
  createBowl(scene);
  const S=80, R=20, wP=[],wR=[],wI=[];
  for(let r=0;r<=R;r++){
    const t=.03+.97*(r/R);
    for(let s=0;s<S;s++){
      const a=(s/S)*Math.PI*2, rad=waterR(a)*t;
      wP.push(Math.cos(a)*rad,0,Math.sin(a)*rad); wR.push(t);
    }
  }
  for(let r=0;r<R;r++){const a=r*S,b=(r+1)*S; for(let s=0;s<S;s++){const sn=(s+1)%S; wI.push(a+s,b+s,b+sn,a+s,b+sn,a+sn);}}
  const geo=new THREE.BufferGeometry();
  geo.setIndex(wI); geo.setAttribute("position",new THREE.Float32BufferAttribute(wP,3));
  geo.setAttribute("aRad",new THREE.Float32BufferAttribute(wR,1)); geo.computeVertexNormals();

  const mat=new THREE.ShaderMaterial({
    transparent:true, depthWrite:true, side:THREE.DoubleSide, uniforms:uni,
    vertexShader:`
      attribute float aRad; varying float vR; varying vec2 vW; uniform float uTime;
      void main(){
        vR=aRad; vec3 p=position;
        p.y+=sin(p.x*.22+uTime*.7)*.03+sin(p.z*.18-uTime*.55)*.025+cos(p.x*.13+p.z*.15+uTime*.4)*.02;
        vW=p.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader:`
      varying float vR; varying vec2 vW; uniform float uTime;
      void main(){
        vec3 deep=vec3(.04,.28,.42);
        vec3 mid=vec3(.12,.48,.58);
        vec3 edge=vec3(.32,.72,.74);
        vec3 c=mix(deep,mid,smoothstep(0.0,.5,vR));
        c=mix(c,edge,smoothstep(.5,.95,vR));
        // Subtle ripple highlights
        float rip=sin(vW.x*.8+vW.y*.6+uTime*1.5)*.5+.5;
        rip*=sin(vW.x*.3-vW.y*.5+uTime*.8)*.5+.5;
        c+=rip*.04;
        float a=smoothstep(1.02,.88,vR)*.96;
        if(a<.01) discard;
        gl_FragColor=vec4(c,a);
      }`,
  });
  const water=new THREE.Mesh(geo,mat);
  water.position.y=WATER_Y; water.renderOrder=R_WATER; scene.add(water);
  return {waterUniforms:uni, causticMap:null};
}

/* ── Shadow blobs ── */
function makeBlobTex() {
  const c=document.createElement("canvas"); c.width=c.height=256;
  const ctx=c.getContext("2d"); ctx.clearRect(0,0,256,256);
  const g=ctx.createRadialGradient(128,128,6,128,128,128);
  g.addColorStop(0,"rgba(255,255,255,0.82)"); g.addColorStop(.55,"rgba(255,255,255,0.32)"); g.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=g; ctx.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.minFilter=t.magFilter=THREE.LinearFilter; return t;
}
function addBlob(scene,tex,x,z,radius=1.8,opacity=.2) {
  const y=getWorldSurfaceHeight(x,z);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(radius*2,radius*2),
    new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,color:"#344347",
      opacity,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));
  m.rotation.x=-Math.PI/2;
  const p=Math.sin(x*12.99+z*78.23)*43758.55; m.rotation.z=(p-Math.floor(p))*Math.PI;
  m.position.set(x,y+.02,z); m.renderOrder=R_GND+1; scene.add(m); return m;
}

/* ── Model loading — expanded with all new varieties ── */
async function loadModels() {
  THREE.Cache.enabled=true;
  const loader=new GLTFLoader();
  const load=url=>new Promise((res,rej)=>loader.load(url,g=>res(g.scene),undefined,rej));
  const E={
    // Trees — 11 leafy + 6 bare = 17 varieties
    t1a:'models/Tree_1_A_Color1.gltf', t1b:'models/Tree_1_B_Color1.gltf', t1c:'models/Tree_1_C_Color1.gltf',
    t2a:'models/Tree_2_A_Color1.gltf', t2b:'models/Tree_2_B_Color1.gltf', t2c:'models/Tree_2_C_Color1.gltf',
    t2d:'models/Tree_2_D_Color1.gltf', t2e:'models/Tree_2_E_Color1.gltf',
    t3a:'models/Tree_3_A_Color1.gltf', t3b:'models/Tree_3_B_Color1.gltf', t3c:'models/Tree_3_C_Color1.gltf',
    t4a:'models/Tree_4_A_Color1.gltf', t4b:'models/Tree_4_B_Color1.gltf', t4c:'models/Tree_4_C_Color1.gltf',
    tb1a:'models/Tree_Bare_1_A_Color1.gltf', tb1b:'models/Tree_Bare_1_B_Color1.gltf', tb1c:'models/Tree_Bare_1_C_Color1.gltf',
    tb2a:'models/Tree_Bare_2_A_Color1.gltf', tb2b:'models/Tree_Bare_2_B_Color1.gltf', tb2c:'models/Tree_Bare_2_C_Color1.gltf',
    // Bushes — 14 varieties
    b1a:'models/Bush_1_A_Color1.gltf', b1b:'models/Bush_1_B_Color1.gltf', b1c:'models/Bush_1_C_Color1.gltf',
    b1d:'models/Bush_1_D_Color1.gltf', b1e:'models/Bush_1_E_Color1.gltf',
    b2a:'models/Bush_2_A_Color1.gltf', b2b:'models/Bush_2_B_Color1.gltf', b2c:'models/Bush_2_C_Color1.gltf', b2d:'models/Bush_2_D_Color1.gltf',
    b3a:'models/Bush_3_A_Color1.gltf', b3b:'models/Bush_3_B_Color1.gltf',
    b4a:'models/Bush_4_A_Color1.gltf', b4b:'models/Bush_4_B_Color1.gltf', b4c:'models/Bush_4_C_Color1.gltf',
    // Rocks — small, medium, large
    r1a:'models/Rock_1_A_Color1.gltf', r1b:'models/Rock_1_B_Color1.gltf', r1c:'models/Rock_1_C_Color1.gltf',
    r1d:'models/Rock_1_D_Color1.gltf', r1e:'models/Rock_1_E_Color1.gltf',
    r1j:'models/Rock_1_J_Color1.gltf', r1k:'models/Rock_1_K_Color1.gltf', r1l:'models/Rock_1_L_Color1.gltf', r1m:'models/Rock_1_M_Color1.gltf',
    r2a:'models/Rock_2_A_Color1.gltf', r2b:'models/Rock_2_B_Color1.gltf', r2c:'models/Rock_2_C_Color1.gltf',
    r2d:'models/Rock_2_D_Color1.gltf', r2e:'models/Rock_2_E_Color1.gltf',
    r3a:'models/Rock_3_A_Color1.gltf', r3b:'models/Rock_3_B_Color1.gltf', r3c:'models/Rock_3_C_Color1.gltf',
    r3d:'models/Rock_3_D_Color1.gltf', r3e:'models/Rock_3_E_Color1.gltf', r3f:'models/Rock_3_F_Color1.gltf',
    r3g:'models/Rock_3_G_Color1.gltf', r3h:'models/Rock_3_H_Color1.gltf',
    r3j:'models/Rock_3_J_Color1.gltf', r3k:'models/Rock_3_K_Color1.gltf', r3l:'models/Rock_3_L_Color1.gltf',
    // Grass — 8 varieties
    g1a:'models/Grass_1_A_Color1.gltf', g1b:'models/Grass_1_B_Color1.gltf', g1c:'models/Grass_1_C_Color1.gltf', g1d:'models/Grass_1_D_Color1.gltf',
    g2a:'models/Grass_2_A_Color1.gltf', g2b:'models/Grass_2_B_Color1.gltf', g2c:'models/Grass_2_C_Color1.gltf', g2d:'models/Grass_2_D_Color1.gltf',
    // Weapons
    sword:'models/sword_A.gltf', bow:'models/bow_A_withString.gltf', staff:'models/staff_A.gltf', arrow:'models/arrow_A.gltf',
  };
  const keys=Object.keys(E);
  const res=await Promise.all(keys.map(k=>load(E[k]).catch(()=>null)));
  res.forEach(m=>stabilizeModelLook(m));
  const M={}; keys.forEach((k,i)=>M[k]=res[i]);
  const f=arr=>arr.filter(Boolean);
  return {
    trees: f([M.t1a,M.t1b,M.t1c,M.t2a,M.t2b,M.t2c,M.t2d,M.t2e,M.t3a,M.t3b,M.t3c,M.t4a,M.t4b,M.t4c]),
    bare: f([M.tb1a,M.tb1b,M.tb1c,M.tb2a,M.tb2b,M.tb2c]),
    bushes: f([M.b1a,M.b1b,M.b1c,M.b1d,M.b1e,M.b2a,M.b2b,M.b2c,M.b2d,M.b3a,M.b3b,M.b4a,M.b4b,M.b4c]),
    rocks: f([M.r1a,M.r1b,M.r1c,M.r1d,M.r1e,M.r2a,M.r2b,M.r2c,M.r2d,M.r2e]),
    bigRocks: f([M.r1j,M.r1k,M.r1l,M.r1m,M.r3a,M.r3b,M.r3c,M.r3d,M.r3e,M.r3f,M.r3g,M.r3h,M.r3j,M.r3k,M.r3l]),
    grass: f([M.g1a,M.g1b,M.g1c,M.g1d,M.g2a,M.g2b,M.g2c,M.g2d]),
    weapons: {sword:M.sword, bow:M.bow, staff:M.staff, arrow:M.arrow},
  };
}

/* ── Placement ── */
function placeM(scene,tmpl,x,z,s,r) {
  const m=tmpl.clone(); m.scale.setScalar(s); m.rotation.y=r;
  m.position.set(x,getWorldSurfaceHeight(x,z),z); scene.add(m); return m;
}

/* ── Trees — lush dense clusters ── */
function placeTrees(scene,blob,M,nodes) {
  const T=M.trees; if(!T.length) return;
  const cl=[
    // North shore — thick grove
    {c:[0,33],t:[[0,0,2.2,.4],[3.5,1,1.8,1.3],[-3,1.5,1.9,2.6],[1.5,3,1.7,3.8],[-1.5,-1,2,5]]},
    {c:[14,30],t:[[0,0,2,1],[2.5,-1,1.7,2.2],[-2,1.5,1.85,3.5]]},
    {c:[-14,31],t:[[0,0,1.95,4],[2,1.5,1.7,5.2],[-2.5,0,1.8,.8]]},
    // East shore — lush wall
    {c:[30,16],t:[[0,0,2.1,.6],[2.5,2,1.75,1.8],[-1,2.5,1.9,3]]},
    {c:[33,4],t:[[0,0,1.85,4.2],[2,-1.5,1.65,5.4],[0,2.5,1.8,1]]},
    {c:[32,-10],t:[[0,0,2,2.4],[2.5,1,1.7,3.6],[-1.5,2,1.8,.2]]},
    // West shore — lush wall
    {c:[-31,15],t:[[0,0,2,.8],[-2.5,1.5,1.75,2],[-1,-2,1.85,3.4]]},
    {c:[-34,3],t:[[0,0,1.9,4.8],[-2.5,-1,1.7,.6],[1.5,2.5,1.8,1.8]]},
    {c:[-33,-12],t:[[0,0,2.1,2.8],[-2,1.5,1.65,4],[1,-2,1.75,5.2]]},
    // South — behind village, thick forest backdrop
    {c:[-16,-43],t:[[0,0,2.3,1.2],[3,.5,2,2.4],[-2.5,1,2.1,3.6],[5,-.5,1.8,4.8],[-5,0,1.9,.3]]},
    {c:[0,-46],t:[[0,0,2.2,3],[3,1,1.9,4.2],[-3,.5,2,.6],[1.5,-1.5,1.8,1.8]]},
    {c:[14,-44],t:[[0,0,2.1,5],[2.5,1.5,1.85,1],[0,-2,1.75,2.4],[-3,0,2,3.6]]},
    {c:[-8,-48],t:[[0,0,2,4.4],[2.5,0,1.8,5.6],[-2.5,1,1.9,.8]]},
    {c:[8,-49],t:[[0,0,1.95,2],[3,-1,1.7,3.2],[-2,1.5,1.85,4.4]]},
    {c:[24,-45],t:[[0,0,2.1,.4],[3,0,1.8,1.6],[-2,1,1.9,2.8]]},
    {c:[-24,-46],t:[[0,0,2,3.6],[-3,.5,1.85,4.8],[2,-1,1.75,6]]},
    // Village accent trees (big, feature trees)
    {c:[-16,-35],t:[[0,0,2.5,1.8]]},
    {c:[13,-38],t:[[0,0,2.3,2.7]]},
    // Additional grove north-east
    {c:[24,24],t:[[0,0,1.9,.5],[2,2,1.7,1.7],[-1.5,2.5,1.8,3]]},
    // Additional grove north-west
    {c:[-24,23],t:[[0,0,1.85,4.1],[-2,2.5,1.7,5.3],[2,1,1.75,1]]},
  ];
  let i=0;
  for(const g of cl) for(const[dx,dz,s,r] of g.t){
    const px=g.c[0]+dx, pz=g.c[1]+dz;
    if(inKO(px,pz,2.5)) continue;
    const m=placeM(scene,T[i%T.length],px,pz,s,r);
    setRes(m,"woodcutting","Tree"); nodes.push(m);
    addBlob(scene,blob,px,pz,s,.15); i++;
  }
}

/* ── Rocks — mineable clusters ── */
function placeRocks(scene,blob,M,nodes) {
  const R=M.rocks; if(!R.length) return;
  const groups=[
    {c:[34,5], r:[[0,0,2,.3],[2,1.5,1.6,2.1],[-.8,-1.8,1.4,4]]},
    {c:[-33,7], r:[[0,0,2.1,3.2],[-1.5,2,1.7,5],[1.5,-1,1.5,1]]},
    {c:[16,33], r:[[0,0,1.9,4.1],[2.5,-1,1.5,1.4],[-.5,2,1.3,2.8]]},
    {c:[-20,32], r:[[0,0,1.8,2.6],[2,1.5,1.5,3.8]]},
  ];
  let i=0;
  for(const g of groups) for(const[dx,dz,s,r] of g.r){
    const px=g.c[0]+dx, pz=g.c[1]+dz;
    const m=placeM(scene,R[i%R.length],px,pz,s,r);
    setRes(m,"mining","Rock"); nodes.push(m); addBlob(scene,blob,px,pz,s*.7,.17); i++;
  }
}

/* ── Water rocks (decorative) ── */
function placeWaterRocks(scene,M) {
  const R=M.rocks; if(!R.length) return;
  [[-7,5,1.3,.4],[6,7.5,1.1,1.2],[9,-5,1.4,2],[-7,-6.5,1,3.4],[1,10,1.2,4.8],[-3,-9,.9,5.6],[8,3,1.1,.8]]
    .forEach(([x,z,s,r],i)=>{const m=placeM(scene,R[i%R.length],x,z,s,r); m.renderOrder=R_DECOR;});
}

/* ── Bushes — DENSE, everywhere ── */
function placeBushes(scene,M) {
  const B=M.bushes; if(!B.length) return;
  [
    // Shore edge — ring of bushes around the lake
    [-14,-28,1.2,.4],[14,-28.5,1.15,2.8],[-10,-30,1.1,3.4],[10,-30.5,1.08,5.6],
    [8,28,1.2,2.1],[-10,29,1.15,2.8],[20,23,1.25,.2],[-22,22,1.2,4.2],
    [28,12,1.18,.5],[-28,10,1.15,1.1],[30,-4,1.12,1.9],[-30,-6,1.1,2.7],
    [26,-16,1.15,3.5],[-26,-18,1.12,4.8],
    // Path edges
    [-12,-32,1,5.2],[12,-32.5,1.05,5.8],[-6,-33,.95,1.2],[6,-33.5,1,3],
    // Behind village — thick undergrowth
    [-10,-42,1.1,.8],[0,-43,1.08,2],[10,-42.5,1.12,3.2],[18,-43,1,4.4],[-18,-44,1.15,5.6],
    [-6,-44,.98,1.4],[6,-45,1.02,2.6],[14,-45.5,1.05,3.8],[-14,-45,1.08,5],
    // Scattered accent
    [36,18,1.2,1.6],[-36,16,1.15,2.8],[38,-12,1.1,4],[-38,-14,1.08,5.2],
    [4,36,1.15,.6],[-6,38,1.1,1.8],[16,32,1.2,3],[-16,34,1.08,4.2],
    // Near buildings
    [-9,-36,.9,.3],[9,-36,.92,1.5],[-5,-38,.88,2.7],[5,-37.5,.9,3.9],
  ].forEach(([x,z,s,r],i)=>{if(!inKO(x,z,1.4)){const m=placeM(scene,B[i%B.length],x,z,s,r); m.renderOrder=R_DECOR;}});
}

/* ── Grass — lush everywhere ── */
function placeGrass(scene,M) {
  const G=M.grass; if(!G.length) return;
  [
    // Village meadow
    [-8,-39],[4,-40],[-4,-38],[8,-39],[-12,-40],[12,-41],[0,-42],[6,-43],[-6,-42],
    // Lake perimeter
    [4,31],[-6,33],[14,29],[-14,31],[0,37],[8,35],[-10,36],[18,27],[-18,28],
    [30,10],[32,-2],[34,6],[-30,12],[-32,-4],[-34,8],[28,18],[-28,16],
    [36,14],[38,2],[34,-10],[32,-18],[-36,12],[-38,0],[-34,-12],[-32,-20],
    // Behind village
    [-20,-42],[20,-43],[0,-45],[-14,-46],[14,-47],[-8,-48],[8,-49],
    // Scattered meadows
    [40,8],[42,-6],[-40,10],[-42,-4],[26,26],[-24,28],[22,32],[-20,34],
    [10,38],[-12,40],[6,42],[-4,44],[16,36],[-14,38],
  ].forEach(([x,z],i)=>{if(!inKO(x,z,1)){const m=placeM(scene,G[i%G.length],x,z,1+(i%5)*.15,(i%16)*Math.PI/8); m.renderOrder=R_DECOR;}});
}

/* ── Mountain decoration — TONS of rocks for dramatic cliffs ── */
function placeMtnDecor(scene,M) {
  const BR=M.bigRocks; if(!BR.length) return;
  // Dense rock formations all around the mountain border
  const mtnRocks=[
    // South ridge
    [38,-48,3.5,.4],[42,-50,4,1.2],[46,-52,3.2,2.9],[34,-46,2.8,.9],[50,-48,3.8,3.5],
    [40,-54,3,5.2],[44,-46,3.4,1.8],[36,-52,2.6,4.6],[48,-54,3.6,.6],[32,-50,2.4,2.2],
    // North ridge
    [10,52,3.8,3.8],[14,56,3.4,4.6],[-10,54,3.2,1.2],[-14,58,3.6,.8],[0,56,4,2.4],
    [20,50,3,5],[6,58,3.5,3.2],[-6,52,2.8,4.4],[18,54,3.2,1.6],[-18,56,3.4,5.4],
    // East ridge
    [52,10,3.5,.4],[56,18,3.2,1.2],[58,4,3.8,2.8],[54,-6,3,4],[52,-18,3.4,5.2],
    [56,26,2.8,3.6],[60,12,3.6,1],[54,-14,3.2,.2],[58,-8,2.6,2.4],[52,22,3,4.8],
    // West ridge
    [-52,12,3.4,.5],[-56,22,3,1.4],[-58,6,3.6,3.1],[-54,-8,3.2,.9],[-52,-20,3.5,5.4],
    [-56,28,2.8,3.8],[-60,14,3.4,1.8],[-54,-16,3,4.2],[-58,-4,2.6,2.6],[-52,24,3.2,5],
    // Extra drama clusters — stacked formations
    [-35,-50,4,5.4],[10,-56,3.8,2],[-10,-54,3.4,2.2],[25,-52,3.6,3.4],[-25,-48,3.2,4.6],
    [30,48,3.4,1.4],[-28,50,3.6,2.6],[22,52,3,3.8],[-22,54,3.2,5],
  ];
  mtnRocks.forEach(([x,z,s,r],i)=>{
    const m=BR[i%BR.length].clone(); m.scale.setScalar(s); m.rotation.y=r;
    m.position.set(x,terrainH(x,z),z); scene.add(m);
  });

  // Trees on lower mountain slopes
  const T=M.trees;
  if(T.length) [
    [48,15,1.8,.2],[51,28,1.7,1],[56,4,1.9,1.8],[-48,15,1.8,.4],[-51,28,1.7,1.2],[-56,2,1.9,2],
    [15,48,1.8,2.5],[-12,50,1.7,3.2],[0,52,1.9,3.8],[22,-48,1.7,2.7],[-20,-49,1.8,3.4],
    [44,22,1.6,4],[42,-15,1.7,5.2],[-44,20,1.65,.6],[-42,-17,1.7,1.8],
    [35,38,1.5,3],[38,30,1.6,4.4],[-35,36,1.55,5.6],[-38,32,1.6,.8],
  ].forEach(([x,z,s,r],i)=>{ const m=T[i%T.length].clone(); m.scale.setScalar(s); m.rotation.y=r; m.position.set(x,terrainH(x,z),z); scene.add(m); });

  // Bare trees higher up
  const BT=M.bare;
  if(BT.length) [
    [54,30,1.4,.4],[58,-18,1.5,1.8],[-54,28,1.35,3.2],[-58,-16,1.5,4.6],
    [20,56,1.3,2],[12,58,1.4,5.4],[-18,56,1.35,.8],[-12,58,1.45,2.4],
    [44,-46,1.4,3.8],[38,-52,1.3,5],[-42,-48,1.5,1.2],[-36,-54,1.35,2.6],
  ].forEach(([x,z,s,r],i)=>{ const m=BT[i%BT.length].clone(); m.scale.setScalar(s); m.rotation.y=r; m.position.set(x,terrainH(x,z),z); scene.add(m); });
}

/* ── Lounges ── */
function addLounge(scene,blob,x,z,rot=0) {
  const y=getWorldSurfaceHeight(x,z);
  const base=new THREE.Mesh(new THREE.BoxGeometry(2.3,.24,1.05),toonMat("#f4d93e"));
  base.position.set(x,y+.72,z); base.rotation.y=rot; base.renderOrder=R_DECOR; scene.add(base);
  const back=new THREE.Mesh(new THREE.BoxGeometry(2,.2,.7),toonMat("#f8df67"));
  back.position.set(x-Math.sin(rot)*.42,y+.98,z-Math.cos(rot)*.42);
  back.rotation.y=rot; back.rotation.x=-.28; back.renderOrder=R_DECOR; scene.add(back);
  addBlob(scene,blob,x,z,1.7,.12);
}

/* ── Paths ── */
function pathGeo(curve,w,samples,yOff=.02) {
  const pos=[],uvs=[],idx=[],h=w/2;
  for(let i=0;i<=samples;i++){
    const t=i/samples, p=curve.getPointAt(t), tan=curve.getTangentAt(t);
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
  const w=opts.width??1.5, h=opts.height??.034, sm=opts.smooth??.22;
  const curve=new THREE.CatmullRomCurve3(pts.map(([x,z])=>new THREE.Vector3(x,0,z)),false,"catmullrom",sm);
  const n=Math.max(42,Math.floor(curve.getLength()*6));
  const edge=new THREE.Mesh(pathGeo(curve,w*1.26,n,h+.006),toonMat(opts.edgeColor||"#d8c39a",{transparent:true,opacity:.66}));
  edge.renderOrder=R_SHORE; scene.add(edge);
  const core=new THREE.Mesh(pathGeo(curve,w,n,h+.014),toonMat(opts.color||"#b79669"));
  core.renderOrder=R_SHORE+1; scene.add(core);
}

/* ── Oasis inlet ── */
function addInlet(scene,uni) {
  const pts=[[58.5,-19.8],[52.1,-17.1],[45,-13.9],[37.9,-10.9],[31.4,-8.8],[27.1,-7.3]];
  addPath(scene,pts,{width:2.7,color:"#bea47a",edgeColor:"#d9c8a3",height:.015,smooth:.16});
  const curve=new THREE.CatmullRomCurve3(pts.map(([x,z])=>new THREE.Vector3(x,0,z)),false,"catmullrom",.16);
  const geo=pathGeo(curve,1.4,80,.034);
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:uni.uTime},
    vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vUv; uniform float uTime; void main(){
      float f=sin(vUv.x*40.0-uTime*4.2)*.5+.5; f+=sin(vUv.x*73.0-uTime*3.1+vUv.y*4.0)*.5+.5; f*=.5;
      float e=smoothstep(.02,.2,vUv.y)*(1.0-smoothstep(.8,.98,vUv.y));
      vec3 c=mix(vec3(.12,.52,.62),vec3(.35,.72,.78),f*.45);
      float a=e*.85; if(a<.005)discard; gl_FragColor=vec4(c,a);
    }`,
  });
  scene.add(new THREE.Mesh(geo,mat));
}

/* ── Buildings — refreshed, more colorful ── */
function addBank(scene,blob,x,z,nodes) {
  const y=getWorldSurfaceHeight(x,z), g=new THREE.Group(); g.position.set(x,y,z);
  setSvc(g,"bank","Bank Chest");
  // Stone platform
  g.add(m3(new THREE.CylinderGeometry(1.2,1.3,.3,8),toonMat("#7a9eb5"),0,.15,0,R_DECOR));
  // Chest body — warm gold
  g.add(m3(new THREE.BoxGeometry(1.3,.7,.85),toonMat("#d4a63c"),0,.65,0,R_DECOR));
  // Chest bands
  g.add(m3(new THREE.BoxGeometry(1.34,.08,.88),toonMat("#8b6a2f"),0,.45,0,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(1.34,.08,.88),toonMat("#8b6a2f"),0,.85,0,R_DECOR));
  // Rounded lid
  const lid=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,1.32,8,1,false,0,Math.PI),toonMat("#e0b84a"));
  lid.rotation.z=Math.PI*.5; lid.position.y=1; lid.renderOrder=R_DECOR; g.add(lid);
  // Lock
  g.add(m3(new THREE.CylinderGeometry(.1,.1,.06,8),toonMat("#c4a24a"),0,.68,.46,R_DECOR));
  scene.add(g); addBlob(scene,blob,x,z,1.8,.16);
  if(nodes) nodes.push(addHS(g,0,.95,.55));
}

function addStore(scene,blob,x,z,nodes) {
  const y=getWorldSurfaceHeight(x,z), g=new THREE.Group(); g.position.set(x,y,z);
  setSvc(g,"store","General Store");
  // Wooden base platform
  g.add(m3(new THREE.BoxGeometry(2.6,.25,1.5),toonMat("#9a7044"),0,.12,0,R_DECOR));
  // Shelf back
  g.add(m3(new THREE.BoxGeometry(2.4,1.4,.15),toonMat("#7e5a30"),0,.95,-.65,R_DECOR));
  // Shelves
  g.add(m3(new THREE.BoxGeometry(2.4,.08,1.2),toonMat("#a87a48"),0,.45,0,R_DECOR));
  g.add(m3(new THREE.BoxGeometry(2.4,.08,1.2),toonMat("#a87a48"),0,1,0,R_DECOR));
  // Awning (colorful)
  g.add(m3(new THREE.BoxGeometry(2.8,.12,1.6),toonMat("#e8944a"),0,1.5,0,R_DECOR));
  // Posts
  const pL=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,1.25,6),toonMat("#9a7a4e"));
  pL.position.set(-1.1,.8,.55); pL.renderOrder=R_DECOR; g.add(pL);
  const pR=pL.clone(); pR.position.x=1.1; g.add(pR);
  // Sign board
  g.add(m3(new THREE.BoxGeometry(1,.35,.06),toonMat("#3f657d"),0,1.2,.72,R_DECOR));
  // Coin decoration
  const coin=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.04,12),toonMat("#f1d173"));
  coin.rotation.x=Math.PI*.5; coin.position.set(0,1.22,.78); coin.renderOrder=R_DECOR; g.add(coin);
  scene.add(g); addBlob(scene,blob,x,z,1.9,.16);
  if(nodes) nodes.push(addHS(g,0,.9,.66));
}

function addSmith(scene,blob,x,z,nodes) {
  const y=getWorldSurfaceHeight(x,z), g=new THREE.Group(); g.position.set(x,y,z);
  setSvc(g,"blacksmith","Blacksmith Forge");
  // Stone foundation
  g.add(m3(new THREE.CylinderGeometry(1.4,1.5,.25,8),toonMat("#5a6068"),0,.12,0,R_DECOR));
  // Forge body — dark stone
  g.add(m3(new THREE.BoxGeometry(2,1.2,1.5),toonMat("#6e7880"),0,.85,0,R_DECOR));
  // Roof — dark metal
  const roof=new THREE.Mesh(new THREE.ConeGeometry(1.5,.7,4),toonMat("#3e454e"));
  roof.position.y=1.82; roof.rotation.y=Math.PI*.25; roof.renderOrder=R_DECOR; g.add(roof);
  // Chimney
  const chim=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,.65,6),toonMat("#4a5058"));
  chim.position.set(.6,2.1,-.3); chim.renderOrder=R_DECOR; g.add(chim);
  // Forge opening — warm glow
  g.add(m3(new THREE.SphereGeometry(.18,8,7),toonMat("#ff8844"),0,.65,.82,R_DECOR));
  // Anvil
  g.add(m3(new THREE.BoxGeometry(.7,.3,.4),toonMat("#484e56"),-.8,.42,.8,R_DECOR));
  // Sign
  g.add(m3(new THREE.BoxGeometry(.9,.4,.06),toonMat("#2a4050"),0,1.15,.82,R_DECOR));
  scene.add(g); addBlob(scene,blob,x,z,2,.18);
  if(nodes) nodes.push(addHS(g,0,.95,.9));
}

function addYard(scene,blob,x,z,nodes) {
  const y=getWorldSurfaceHeight(x,z), g=new THREE.Group(); g.position.set(x,y,z);
  setSvc(g,"construction","House Construction Yard");
  // Blueprint sign on post
  const sp=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,1.45,6),toonMat("#8f6742"));
  sp.position.set(-3.8,.98,3.7); sp.renderOrder=R_DECOR; g.add(sp);
  g.add(m3(new THREE.BoxGeometry(1.85,.7,.1),toonMat("#2f536d"),-3.8,1.52,3.78,R_DECOR+1));
  g.add(m3(new THREE.BoxGeometry(.32,.11,.12),toonMat("#dce6ed"),-3.98,1.54,3.86,R_DECOR+2));
  // House structure
  const H=new THREE.Group(); H.position.set(.15,.06,-.2); g.add(H);
  const foundation=new THREE.Mesh(new THREE.BoxGeometry(4.6,.35,3.7),toonMat("#b7aea0")); foundation.position.y=.18; foundation.renderOrder=R_DECOR; H.add(foundation);
  const frame=new THREE.Group(); H.add(frame);
  const fMat=toonMat("#9c7048"), fGeo=new THREE.BoxGeometry(.2,1.5,.2);
  for(const[fx,fz] of [[-2,-1.5],[2,-1.5],[-2,1.5],[2,1.5]]){const p=new THREE.Mesh(fGeo,fMat); p.position.set(fx,1,fz); p.renderOrder=R_DECOR+1; frame.add(p);}
  const bGeo=new THREE.BoxGeometry(4.25,.2,.2);
  const bF=new THREE.Mesh(bGeo,fMat); bF.position.set(0,1.74,1.5); bF.renderOrder=R_DECOR+1; frame.add(bF);
  const bB=bF.clone(); bB.position.z=-1.5; frame.add(bB);
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
    const lr=THREE.MathUtils.clamp((stock.logs||0)/120,0,1), or=THREE.MathUtils.clamp((stock.ore||0)/80,0,1);
    logPile.scale.set(.4+lr*.9,.45+lr,.4+lr*.9); orePile.scale.set(.45+or*.8,.32+or*.85,.45+or*.8);
    glow.visible=p>=1;
    stage=p>=1?4:p>=.82?3:p>=.62?2:p>=.33?1:0;
  };
  setProgress(0); scene.add(g); addBlob(scene,blob,x,z,4.6,.16);
  if(nodes) nodes.push(addHS(g,-3.8,1.05,3.7));
  return {node:g, setProgress, getStage:()=>stage};
}

function addDummy(scene,blob,x,z,nodes) {
  const g=new THREE.Group(), y=getWorldSurfaceHeight(x,z); g.position.set(x,y,z);
  const bMat=toonMat("#a07040");
  // Body
  g.add(m3(new THREE.CylinderGeometry(.18,.22,1.4,8),bMat,0,.7,0));
  // Arms
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,1,6),bMat); arm.position.y=1.1; arm.rotation.z=Math.PI/2; g.add(arm);
  // Head
  g.add(m3(new THREE.SphereGeometry(.2,8,8),toonMat("#c4a868"),0,1.6,0));
  // Base
  g.add(m3(new THREE.CylinderGeometry(.28,.28,.1,10),toonMat("#8a6038"),0,.05,0));
  setSvc(g,"dummy","Training Dummy"); scene.add(g);
  nodes.push(addHS(g,0,.8,0)); addBlob(scene,blob,x,z,.5,.18);
}

function addTrainYard(scene,blob,x,z) {
  const y=getWorldSurfaceHeight(x,z), g=new THREE.Group(); g.position.set(x,y,z);
  const fMat=toonMat("#8f6642"), fGeo=new THREE.CylinderGeometry(.07,.08,.72,6);
  for(let i=0;i<10;i++){const a=(i/10)*Math.PI*2; const p=new THREE.Mesh(fGeo,fMat); p.position.set(Math.cos(a)*5.4,.42,Math.sin(a)*5.4); p.renderOrder=R_DECOR; g.add(p);}
  // Wooden sign (proper sign, not just a stick)
  const signPost=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,1.3,6),toonMat("#8a6240"));
  signPost.position.set(0,.74,-4.7); signPost.renderOrder=R_DECOR; g.add(signPost);
  const signBoard=m3(new THREE.BoxGeometry(1.55,.52,.08),toonMat("#3d6079"),0,1.15,-4.38,R_DECOR+1);
  g.add(signBoard);
  // Crossed swords decoration on sign
  const sGeo=new THREE.BoxGeometry(.52,.06,.06), sMat=toonMat("#e5d08b");
  const cA=new THREE.Mesh(sGeo,sMat); cA.position.set(-.12,1.18,-4.32); cA.rotation.z=Math.PI*.2; cA.renderOrder=R_DECOR+2; g.add(cA);
  const cB=cA.clone(); cB.position.x=.12; cB.rotation.z=-Math.PI*.2; g.add(cB);
  scene.add(g); addBlob(scene,blob,x,z,3.5,.13);
}

/* ── Service Plaza ── */
function addPlaza(scene,blob,nodes,obstacles) {
  const tX=SVC.train.x,tZ=SVC.train.z,hX=SVC.build.x,hZ=SVC.build.z;
  const bk={x:-7,z:-34}, st={x:0,z:-34.5}, sm={x:7,z:-34};
  addPath(scene,[[-32,-31],[32,-31]],{width:3.05,color:"#b79063",smooth:.02});
  addPath(scene,[[0,-31],[0,-42]],{width:1.85,color:"#b58d61",smooth:.04});
  for(const p of [bk,st,sm]) addPath(scene,[[p.x,-31],[p.x,p.z+1.55]],{width:1.2,color:"#b58d61",smooth:.04});
  addPath(scene,[[8,-31],[12,-33],[hX,hZ]],{width:1.62,smooth:.2});
  addPath(scene,[[-8,-31],[-14,-33],[tX,tZ]],{width:1.62,smooth:.2});
  addBank(scene,blob,bk.x,bk.z,nodes);
  addStore(scene,blob,st.x,st.z,nodes);
  addSmith(scene,blob,sm.x,sm.z,nodes);
  addTrainYard(scene,blob,tX,tZ);
  addDummy(scene,blob,tX+3.1,tZ,nodes);
  addDummy(scene,blob,tX,tZ,nodes);
  addDummy(scene,blob,tX-3.1,tZ,nodes);
  const cs=addYard(scene,blob,hX,hZ,nodes);
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
const RING_MAT=new THREE.MeshBasicMaterial({color:"#dcf8ff",transparent:true,opacity:.72});
const BOB_MAT=toonMat("#ffcc58");

function addFishing(scene,nodes) {
  const spots=[];
  for(const[x,z,i] of [[-6.5,10.4,0],[8.4,9.2,1],[10.6,-5.3,2],[-9.2,-7.4,3],[2.3,13.1,4]]){
    const g=new THREE.Group(); setRes(g,"fishing","Fishing Spot");
    g.userData.bobPhase=i*1.23; g.position.set(x,WATER_Y+.02,z); g.renderOrder=R_WATER+2;
    const ring=new THREE.Mesh(RING_GEO,RING_MAT.clone()); ring.rotation.x=Math.PI/2; g.add(ring);
    const bob=new THREE.Mesh(BOB_GEO,BOB_MAT); bob.position.y=.12; g.add(bob);
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

/* ── Lily pads — more, lusher ── */
function addLilies(scene) {
  [
    {x:-8,z:6,r:.6},{x:-5,z:12,r:.5,f:"#f5a0c0"},{x:3,z:14,r:.65},{x:7,z:11,r:.55,f:"#f7e663"},
    {x:-11,z:3,r:.45},{x:12,z:-3,r:.6},{x:-4,z:-10,r:.55,f:"#f5a0c0"},{x:6,z:-8,r:.5},{x:-9,z:-5,r:.7},{x:10,z:5,r:.55},
    {x:-2,z:16,r:.5,f:"#ffb6d9"},{x:14,z:4,r:.45},{x:-12,z:-8,r:.5},{x:4,z:-12,r:.55,f:"#c4a0f5"},
    {x:8,z:14,r:.48},{x:-6,z:14,r:.52,f:"#f7e663"},
  ].forEach((p,i)=>{
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

/* ── Wildflowers — vibrant, everywhere ── */
function addFlowers(scene) {
  const colors=["#f5a0c0","#f7e663","#c4a0f5","#ff9e7a","#a0d8f0","#ffb6d9","#ff7eb3","#88e0a8"];
  const sGeo=new THREE.CylinderGeometry(.015,.018,.35,4), bGeo=new THREE.SphereGeometry(.06,6,6), sMat=toonMat("#3a8e38");
  [
    // Village area
    [-6,-39],[2,-40],[-10,-41],[8,-42],[14,-40],[-14,-42],[-2,-43],[10,-44],[-8,-45],[4,-43],
    [10,-34],[8,-32.5],[-8,-31.5],[-10,-30],[3,-35],[-5,-36],[12,-36],[-12,-35],
    // Lake perimeter — scattered wildflowers
    [6,32],[8,34],[-4,33],[-8,31],[14,30],[-12,32],[2,36],[16,28],[-16,29],
    [28,8],[30,-2],[-28,10],[-30,-4],[32,14],[-32,12],[34,-8],[-34,-10],
    // Extra meadow patches
    [-20,-40],[20,-41],[0,-44],[16,-44],[-16,-45],[24,-42],[-24,-43],
    [22,22],[-20,24],[18,28],[-22,26],
  ].forEach(([x,z],i)=>{
    if(inKO(x,z,.6)) return;
    const y=getWorldSurfaceHeight(x,z);
    const s=new THREE.Mesh(sGeo,sMat); s.position.set(x,y+.18,z); s.renderOrder=R_DECOR; scene.add(s);
    const b=new THREE.Mesh(bGeo,toonMat(colors[i%colors.length])); b.position.set(x,y+.37,z); b.renderOrder=R_DECOR; scene.add(b);
  });
}

/* ── Entry ── */
export async function createWorld(scene) {
  const nodes=[], obstacles=[];
  const skyMat=addSky(scene);
  const ground=createTerrain(scene);
  const {waterUniforms,causticMap}=createWater(scene);
  addInlet(scene,waterUniforms);
  const blob=makeBlobTex();

  let models=null;
  try{models=await loadModels();}catch(e){console.warn("Model load failed:",e);}

  if(models){
    placeTrees(scene,blob,models,nodes); placeRocks(scene,blob,models,nodes);
    placeWaterRocks(scene,models); placeBushes(scene,models);
    placeGrass(scene,models); placeMtnDecor(scene,models);
  }

  [[-10,-27,Math.PI],[-3.5,-27.5,Math.PI],[3.5,-27.5,Math.PI],[10,-27,Math.PI]]
    .forEach(([x,z,r])=>addLounge(scene,blob,x,z,r));

  addLilies(scene); addFlowers(scene);
  const fishing=addFishing(scene,nodes);
  const {constructionSite}=addPlaza(scene,blob,nodes,obstacles);

  return {
    ground, skyMat, waterUniforms, causticMap,
    addShadowBlob:(x,z,r,o)=>addBlob(scene,blob,x,z,r,o),
    resourceNodes:nodes, updateWorld:t=>updateFishing(fishing,t),
    constructionSite, collisionObstacles:obstacles,
    weaponModels:models?.weapons??null,
  };
}

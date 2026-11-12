import{a as Et,d as xe,e as Ee,h as Te}from"./chunk-OCJJZ4HW.js";import{a as _t,b as ct,c as Xt,d as Gt,e as we,f as ge,g as ve,h as Me,k as Pt,l as qt,m as Jt,n as Qt,o as Zt,p as te,t as ee}from"./chunk-GEUWWUAE.js";import{b as de}from"./chunk-7MXHSGKT.js";import{b as me,c as _e}from"./chunk-ZJ744S7L.js";import{c as gt}from"./chunk-OHYBWY5A.js";import*as je from"three";import{GLTFLoader as To}from"three/addons/loaders/GLTFLoader.js";import{Group as la}from"three";import*as a from"three";import{GLTFLoader as io}from"three/addons/loaders/GLTFLoader.js";import{mergeGeometries as co}from"three/addons/utils/BufferGeometryUtils.js";var oe={xMin:-634,xMax:530,zMin:-410,zMax:479};var ke={x:80,z:60},Se={name:"taiga",sand:[.7,.72,.74],grass:[.74,.76,.78],hill:[.62,.64,.68],peak:[.88,.9,.92],beachWidth:5,props:["Pine_Tree_Snow","Pine_Tree_Snow","Pine_Tree_Snow","Birch_Tree_Snow","Birch_Tree_Dead_Snow","Ice_Pine","Ice_Oak","Frost_Bush","Berry_Bush","Rock_3_A","Rock_3_C","Rock_3_E","Ice_Block","Crystal_1","Glacial_Rock"],rareProps:["Ice_Spire","Snowdrift_Cairn","Petrified_Tree","Rocks_Ore_Silver","Rocks_Ore_Moonstone"]},vt={name:"plains",sand:[.86,.77,.56],grass:[.15,.42,.14],hill:[.22,.38,.16],peak:[.48,.44,.32],beachWidth:8,props:["Toon_Oak","Toon_Oak","Toon_Willow","Birch_Tree","Autumn_Tree","Prop_Tree_Oak_1","Prop_Tree_Oak_2","Prop_Stump","Prop_Hollow_Trunk","Berry_Bush","Bush","Prop_Bush_1","Prop_Bush_2","Rock_3_A","Rock_3_C","Rock_3_E","Rock_3_G","Rock_1_A","Rock_2_A","Mossy_Rock"],rareProps:["Mossy_Log","Wildflower_Patch","Rocks_Ore_Tin","Rocks_Ore_Copper"]},ae={name:"mistwood",sand:[.66,.62,.48],grass:[.18,.48,.24],hill:[.22,.42,.2],peak:[.52,.56,.5],beachWidth:7,props:["Toon_Pine","Toon_Pine","Toon_Willow","Mushroom_Tree","Giant_Toadstool","Spore_Pod","Crystal_Bloom","Mossy_Log","Prop_Hollow_Trunk","Bush","Berry_Bush","Prop_Bush_2","Prop_Bush_3","Rock_3_A","Rock_3_C","Rock_3_E","Mossy_Rock","Spore_Rock"],rareProps:["Roots","Tree_Spiral_1","Rocks_Ore_Jade","Rocks_Ore_Opal"]},Ut={name:"savanna",sand:[.78,.7,.5],grass:[.58,.52,.26],hill:[.52,.42,.26],peak:[.58,.5,.4],beachWidth:7,props:["Cactus","Cactus_Flowers","Desert_Yucca","Toon_Willow","Prop_Stump","Prop_Branch_1","Prop_Branch_2","Bush","Prop_Bush_1","Rock_3_A","Rock_3_C","Rock_3_G","Rock_2_A","Rock_4","Sandstone_Pillar","Bone_Skull"],rareProps:["Sandstone_Arch","Rocks_Ore_Copper","Rocks_Ore_Sunstone"]},ye={name:"stone",sand:[.58,.58,.56],grass:[.38,.4,.4],hill:[.3,.32,.34],peak:[.66,.68,.7],beachWidth:4,props:["Rock_3_A","Rock_3_A","Rock_3_C","Rock_3_C","Rock_3_E","Rock_3_G","Rock_1_A","Rock_2_A","Rock_4","Prop_Cliff_Rock_1","Prop_Cliff_Rock_2","Mossy_Rock","Glacial_Rock","Prop_Stump","Prop_Hollow_Trunk","Bush","Crystal_1","Crystal_2"],rareProps:["Sandstone_Pillar","Rocks_Ore_Tin","Rocks_Ore_Copper","Rocks_Ore_Silver","Rocks_Ore_Cobalt","Rocks_Ore_Titanium","Crystal_3","Crystal_Bloom"]},Kt={name:"dirt",sand:[.66,.56,.42],grass:[.4,.3,.18],hill:[.34,.26,.18],peak:[.48,.4,.3],beachWidth:6,props:["Prop_Stump","Prop_Stump","Prop_Hollow_Trunk","Prop_Branch_1","Prop_Branch_2","Prop_Branch_3","Bush","Prop_Bush_1","Rock_3_A","Rock_3_C","Rock_1_A","Mossy_Log"],rareProps:["Roots","Rocks_Ore_Tin","Rocks_Ore_Copper","Wildflower_Patch"]},Re=[];function Ae(t,r){let n=0;for(let e=0;e<Re.length;e++){let s=Re[e],l=t-s.cx,i=r-s.cz,h=l*l+i*i,w=s.radius||200,x=h/(w*w),g=x*x,y=s.w/(1+g);n+=y*s.height}return n}var At=[{palette:Ut,cx:-110,cz:40,w:1,radius:110},{palette:Se,cx:273,cz:513,w:1,radius:220},{palette:Ut,cx:29,cz:-458,w:1,radius:160},{palette:ye,cx:290,cz:66,w:1,radius:110},{palette:vt,cx:81,cz:-164,w:1,radius:40},{palette:Ut,cx:-359,cz:594,w:1,radius:270},{palette:Kt,cx:-448,cz:60,w:1,radius:130},{palette:vt,cx:139,cz:181,w:1,radius:60},{palette:vt,cx:-96,cz:208,w:1,radius:40},{palette:vt,cx:-4,cz:216,w:1,radius:40},{palette:Ut,cx:-535,cz:297,w:1,radius:70},{palette:Kt,cx:266,cz:-169,w:1,radius:60},{palette:ae,cx:379,cz:-207,w:1,radius:90},{palette:ae,cx:-273,cz:-219,w:1,radius:130},{palette:vt,cx:-31,cz:-69,w:1,radius:40},{palette:vt,cx:58,cz:-82,w:1,radius:40},{palette:vt,cx:139,cz:57,w:1,radius:40},{palette:vt,cx:140,cz:96,w:1,radius:40},{palette:vt,cx:133,cz:-84,w:1,radius:40},{palette:vt,cx:149,cz:-39,w:1,radius:60},{palette:Kt,cx:-30,cz:-115,w:1,radius:40}],eo={taiga:Se,stone:ye,mistwood:ae,plains:vt,dirt:Kt,savanna:Ut};var oo=["taiga","stone","mistwood","plains","dirt","savanna"],jt=16,Lt={xMin:-700,xMax:700,zMin:-640,zMax:700},ne=Math.ceil((Lt.xMax-Lt.xMin)/jt),Pe=Math.ceil((Lt.zMax-Lt.zMin)/jt),ao=new Uint8Array(ne*Pe).fill(255);function Yt(t,r){return t<0||r<0||t>=ne||r>=Pe?255:ao[r*ne+t]}function no(t){if(t===255)return null;let r=oo[t];return eo[r]||null}var Oo=_e(me(3405691582,106981));var mt={name:"neutral",sand:[.55,.55,.55],grass:[.55,.55,.55],hill:[.5,.5,.5],peak:[.65,.65,.65],beachWidth:5},ro={name:"neutral",palette:mt,grass:mt.grass,sand:mt.sand,hill:mt.hill,peak:mt.peak,beachWidth:mt.beachWidth};function so(t,r){let n=(t-Lt.xMin)/jt-.5,e=(r-Lt.zMin)/jt-.5,s=Math.floor(n),l=Math.floor(e),i=s+1,h=l+1,w=Math.max(0,Math.min(1,n-s)),x=Math.max(0,Math.min(1,e-l)),g=(1-w)*(1-x),y=w*(1-x),A=(1-w)*x,c=w*x,_=[Yt(s,l),Yt(i,l),Yt(s,h),Yt(i,h)],M=[g,y,A,c],P=0,at=0,k=0,U=0,tt=0,Z=0,dt=0,Tt=0,lt=0,pt=0,nt=0,zt=0,Rt=0,Ht=0,Ft=mt,St=0;for(let Dt=0;Dt<4;Dt++){let st=no(_[Dt]);if(!st)continue;let ot=M[Dt];ot<=0||(P+=ot,at+=st.grass[0]*ot,k+=st.grass[1]*ot,U+=st.grass[2]*ot,tt+=st.sand[0]*ot,Z+=st.sand[1]*ot,dt+=st.sand[2]*ot,Tt+=st.hill[0]*ot,lt+=st.hill[1]*ot,pt+=st.hill[2]*ot,nt+=st.peak[0]*ot,zt+=st.peak[1]*ot,Rt+=st.peak[2]*ot,Ht+=st.beachWidth*ot,ot>St&&(St=ot,Ft=st))}if(P<.05)return null;let ut=1/P;return{name:Ft.name,palette:Ft,grass:[at*ut,k*ut,U*ut],sand:[tt*ut,Z*ut,dt*ut],hill:[Tt*ut,lt*ut,pt*ut],peak:[nt*ut,zt*ut,Rt*ut],beachWidth:Ht*ut}}function Ce(t,r){let n=so(t,r);if(n)return n;if(At.length===0)return ro;let e=new Array(At.length),s=0,l=0;for(let c=0;c<At.length;c++){let _=At[c],M=t-_.cx,P=r-_.cz,at=M*M+P*P,k=_.radius||250,U=at/(k*k),tt=U*U*U*U,Z=_.w/(1+tt);e[c]=Z,Z>s&&(s=Z,l=c)}if(s<.01)return{name:"neutral",palette:mt,grass:mt.grass,sand:mt.sand,hill:mt.hill,peak:mt.peak,beachWidth:mt.beachWidth};let i=At[l],h=0,w=-1;for(let c=0;c<At.length;c++)At[c].palette.name!==i.palette.name&&e[c]>h&&(h=e[c],w=c);if(w<0||h<s*.15)return{name:i.palette.name,palette:i.palette,grass:i.palette.grass,sand:i.palette.sand,hill:i.palette.hill,peak:i.palette.peak,beachWidth:i.palette.beachWidth};let x=At[w],g=s+h,y=h/g,A=(c,_)=>[c[0]*(1-y)+_[0]*y,c[1]*(1-y)+_[1]*y,c[2]*(1-y)+_[2]*y];return{name:i.palette.name,palette:i.palette,grass:A(i.palette.grass,x.palette.grass),sand:A(i.palette.sand,x.palette.sand),hill:A(i.palette.hill,x.palette.hill),peak:A(i.palette.peak,x.palette.peak),beachWidth:i.palette.beachWidth*(1-y)+x.palette.beachWidth*y}}var Wo={worldX:0,worldZ:0,bounds:oe,spawn:{x:ke.x,z:ke.z},seed:3235826430};var re=0,Be=2,Ie=2.5,Vt=3;function kt(t,r){let n=(c,_)=>{let M=(c*1597334677^_*3812015801)>>>0;return M=(M>>16^M)*73244475>>>0,M=(M>>16^M)>>>0,M/4294967295},e=Math.floor(t),s=Math.floor(r),l=t-e,i=r-s,h=l*l*(3-2*l),w=i*i*(3-2*i),x=n(e,s),g=n(e+1,s),y=n(e,s+1),A=n(e+1,s+1);return x+(g-x)*h+(y-x)*w+(x-g-y+A)*h*w}var be=(()=>{let t=[];for(let r=0;r<350;r++){let n=(r*1597334677^r*7+3812015801)>>>0,e=n/4294967295*2e3-1e3;n=(n>>16^n)*73244475>>>0;let s=n/4294967295*1600-700;n=(n>>16^n)>>>0;let l=120+n/4294967295*60;n=(n>>13^n)*668265261>>>0;let i=.1+n/4294967295*.1;t.push({x:e,z:s,r:l,amp:i})}return t})();function lo(t,r){let n=0;for(let e=0;e<be.length;e++){let s=be[e],l=t-s.x,i=r-s.z,h=l*l+i*i,w=s.r*s.r;if(h<w){let x=1-h/w;n+=s.amp*x*x}}return n}function uo(t,r){let n=t*r,e=Math.floor(n),s=n-e,l=.85,i=s<l?0:(s-l)/.15;return i=i*i*(3-2*i),(e+i)/r}var ce=(()=>{let t=document.createElement("canvas");t.width=4,t.height=1;let r=t.getContext("2d");[100,160,220,255].forEach((e,s)=>{r.fillStyle=`rgb(${e},${e},${e})`,r.fillRect(s,0,1,1)});let n=new a.CanvasTexture(t);return n.colorSpace=a.NoColorSpace,n.minFilter=n.magFilter=a.NearestFilter,n.generateMipmaps=!1,n._shared=!0,n})();function pe(t,r={}){let{flatShading:n,...e}=r;return new a.MeshToonMaterial({color:t,gradientMap:ce,...e})}var Nt={lush:{sand:[.72,.64,.42],grass:[.31,.66,.25],hill:[.25,.55,.22],peak:[.2,.45,.2]},sand:{sand:[.86,.73,.45],grass:[.78,.66,.4],hill:[.69,.58,.35],peak:[.58,.5,.32]},dirt:{sand:[.54,.43,.3],grass:[.46,.36,.25],hill:[.34,.3,.25],peak:[.27,.24,.2]},mulch:{sand:[.5,.38,.25],grass:[.4,.31,.2],hill:[.32,.25,.16],peak:[.25,.2,.14]},path:{sand:[.63,.51,.35],grass:[.56,.45,.3],hill:[.48,.38,.25],peak:[.4,.32,.22]}};function po(t,r){return Math.hypot((t+15)/13,(r+8)/8.6)<1.55?Nt.sand:Math.hypot((t+24)/11,(r-17)/9)<1.08?Nt.dirt:Math.hypot((t-23)/13,(r+12)/10)<1.12?Nt.mulch:Math.abs(t)<3.2&&r>4&&r<30?Nt.path:Nt.lush}function fo(t,r,n){return t?.instanceBiome==="pet_garden"?po(r,n):Ce(r,n)}var ho="models/terrain/",se={dockStr:"Prop_Docks_Straight.glb",dockStrSup:"Prop_Docks_Straight_Supports.glb",dockSteps:"Prop_Docks_Steps.glb",grassClump1:"Prop_Grass_Clump_1.glb",grassClump2:"Prop_Grass_Clump_2.glb",grassClump3:"Prop_Grass_Clump_3.glb",grassClump4:"Prop_Grass_Clump_4.glb",flowerDaisy:"Prop_Flower_Daisy.glb",flowerRose:"Prop_Flower_Rose.glb",flowerSunflower:"Prop_Flower_Sunflower.glb",flowerTulip:"Prop_Flower_Tulip.glb",cattail1:"Prop_Cattail_1.glb",cattail2:"Prop_Cattail_2.glb",mushroom1:"Prop_Mushroom_1.glb",mushroom2:"Prop_Mushroom_2.glb",palmTree1:"Prop_Tree_Palm_1.glb",palmTree2:"Prop_Tree_Palm_2.glb",shell1:"Prop_Shell_1.glb",shell2:"Prop_Shell_2.glb",starfish1:"Prop_Starfish_1.glb",starfish2:"Prop_Starfish_2.glb",stump:"Prop_Stump.glb",hollowTrunk:"Prop_Hollow_Trunk.glb"};async function Ko(){let t=new io,r=l=>new Promise((i,h)=>t.load(l,w=>i(w.scene),void 0,h)),n=Object.keys(se),e=await Promise.all(n.map(l=>r(ho+se[l]).catch(i=>(console.warn(`tile load fail: ${se[l]}`,i),null)))),s={};return n.forEach((l,i)=>{s[l]=e[i]}),s}var Oe=[{x:0,z:-32,r:14},{x:18,z:-35,r:10},{x:-22,z:-34,r:8}];function le(t,r,n=0){for(let e of Oe)if(Math.hypot(t-e.x,r-e.z)<=e.r+n)return!0;return!1}function ze(t,r){let n=Math.sin(t*127.1+r*311.7)*43758.5453;return n-Math.floor(n)}function We(t){let r=t|0;return()=>{r=r+1831565813|0;let n=Math.imul(r^r>>>15,1|r);return n=n+Math.imul(n^n>>>7,61|n)^n,((n^n>>>14)>>>0)/4294967296}}var Le=38,Ge=-6,ue=26,Ue=[];{let t=We(77);for(let r=0;r<120;r++){let n=-40+t()*80,e=-38+t()*72,s=Pt(n,e);if(s.dist<s.width+3||Qt(n,e)<2||le(n,e,4)||Math.hypot(n-Le,e-Ge)<ue-4)continue;let l=t()<.25;Ue.push({x:n,z:e,r:l?10+t()*12:5+t()*7,h:l?1.2+t()*1.5:.3+t()*.6})}}var He=-6,Fe=6,De=8,ie=3;function mo(t,r){let n=te(t,r),e=Pt(t,r),s=a.MathUtils.smoothstep,l=s(e.dist,e.width,e.width+6),i=s(Qt(t,r),1,5),h=1;for(let g of Oe)h=Math.min(h,s(Math.hypot(t-g.x,r-g.z),g.r,g.r+6));let w=s(Math.hypot(t-Le,r-Ge),ue-18,ue+4),x=l*i*h*w;n+=(Math.sin(t*.07+r*.05)*.5+Math.cos(t*.11-r*.06)*.35+Math.sin(t*.04+r*.13)*.25)*x;for(let g of Ue){let y=Math.hypot(t-g.x,r-g.z);if(y<g.r){let A=1-y/g.r;n+=g.h*A*A*(3-2*A)*x}}if(t>He-3&&t<Fe+3&&Math.abs(r-De)<ie+3){let g=1-s(Math.max(He-t,t-Fe,0),0,3),y=1-s(Math.abs(r-De),ie,ie+3),A=g*y;A>0&&(n=a.MathUtils.lerp(n,ct-2,A))}return n}var _o=(()=>{let e=Math.hypot(42,18,18);return[42/e,18/e,18/e]})(),xo=.8,wo=.55,go=1.18,vo=1,Mo=.8;function Ne(t){return typeof window>"u"?!!t:window._bakedSun===!1?!1:window._bakedSun===!0?!0:!!t}function Ve(t){let r=typeof window<"u"&&window._sunBake||null,n=t||_o;return{amb:r?.amb??xo,str:r?.str??wo,wr:r?.wr??go,wg:r?.wg??vo,wb:r?.wb??Mo,sx:n[0],sy:n[1],sz:n[2]}}function jo(t,r,n=!1){if(!Ne(n)||t.userData&&t.userData._sunBaked)return!1;let e=t.attributes.normal,s=t.attributes.color;if(!e||!s||!s.array)return!1;let l=Ve(r),i=s.array,h=s.count,w=i instanceof Uint8Array||i instanceof Uint8ClampedArray?255:1;for(let x=0,g=0;x<h;x++,g+=3){let y=Math.max(0,e.getX(x)*l.sx+e.getY(x)*l.sy+e.getZ(x)*l.sz),A=l.amb+l.str*y;i[g]=Math.min(w,i[g]*A*l.wr),i[g+1]=Math.min(w,i[g+1]*A*l.wg),i[g+2]=Math.min(w,i[g+2]*A*l.wb)}return s.needsUpdate=!0,t.userData=t.userData||{},t.userData._sunBaked=!0,!0}async function $o(t,r,n,e,s,l=null){let i=new a.Group;i.name="terrain";let h=performance.now(),w=async(H=!1)=>{if(typeof l!="function")return;let Q=performance.now()-h;!H&&Q<3.5||(await l(Q),h=performance.now())},x=s||4,g=e?e.xMin:(we-1)*_t,y=e?e.xMax:(ge+1)*_t,A=e?e.zMin:(ve-1)*_t,c=e?e.zMax:(Me+1)*_t,_=g,M=y,P=A,at=c,k=Math.ceil((M-_)/x)+1,U=Math.ceil((at-P)/x)+1,tt=new Float32Array(k*U*3),Z=new Uint8Array(k*U*3),dt=[],Tt=new a.Color("#4dad38"),lt=new a.Color("#F0D28A"),pt=new a.Color(.06,.18,.38),nt=new a.Color,zt=a.MathUtils.smoothstep,Rt=e&&e.localOffsetX||0,Ht=e&&e.localOffsetZ||0,Ft=Array.isArray(e?.caveHoles)?e.caveHoles:[],St=e?.instanceBiome==="pet_garden",ut=!!(e&&e.isInstance),Dt=!!(e&&e._chunkData&&e._chunkData.procgen),st=Ft.length?(H,Q,N,E,z,j)=>{for(let B of Ft){let I=B.r||2.2,W=I*I,$=(H+N+z)/3-B.x,ft=(Q+E+j)/3-B.z;if($*$+ft*ft<W)return!0;let ht=I*.72,T=ht*ht,V=H-B.x,o=Q-B.z,u=N-B.x,p=E-B.z,f=z-B.x,v=j-B.z;if(V*V+o*o<T||u*u+p*p<T||f*f+v*v<T)return!0}return!1}:null,ot=1/0;for(let H=0;H<U;H++){for(let Q=0;Q<k;Q++){let N=_+Q*x,E=P+H*x,z=N-Rt,j=E-Ht,B=N<g||N>y||E<A||E>c,I=Xt;if(r){let R=`${z},${j}`;!(R in r)&&B&&(z=Math.max(g,Math.min(y,N))-Rt,j=Math.max(A,Math.min(c,E))-Ht,R=`${z},${j}`),R in r&&(I+=r[R])}!Dt&&!ut&&(I+=Ae(N,E)),!B&&I<ot&&(ot=I);let W=(H*k+Q)*3,$=Q===0||Q===k-1,ft=H===0||H===U-1,ht=e&&e.isInstance,T=e&&e._chunkData&&e._chunkData.procgen,V=$||ft||ht||T?0:(ze(N,E)-.5)*(x*.03);tt[W]=N+V,tt[W+1]=I,tt[W+2]=E+V*.7;let o=fo(e,N,E),u=o.sand,p=o.grass,f=o.hill,v=o.peak,d=.06,m=.18,D=.38,S=nt,F,G,C,q=.6;if(I<ct-q)F=d,G=m,C=D;else if(I<ct){let R=(ct-I)/q,b=R*R*(3-2*R);F=p[0]*(1-b)+d*b,G=p[1]*(1-b)+m*b,C=p[2]*(1-b)+D*b}else if(I<Gt)F=p[0],G=p[1],C=p[2];else if(I<Gt+1.5){let R=(I-Gt)/1.5;F=p[0]*(1-R)+f[0]*R,G=p[1]*(1-R)+f[1]*R,C=p[2]*(1-R)+f[2]*R}else{let R=Math.min(1,(I-Gt-1.5)/2);F=f[0]*(1-R)+v[0]*R,G=f[1]*(1-R)+v[1]*R,C=f[2]*(1-R)+v[2]*R}if(I>=ct){let R=kt(N*.09+31.7,E*.09+17.3)-.5,b=kt(N*.025+81.4,E*.025+53.7)-.5,K=kt(N*.012+121.1,E*.012+199.5)-.5,et=St?R*.15+b*.08+K*.09:R*.09+b*.05+K*.06;if(F+=et,G+=et,C+=et,St){let L=Math.max(-.035,Math.min(.13,(I-Xt)*.034)),X=(ze(N*1.73+19.7,E*1.73+41.9)-.5)*.042;F+=L*.55+X*.72,G+=L*.8+X*.62,C+=L*.38+X*.42}}S.setRGB(Math.max(0,Math.min(1,F)),Math.max(0,Math.min(1,G)),Math.max(0,Math.min(1,C)));let Y=!!(ut&&e.water===!1);if(n&&(Y||I>=ct-q)){let R=`${z},${j}`;if(R in n){let b=n[R];nt.setRGB(b[0],b[1],b[2]),S=nt}else if(!B&&n._default){let b=n._default;nt.setRGB(b[0],b[1],b[2]),S=nt}}if(Z[W]=S.r*255+.5|0,Z[W+1]=S.g*255+.5|0,Z[W+2]=S.b*255+.5|0,Q<k-1&&H<U-1){let R=H*k+Q,b=R+1,K=R+k,et=K+1,L=_+Q*x,X=P+H*x,O=_+(Q+1)*x,J=P+(H+1)*x;(!st||!st(L,X,L,J,O,X))&&dt.push(R,K,b),(!st||!st(O,X,L,J,O,J))&&dt.push(b,K,et)}}(H&3)===3&&await w()}let Je=!0,Qe=e&&e._chunkData&&e._chunkData.procgen;if(Je){let H=new a.BufferGeometry;H.setAttribute("position",new a.BufferAttribute(tt,3)),H.setAttribute("color",new a.BufferAttribute(Z,3,!0)),H.setIndex(dt),H=H.toNonIndexed(),await w(!0);{let E=H.attributes.color.array,z=H.attributes.position.array,j=!Qe&&!St,B=Ne(!0)?Ve():null,I=Array.isArray(e?.caveSpots)?e.caveSpots:[],W=(o,u,p,f=0)=>{let v=o.rot||-.55,d=u-o.x,m=p-o.z,D=Math.cos(-v),S=Math.sin(-v),F=d*D-m*S,G=d*S+m*D,C=o.len||Math.max(5.5,(o.r||7)*.86),q=Math.abs(F)/Math.max(.001,C),Y=Math.abs(F)/Math.max(.001,C+f*1.2);if(Y>1)return null;let R=Math.sin(F*.78+.91)*.42+Math.sin(F*1.72+2.3)*.16,K=(o.width||1.06)*(.62+Math.max(0,1-Math.min(q,1))*.78)+f,et=Math.abs(G-R)/Math.max(.18,K);if(et>1)return null;let L=1-Math.max(0,(q-.74)/.26);return{core:Math.max(0,1-et)*Math.max(0,Math.min(1,L)),edge:et,along:Y}},$=(o,u,p,f=0)=>{let v=o.rot||0,d=u-o.x,m=p-o.z,D=Math.cos(-v),S=Math.sin(-v),F=d*D-m*S,G=d*S+m*D,C=o.r||3.5,q=C*1.18+f,Y=C*.72+f*.72,R=Math.hypot(F/Math.max(.001,q),(G+C*.12)/Math.max(.001,Y));return R>1?null:{core:Math.max(0,1-R),edge:R,lx:F,lz:G}},ft=(o,u,p,f=.35)=>{if(o.shape==="crack")return!!W(o,u,p,f);if(o.shape==="afk_burrow")return!!$(o,u,p,f);let v=u-o.x,d=p-o.z;return v*v+d*d<o.r*o.r},ht=(o,u,p,f,v,d,m,D,S)=>{if(o.shape==="afk_burrow"){let Y=[[u,p],[f,v],[d,m],[D,S],[(f+d)*.5,(v+m)*.5],[(d+D)*.5,(m+S)*.5],[(D+f)*.5,(S+v)*.5]],R=null;for(let b of Y){let K=$(o,b[0],b[1],.42);K&&(!R||K.core>R.burrow.core)&&(R={wx:b[0],wz:b[1],pad:.42,burrow:K})}return R}if(o.shape!=="crack")return ft(o,u,p)?{wx:u,wz:p,pad:.35}:null;let F=.72,G=[[u,p],[f,v],[d,m],[D,S],[(f+d)*.5,(v+m)*.5],[(d+D)*.5,(m+S)*.5],[(D+f)*.5,(S+v)*.5]],C=null;for(let q of G){let Y=W(o,q[0],q[1],F);Y&&(!C||Y.core>C.crack.core)&&(C={wx:q[0],wz:q[1],pad:F,crack:Y})}return C},T=(o,u,p,f,v,d,m,D)=>{let S=(v-p)*(u-f)-(d-f)*(o-p),F=(m-v)*(u-d)-(D-d)*(o-v),G=(p-m)*(u-D)-(f-D)*(o-m),C=1e-5,q=S<-C||F<-C||G<-C,Y=S>C||F>C||G>C;return!(q&&Y)},V=(o,u,p=.35)=>{for(let f of I){let v=f.shape==="crack"?W(f,o,u,p):null;if(f.shape==="crack"){if(!v)continue;let F=Math.max(0,1-Math.abs(v.edge-.64)/.36)*(1-Math.min(1,v.along)*.25)*(1-v.core*.72);return[.006+F*.15,.001+F*.005,.001+F*.004]}let d=f.shape==="afk_burrow"?$(f,o,u,p):null;if(f.shape==="afk_burrow"){if(!d)continue;let F=Array.isArray(f.holeColor)?f.holeColor:[.012,.004,.052],G=Array.isArray(f.rimColor)?f.rimColor:[.035,.105,.165],C=Math.pow(Math.max(0,Math.min(1,d.edge)),1.55);return[F[0]*(1-C)+G[0]*C,F[1]*(1-C)+G[1]*C,F[2]*(1-C)+G[2]*C]}let m=o-f.x,D=u-f.z;if(!(Math.hypot(m,D)>f.r))return[0,0,0]}return null};for(let o=0;o<E.length;o+=9){let u=(E[o]+E[o+3]+E[o+6])/3,p=(E[o+1]+E[o+4]+E[o+7])/3,f=(E[o+2]+E[o+5]+E[o+8])/3,v=(z[o]+z[o+3]+z[o+6])/3,d=(z[o+1]+z[o+4]+z[o+7])/3,m=(z[o+2]+z[o+5]+z[o+8])/3,D=z[o],S=z[o+2],F=z[o+1],G=z[o+3],C=z[o+4],q=z[o+5],Y=z[o+6],R=z[o+7],b=z[o+8],K=d<ct-.5;if(!K){let O=Math.sin(v*12.9898+m*78.233)*43758.5453,rt=(O-Math.floor(O)-.5)*(St?7.5:.025);u+=rt,p+=rt,f+=rt}if(St&&!K){let O=(kt(v*.18+14.1,m*.18+27.6)-.5)*10+(kt(v*.47+68.4,m*.47+3.9)-.5)*4.5,J=Math.max(-8,Math.min(16,(d-Xt)*5.5));u+=O*.85+J*.62,p+=O*.72+J*.92,f+=O*.5+J*.46}if(j&&!K){let O=lo(-v,-m),J=.81-Math.min(O,.49),it=uo(Math.max(0,Math.min(1,J)),14),rt=(kt(-v*.018+7.31,-m*.018+13.77)*.45+kt(-v*.045+53.17,-m*.045+97.43)*.28+kt(-v*.1+107.89,-m*.1+151.61)*.16+kt(-v*.22+199.33,-m*.22+263.07)*.11)*.76-.38,xt=.35+.65*Math.max(0,Math.min(1,it)),wt=1-.85+.85*xt,Mt=rt*.08;u=u*wt+Mt,p=p*wt+Mt,f=f*wt+Mt}let et=Math.min(255,Math.max(0,u)),L=Math.min(255,Math.max(0,p)),X=Math.min(255,Math.max(0,f));if(I.length)for(let O=0;O<I.length;O++){let J=I[O];J.isOwn&&(J.shape||"hole")==="hole"&&J._anchorFaceIdx==null&&T(J.x,J.z,D,S,G,q,Y,b)&&(J._anchorFaceIdx=o);let it=ht(J,v,m,D,S,G,q,Y,b);if(it){let rt=V(it.wx,it.wz,it.pad);rt&&(et=rt[0]*255,L=rt[1]*255,X=rt[2]*255),J._faceIdx||(J._faceIdx=[]),J._faceIdx.push(o);break}}if(B){let O=G-D,J=C-F,it=q-S,rt=Y-D,xt=R-F,wt=b-S,Mt=J*wt-it*xt,Bt=it*rt-O*wt,It=O*xt-J*rt,Ot=1/Math.max(1e-6,Math.hypot(Mt,Bt,It));Mt*=Ot,Bt*=Ot,It*=Ot;let yt=Math.max(0,Mt*B.sx+Bt*B.sy+It*B.sz),Wt=B.amb+B.str*yt;et=Math.min(255,et*Wt*B.wr),L=Math.min(255,L*Wt*B.wg),X=Math.min(255,X*Wt*B.wb)}E[o]=E[o+3]=E[o+6]=et,E[o+1]=E[o+4]=E[o+7]=L,E[o+2]=E[o+5]=E[o+8]=X,o%720===0&&o>0&&await w()}for(let o of I){if((!o._faceIdx||!o._faceIdx.length)&&o.isOwn&&(o.shape||"hole")==="hole"&&Number.isInteger(o._anchorFaceIdx)){let u=o._anchorFaceIdx;for(let p=0;p<9;p++)E[u+p]=0;o._faceIdx=[u]}o._anchorFaceIdx=null}H.attributes.color.needsUpdate=!0,B&&(H.userData=H.userData||{},H.userData._sunBaked=!0);for(let o of I){if(!o._faceIdx||!o._faceIdx.length)continue;let u=H.attributes.position.array,p=new Float32Array(o._faceIdx.length*9);for(let m=0;m<o._faceIdx.length;m++){let D=o._faceIdx[m];for(let S=0;S<3;S++)p[m*9+S*3]=u[D+S*3]-o.x,p[m*9+S*3+1]=u[D+S*3+1],p[m*9+S*3+2]=u[D+S*3+2]-o.z}let f=new a.BufferGeometry;f.setAttribute("position",new a.BufferAttribute(p,3)),f.computeBoundingSphere();let v=new a.MeshBasicMaterial({transparent:!0,opacity:0,depthTest:!1,depthWrite:!1,colorWrite:!1}),d=new a.Mesh(f,v);d.position.set(o.x,0,o.z),d.name=`cave_click_${o.seed}`,d.userData.serviceType=o.serviceType||"cave",d.userData.caveSeed=o.seed,d.userData.resourceLabel=o.label||"Cave Entrance",o.afkBossCaveId&&(d.userData.afkBossCaveId=o.afkBossCaveId),Number.isFinite(o.afkBossCaveIndex)&&(d.userData.afkBossCaveIndex=o.afkBossCaveIndex),d.userData._caveClickMesh=!0,o.shape==="crack"&&(d.userData._caveCrackClickMesh=!0),d.renderOrder=re+5,i.add(d),o._faceIdx=null}}H.computeVertexNormals(),H.computeBoundingBox(),H.computeBoundingSphere(),await w(!0);let Q=new a.MeshToonMaterial({vertexColors:!0,gradientMap:ce}),N=new a.Mesh(H,Q);N.renderOrder=re,i.add(N),e._osrsBuilt=!0}if(!(e&&e._osrsBuilt)){let N=Math.ceil((M-_)/1)+1,E=Math.ceil((at-P)/1)+1,z=N+4,j=E+4,B=new Uint8Array(z*j*4);for(let T=0;T<j;T++)for(let V=0;V<z;V++){let o=_+(V-2)*1,u=P+(T-2)*1,p=(T*z+V)*4,f=o-Rt,v=u-Ht,d,m,D,S=`${f},${v}`;if(n&&n[S]){let F=n[S];d=F[0],m=F[1],D=F[2]}else{let F=(o-_)/x,G=(u-P)/x,C=Math.max(0,Math.min(Math.floor(F),k-2)),q=Math.max(0,Math.min(Math.floor(G),U-2)),Y=Math.min(C+1,k-1),R=Math.min(q+1,U-1),b=Math.max(0,Math.min(1,F-C)),K=Math.max(0,Math.min(1,G-q)),et=(q*k+C)*3,L=(q*k+Y)*3,X=(R*k+C)*3,O=(R*k+Y)*3;d=Z[et]*(1-b)*(1-K)+Z[L]*b*(1-K)+Z[X]*(1-b)*K+Z[O]*b*K,m=Z[et+1]*(1-b)*(1-K)+Z[L+1]*b*(1-K)+Z[X+1]*(1-b)*K+Z[O+1]*b*K,D=Z[et+2]*(1-b)*(1-K)+Z[L+2]*b*(1-K)+Z[X+2]*(1-b)*K+Z[O+2]*b*K}B[p]=Math.min(255,Math.max(0,d+.5)),B[p+1]=Math.min(255,Math.max(0,m+.5)),B[p+2]=Math.min(255,Math.max(0,D+.5)),B[p+3]=255}let I=new a.DataTexture(B,z,j,a.RGBAFormat);I.magFilter=a.LinearFilter,I.minFilter=a.LinearFilter,I.wrapS=a.ClampToEdgeWrapping,I.wrapT=a.ClampToEdgeWrapping,I.colorSpace=a.LinearSRGBColorSpace,I.needsUpdate=!0;let W=new Float32Array(k*U*2);for(let T=0;T<U;T++)for(let V=0;V<k;V++){let o=(T*k+V)*2,u=V*x/1+2,p=T*x/1+2;W[o]=(u+.5)/z,W[o+1]=(p+.5)/j}let $=new a.BufferGeometry;$.setAttribute("position",new a.BufferAttribute(tt,3)),$.setAttribute("uv",new a.BufferAttribute(W,2)),$.setIndex(dt),$.computeVertexNormals();{let T=$.attributes.normal.array,V=e&&e._chunkData&&e._chunkData.procgen;for(let o=0;o<U;o++)for(let u=0;u<k;u++)if(u===0||u===k-1||o===0||o===U-1){let p=(o*k+u)*3;T[p]=0,T[p+1]=1,T[p+2]=0}else if(V){let p=(o*k+u)*3;T[p]=0,T[p+1]=1,T[p+2]=0}$.attributes.normal.needsUpdate=!0}$.computeBoundingBox(),$.computeBoundingSphere();let ft=new a.MeshToonMaterial({map:I,gradientMap:ce}),ht=new a.Mesh($,ft);ht.renderOrder=re,i.add(ht)}if(!e||!e.isInstance||e.water===!0){let H=y-g,Q=c-A,N=y-g+1,E=c-A+1,z=8,j=N+z*2,B=E+z*2,I=ot<1/0&&ot>=ct+.1,W;if(!I){if(e&&e._chunkData&&e._chunkData.waterAlpha){let L=e._chunkData.waterAlpha,X=Uint8Array.from(atob(L),O=>O.charCodeAt(0));W=new a.DataTexture(X,j,B,a.RGBAFormat)}else{let L=new Uint8Array(N*E*4);for(let X=0;X<N*E;X++)L[X*4]=107,L[X*4+1]=189,L[X*4+2]=235,L[X*4+3]=112;W=new a.DataTexture(L,N,E,a.RGBAFormat)}W.magFilter=a.LinearFilter,W.minFilter=a.LinearFilter,W.wrapS=a.ClampToEdgeWrapping,W.wrapT=a.ClampToEdgeWrapping,W.needsUpdate=!0;let $=window._shoreCue||{},ft=Array.isArray($.col)&&$.col.length===3?$.col:[.12,.4,.6],ht=typeof $.alpha=="number"?$.alpha:.95,T=Array.isArray($.band)&&$.band.length===2?$.band:[.6,2.5],V=new Uint8Array(k*U*4);for(let L=0,X=k*U;L<X;L++){let O=(ct-tt[L*3+1])*42.5;V[L*4]=O<=0?0:O>=255?255:O|0,V[L*4+3]=255}let o=new a.DataTexture(V,k,U,a.RGBAFormat);o.magFilter=a.LinearFilter,o.minFilter=a.LinearFilter,o.wrapS=a.ClampToEdgeWrapping,o.wrapT=a.ClampToEdgeWrapping,o.needsUpdate=!0;let u=null,p=window._waterShrinkStats||(window._waterShrinkStats={planes:0,baked:0,rects:0});p.planes++;let f=window._waterShrinkOff!==!0&&e&&e._chunkData&&Array.isArray(e._chunkData.waterRects)&&e._chunkData.waterRects.length&&e._chunkData.waterRects.length<=256?e._chunkData.waterRects:null;if(f){let L=(g+y)/2,X=(A+c)/2,O=new Float32Array(f.length*12),J=new Float32Array(f.length*8),it=new Uint16Array(f.length*6),rt=0,xt=0;for(let wt of f){let Mt=g+wt[0],Bt=A+wt[1],It=g+wt[2],Ot=A+wt[3],yt=rt;for(let[Wt,he]of[[Mt,Bt],[It,Bt],[Mt,Ot],[It,Ot]])O[rt*3]=Wt-L,O[rt*3+1]=0,O[rt*3+2]=he-X,J[rt*2]=(Wt-g)/H,J[rt*2+1]=(c-he)/Q,rt++;it[xt++]=yt,it[xt++]=yt+2,it[xt++]=yt+3,it[xt++]=yt,it[xt++]=yt+3,it[xt++]=yt+1}u=new a.BufferGeometry,u.setAttribute("position",new a.BufferAttribute(O,3)),u.setAttribute("uv",new a.BufferAttribute(J,2)),u.setIndex(new a.BufferAttribute(it,1)),u.computeBoundingSphere(),p.baked++,p.rects+=f.length}u||(u=new a.PlaneGeometry(H,Q,8,8),u.rotateX(-Math.PI/2));let v=(z+.5)/j,d=(z+.5)/B,m=(z+N-.5)/j,D=(z+E-.5)/B,S=!!(e&&e._chunkData&&e._chunkData.procgen),F=`
      float tierTint(vec2 worldXZ) {
        float dist = length(worldXZ);
        if (dist > 5704.0)      return 0.55;
        else if (dist > 3630.0) return 0.70;
        else if (dist > 1556.0) return 0.85;
        return 1.0;
      }
    `,G=(Array.isArray(e?.caveSpots)?e.caveSpots:[]).filter(L=>L&&L.shape==="crack").slice(0,4),C=Array.from({length:4},(L,X)=>{let O=G[X];return new a.Vector4(O?.x||0,O?.z||0,O?.len||Math.max(5.5,(O?.r||7)*.86),O?.width||1.06)}),q=Array.from({length:4},(L,X)=>G[X]?.rot||-.55),Y=`
      uniform int uCrackCount;
      uniform vec4 uCracks[4];
      uniform float uCrackRot[4];
      bool inCrackWaterMask(vec2 worldXZ) {
        for (int i = 0; i < 4; i++) {
          if (i >= uCrackCount) break;
          vec4 c = uCracks[i];
          float rot = uCrackRot[i];
          vec2 d = worldXZ - c.xy;
          float ca = cos(-rot);
          float sa = sin(-rot);
          float lx = d.x * ca - d.y * sa;
          float lz = d.x * sa + d.y * ca;
          float halfLen = max(0.001, c.z);
          float alongRaw = abs(lx) / halfLen;
          if (alongRaw > 1.03) continue;
          float wiggle = sin(lx * 0.78 + 0.91) * 0.42
                       + sin(lx * 1.72 + 2.30) * 0.16;
          float width = c.w * (0.62 + max(0.0, 1.0 - min(alongRaw, 1.0)) * 0.78) + 0.95;
          float endFade = 1.0 - max(0.0, (alongRaw - 0.80) / 0.23);
          if (endFade > 0.0 && abs(lz - wiggle) <= width) return true;
        }
        return false;
      }
    `,R=S?`
        uniform sampler2D uTex;
        uniform float uTime;
        uniform float uDim;
        uniform float uFancyFx;
        uniform float uShape; uniform vec2 uCenter; uniform float uRadius; /* CHUNKSTREAM carve */
        uniform vec2 uUvMin;
        uniform vec2 uUvMax;
        uniform sampler2D uDepth; uniform vec2 uDepthUvMin; uniform vec2 uDepthUvMax; /* SHORECUE: baked vertical seabed depth (R = depth/6u) */
        uniform vec3 uShallowCol; uniform float uShoreAlpha; uniform vec2 uShoreBand; uniform float uShoreOn;
        varying vec2 vUv;
        varying float vWave;
        varying vec3 vWorldPos;
        uniform float uFxNear; uniform float uFxFar; /* PERF: foam/sparkle distance LOD */
        ${Y}
        #include <fog_pars_fragment>
        void main() {
          if (inCrackWaterMask(vWorldPos.xz)) discard;
          if (uShape > 0.5) { vec2 _e = abs(vWorldPos.xz - uCenter); float _d = (uShape < 1.5) ? length(vWorldPos.xz - uCenter) : max(_e.x, _e.y); if (_d > uRadius) discard; } /* CHUNKSTREAM: skybox past the edge */
          vec2 uv = mix(uUvMin, uUvMax, vUv);
          vec4 c = texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
          /* Procgen alpha texture encodes signed distance in the alpha
             channel: sd = (a*255 - 128) / 20, positive = water side.
             No edge offset \u2014 water follows the polygon exactly so
             noise-perturbed lake crevices stay visible. */
          float sd = (c.a * 255.0 - 128.0) / 20.0;
          float aaW = max(fwidth(sd), 1e-4);
          float edge = smoothstep(-aaW, aaW, sd);
          if (edge < 0.005) discard;

          /* SHORECUE: angle-stable depth read. The shallow\u2192deep look used to
             be the seabed seen through a fixed 0.62 film \u2014 pure parallax, so
             it slid against the foam line as camera height changed
             (offset \u2248 depth/tan(elevation)). Paint the ramp into the SURFACE
             from true vertical seabed depth instead; converges to exactly
             (deep, 0.62) past uShoreBand.y so the deep two-tone and the
             global-ocean seam are untouched. */
          vec2 duv = mix(uDepthUvMin, uDepthUvMax, vUv);
          float wdep = texture2D(uDepth, vec2(duv.x, 1.0 - duv.y)).r * 6.0;
          float shoreT = mix(1.0, smoothstep(uShoreBand.x, uShoreBand.y, wdep), uShoreOn);
          float shoreA = mix(uShoreAlpha, 0.62, shoreT);

          /* Potato mode early-out \u2014 flat color, no trig. */
          if (uFancyFx < 0.5) {
            vec3 flatCol = mix(uShallowCol, vec3(0.18, 0.52, 0.72), shoreT);
            float flatA = edge * shoreA;
            gl_FragColor = vec4(flatCol * flatA * uDim, flatA);
            #include <fog_fragment>
            return;
          }

          /* Lake mask in R channel (set by procgen bake when fragment is
             inland depthSD > shoreSD). Lakes get calmer surface \u2014 less
             shimmer, less foam, fewer sparkles, slower animation. */
          float isLake = c.r;
          float liveMul = mix(1.0, 0.35, isLake);    /* foam/sparkle intensity */
          float speedMul = mix(1.0, 0.45, isLake);   /* animation speed */

          /* \u2500\u2500 Our base: UV-warped multi-scale ripple shimmer \u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
          vec2 rUV = vWorldPos.xz * 0.20;
          vec2 warp = vec2(
            sin(rUV.x * 0.21 + uTime * 0.31) * 0.6,
            cos(rUV.y * 0.18 - uTime * 0.27) * 0.6
          );
          vec2 wUV = rUV + warp;
          float s1 = sin(dot(wUV, vec2( 0.71,  0.71)) * 0.42 + uTime * 0.55);
          float s2 = sin(dot(wUV, vec2(-0.55,  0.84)) * 0.31 - uTime * 0.42) * 0.85;
          float m1 = sin(dot(wUV, vec2( 0.92, -0.39)) * 1.05 + uTime * 1.10) * 0.45;
          float f1 = sin(dot(wUV, vec2(-0.88, -0.47)) * 3.10 - uTime * 2.20) * 0.18;
          float f2 = sin(dot(wUV, vec2( 0.39,  0.92)) * 4.50 + uTime * 2.80) * 0.12;
          float ripple = (s1 + s2 + m1 + f1 + f2) * 0.32 * uFancyFx;
          vec3 deep = vec3(0.18, 0.52, 0.72);
          /* Reduce shimmer amplitude for lakes (less surface activity). */
          float shimmer = 1.0 + ripple * mix(0.06, 0.025, isLake);
          vec3 col = mix(uShallowCol, deep, shoreT) * shimmer; /* SHORECUE */
          vec3 foamCol = vec3(0.700, 1.000, 1.000);
          vec3 wp = vWorldPos;
          float tt = uTime * speedMul;  /* lake-slowed time */

          /* Sparse foam crests \u2014 speed dampened on lakes via tt. PERF LOD: skip
             foam + sparkle past uFxFar and fade across [uFxNear, uFxFar] by viewer
             distance (same coverage-relative cut as the global ocean). */
          float _fxLod = 1.0 - smoothstep(uFxNear, uFxFar, length(wp.xz - cameraPosition.xz));
          if (_fxLod > 0.003) {
          float w1 = sin(wp.x * 0.43 + wp.z * 0.11 + tt * 1.8) * 0.5 + 0.5;
          float w2 = sin(wp.z * 0.37 + wp.x * 0.07 - tt * 1.4) * 0.5 + 0.5;
          float w3 = sin(wp.x * 0.31 + wp.z * 0.47 + tt * 1.1) * 0.5 + 0.5;
          float w4 = sin(wp.x * 0.17 + wp.z * 0.29 + tt * 0.8) * 0.5 + 0.5;
          float w5 = sin(wp.z * 0.41 + wp.x * 0.33 + tt * 0.9) * 0.5 + 0.5;
          float w6 = sin(wp.x * 0.67 - wp.z * 0.43 - tt * 0.5) * 0.5 + 0.5;
          float foam = w1 * w2 * w3 + w4 * w5 * w6 * 0.4;
          foam = 1.0 - smoothstep(0.002, 0.012, foam);
          col += foamCol * foam * 0.22 * liveMul * uFancyFx * _fxLod;

          float sp1 = sin(wp.x * 0.40 + wp.z * 0.09 + tt * 1.7);
          float sp2 = sin(wp.z * 0.35 + wp.x * 0.13 - tt * 1.4);
          float sp3 = sin(wp.x * 0.27 - wp.z * 0.17 + tt * 2.0);
          float sp4 = sin(wp.x * 0.71 - wp.z * 0.47 + tt * 0.95);
          float sparkleMask = sin(wp.x * 0.031 + wp.z * 0.047 + tt * 0.12)
                            * sin(wp.z * 0.053 - wp.x * 0.029 - tt * 0.09);
          sparkleMask = smoothstep(0.15, 0.55, sparkleMask);
          float sparkle = sp1 * sp2 * sp3 * sp4;
          sparkle = smoothstep(0.7, 0.97, sparkle) * sparkleMask;
          col += vec3(1.0) * sparkle * 0.22 * liveMul * uFancyFx * _fxLod;
          }

          float alpha = edge * shoreA; /* SHORECUE */
          gl_FragColor = vec4(col * alpha * uDim, alpha);
          #include <fog_fragment>
        }
      `:`
        uniform sampler2D uTex;
        uniform float uTime;
        uniform float uDim;
        uniform float uFancyFx;
        uniform float uShape; uniform vec2 uCenter; uniform float uRadius; /* CHUNKSTREAM carve */
        uniform vec2 uUvMin;
        uniform vec2 uUvMax;
        uniform sampler2D uDepth; uniform vec2 uDepthUvMin; uniform vec2 uDepthUvMax; /* SHORECUE: baked vertical seabed depth (R = depth/6u) */
        uniform vec3 uShallowCol; uniform float uShoreAlpha; uniform vec2 uShoreBand; uniform float uShoreOn;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        uniform float uFxNear; uniform float uFxFar; /* PERF: foam/sparkle distance LOD */
        ${Y}
        #include <fog_pars_fragment>
        void main() {
          if (inCrackWaterMask(vWorldPos.xz)) discard;
          if (uShape > 0.5) { vec2 _e = abs(vWorldPos.xz - uCenter); float _d = (uShape < 1.5) ? length(vWorldPos.xz - uCenter) : max(_e.x, _e.y); if (_d > uRadius) discard; } /* CHUNKSTREAM: skybox past the edge */
          vec2 uv = mix(uUvMin, uUvMax, vUv);
          vec4 c = texture2D(uTex, vec2(uv.x, 1.0 - uv.y));
          float rawA = c.a;
          if (rawA < 0.04) discard;

          /* SHORECUE: see the procgen fragment \u2014 angle-stable surface-owned
             depth ramp from the baked vertical seabed depth. */
          vec2 duv = mix(uDepthUvMin, uDepthUvMax, vUv);
          float wdep = texture2D(uDepth, vec2(duv.x, 1.0 - duv.y)).r * 6.0;
          float shoreT = mix(1.0, smoothstep(uShoreBand.x, uShoreBand.y, wdep), uShoreOn);
          float shoreA = mix(uShoreAlpha, 0.62, shoreT);

          /* Potato mode early-out \u2014 flat color, no trig. */
          if (uFancyFx < 0.5) {
            vec3 flatCol = mix(uShallowCol, vec3(0.18, 0.52, 0.72), shoreT);
            float flatA = smoothstep(0.04, 0.12, rawA) * shoreA;
            gl_FragColor = vec4(flatCol * flatA * uDim, flatA);
            #include <fog_fragment>
            return;
          }

          /* Wobble used ONLY for the alpha smoothstep (masks the texel
             grid staircase at shorelines). Inlandness uses RAW alpha
             so deep-ocean dampening doesn't flicker as the wobble
             crosses the threshold \u2014 that flicker was the source of
             the speed/brightness seam vs global ocean. */
          float wob = sin(vWorldPos.x * 0.42 + uTime * 0.83)
                    * cos(vWorldPos.z * 0.39 + uTime * 0.71) * 0.04;
          float a = clamp(rawA + wob, 0.0, 1.0);
          /* Mainland inland-water heuristic \u2014 within mainland rectangle
             AND raw alpha is low/mid (rivers/lakes only). Steady, no
             wobble, no flicker. */
          float inMainland = step(-950.0, vWorldPos.x) * step(vWorldPos.x, 850.0)
                           * step(-646.0, vWorldPos.z) * step(vWorldPos.z, 654.0);
          float inlandness = 1.0 - smoothstep(0.40, 0.85, rawA);
          float isInland = inMainland * inlandness;
          float liveMul = mix(1.0, 0.25, isInland);   /* stronger dampen */
          float speedMul = mix(1.0, 0.35, isInland);  /* slower */

          /* Our base ripple shimmer + foam crests + sparkles overlay. */
          vec2 rUV = vWorldPos.xz * 0.20;
          vec2 warp = vec2(
            sin(rUV.x * 0.21 + uTime * 0.31) * 0.6,
            cos(rUV.y * 0.18 - uTime * 0.27) * 0.6
          );
          vec2 wUV = rUV + warp;
          float s1 = sin(dot(wUV, vec2( 0.71,  0.71)) * 0.42 + uTime * 0.55);
          float s2 = sin(dot(wUV, vec2(-0.55,  0.84)) * 0.31 - uTime * 0.42) * 0.85;
          float m1 = sin(dot(wUV, vec2( 0.92, -0.39)) * 1.05 + uTime * 1.10) * 0.45;
          float f1 = sin(dot(wUV, vec2(-0.88, -0.47)) * 3.10 - uTime * 2.20) * 0.18;
          float f2 = sin(dot(wUV, vec2( 0.39,  0.92)) * 4.50 + uTime * 2.80) * 0.12;
          float ripple = (s1 + s2 + m1 + f1 + f2) * 0.32 * uFancyFx;
          vec3 deep = vec3(0.18, 0.52, 0.72);
          float shimmer = 1.0 + ripple * mix(0.06, 0.025, isInland);
          vec3 col = mix(uShallowCol, deep, shoreT) * shimmer; /* SHORECUE */
          vec3 foamCol = vec3(0.700, 1.000, 1.000);
          vec3 wp = vWorldPos;
          float tt = uTime * speedMul;

          /* PERF LOD: skip foam + sparkle past uFxFar, fade across [uFxNear, uFxFar]
             by viewer distance (same coverage-relative cut as the global ocean). */
          float _fxLod = 1.0 - smoothstep(uFxNear, uFxFar, length(wp.xz - cameraPosition.xz));
          if (_fxLod > 0.003) {
          float w1 = sin(wp.x * 0.43 + wp.z * 0.11 + tt * 1.8) * 0.5 + 0.5;
          float w2 = sin(wp.z * 0.37 + wp.x * 0.07 - tt * 1.4) * 0.5 + 0.5;
          float w3 = sin(wp.x * 0.31 + wp.z * 0.47 + tt * 1.1) * 0.5 + 0.5;
          float w4 = sin(wp.x * 0.17 + wp.z * 0.29 + tt * 0.8) * 0.5 + 0.5;
          float w5 = sin(wp.z * 0.41 + wp.x * 0.33 + tt * 0.9) * 0.5 + 0.5;
          float w6 = sin(wp.x * 0.67 - wp.z * 0.43 - tt * 0.5) * 0.5 + 0.5;
          float foam = w1 * w2 * w3 + w4 * w5 * w6 * 0.4;
          foam = 1.0 - smoothstep(0.002, 0.012, foam);
          col += foamCol * foam * 0.22 * liveMul * uFancyFx * _fxLod;

          float sp1 = sin(wp.x * 0.40 + wp.z * 0.09 + tt * 1.7);
          float sp2 = sin(wp.z * 0.35 + wp.x * 0.13 - tt * 1.4);
          float sp3 = sin(wp.x * 0.27 - wp.z * 0.17 + tt * 2.0);
          float sp4 = sin(wp.x * 0.71 - wp.z * 0.47 + tt * 0.95);
          float sparkleMask = sin(wp.x * 0.031 + wp.z * 0.047 + tt * 0.12)
                            * sin(wp.z * 0.053 - wp.x * 0.029 - tt * 0.09);
          sparkleMask = smoothstep(0.15, 0.55, sparkleMask);
          float sparkle = sp1 * sp2 * sp3 * sp4;
          sparkle = smoothstep(0.7, 0.97, sparkle) * sparkleMask;
          col += vec3(1.0) * sparkle * 0.22 * liveMul * uFancyFx * _fxLod;
          }

          float alpha = smoothstep(0.04, 0.12, a) * shoreA; /* SHORECUE */
          gl_FragColor = vec4(col * alpha * uDim, alpha);
          #include <fog_fragment>
        }
      `,b=S?`
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      varying vec3 vWorldPos;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vWave = 0.0;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; /* CHUNKSTREAM: for fog depth */
        #include <fog_vertex>
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `:`
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      varying vec3 vWorldPos;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec3 pos = position;
        float w = sin(uTime * 0.5) * 0.025;
        pos.y += w;
        vWave = w;
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; /* CHUNKSTREAM: for fog depth */
        #include <fog_vertex>
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;t.uFancyFx||(t.uFancyFx={value:1}),t.uFxNear||(t.uFxNear={value:9e8}),t.uFxFar||(t.uFxFar={value:9e9});let K=new a.ShaderMaterial({transparent:!0,depthWrite:!0,depthTest:!0,premultipliedAlpha:!0,fog:!0,polygonOffset:!0,polygonOffsetFactor:0,polygonOffsetUnits:4,extensions:{derivatives:S},uniforms:{uTex:{value:W},uTime:t.uTime,uDim:t.uDim||(t.uDim={value:1}),uFancyFx:t.uFancyFx,uFxNear:t.uFxNear,uFxFar:t.uFxFar,uUvMin:{value:new a.Vector2(v,d)},uUvMax:{value:new a.Vector2(m,D)},uDepth:{value:o},uDepthUvMin:{value:new a.Vector2(.5/k,.5/U)},uDepthUvMax:{value:new a.Vector2(1-.5/k,1-.5/U)},uShallowCol:t.uShallowCol||(t.uShallowCol={value:new a.Vector3(ft[0],ft[1],ft[2])}),uShoreAlpha:t.uShoreAlpha||(t.uShoreAlpha={value:ht}),uShoreBand:t.uShoreBand||(t.uShoreBand={value:new a.Vector2(T[0],T[1])}),uShoreOn:t.uShoreOn||(t.uShoreOn={value:window._shoreCue&&window._shoreCue.off!==!0?1:0}),uCrackCount:{value:G.length},uCracks:{value:C},uCrackRot:{value:q},fogColor:{value:new a.Color(10470621)},fogNear:{value:9e8},fogFar:{value:9e8},uShape:t.uShape||{value:0},uCenter:t.uCenter||{value:new a.Vector2(0,0)},uRadius:t.uRadius||{value:1e9}},vertexShader:b,fragmentShader:ee(R)}),et=new a.Mesh(u,K);et.position.set((g+y)/2,ct,(A+c)/2),et.userData.isWaterSurface=!0,et.renderOrder=Be,i.add(et)}}if(e&&e.edges){let N=pe("#6a6a5e"),E=e.edges,z=(_+M)/2,j=(P+at)/2,B=M-_,I=at-P;if(E.north){let W=new a.Mesh(new a.BoxGeometry(B+2,12,2),N);W.position.set(z,12/2-1,at+1),i.add(W)}if(E.south){let W=new a.Mesh(new a.BoxGeometry(B+2,12,2),N);W.position.set(z,12/2-1,P-1),i.add(W)}if(E.east){let W=new a.Mesh(new a.BoxGeometry(2,12,I+2),N);W.position.set(M+1,12/2-1,j),i.add(W)}if(E.west){let W=new a.Mesh(new a.BoxGeometry(2,12,I+2),N);W.position.set(_-1,12/2-1,j),i.add(W)}}if(window._enableFoam!==!1&&window._shorelineChains&&!(e&&e.isInstance)){let H=typeof window._foamW=="number"?window._foamW:.6,Q=typeof window._foamInland=="number"?window._foamInland:.5,N=ct+(typeof window._foamY=="number"?window._foamY:.03),E=new a.MeshBasicMaterial({color:10147054,transparent:!0,opacity:.42,depthWrite:!1,side:a.DoubleSide,polygonOffset:!0,polygonOffsetFactor:0,polygonOffsetUnits:-2});e&&e._chunkData&&e._chunkData.procgen||(E.onBeforeCompile=T=>{T.uniforms.uTime=t.uTime,T.vertexShader=T.vertexShader.replace("void main() {",`uniform float uTime;
void main() {`).replace("#include <begin_vertex>",`#include <begin_vertex>
	transformed.y += sin(uTime * 0.5) * 0.025;`)},E.customProgramCacheKey=()=>"shoreFoamBob1");let z=(T,V)=>{let o=(T[0]+V[0])*.5,u=(T[1]+V[1])*.5;return o>=_&&o<M&&u>=P&&u<at},j=4,B=T=>T[0]>=_-j&&T[0]<=M+j&&T[1]>=P-j&&T[1]<=at+j,I=_-j,W=M+j,$=P-j,ft=at+j,ht=(T,V)=>{let o=(T-_)/x,u=(V-P)/x;o=Math.max(0,Math.min(k-1.001,o)),u=Math.max(0,Math.min(U-1.001,u));let p=Math.floor(o),f=Math.floor(u),v=o-p,d=u-f,m=(f*k+p)*3+1;return tt[m]*(1-v)*(1-d)+tt[m+3]*v*(1-d)+tt[m+k*3]*(1-v)*d+tt[m+k*3+3]*v*d};for(let T of window._shorelineChains){let V=T.bbox;if(V&&(V[2]<I||V[0]>W||V[3]<$||V[1]>ft))continue;let o=0,u=0;for(let d=0;d<T.length;d++){let m=T[d];if(!B(m))continue;let D=ht(m[0]+m[2]*1.5,m[1]+m[3]*1.5),S=ht(m[0]-m[2]*1.5,m[1]-m[3]*1.5);D<S?u++:D>S&&(u++,o++)}let p=u&&o*2>u?-1:1,f=[],v=[];for(let d=0;d<T.length;d++){if(!B(T[d]))continue;let[m,D,S,F]=T[d],G=S*p,C=F*p,q=f.length/3;if(f.push(m-G*Q,N,D-C*Q),f.push(m+G*H,N,D+C*H),d>0&&B(T[d-1])&&z(T[d-1],T[d])){let Y=q-2;v.push(Y,Y+2,Y+1,Y+1,Y+2,Y+3)}}if(f.length>=6&&v.length>0){let d=new a.BufferGeometry;d.setAttribute("position",new a.Float32BufferAttribute(f,3)),d.setIndex(v);let m=new a.Mesh(d,E);m.renderOrder=Ie,m.raycast=()=>{},m.userData._isFoam=!0,window._enableFoam===!1&&(m.visible=!1),i.add(m)}}}return i.updateMatrixWorld(!0),i.traverse(H=>{H.matrixAutoUpdate=!1}),i}function qo(t,r){let n=new a.Group;n.name="props";let e=We(42),s=(c,_)=>c+e()*(_-c);function l(c,_,M,P,at){let k=t[c];if(!k)return;let U=k.clone();U.scale.setScalar(_t*P),U.position.set(_,mo(_,M),M),U.rotation.y=at,n.add(U)}let i=["grassClump1","grassClump2","grassClump3","grassClump4"],h=["flowerDaisy","flowerRose","flowerSunflower","flowerTulip"],w=["cattail1","cattail2"],x=["mushroom1","mushroom2"],g=["shell1","shell2","starfish1","starfish2"],y=["palmTree1","palmTree2"];for(let c=0;c<80;c++){let _=s(-36,28),M=s(-34,36),P=Pt(_,M);P.dist<P.width+1.5||Jt(_,M)||le(_,M,3)||Zt(_,M)||l(i[c%i.length],_,M,s(.7,1.1),e()*Math.PI*2)}for(let c=0;c<40;c++){let _=s(-34,26),M=s(-30,34),P=Pt(_,M);P.dist<P.width+2||Jt(_,M)||le(_,M,4)||Zt(_,M)||l(h[c%h.length],_,M,s(.6,1),e()*Math.PI*2)}for(let c=0;c<15;c++){let _=s(-10,30),M=s(-16,38),P=Pt(_,M);P.dist<P.width||P.dist>P.width+3||l(w[c%w.length],_,M,s(.8,1.2),e()*Math.PI*2)}for(let c=0;c<10;c++){let _=s(-32,34),M=s(10,34),P=Pt(_,M);P.dist<P.width+1||Zt(_,M)||l(x[c%x.length],_,M,s(.6,1),e()*Math.PI*2)}for(let c=0;c<8;c++){let _=s(32,46),M=s(-22,2);qt(_,M)||l(g[c%g.length],_,M,s(.5,.9),e()*Math.PI*2)}for(let c=0;c<4;c++){let _=s(34,44),M=s(-20,0);qt(_,M)||l(y[c%y.length],_,M,s(.8,1.2),e()*Math.PI*2)}let A=[[22,20],[26,26],[-24,20],[-18,24],[30,24]];for(let[c,_]of A){let M=c+s(-2,2),P=_+s(-2,2);l("stump",M,P,s(.7,1),e()*Math.PI*2)}return l("hollowTrunk",-28,18,.9,s(0,Math.PI*2)),r.add(n),n}var Xe=new a.MeshToonMaterial({vertexColors:!0,side:a.DoubleSide});Xe.name="dock_merged_static";function Eo(t){if(!t?.children?.length)return!1;let r=new Set;for(let i of t.children)i.name==="dock_deck"&&r.add(i);let n=[],e=[];for(let i of[...t.children])r.has(i)||(i.updateMatrixWorld(!0),i.traverse(h=>{if(!h.isMesh||!h.geometry)return;let w=h.geometry.index?h.geometry.toNonIndexed():h.geometry.clone();w.applyMatrix4(h.matrixWorld);let x=w.attributes?.position?.count||0;if(!x){w.dispose();return}let g=w.attributes.color,y=h.material?.color||new a.Color(g?1:.55,g?1:.42,g?1:.28),A=new Float32Array(x*3);if(g)for(let c=0;c<x;c++)A[c*3]=g.getX(c)*y.r,A[c*3+1]=g.getY(c)*y.g,A[c*3+2]=(g.itemSize>=3?g.getZ(c):1)*y.b;else for(let c=0;c<x;c++)A[c*3]=y.r,A[c*3+1]=y.g,A[c*3+2]=y.b;w.setAttribute("color",new a.BufferAttribute(A,3));for(let c of Object.keys(w.attributes))c!=="position"&&c!=="normal"&&c!=="color"&&w.deleteAttribute(c);(!w.attributes.normal||!(w.attributes.normal.array instanceof Float32Array))&&w.computeVertexNormals(),n.push(w)}),e.push(i));if(!n.length)return!1;let s=co(n,!1);for(let i of n)i.dispose();if(!s)return!1;for(let i of e)t.remove(i),i.traverse(h=>{h.isMesh&&(h.geometry=null,h.material=null),h.removeFromParent?.(),h.children&&(h.children.length=0)});let l=new a.Mesh(s,Xe);return l.name="merged_static",l.userData._perfType="mainland_dock",l.userData._dockMerged=!0,l.renderOrder=Vt,t.add(l),!0}function Ze(t){let r=new a.Group;r.name="dock";let n=40,e=4,s=4,l=ct+.15,i=[];if(t.dockSteps){let h=t.dockSteps.clone();h.scale.setScalar(_t),h.position.set(n-_t,l,e),h.rotation.y=Math.PI/2,h.userData._perfType="Prop_Docks_Steps",r.add(h),i.push(h)}for(let h=0;h<s;h++){if(t.dockStr){let w=t.dockStr.clone();w.scale.setScalar(_t),w.position.set(n+h*_t,l,e),w.rotation.y=Math.PI/2,w.userData._perfType="Prop_Docks_Straight",r.add(w),i.push(w)}if(t.dockStrSup)for(let w of[Math.PI/2,-Math.PI/2]){let x=t.dockStrSup.clone();x.scale.setScalar(_t),x.position.set(n+h*_t,l,e),x.rotation.y=w,x.userData._perfType="Prop_Docks_Straight_Supports",r.add(x)}}de(r,i);try{Eo(r)}catch(h){console.warn("[mainland dock] merge failed:",h&&h.message||h)}return r.renderOrder=Vt,r.traverse(h=>{h.isMesh&&(h.renderOrder=Vt)}),r}function Jo(){let t=new a.Group;t.name="stepping_stones";let r=new a.CylinderGeometry(.55,.65,.25,8),n=pe("#8a8a82");for(let[e,s]of[[0,20],[-1,18],[1,16],[4,-1],[8,-4],[12,-7]]){let l=new a.Mesh(r,n);l.position.set(e,ct-.05,s),l.rotation.y=Math.random()*Math.PI,l.renderOrder=Be+1,t.add(l)}return t}function Qo(t,r){let l=te(0,40)+4.8,i=ct+.16,h=(40.9+34.4)/2,w=l*.58+i*.42,x=(c,_=1)=>new a.ShaderMaterial({transparent:!0,depthWrite:!1,side:a.DoubleSide,uniforms:{uTime:r.uTime,uPhase:{value:c},uAlpha:{value:_}},vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",fragmentShader:ee(`varying vec2 vUv; uniform float uTime,uPhase,uAlpha;
      void main(){
        float t=fract(vUv.y*2.2-uTime*0.45+uPhase);
        float streak=smoothstep(0.0,0.24,t)*smoothstep(1.0,0.62,t);
        float edge=smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x);
        vec3 col=mix(vec3(0.62,0.86,0.97),vec3(0.80,0.95,1.0),streak*0.65);
        float a=edge*(0.26+streak*0.48)*uAlpha;
        gl_FragColor=vec4(col,clamp(a,0.0,0.85)); }`)}),g=(c,_,M,P=1)=>{let at=[[c,l,40.9],[c,w,h],[c,i,34.4]];for(let k=0;k<at.length-1;k++){let[U,tt,Z]=at[k],[dt,Tt,lt]=at[k+1],pt=Math.hypot(Tt-tt,lt-Z),nt=new a.Mesh(new a.PlaneGeometry(_,pt,1,12),x(M+k*.17,P));nt.position.set((U+dt)/2,(tt+Tt)/2,(Z+lt)/2),nt.quaternion.setFromUnitVectors(new a.Vector3(0,1,0),new a.Vector3(0,Tt-tt,lt-Z).normalize()),nt.renderOrder=Vt+1,t.add(nt)}};g(0,3.6,0,1),g(0-1.05,1.4,.22,.7),g(0+1.05,1.4,.41,.7);let y=new a.Mesh(new a.BoxGeometry(3.8,.12,.9),pe("#8a8f92"));y.position.set(0,l+.02,40.9+.2),y.renderOrder=Vt,t.add(y);let A=new a.Mesh(new a.CircleGeometry(2.25,20),new a.MeshBasicMaterial({color:"#dff6ff",transparent:!0,opacity:.42,depthWrite:!1}));A.rotation.x=-Math.PI/2,A.position.set(0,ct+.03,34.4+.15),A.renderOrder=Ie,t.add(A)}var ta=[[20,18,2.2,1.8],[28,28,2.4,3.6],[18,28,2.1,.9],[32,20,1.9,2.4],[24,32,2.3,4.2],[-22,18,2,1],[-30,24,1.9,5.2],[-20,26,2.2,4.5],[-16,-18,1.7,2.1],[14,-18,1.6,.7],[-8,-42,2.4,3.3],[10,30,1.8,.5],[-10,22,2,3.1],[36,28,1.7,4.4],[-34,16,1.9,1.6],[-26,8,1.8,5.7],[6,24,1.6,2.3],[-6,16,1.7,.2],[16,10,1.5,4],[-12,32,2.1,2.9],[26,14,1.8,5.1],[-28,-8,1.6,3.7],[22,-8,1.5,1.3],[-4,28,1.9,4.6],[30,8,1.7,.8],[-18,4,1.6,2.5]],ea=[[-28,26,1.6,1.4],[-14,8,1.45,2.1],[-20,-6,1.4,.9]],oa=[[22,34,1.04,3.2],[-26,30,1,4.1],[34,22,.98,5],[-32,18,.95,2.6],[-10,14,.95,1.7],[-16,10,1,5.3],[8,20,.9,.5],[14,12,1.05,3.9],[-22,-2,.92,2.4],[-18,-10,.98,4.6],[6,8,.88,1.2],[-8,4,1.02,3.5],[12,24,.96,5.8],[-24,16,.94,.3]],aa=[[-12,-28,1.1,.4],[12,-28,1.12,2.8],[20,-10,1.1,1.9],[-18,-12,1.08,5],[8,-38,1,3.8]],na=[[-38,38,4.2,0],[0,42,3.8,1.6],[38,38,4.5,3.1],[-36,40,4,4.7],[36,40,3.6,.8],[-42,20,4.1,2.3],[-42,4,3.9,5.5],[-42,-12,4.4,3.9],[-42,-28,3.5,1.2],[0,-40,4.3,4.1],[-18,-40,3.7,2.8],[18,-40,4,5.8],[-34,-38,4.6,.4],[28,-38,3.8,3.5]],ra=[{x:-4,z:14,phase:0},{x:4,z:4,phase:1.2},{x:8,z:-4,phase:2.4}];function ko(t){let r=Ze(t);return r.name="loch_south_pier",r.scale.y=.45,r.position.set(-38,0,-4),r}var Ye=null;function pa(){return Ye||=(async()=>{let t={},r=new To;return await Promise.all([["dockStr","Prop_Docks_Straight"],["dockStrSup","Prop_Docks_Straight_Supports"],["dockSteps","Prop_Docks_Steps"]].map(async([n,e])=>{t[n]=(await r.loadAsync("models/terrain/"+e+".glb")).scene})),t})().catch(t=>{throw Ye=null,t})}var fe,Ro,bt,$e,Ct,Ke=0,So=t=>t?.seed===gt.seed;function xa(t){t.some(So)||t.push({...gt})}function qe(t){return Ro||=xe(t).then(r=>(fe=r,{...r,props:r.props.filter(n=>n.role==="scenery"),pois:r.pois.filter(n=>n.type!=="Svc_FishingSpot")}))}async function wa(t){return(await qe(t)).hm}function ga(t){bt=t}var $t=t=>({x:gt.worldX+t.x,z:gt.worldZ+t.z});function va(){if(!bt)return;let t=performance.now()*.001,r=Math.max(0,Math.min(1,t-Ke));Ke=t;let{player:n}=bt,e=Math.hypot(n.position.x-gt.worldX,n.position.z-gt.worldZ)<200;!$e&&e&&document.body.classList.contains("game-started")&&[Et.arrival,Et.head,...Et.stations,Et.wisperator].every(s=>{let l=$t(s);return window._isChunkLoadedAtWorld?.(l.x,l.z)})&&yo().catch(s=>console.error("[loch] island setup failed",s)),Ct&&((e||Ct.play.hasLoadedMachine)&&Ct.encounter.update(r),Ct.play.update(r),Ct.wisperator.tick())}function yo(){return $e||=Ao()}async function Ao(){if(!bt)throw Error("Loch island context is not configured");await qe(gt);let{scene:t,renderer:r,player:n,camera:e,groundY:s,obstacles:l}=bt,[{buildLochBerryLobber:i},{buildLochFishCannon:h},{buildLochLogBallista:w},{buildLochRockSling:x},{buildLochHunterSling:g},{createLochIslandEncounterPreview:y},{createLochSkillingPlay:A},{playLochSound:c},{buildLochHeadRest:_},{installLochWisperator:M}]=await Promise.all([import("./lochShoreBerryLobber-W5K7IDVY.js"),import("./lochShoreFishCannon-33URXWNG.js"),import("./lochShoreLogBallista-QXHIPN65.js"),import("./lochShoreRockSling-2MLPKBDS.js"),import("./lochShoreHunterSling-LVIFLCWF.js"),import("./lochIslandEncounterPreview-LAMA2NKK.js"),import("./lochSkillingPlay-4VOKZH6A.js"),import("./lochSkillingSounds-ZFCRHNQS.js"),import("./lochHeadRest-PZ4RB3TQ.js"),import("./lochWisperator-TPOE7IE6.js")]),P={...Et,boss:$t(Et.boss),head:$t(Et.head)};t.add(_(P.head,s));let at=await Ee(),k=new Map,U={hunter:()=>g(at),berry:i,fish:h,log:w,rock:x};for(let lt of Et.stations){let pt=$t(lt),nt=U[lt.key]();await Te(nt,lt.key),nt.position.set(pt.x,s(pt.x,pt.z),pt.z),nt.rotation.y=Math.atan2(P.boss.x-pt.x,P.boss.z-pt.z),t.add(nt);let zt=new je.AnimationMixer(nt);zt.clipAction(nt.animations.find(Rt=>Rt.name==="Idle")).play(),k.set(lt.key,{root:nt,mixer:zt,name:lt.name}),l.push({x:pt.x,z:pt.z,radius:1.65,id:"loch_"+lt.key})}let tt,Z=y({scene:t,layout:P,terrainHeight:s,waterY:ct,machines:k,authoritative:!0,onEvent:lt=>{c(lt),tt?.machineEvent(lt)}});Z.boss.root.visible=!1,await r.compileAsync(Z.boss.root,e,t),Z.boss.root.visible=!0;let dt=document.createElement("div");dt.id="loch-island-visit",document.body.append(dt),tt=await A({...bt,island:fe,record:gt,machines:k,encounter:Z,panel:dt});let Tt=await M({...bt,record:gt,position:Et.wisperator});return Ct={record:gt,island:fe,machines:k,encounter:Z,pier:t.getObjectByName("loch_south_pier"),groundY:s,player:n,play:tt,wisperator:Tt},Ct}export{Ko as a,mo as b,jo as c,$o as d,qo as e,Ze as f,Jo as g,Qo as h,ta as i,ea as j,oa as k,aa as l,na as m,ra as n,ko as o,pa as p,So as q,xa as r,qe as s,wa as t,ga as u,va as v,yo as w};

import{b as de}from"./chunk-7MXHSGKT.js";import{a as _t,b as ct,c as Xt,d as Gt,e as we,f as ge,g as ve,h as Me,k as Pt,l as qt,m as Jt,n as Qt,o as Zt,p as te,t as ee}from"./chunk-GEUWWUAE.js";import{a as Et,d as xe,e as Ee,h as Te}from"./chunk-LNZSIZAZ.js";import{b as me,c as _e}from"./chunk-BDOJGZA2.js";import{c as gt}from"./chunk-RG5JSPC3.js";import*as Ze from"three";import{GLTFLoader as ra}from"three/addons/loaders/GLTFLoader.js";import{Group as ia}from"three";import*as a from"three";import{GLTFLoader as no}from"three/addons/loaders/GLTFLoader.js";import{mergeGeometries as ro}from"three/addons/utils/BufferGeometryUtils.js";var oe={xMin:-634,xMax:530,zMin:-410,zMax:479};var ke={x:80,z:60},Se={name:"taiga",sand:[.7,.72,.74],grass:[.74,.76,.78],hill:[.62,.64,.68],peak:[.88,.9,.92],beachWidth:5,props:["Pine_Tree_Snow","Pine_Tree_Snow","Pine_Tree_Snow","Birch_Tree_Snow","Birch_Tree_Dead_Snow","Ice_Pine","Ice_Oak","Frost_Bush","Berry_Bush","Rock_3_A","Rock_3_C","Rock_3_E","Ice_Block","Crystal_1","Glacial_Rock"],rareProps:["Ice_Spire","Snowdrift_Cairn","Petrified_Tree","Rocks_Ore_Silver","Rocks_Ore_Moonstone"]},vt={name:"plains",sand:[.86,.77,.56],grass:[.15,.42,.14],hill:[.22,.38,.16],peak:[.48,.44,.32],beachWidth:8,props:["Toon_Oak","Toon_Oak","Toon_Willow","Birch_Tree","Autumn_Tree","Prop_Tree_Oak_1","Prop_Tree_Oak_2","Prop_Stump","Prop_Hollow_Trunk","Berry_Bush","Bush","Prop_Bush_1","Prop_Bush_2","Rock_3_A","Rock_3_C","Rock_3_E","Rock_3_G","Rock_1_A","Rock_2_A","Mossy_Rock"],rareProps:["Mossy_Log","Wildflower_Patch","Rocks_Ore_Tin","Rocks_Ore_Copper"]},ae={name:"mistwood",sand:[.66,.62,.48],grass:[.18,.48,.24],hill:[.22,.42,.2],peak:[.52,.56,.5],beachWidth:7,props:["Toon_Pine","Toon_Pine","Toon_Willow","Mushroom_Tree","Giant_Toadstool","Spore_Pod","Crystal_Bloom","Mossy_Log","Prop_Hollow_Trunk","Bush","Berry_Bush","Prop_Bush_2","Prop_Bush_3","Rock_3_A","Rock_3_C","Rock_3_E","Mossy_Rock","Spore_Rock"],rareProps:["Roots","Tree_Spiral_1","Rocks_Ore_Jade","Rocks_Ore_Opal"]},Ut={name:"savanna",sand:[.78,.7,.5],grass:[.58,.52,.26],hill:[.52,.42,.26],peak:[.58,.5,.4],beachWidth:7,props:["Cactus","Cactus_Flowers","Desert_Yucca","Toon_Willow","Prop_Stump","Prop_Branch_1","Prop_Branch_2","Bush","Prop_Bush_1","Rock_3_A","Rock_3_C","Rock_3_G","Rock_2_A","Rock_4","Sandstone_Pillar","Bone_Skull"],rareProps:["Sandstone_Arch","Rocks_Ore_Copper","Rocks_Ore_Sunstone"]},ye={name:"stone",sand:[.58,.58,.56],grass:[.38,.4,.4],hill:[.3,.32,.34],peak:[.66,.68,.7],beachWidth:4,props:["Rock_3_A","Rock_3_A","Rock_3_C","Rock_3_C","Rock_3_E","Rock_3_G","Rock_1_A","Rock_2_A","Rock_4","Prop_Cliff_Rock_1","Prop_Cliff_Rock_2","Mossy_Rock","Glacial_Rock","Prop_Stump","Prop_Hollow_Trunk","Bush","Crystal_1","Crystal_2"],rareProps:["Sandstone_Pillar","Rocks_Ore_Tin","Rocks_Ore_Copper","Rocks_Ore_Silver","Rocks_Ore_Cobalt","Rocks_Ore_Titanium","Crystal_3","Crystal_Bloom"]},Kt={name:"dirt",sand:[.66,.56,.42],grass:[.4,.3,.18],hill:[.34,.26,.18],peak:[.48,.4,.3],beachWidth:6,props:["Prop_Stump","Prop_Stump","Prop_Hollow_Trunk","Prop_Branch_1","Prop_Branch_2","Prop_Branch_3","Bush","Prop_Bush_1","Rock_3_A","Rock_3_C","Rock_1_A","Mossy_Log"],rareProps:["Roots","Rocks_Ore_Tin","Rocks_Ore_Copper","Wildflower_Patch"]},Re=[];function Ae(t,r){let n=0;for(let o=0;o<Re.length;o++){let s=Re[o],f=t-s.cx,c=r-s.cz,m=f*f+c*c,v=s.radius||200,x=m/(v*v),T=x*x,C=s.w/(1+T);n+=C*s.height}return n}var At=[{palette:Ut,cx:-110,cz:40,w:1,radius:110},{palette:Se,cx:273,cz:513,w:1,radius:220},{palette:Ut,cx:29,cz:-458,w:1,radius:160},{palette:ye,cx:290,cz:66,w:1,radius:110},{palette:vt,cx:81,cz:-164,w:1,radius:40},{palette:Ut,cx:-359,cz:594,w:1,radius:270},{palette:Kt,cx:-448,cz:60,w:1,radius:130},{palette:vt,cx:139,cz:181,w:1,radius:60},{palette:vt,cx:-96,cz:208,w:1,radius:40},{palette:vt,cx:-4,cz:216,w:1,radius:40},{palette:Ut,cx:-535,cz:297,w:1,radius:70},{palette:Kt,cx:266,cz:-169,w:1,radius:60},{palette:ae,cx:379,cz:-207,w:1,radius:90},{palette:ae,cx:-273,cz:-219,w:1,radius:130},{palette:vt,cx:-31,cz:-69,w:1,radius:40},{palette:vt,cx:58,cz:-82,w:1,radius:40},{palette:vt,cx:139,cz:57,w:1,radius:40},{palette:vt,cx:140,cz:96,w:1,radius:40},{palette:vt,cx:133,cz:-84,w:1,radius:40},{palette:vt,cx:149,cz:-39,w:1,radius:60},{palette:Kt,cx:-30,cz:-115,w:1,radius:40}],Je={taiga:Se,stone:ye,mistwood:ae,plains:vt,dirt:Kt,savanna:Ut};var Qe=["taiga","stone","mistwood","plains","dirt","savanna"],jt=16,Lt={xMin:-700,xMax:700,zMin:-640,zMax:700},ne=Math.ceil((Lt.xMax-Lt.xMin)/jt),Pe=Math.ceil((Lt.zMax-Lt.zMin)/jt),to=new Uint8Array(ne*Pe).fill(255);function Yt(t,r){return t<0||r<0||t>=ne||r>=Pe?255:to[r*ne+t]}function eo(t){if(t===255)return null;let r=Qe[t];return Je[r]||null}var Do=_e(me(3405691582,106981));var mt={name:"neutral",sand:[.55,.55,.55],grass:[.55,.55,.55],hill:[.5,.5,.5],peak:[.65,.65,.65],beachWidth:5},oo={name:"neutral",palette:mt,grass:mt.grass,sand:mt.sand,hill:mt.hill,peak:mt.peak,beachWidth:mt.beachWidth};function ao(t,r){let n=(t-Lt.xMin)/jt-.5,o=(r-Lt.zMin)/jt-.5,s=Math.floor(n),f=Math.floor(o),c=s+1,m=f+1,v=Math.max(0,Math.min(1,n-s)),x=Math.max(0,Math.min(1,o-f)),T=(1-v)*(1-x),C=v*(1-x),F=(1-v)*x,i=v*x,_=[Yt(s,f),Yt(c,f),Yt(s,m),Yt(c,m)],g=[T,C,F,i],y=0,at=0,k=0,U=0,tt=0,Z=0,dt=0,Tt=0,lt=0,pt=0,nt=0,zt=0,Rt=0,Ht=0,Ft=mt,St=0;for(let Bt=0;Bt<4;Bt++){let st=eo(_[Bt]);if(!st)continue;let ot=g[Bt];ot<=0||(y+=ot,at+=st.grass[0]*ot,k+=st.grass[1]*ot,U+=st.grass[2]*ot,tt+=st.sand[0]*ot,Z+=st.sand[1]*ot,dt+=st.sand[2]*ot,Tt+=st.hill[0]*ot,lt+=st.hill[1]*ot,pt+=st.hill[2]*ot,nt+=st.peak[0]*ot,zt+=st.peak[1]*ot,Rt+=st.peak[2]*ot,Ht+=st.beachWidth*ot,ot>St&&(St=ot,Ft=st))}if(y<.05)return null;let ut=1/y;return{name:Ft.name,palette:Ft,grass:[at*ut,k*ut,U*ut],sand:[tt*ut,Z*ut,dt*ut],hill:[Tt*ut,lt*ut,pt*ut],peak:[nt*ut,zt*ut,Rt*ut],beachWidth:Ht*ut}}function Ce(t,r){let n=ao(t,r);if(n)return n;if(At.length===0)return oo;let o=new Array(At.length),s=0,f=0;for(let i=0;i<At.length;i++){let _=At[i],g=t-_.cx,y=r-_.cz,at=g*g+y*y,k=_.radius||250,U=at/(k*k),tt=U*U*U*U,Z=_.w/(1+tt);o[i]=Z,Z>s&&(s=Z,f=i)}if(s<.01)return{name:"neutral",palette:mt,grass:mt.grass,sand:mt.sand,hill:mt.hill,peak:mt.peak,beachWidth:mt.beachWidth};let c=At[f],m=0,v=-1;for(let i=0;i<At.length;i++)At[i].palette.name!==c.palette.name&&o[i]>m&&(m=o[i],v=i);if(v<0||m<s*.15)return{name:c.palette.name,palette:c.palette,grass:c.palette.grass,sand:c.palette.sand,hill:c.palette.hill,peak:c.palette.peak,beachWidth:c.palette.beachWidth};let x=At[v],T=s+m,C=m/T,F=(i,_)=>[i[0]*(1-C)+_[0]*C,i[1]*(1-C)+_[1]*C,i[2]*(1-C)+_[2]*C];return{name:c.palette.name,palette:c.palette,grass:F(c.palette.grass,x.palette.grass),sand:F(c.palette.sand,x.palette.sand),hill:F(c.palette.hill,x.palette.hill),peak:F(c.palette.peak,x.palette.peak),beachWidth:c.palette.beachWidth*(1-C)+x.palette.beachWidth*C}}var Io={worldX:0,worldZ:0,bounds:oe,spawn:{x:ke.x,z:ke.z},seed:3235826430};var re=0,De=2,Ie=2.5,Vt=3;function kt(t,r){let n=(i,_)=>{let g=(i*1597334677^_*3812015801)>>>0;return g=(g>>16^g)*73244475>>>0,g=(g>>16^g)>>>0,g/4294967295},o=Math.floor(t),s=Math.floor(r),f=t-o,c=r-s,m=f*f*(3-2*f),v=c*c*(3-2*c),x=n(o,s),T=n(o+1,s),C=n(o,s+1),F=n(o+1,s+1);return x+(T-x)*m+(C-x)*v+(x-T-C+F)*m*v}var be=(()=>{let t=[];for(let r=0;r<350;r++){let n=(r*1597334677^r*7+3812015801)>>>0,o=n/4294967295*2e3-1e3;n=(n>>16^n)*73244475>>>0;let s=n/4294967295*1600-700;n=(n>>16^n)>>>0;let f=120+n/4294967295*60;n=(n>>13^n)*668265261>>>0;let c=.1+n/4294967295*.1;t.push({x:o,z:s,r:f,amp:c})}return t})();function so(t,r){let n=0;for(let o=0;o<be.length;o++){let s=be[o],f=t-s.x,c=r-s.z,m=f*f+c*c,v=s.r*s.r;if(m<v){let x=1-m/v;n+=s.amp*x*x}}return n}function io(t,r){let n=t*r,o=Math.floor(n),s=n-o,f=.85,c=s<f?0:(s-f)/.15;return c=c*c*(3-2*c),(o+c)/r}var ce=(()=>{let t=document.createElement("canvas");t.width=4,t.height=1;let r=t.getContext("2d");[100,160,220,255].forEach((o,s)=>{r.fillStyle=`rgb(${o},${o},${o})`,r.fillRect(s,0,1,1)});let n=new a.CanvasTexture(t);return n.colorSpace=a.NoColorSpace,n.minFilter=n.magFilter=a.NearestFilter,n.generateMipmaps=!1,n._shared=!0,n})();function pe(t,r={}){let{flatShading:n,...o}=r;return new a.MeshToonMaterial({color:t,gradientMap:ce,...o})}var Nt={lush:{sand:[.72,.64,.42],grass:[.31,.66,.25],hill:[.25,.55,.22],peak:[.2,.45,.2]},sand:{sand:[.86,.73,.45],grass:[.78,.66,.4],hill:[.69,.58,.35],peak:[.58,.5,.32]},dirt:{sand:[.54,.43,.3],grass:[.46,.36,.25],hill:[.34,.3,.25],peak:[.27,.24,.2]},mulch:{sand:[.5,.38,.25],grass:[.4,.31,.2],hill:[.32,.25,.16],peak:[.25,.2,.14]},path:{sand:[.63,.51,.35],grass:[.56,.45,.3],hill:[.48,.38,.25],peak:[.4,.32,.22]}};function co(t,r){return Math.hypot((t+15)/13,(r+8)/8.6)<1.55?Nt.sand:Math.hypot((t+24)/11,(r-17)/9)<1.08?Nt.dirt:Math.hypot((t-23)/13,(r+12)/10)<1.12?Nt.mulch:Math.abs(t)<3.2&&r>4&&r<30?Nt.path:Nt.lush}function lo(t,r,n){return t?.instanceBiome==="pet_garden"?co(r,n):Ce(r,n)}var uo="models/terrain/",se={dockStr:"Prop_Docks_Straight.glb",dockStrSup:"Prop_Docks_Straight_Supports.glb",dockSteps:"Prop_Docks_Steps.glb",grassClump1:"Prop_Grass_Clump_1.glb",grassClump2:"Prop_Grass_Clump_2.glb",grassClump3:"Prop_Grass_Clump_3.glb",grassClump4:"Prop_Grass_Clump_4.glb",flowerDaisy:"Prop_Flower_Daisy.glb",flowerRose:"Prop_Flower_Rose.glb",flowerSunflower:"Prop_Flower_Sunflower.glb",flowerTulip:"Prop_Flower_Tulip.glb",cattail1:"Prop_Cattail_1.glb",cattail2:"Prop_Cattail_2.glb",mushroom1:"Prop_Mushroom_1.glb",mushroom2:"Prop_Mushroom_2.glb",palmTree1:"Prop_Tree_Palm_1.glb",palmTree2:"Prop_Tree_Palm_2.glb",shell1:"Prop_Shell_1.glb",shell2:"Prop_Shell_2.glb",starfish1:"Prop_Starfish_1.glb",starfish2:"Prop_Starfish_2.glb",stump:"Prop_Stump.glb",hollowTrunk:"Prop_Hollow_Trunk.glb"};async function Zo(){let t=new no,r=f=>new Promise((c,m)=>t.load(f,v=>c(v.scene),void 0,m)),n=Object.keys(se),o=await Promise.all(n.map(f=>r(uo+se[f]).catch(c=>(console.warn(`tile load fail: ${se[f]}`,c),null)))),s={};return n.forEach((f,c)=>{s[f]=o[c]}),s}var Oe=[{x:0,z:-32,r:14},{x:18,z:-35,r:10},{x:-22,z:-34,r:8}];function le(t,r,n=0){for(let o of Oe)if(Math.hypot(t-o.x,r-o.z)<=o.r+n)return!0;return!1}function ze(t,r){let n=Math.sin(t*127.1+r*311.7)*43758.5453;return n-Math.floor(n)}function We(t){let r=t|0;return()=>{r=r+1831565813|0;let n=Math.imul(r^r>>>15,1|r);return n=n+Math.imul(n^n>>>7,61|n)^n,((n^n>>>14)>>>0)/4294967296}}var Le=38,Ge=-6,ue=26,Ue=[];{let t=We(77);for(let r=0;r<120;r++){let n=-40+t()*80,o=-38+t()*72,s=Pt(n,o);if(s.dist<s.width+3||Qt(n,o)<2||le(n,o,4)||Math.hypot(n-Le,o-Ge)<ue-4)continue;let f=t()<.25;Ue.push({x:n,z:o,r:f?10+t()*12:5+t()*7,h:f?1.2+t()*1.5:.3+t()*.6})}}var He=-6,Fe=6,Be=8,ie=3;function po(t,r){let n=te(t,r),o=Pt(t,r),s=a.MathUtils.smoothstep,f=s(o.dist,o.width,o.width+6),c=s(Qt(t,r),1,5),m=1;for(let T of Oe)m=Math.min(m,s(Math.hypot(t-T.x,r-T.z),T.r,T.r+6));let v=s(Math.hypot(t-Le,r-Ge),ue-18,ue+4),x=f*c*m*v;n+=(Math.sin(t*.07+r*.05)*.5+Math.cos(t*.11-r*.06)*.35+Math.sin(t*.04+r*.13)*.25)*x;for(let T of Ue){let C=Math.hypot(t-T.x,r-T.z);if(C<T.r){let F=1-C/T.r;n+=T.h*F*F*(3-2*F)*x}}if(t>He-3&&t<Fe+3&&Math.abs(r-Be)<ie+3){let T=1-s(Math.max(He-t,t-Fe,0),0,3),C=1-s(Math.abs(r-Be),ie,ie+3),F=T*C;F>0&&(n=a.MathUtils.lerp(n,ct-2,F))}return n}var fo=(()=>{let o=Math.hypot(42,18,18);return[42/o,18/o,18/o]})(),ho=.8,mo=.55,_o=1.18,xo=1,wo=.8;function go(t){return typeof window>"u"?!!t:window._bakedSun===!1?!1:window._bakedSun===!0?!0:!!t}function vo(t){let r=typeof window<"u"&&window._sunBake||null,n=t||fo;return{amb:r?.amb??ho,str:r?.str??mo,wr:r?.wr??_o,wg:r?.wg??xo,wb:r?.wb??wo,sx:n[0],sy:n[1],sz:n[2]}}async function Yo(t,r,n,o,s,f=null){let c=new a.Group;c.name="terrain";let m=performance.now(),v=async(z=!1)=>{if(typeof f!="function")return;let Q=performance.now()-m;!z&&Q<3.5||(await f(Q),m=performance.now())},x=s||4,T=o?o.xMin:(we-1)*_t,C=o?o.xMax:(ge+1)*_t,F=o?o.zMin:(ve-1)*_t,i=o?o.zMax:(Me+1)*_t,_=T,g=C,y=F,at=i,k=Math.ceil((g-_)/x)+1,U=Math.ceil((at-y)/x)+1,tt=new Float32Array(k*U*3),Z=new Uint8Array(k*U*3),dt=[],Tt=new a.Color("#4dad38"),lt=new a.Color("#F0D28A"),pt=new a.Color(.06,.18,.38),nt=new a.Color,zt=a.MathUtils.smoothstep,Rt=o&&o.localOffsetX||0,Ht=o&&o.localOffsetZ||0,Ft=Array.isArray(o?.caveHoles)?o.caveHoles:[],St=o?.instanceBiome==="pet_garden",ut=!!(o&&o.isInstance),Bt=!!(o&&o._chunkData&&o._chunkData.procgen),st=Ft.length?(z,Q,N,M,b,j)=>{for(let D of Ft){let I=D.r||2.2,W=I*I,$=(z+N+b)/3-D.x,ft=(Q+M+j)/3-D.z;if($*$+ft*ft<W)return!0;let ht=I*.72,E=ht*ht,V=z-D.x,e=Q-D.z,l=N-D.x,u=M-D.z,p=b-D.x,w=j-D.z;if(V*V+e*e<E||l*l+u*u<E||p*p+w*w<E)return!0}return!1}:null,ot=1/0;for(let z=0;z<U;z++){for(let Q=0;Q<k;Q++){let N=_+Q*x,M=y+z*x,b=N-Rt,j=M-Ht,D=N<T||N>C||M<F||M>i,I=Xt;if(r){let R=`${b},${j}`;!(R in r)&&D&&(b=Math.max(T,Math.min(C,N))-Rt,j=Math.max(F,Math.min(i,M))-Ht,R=`${b},${j}`),R in r&&(I+=r[R])}!Bt&&!ut&&(I+=Ae(N,M)),!D&&I<ot&&(ot=I);let W=(z*k+Q)*3,$=Q===0||Q===k-1,ft=z===0||z===U-1,ht=o&&o.isInstance,E=o&&o._chunkData&&o._chunkData.procgen,V=$||ft||ht||E?0:(ze(N,M)-.5)*(x*.03);tt[W]=N+V,tt[W+1]=I,tt[W+2]=M+V*.7;let e=lo(o,N,M),l=e.sand,u=e.grass,p=e.hill,w=e.peak,h=.06,d=.18,B=.38,S=nt,H,G,A,q=.6;if(I<ct-q)H=h,G=d,A=B;else if(I<ct){let R=(ct-I)/q,P=R*R*(3-2*R);H=u[0]*(1-P)+h*P,G=u[1]*(1-P)+d*P,A=u[2]*(1-P)+B*P}else if(I<Gt)H=u[0],G=u[1],A=u[2];else if(I<Gt+1.5){let R=(I-Gt)/1.5;H=u[0]*(1-R)+p[0]*R,G=u[1]*(1-R)+p[1]*R,A=u[2]*(1-R)+p[2]*R}else{let R=Math.min(1,(I-Gt-1.5)/2);H=p[0]*(1-R)+w[0]*R,G=p[1]*(1-R)+w[1]*R,A=p[2]*(1-R)+w[2]*R}if(I>=ct){let R=kt(N*.09+31.7,M*.09+17.3)-.5,P=kt(N*.025+81.4,M*.025+53.7)-.5,K=kt(N*.012+121.1,M*.012+199.5)-.5,et=St?R*.15+P*.08+K*.09:R*.09+P*.05+K*.06;if(H+=et,G+=et,A+=et,St){let L=Math.max(-.035,Math.min(.13,(I-Xt)*.034)),X=(ze(N*1.73+19.7,M*1.73+41.9)-.5)*.042;H+=L*.55+X*.72,G+=L*.8+X*.62,A+=L*.38+X*.42}}S.setRGB(Math.max(0,Math.min(1,H)),Math.max(0,Math.min(1,G)),Math.max(0,Math.min(1,A)));let Y=!!(ut&&o.water===!1);if(n&&(Y||I>=ct-q)){let R=`${b},${j}`;if(R in n){let P=n[R];nt.setRGB(P[0],P[1],P[2]),S=nt}else if(!D&&n._default){let P=n._default;nt.setRGB(P[0],P[1],P[2]),S=nt}}if(Z[W]=S.r*255+.5|0,Z[W+1]=S.g*255+.5|0,Z[W+2]=S.b*255+.5|0,Q<k-1&&z<U-1){let R=z*k+Q,P=R+1,K=R+k,et=K+1,L=_+Q*x,X=y+z*x,O=_+(Q+1)*x,J=y+(z+1)*x;(!st||!st(L,X,L,J,O,X))&&dt.push(R,K,P),(!st||!st(O,X,L,J,O,J))&&dt.push(P,K,et)}}(z&3)===3&&await v()}let je=!0,$e=o&&o._chunkData&&o._chunkData.procgen;if(je){let z=new a.BufferGeometry;z.setAttribute("position",new a.BufferAttribute(tt,3)),z.setAttribute("color",new a.BufferAttribute(Z,3,!0)),z.setIndex(dt),z=z.toNonIndexed(),await v(!0);{let M=z.attributes.color.array,b=z.attributes.position.array,j=!$e&&!St,D=go(!0)?vo():null,I=Array.isArray(o?.caveSpots)?o.caveSpots:[],W=(e,l,u,p=0)=>{let w=e.rot||-.55,h=l-e.x,d=u-e.z,B=Math.cos(-w),S=Math.sin(-w),H=h*B-d*S,G=h*S+d*B,A=e.len||Math.max(5.5,(e.r||7)*.86),q=Math.abs(H)/Math.max(.001,A),Y=Math.abs(H)/Math.max(.001,A+p*1.2);if(Y>1)return null;let R=Math.sin(H*.78+.91)*.42+Math.sin(H*1.72+2.3)*.16,K=(e.width||1.06)*(.62+Math.max(0,1-Math.min(q,1))*.78)+p,et=Math.abs(G-R)/Math.max(.18,K);if(et>1)return null;let L=1-Math.max(0,(q-.74)/.26);return{core:Math.max(0,1-et)*Math.max(0,Math.min(1,L)),edge:et,along:Y}},$=(e,l,u,p=0)=>{let w=e.rot||0,h=l-e.x,d=u-e.z,B=Math.cos(-w),S=Math.sin(-w),H=h*B-d*S,G=h*S+d*B,A=e.r||3.5,q=A*1.18+p,Y=A*.72+p*.72,R=Math.hypot(H/Math.max(.001,q),(G+A*.12)/Math.max(.001,Y));return R>1?null:{core:Math.max(0,1-R),edge:R,lx:H,lz:G}},ft=(e,l,u,p=.35)=>{if(e.shape==="crack")return!!W(e,l,u,p);if(e.shape==="afk_burrow")return!!$(e,l,u,p);let w=l-e.x,h=u-e.z;return w*w+h*h<e.r*e.r},ht=(e,l,u,p,w,h,d,B,S)=>{if(e.shape==="afk_burrow"){let Y=[[l,u],[p,w],[h,d],[B,S],[(p+h)*.5,(w+d)*.5],[(h+B)*.5,(d+S)*.5],[(B+p)*.5,(S+w)*.5]],R=null;for(let P of Y){let K=$(e,P[0],P[1],.42);K&&(!R||K.core>R.burrow.core)&&(R={wx:P[0],wz:P[1],pad:.42,burrow:K})}return R}if(e.shape!=="crack")return ft(e,l,u)?{wx:l,wz:u,pad:.35}:null;let H=.72,G=[[l,u],[p,w],[h,d],[B,S],[(p+h)*.5,(w+d)*.5],[(h+B)*.5,(d+S)*.5],[(B+p)*.5,(S+w)*.5]],A=null;for(let q of G){let Y=W(e,q[0],q[1],H);Y&&(!A||Y.core>A.crack.core)&&(A={wx:q[0],wz:q[1],pad:H,crack:Y})}return A},E=(e,l,u,p,w,h,d,B)=>{let S=(w-u)*(l-p)-(h-p)*(e-u),H=(d-w)*(l-h)-(B-h)*(e-w),G=(u-d)*(l-B)-(p-B)*(e-d),A=1e-5,q=S<-A||H<-A||G<-A,Y=S>A||H>A||G>A;return!(q&&Y)},V=(e,l,u=.35)=>{for(let p of I){let w=p.shape==="crack"?W(p,e,l,u):null;if(p.shape==="crack"){if(!w)continue;let H=Math.max(0,1-Math.abs(w.edge-.64)/.36)*(1-Math.min(1,w.along)*.25)*(1-w.core*.72);return[.006+H*.15,.001+H*.005,.001+H*.004]}let h=p.shape==="afk_burrow"?$(p,e,l,u):null;if(p.shape==="afk_burrow"){if(!h)continue;let H=Array.isArray(p.holeColor)?p.holeColor:[.012,.004,.052],G=Array.isArray(p.rimColor)?p.rimColor:[.035,.105,.165],A=Math.pow(Math.max(0,Math.min(1,h.edge)),1.55);return[H[0]*(1-A)+G[0]*A,H[1]*(1-A)+G[1]*A,H[2]*(1-A)+G[2]*A]}let d=e-p.x,B=l-p.z;if(!(Math.hypot(d,B)>p.r))return[0,0,0]}return null};for(let e=0;e<M.length;e+=9){let l=(M[e]+M[e+3]+M[e+6])/3,u=(M[e+1]+M[e+4]+M[e+7])/3,p=(M[e+2]+M[e+5]+M[e+8])/3,w=(b[e]+b[e+3]+b[e+6])/3,h=(b[e+1]+b[e+4]+b[e+7])/3,d=(b[e+2]+b[e+5]+b[e+8])/3,B=b[e],S=b[e+2],H=b[e+1],G=b[e+3],A=b[e+4],q=b[e+5],Y=b[e+6],R=b[e+7],P=b[e+8],K=h<ct-.5;if(!K){let O=Math.sin(w*12.9898+d*78.233)*43758.5453,rt=(O-Math.floor(O)-.5)*(St?7.5:.025);l+=rt,u+=rt,p+=rt}if(St&&!K){let O=(kt(w*.18+14.1,d*.18+27.6)-.5)*10+(kt(w*.47+68.4,d*.47+3.9)-.5)*4.5,J=Math.max(-8,Math.min(16,(h-Xt)*5.5));l+=O*.85+J*.62,u+=O*.72+J*.92,p+=O*.5+J*.46}if(j&&!K){let O=so(-w,-d),J=.81-Math.min(O,.49),it=io(Math.max(0,Math.min(1,J)),14),rt=(kt(-w*.018+7.31,-d*.018+13.77)*.45+kt(-w*.045+53.17,-d*.045+97.43)*.28+kt(-w*.1+107.89,-d*.1+151.61)*.16+kt(-w*.22+199.33,-d*.22+263.07)*.11)*.76-.38,xt=.35+.65*Math.max(0,Math.min(1,it)),wt=1-.85+.85*xt,Mt=rt*.08;l=l*wt+Mt,u=u*wt+Mt,p=p*wt+Mt}let et=Math.min(255,Math.max(0,l)),L=Math.min(255,Math.max(0,u)),X=Math.min(255,Math.max(0,p));if(I.length)for(let O=0;O<I.length;O++){let J=I[O];J.isOwn&&(J.shape||"hole")==="hole"&&J._anchorFaceIdx==null&&E(J.x,J.z,B,S,G,q,Y,P)&&(J._anchorFaceIdx=e);let it=ht(J,w,d,B,S,G,q,Y,P);if(it){let rt=V(it.wx,it.wz,it.pad);rt&&(et=rt[0]*255,L=rt[1]*255,X=rt[2]*255),J._faceIdx||(J._faceIdx=[]),J._faceIdx.push(e);break}}if(D){let O=G-B,J=A-H,it=q-S,rt=Y-B,xt=R-H,wt=P-S,Mt=J*wt-it*xt,Dt=it*rt-O*wt,It=O*xt-J*rt,Ot=1/Math.max(1e-6,Math.hypot(Mt,Dt,It));Mt*=Ot,Dt*=Ot,It*=Ot;let yt=Math.max(0,Mt*D.sx+Dt*D.sy+It*D.sz),Wt=D.amb+D.str*yt;et=Math.min(255,et*Wt*D.wr),L=Math.min(255,L*Wt*D.wg),X=Math.min(255,X*Wt*D.wb)}M[e]=M[e+3]=M[e+6]=et,M[e+1]=M[e+4]=M[e+7]=L,M[e+2]=M[e+5]=M[e+8]=X,e%720===0&&e>0&&await v()}for(let e of I){if((!e._faceIdx||!e._faceIdx.length)&&e.isOwn&&(e.shape||"hole")==="hole"&&Number.isInteger(e._anchorFaceIdx)){let l=e._anchorFaceIdx;for(let u=0;u<9;u++)M[l+u]=0;e._faceIdx=[l]}e._anchorFaceIdx=null}z.attributes.color.needsUpdate=!0,D&&(z.userData=z.userData||{},z.userData._sunBaked=!0);for(let e of I){if(!e._faceIdx||!e._faceIdx.length)continue;let l=z.attributes.position.array,u=new Float32Array(e._faceIdx.length*9);for(let d=0;d<e._faceIdx.length;d++){let B=e._faceIdx[d];for(let S=0;S<3;S++)u[d*9+S*3]=l[B+S*3]-e.x,u[d*9+S*3+1]=l[B+S*3+1],u[d*9+S*3+2]=l[B+S*3+2]-e.z}let p=new a.BufferGeometry;p.setAttribute("position",new a.BufferAttribute(u,3)),p.computeBoundingSphere();let w=new a.MeshBasicMaterial({transparent:!0,opacity:0,depthTest:!1,depthWrite:!1,colorWrite:!1}),h=new a.Mesh(p,w);h.position.set(e.x,0,e.z),h.name=`cave_click_${e.seed}`,h.userData.serviceType=e.serviceType||"cave",h.userData.caveSeed=e.seed,h.userData.resourceLabel=e.label||"Cave Entrance",e.afkBossCaveId&&(h.userData.afkBossCaveId=e.afkBossCaveId),Number.isFinite(e.afkBossCaveIndex)&&(h.userData.afkBossCaveIndex=e.afkBossCaveIndex),h.userData._caveClickMesh=!0,e.shape==="crack"&&(h.userData._caveCrackClickMesh=!0),h.renderOrder=re+5,c.add(h),e._faceIdx=null}}z.computeVertexNormals(),z.computeBoundingBox(),z.computeBoundingSphere(),await v(!0);let Q=new a.MeshToonMaterial({vertexColors:!0,gradientMap:ce}),N=new a.Mesh(z,Q);N.renderOrder=re,c.add(N),o._osrsBuilt=!0}if(!(o&&o._osrsBuilt)){let N=Math.ceil((g-_)/1)+1,M=Math.ceil((at-y)/1)+1,b=N+4,j=M+4,D=new Uint8Array(b*j*4);for(let E=0;E<j;E++)for(let V=0;V<b;V++){let e=_+(V-2)*1,l=y+(E-2)*1,u=(E*b+V)*4,p=e-Rt,w=l-Ht,h,d,B,S=`${p},${w}`;if(n&&n[S]){let H=n[S];h=H[0],d=H[1],B=H[2]}else{let H=(e-_)/x,G=(l-y)/x,A=Math.max(0,Math.min(Math.floor(H),k-2)),q=Math.max(0,Math.min(Math.floor(G),U-2)),Y=Math.min(A+1,k-1),R=Math.min(q+1,U-1),P=Math.max(0,Math.min(1,H-A)),K=Math.max(0,Math.min(1,G-q)),et=(q*k+A)*3,L=(q*k+Y)*3,X=(R*k+A)*3,O=(R*k+Y)*3;h=Z[et]*(1-P)*(1-K)+Z[L]*P*(1-K)+Z[X]*(1-P)*K+Z[O]*P*K,d=Z[et+1]*(1-P)*(1-K)+Z[L+1]*P*(1-K)+Z[X+1]*(1-P)*K+Z[O+1]*P*K,B=Z[et+2]*(1-P)*(1-K)+Z[L+2]*P*(1-K)+Z[X+2]*(1-P)*K+Z[O+2]*P*K}D[u]=Math.min(255,Math.max(0,h+.5)),D[u+1]=Math.min(255,Math.max(0,d+.5)),D[u+2]=Math.min(255,Math.max(0,B+.5)),D[u+3]=255}let I=new a.DataTexture(D,b,j,a.RGBAFormat);I.magFilter=a.LinearFilter,I.minFilter=a.LinearFilter,I.wrapS=a.ClampToEdgeWrapping,I.wrapT=a.ClampToEdgeWrapping,I.colorSpace=a.LinearSRGBColorSpace,I.needsUpdate=!0;let W=new Float32Array(k*U*2);for(let E=0;E<U;E++)for(let V=0;V<k;V++){let e=(E*k+V)*2,l=V*x/1+2,u=E*x/1+2;W[e]=(l+.5)/b,W[e+1]=(u+.5)/j}let $=new a.BufferGeometry;$.setAttribute("position",new a.BufferAttribute(tt,3)),$.setAttribute("uv",new a.BufferAttribute(W,2)),$.setIndex(dt),$.computeVertexNormals();{let E=$.attributes.normal.array,V=o&&o._chunkData&&o._chunkData.procgen;for(let e=0;e<U;e++)for(let l=0;l<k;l++)if(l===0||l===k-1||e===0||e===U-1){let u=(e*k+l)*3;E[u]=0,E[u+1]=1,E[u+2]=0}else if(V){let u=(e*k+l)*3;E[u]=0,E[u+1]=1,E[u+2]=0}$.attributes.normal.needsUpdate=!0}$.computeBoundingBox(),$.computeBoundingSphere();let ft=new a.MeshToonMaterial({map:I,gradientMap:ce}),ht=new a.Mesh($,ft);ht.renderOrder=re,c.add(ht)}if(!o||!o.isInstance||o.water===!0){let z=C-T,Q=i-F,N=C-T+1,M=i-F+1,b=8,j=N+b*2,D=M+b*2,I=ot<1/0&&ot>=ct+.1,W;if(!I){if(o&&o._chunkData&&o._chunkData.waterAlpha){let L=o._chunkData.waterAlpha,X=Uint8Array.from(atob(L),O=>O.charCodeAt(0));W=new a.DataTexture(X,j,D,a.RGBAFormat)}else{let L=new Uint8Array(N*M*4);for(let X=0;X<N*M;X++)L[X*4]=107,L[X*4+1]=189,L[X*4+2]=235,L[X*4+3]=112;W=new a.DataTexture(L,N,M,a.RGBAFormat)}W.magFilter=a.LinearFilter,W.minFilter=a.LinearFilter,W.wrapS=a.ClampToEdgeWrapping,W.wrapT=a.ClampToEdgeWrapping,W.needsUpdate=!0;let $=window._shoreCue||{},ft=Array.isArray($.col)&&$.col.length===3?$.col:[.12,.4,.6],ht=typeof $.alpha=="number"?$.alpha:.95,E=Array.isArray($.band)&&$.band.length===2?$.band:[.6,2.5],V=new Uint8Array(k*U*4);for(let L=0,X=k*U;L<X;L++){let O=(ct-tt[L*3+1])*42.5;V[L*4]=O<=0?0:O>=255?255:O|0,V[L*4+3]=255}let e=new a.DataTexture(V,k,U,a.RGBAFormat);e.magFilter=a.LinearFilter,e.minFilter=a.LinearFilter,e.wrapS=a.ClampToEdgeWrapping,e.wrapT=a.ClampToEdgeWrapping,e.needsUpdate=!0;let l=null,u=window._waterShrinkStats||(window._waterShrinkStats={planes:0,baked:0,rects:0});u.planes++;let p=window._waterShrinkOff!==!0&&o&&o._chunkData&&Array.isArray(o._chunkData.waterRects)&&o._chunkData.waterRects.length&&o._chunkData.waterRects.length<=256?o._chunkData.waterRects:null;if(p){let L=(T+C)/2,X=(F+i)/2,O=new Float32Array(p.length*12),J=new Float32Array(p.length*8),it=new Uint16Array(p.length*6),rt=0,xt=0;for(let wt of p){let Mt=T+wt[0],Dt=F+wt[1],It=T+wt[2],Ot=F+wt[3],yt=rt;for(let[Wt,he]of[[Mt,Dt],[It,Dt],[Mt,Ot],[It,Ot]])O[rt*3]=Wt-L,O[rt*3+1]=0,O[rt*3+2]=he-X,J[rt*2]=(Wt-T)/z,J[rt*2+1]=(i-he)/Q,rt++;it[xt++]=yt,it[xt++]=yt+2,it[xt++]=yt+3,it[xt++]=yt,it[xt++]=yt+3,it[xt++]=yt+1}l=new a.BufferGeometry,l.setAttribute("position",new a.BufferAttribute(O,3)),l.setAttribute("uv",new a.BufferAttribute(J,2)),l.setIndex(new a.BufferAttribute(it,1)),l.computeBoundingSphere(),u.baked++,u.rects+=p.length}l||(l=new a.PlaneGeometry(z,Q,8,8),l.rotateX(-Math.PI/2));let w=(b+.5)/j,h=(b+.5)/D,d=(b+N-.5)/j,B=(b+M-.5)/D,S=!!(o&&o._chunkData&&o._chunkData.procgen),H=`
      float tierTint(vec2 worldXZ) {
        float dist = length(worldXZ);
        if (dist > 5704.0)      return 0.55;
        else if (dist > 3630.0) return 0.70;
        else if (dist > 1556.0) return 0.85;
        return 1.0;
      }
    `,G=(Array.isArray(o?.caveSpots)?o.caveSpots:[]).filter(L=>L&&L.shape==="crack").slice(0,4),A=Array.from({length:4},(L,X)=>{let O=G[X];return new a.Vector4(O?.x||0,O?.z||0,O?.len||Math.max(5.5,(O?.r||7)*.86),O?.width||1.06)}),q=Array.from({length:4},(L,X)=>G[X]?.rot||-.55),Y=`
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
      `,P=S?`
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
    `;t.uFancyFx||(t.uFancyFx={value:1}),t.uFxNear||(t.uFxNear={value:9e8}),t.uFxFar||(t.uFxFar={value:9e9});let K=new a.ShaderMaterial({transparent:!0,depthWrite:!0,depthTest:!0,premultipliedAlpha:!0,fog:!0,polygonOffset:!0,polygonOffsetFactor:0,polygonOffsetUnits:4,extensions:{derivatives:S},uniforms:{uTex:{value:W},uTime:t.uTime,uDim:t.uDim||(t.uDim={value:1}),uFancyFx:t.uFancyFx,uFxNear:t.uFxNear,uFxFar:t.uFxFar,uUvMin:{value:new a.Vector2(w,h)},uUvMax:{value:new a.Vector2(d,B)},uDepth:{value:e},uDepthUvMin:{value:new a.Vector2(.5/k,.5/U)},uDepthUvMax:{value:new a.Vector2(1-.5/k,1-.5/U)},uShallowCol:t.uShallowCol||(t.uShallowCol={value:new a.Vector3(ft[0],ft[1],ft[2])}),uShoreAlpha:t.uShoreAlpha||(t.uShoreAlpha={value:ht}),uShoreBand:t.uShoreBand||(t.uShoreBand={value:new a.Vector2(E[0],E[1])}),uShoreOn:t.uShoreOn||(t.uShoreOn={value:window._shoreCue&&window._shoreCue.off!==!0?1:0}),uCrackCount:{value:G.length},uCracks:{value:A},uCrackRot:{value:q},fogColor:{value:new a.Color(10470621)},fogNear:{value:9e8},fogFar:{value:9e8},uShape:t.uShape||{value:0},uCenter:t.uCenter||{value:new a.Vector2(0,0)},uRadius:t.uRadius||{value:1e9}},vertexShader:P,fragmentShader:ee(R)}),et=new a.Mesh(l,K);et.position.set((T+C)/2,ct,(F+i)/2),et.userData.isWaterSurface=!0,et.renderOrder=De,c.add(et)}}if(o&&o.edges){let N=pe("#6a6a5e"),M=o.edges,b=(_+g)/2,j=(y+at)/2,D=g-_,I=at-y;if(M.north){let W=new a.Mesh(new a.BoxGeometry(D+2,12,2),N);W.position.set(b,12/2-1,at+1),c.add(W)}if(M.south){let W=new a.Mesh(new a.BoxGeometry(D+2,12,2),N);W.position.set(b,12/2-1,y-1),c.add(W)}if(M.east){let W=new a.Mesh(new a.BoxGeometry(2,12,I+2),N);W.position.set(g+1,12/2-1,j),c.add(W)}if(M.west){let W=new a.Mesh(new a.BoxGeometry(2,12,I+2),N);W.position.set(_-1,12/2-1,j),c.add(W)}}if(window._enableFoam!==!1&&window._shorelineChains&&!(o&&o.isInstance)){let z=typeof window._foamW=="number"?window._foamW:.6,Q=typeof window._foamInland=="number"?window._foamInland:.5,N=ct+(typeof window._foamY=="number"?window._foamY:.03),M=new a.MeshBasicMaterial({color:10147054,transparent:!0,opacity:.42,depthWrite:!1,side:a.DoubleSide,polygonOffset:!0,polygonOffsetFactor:0,polygonOffsetUnits:-2});o&&o._chunkData&&o._chunkData.procgen||(M.onBeforeCompile=E=>{E.uniforms.uTime=t.uTime,E.vertexShader=E.vertexShader.replace("void main() {",`uniform float uTime;
void main() {`).replace("#include <begin_vertex>",`#include <begin_vertex>
	transformed.y += sin(uTime * 0.5) * 0.025;`)},M.customProgramCacheKey=()=>"shoreFoamBob1");let b=(E,V)=>{let e=(E[0]+V[0])*.5,l=(E[1]+V[1])*.5;return e>=_&&e<g&&l>=y&&l<at},j=4,D=E=>E[0]>=_-j&&E[0]<=g+j&&E[1]>=y-j&&E[1]<=at+j,I=_-j,W=g+j,$=y-j,ft=at+j,ht=(E,V)=>{let e=(E-_)/x,l=(V-y)/x;e=Math.max(0,Math.min(k-1.001,e)),l=Math.max(0,Math.min(U-1.001,l));let u=Math.floor(e),p=Math.floor(l),w=e-u,h=l-p,d=(p*k+u)*3+1;return tt[d]*(1-w)*(1-h)+tt[d+3]*w*(1-h)+tt[d+k*3]*(1-w)*h+tt[d+k*3+3]*w*h};for(let E of window._shorelineChains){let V=E.bbox;if(V&&(V[2]<I||V[0]>W||V[3]<$||V[1]>ft))continue;let e=0,l=0;for(let h=0;h<E.length;h++){let d=E[h];if(!D(d))continue;let B=ht(d[0]+d[2]*1.5,d[1]+d[3]*1.5),S=ht(d[0]-d[2]*1.5,d[1]-d[3]*1.5);B<S?l++:B>S&&(l++,e++)}let u=l&&e*2>l?-1:1,p=[],w=[];for(let h=0;h<E.length;h++){if(!D(E[h]))continue;let[d,B,S,H]=E[h],G=S*u,A=H*u,q=p.length/3;if(p.push(d-G*Q,N,B-A*Q),p.push(d+G*z,N,B+A*z),h>0&&D(E[h-1])&&b(E[h-1],E[h])){let Y=q-2;w.push(Y,Y+2,Y+1,Y+1,Y+2,Y+3)}}if(p.length>=6&&w.length>0){let h=new a.BufferGeometry;h.setAttribute("position",new a.Float32BufferAttribute(p,3)),h.setIndex(w);let d=new a.Mesh(h,M);d.renderOrder=Ie,d.raycast=()=>{},d.userData._isFoam=!0,window._enableFoam===!1&&(d.visible=!1),c.add(d)}}}return c.updateMatrixWorld(!0),c.traverse(z=>{z.matrixAutoUpdate=!1}),c}function Ko(t,r){let n=new a.Group;n.name="props";let o=We(42),s=(i,_)=>i+o()*(_-i);function f(i,_,g,y,at){let k=t[i];if(!k)return;let U=k.clone();U.scale.setScalar(_t*y),U.position.set(_,po(_,g),g),U.rotation.y=at,n.add(U)}let c=["grassClump1","grassClump2","grassClump3","grassClump4"],m=["flowerDaisy","flowerRose","flowerSunflower","flowerTulip"],v=["cattail1","cattail2"],x=["mushroom1","mushroom2"],T=["shell1","shell2","starfish1","starfish2"],C=["palmTree1","palmTree2"];for(let i=0;i<80;i++){let _=s(-36,28),g=s(-34,36),y=Pt(_,g);y.dist<y.width+1.5||Jt(_,g)||le(_,g,3)||Zt(_,g)||f(c[i%c.length],_,g,s(.7,1.1),o()*Math.PI*2)}for(let i=0;i<40;i++){let _=s(-34,26),g=s(-30,34),y=Pt(_,g);y.dist<y.width+2||Jt(_,g)||le(_,g,4)||Zt(_,g)||f(m[i%m.length],_,g,s(.6,1),o()*Math.PI*2)}for(let i=0;i<15;i++){let _=s(-10,30),g=s(-16,38),y=Pt(_,g);y.dist<y.width||y.dist>y.width+3||f(v[i%v.length],_,g,s(.8,1.2),o()*Math.PI*2)}for(let i=0;i<10;i++){let _=s(-32,34),g=s(10,34),y=Pt(_,g);y.dist<y.width+1||Zt(_,g)||f(x[i%x.length],_,g,s(.6,1),o()*Math.PI*2)}for(let i=0;i<8;i++){let _=s(32,46),g=s(-22,2);qt(_,g)||f(T[i%T.length],_,g,s(.5,.9),o()*Math.PI*2)}for(let i=0;i<4;i++){let _=s(34,44),g=s(-20,0);qt(_,g)||f(C[i%C.length],_,g,s(.8,1.2),o()*Math.PI*2)}let F=[[22,20],[26,26],[-24,20],[-18,24],[30,24]];for(let[i,_]of F){let g=i+s(-2,2),y=_+s(-2,2);f("stump",g,y,s(.7,1),o()*Math.PI*2)}return f("hollowTrunk",-28,18,.9,s(0,Math.PI*2)),r.add(n),n}var Ne=new a.MeshToonMaterial({vertexColors:!0,side:a.DoubleSide});Ne.name="dock_merged_static";function Mo(t){if(!t?.children?.length)return!1;let r=new Set;for(let c of t.children)c.name==="dock_deck"&&r.add(c);let n=[],o=[];for(let c of[...t.children])r.has(c)||(c.updateMatrixWorld(!0),c.traverse(m=>{if(!m.isMesh||!m.geometry)return;let v=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();v.applyMatrix4(m.matrixWorld);let x=v.attributes?.position?.count||0;if(!x){v.dispose();return}let T=v.attributes.color,C=m.material?.color||new a.Color(T?1:.55,T?1:.42,T?1:.28),F=new Float32Array(x*3);if(T)for(let i=0;i<x;i++)F[i*3]=T.getX(i)*C.r,F[i*3+1]=T.getY(i)*C.g,F[i*3+2]=(T.itemSize>=3?T.getZ(i):1)*C.b;else for(let i=0;i<x;i++)F[i*3]=C.r,F[i*3+1]=C.g,F[i*3+2]=C.b;v.setAttribute("color",new a.BufferAttribute(F,3));for(let i of Object.keys(v.attributes))i!=="position"&&i!=="normal"&&i!=="color"&&v.deleteAttribute(i);(!v.attributes.normal||!(v.attributes.normal.array instanceof Float32Array))&&v.computeVertexNormals(),n.push(v)}),o.push(c));if(!n.length)return!1;let s=ro(n,!1);for(let c of n)c.dispose();if(!s)return!1;for(let c of o)t.remove(c),c.traverse(m=>{m.isMesh&&(m.geometry=null,m.material=null),m.removeFromParent?.(),m.children&&(m.children.length=0)});let f=new a.Mesh(s,Ne);return f.name="merged_static",f.userData._perfType="mainland_dock",f.userData._dockMerged=!0,f.renderOrder=Vt,t.add(f),!0}function Ve(t){let r=new a.Group;r.name="dock";let n=40,o=4,s=4,f=ct+.15,c=[];if(t.dockSteps){let m=t.dockSteps.clone();m.scale.setScalar(_t),m.position.set(n-_t,f,o),m.rotation.y=Math.PI/2,m.userData._perfType="Prop_Docks_Steps",r.add(m),c.push(m)}for(let m=0;m<s;m++){if(t.dockStr){let v=t.dockStr.clone();v.scale.setScalar(_t),v.position.set(n+m*_t,f,o),v.rotation.y=Math.PI/2,v.userData._perfType="Prop_Docks_Straight",r.add(v),c.push(v)}if(t.dockStrSup)for(let v of[Math.PI/2,-Math.PI/2]){let x=t.dockStrSup.clone();x.scale.setScalar(_t),x.position.set(n+m*_t,f,o),x.rotation.y=v,x.userData._perfType="Prop_Docks_Straight_Supports",r.add(x)}}de(r,c);try{Mo(r)}catch(m){console.warn("[mainland dock] merge failed:",m&&m.message||m)}return r.renderOrder=Vt,r.traverse(m=>{m.isMesh&&(m.renderOrder=Vt)}),r}function jo(){let t=new a.Group;t.name="stepping_stones";let r=new a.CylinderGeometry(.55,.65,.25,8),n=pe("#8a8a82");for(let[o,s]of[[0,20],[-1,18],[1,16],[4,-1],[8,-4],[12,-7]]){let f=new a.Mesh(r,n);f.position.set(o,ct-.05,s),f.rotation.y=Math.random()*Math.PI,f.renderOrder=De+1,t.add(f)}return t}function $o(t,r){let f=te(0,40)+4.8,c=ct+.16,m=(40.9+34.4)/2,v=f*.58+c*.42,x=(i,_=1)=>new a.ShaderMaterial({transparent:!0,depthWrite:!1,side:a.DoubleSide,uniforms:{uTime:r.uTime,uPhase:{value:i},uAlpha:{value:_}},vertexShader:"varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",fragmentShader:ee(`varying vec2 vUv; uniform float uTime,uPhase,uAlpha;
      void main(){
        float t=fract(vUv.y*2.2-uTime*0.45+uPhase);
        float streak=smoothstep(0.0,0.24,t)*smoothstep(1.0,0.62,t);
        float edge=smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x);
        vec3 col=mix(vec3(0.62,0.86,0.97),vec3(0.80,0.95,1.0),streak*0.65);
        float a=edge*(0.26+streak*0.48)*uAlpha;
        gl_FragColor=vec4(col,clamp(a,0.0,0.85)); }`)}),T=(i,_,g,y=1)=>{let at=[[i,f,40.9],[i,v,m],[i,c,34.4]];for(let k=0;k<at.length-1;k++){let[U,tt,Z]=at[k],[dt,Tt,lt]=at[k+1],pt=Math.hypot(Tt-tt,lt-Z),nt=new a.Mesh(new a.PlaneGeometry(_,pt,1,12),x(g+k*.17,y));nt.position.set((U+dt)/2,(tt+Tt)/2,(Z+lt)/2),nt.quaternion.setFromUnitVectors(new a.Vector3(0,1,0),new a.Vector3(0,Tt-tt,lt-Z).normalize()),nt.renderOrder=Vt+1,t.add(nt)}};T(0,3.6,0,1),T(0-1.05,1.4,.22,.7),T(0+1.05,1.4,.41,.7);let C=new a.Mesh(new a.BoxGeometry(3.8,.12,.9),pe("#8a8f92"));C.position.set(0,f+.02,40.9+.2),C.renderOrder=Vt,t.add(C);let F=new a.Mesh(new a.CircleGeometry(2.25,20),new a.MeshBasicMaterial({color:"#dff6ff",transparent:!0,opacity:.42,depthWrite:!1}));F.rotation.x=-Math.PI/2,F.position.set(0,ct+.03,34.4+.15),F.renderOrder=Ie,t.add(F)}var qo=[[20,18,2.2,1.8],[28,28,2.4,3.6],[18,28,2.1,.9],[32,20,1.9,2.4],[24,32,2.3,4.2],[-22,18,2,1],[-30,24,1.9,5.2],[-20,26,2.2,4.5],[-16,-18,1.7,2.1],[14,-18,1.6,.7],[-8,-42,2.4,3.3],[10,30,1.8,.5],[-10,22,2,3.1],[36,28,1.7,4.4],[-34,16,1.9,1.6],[-26,8,1.8,5.7],[6,24,1.6,2.3],[-6,16,1.7,.2],[16,10,1.5,4],[-12,32,2.1,2.9],[26,14,1.8,5.1],[-28,-8,1.6,3.7],[22,-8,1.5,1.3],[-4,28,1.9,4.6],[30,8,1.7,.8],[-18,4,1.6,2.5]],Jo=[[-28,26,1.6,1.4],[-14,8,1.45,2.1],[-20,-6,1.4,.9]],Qo=[[22,34,1.04,3.2],[-26,30,1,4.1],[34,22,.98,5],[-32,18,.95,2.6],[-10,14,.95,1.7],[-16,10,1,5.3],[8,20,.9,.5],[14,12,1.05,3.9],[-22,-2,.92,2.4],[-18,-10,.98,4.6],[6,8,.88,1.2],[-8,4,1.02,3.5],[12,24,.96,5.8],[-24,16,.94,.3]],ta=[[-12,-28,1.1,.4],[12,-28,1.12,2.8],[20,-10,1.1,1.9],[-18,-12,1.08,5],[8,-38,1,3.8]],ea=[[-38,38,4.2,0],[0,42,3.8,1.6],[38,38,4.5,3.1],[-36,40,4,4.7],[36,40,3.6,.8],[-42,20,4.1,2.3],[-42,4,3.9,5.5],[-42,-12,4.4,3.9],[-42,-28,3.5,1.2],[0,-40,4.3,4.1],[-18,-40,3.7,2.8],[18,-40,4,5.8],[-34,-38,4.6,.4],[28,-38,3.8,3.5]],oa=[{x:-4,z:14,phase:0},{x:4,z:4,phase:1.2},{x:8,z:-4,phase:2.4}];function Eo(t){let r=Ve(t);return r.name="loch_south_pier",r.scale.y=.45,r.position.set(-38,0,-4),r}var fe,To,bt,Ye,Ct,Xe=0,ko=t=>t?.seed===gt.seed;function da(t){t.some(ko)||t.push({...gt})}function Ke(t){return To||=xe(t).then(r=>(fe=r,{...r,props:r.props.filter(n=>n.role==="scenery"),pois:r.pois.filter(n=>n.type!=="Svc_FishingSpot")}))}async function ma(t){return(await Ke(t)).hm}function _a(t){bt=t}var $t=t=>({x:gt.worldX+t.x,z:gt.worldZ+t.z});function xa(){if(!bt)return;let t=performance.now()*.001,r=Math.max(0,Math.min(1,t-Xe));Xe=t;let{player:n}=bt,o=Math.hypot(n.position.x-gt.worldX,n.position.z-gt.worldZ)<200;!Ye&&o&&document.body.classList.contains("game-started")&&[Et.arrival,Et.head,...Et.stations,Et.wisperator].every(s=>{let f=$t(s);return window._isChunkLoadedAtWorld?.(f.x,f.z)})&&Ro().catch(s=>console.error("[loch] island setup failed",s)),Ct&&((o||Ct.play.hasLoadedMachine)&&Ct.encounter.update(r),Ct.play.update(r),Ct.wisperator.tick())}function Ro(){return Ye||=So()}async function So(){if(!bt)throw Error("Loch island context is not configured");await Ke(gt);let{scene:t,renderer:r,player:n,camera:o,groundY:s,obstacles:f}=bt,[{buildLochBerryLobber:c},{buildLochFishCannon:m},{buildLochLogBallista:v},{buildLochRockSling:x},{buildLochHunterSling:T},{createLochIslandEncounterPreview:C},{createLochSkillingPlay:F},{playLochSound:i},{buildLochHeadRest:_},{installLochWisperator:g}]=await Promise.all([import("./lochShoreBerryLobber-W5K7IDVY.js"),import("./lochShoreFishCannon-33URXWNG.js"),import("./lochShoreLogBallista-QXHIPN65.js"),import("./lochShoreRockSling-2MLPKBDS.js"),import("./lochShoreHunterSling-LVIFLCWF.js"),import("./lochIslandEncounterPreview-LAMA2NKK.js"),import("./lochSkillingPlay-UJRWVEIO.js"),import("./lochSkillingSounds-ZFCRHNQS.js"),import("./lochHeadRest-PZ4RB3TQ.js"),import("./lochWisperator-TDWQWRXD.js")]),y={...Et,boss:$t(Et.boss),head:$t(Et.head)};t.add(_(y.head,s));let at=await Ee(),k=new Map,U={hunter:()=>T(at),berry:c,fish:m,log:v,rock:x};for(let lt of Et.stations){let pt=$t(lt),nt=U[lt.key]();await Te(nt,lt.key),nt.position.set(pt.x,s(pt.x,pt.z),pt.z),nt.rotation.y=Math.atan2(y.boss.x-pt.x,y.boss.z-pt.z),t.add(nt);let zt=new Ze.AnimationMixer(nt);zt.clipAction(nt.animations.find(Rt=>Rt.name==="Idle")).play(),k.set(lt.key,{root:nt,mixer:zt,name:lt.name}),f.push({x:pt.x,z:pt.z,radius:1.65,id:"loch_"+lt.key})}let tt,Z=C({scene:t,layout:y,terrainHeight:s,waterY:ct,machines:k,authoritative:!0,onEvent:lt=>{i(lt),tt?.machineEvent(lt)}});Z.boss.root.visible=!1,await r.compileAsync(Z.boss.root,o,t),Z.boss.root.visible=!0;let dt=document.createElement("div");dt.id="loch-island-visit",document.body.append(dt),tt=await F({...bt,island:fe,record:gt,machines:k,encounter:Z,panel:dt});let Tt=await g({...bt,record:gt,position:Et.wisperator});return Ct={record:gt,island:fe,machines:k,encounter:Z,pier:t.getObjectByName("loch_south_pier"),groundY:s,player:n,play:tt,wisperator:Tt},Ct}export{Zo as a,po as b,Yo as c,Ko as d,Ve as e,jo as f,$o as g,qo as h,Jo as i,Qo as j,ta as k,ea as l,oa as m,Eo as n,ko as o,da as p,Ke as q,ma as r,_a as s,xa as t,Ro as u};

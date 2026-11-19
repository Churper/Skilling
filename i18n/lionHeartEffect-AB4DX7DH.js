import"./chunk-7MI2BWQZ.js";import*as e from"three";import{GLTFLoader as S}from"three/addons/loaders/GLTFLoader.js";var H;function B(){return H||(H=new S().loadAsync(new URL("../../models/items/Lion_Heart.glb",import.meta.url).href).then(({scene:c})=>{let g=new e.Box3().setFromObject(c),p=g.getCenter(new e.Vector3);c.position.sub(p);let u=new e.Group;u.add(c);let o=g.getSize(new e.Vector3);return u.scale.setScalar(.86/Math.max(o.x,o.y,o.z)),u}).catch(c=>{throw H=null,c})),H}var y=.25,A=y+.54,R;function F(c,g){if(!R){R=c.createBuffer(1,Math.ceil(24e3*1.12),24e3);let o=R.getChannelData(0),l=2*Math.PI,d=3959,n=0,E=0;for(let a=0;a<o.length;a++){let f=a/24e3,t=f-y;d=Math.imul(d,1664525)+1013904223>>>0,n+=.25*(d/2147483648-1-n),E+=.042*(n-E);let s=n-E;if(t<0){let h=Math.exp(19*t);o[a]=.26*h*s+.07*h*Math.sin(l*(365*f+510*f*f))}else{let h=1-Math.exp(-230*t),i=Math.sin(l*(86*t+7.8*(1-Math.exp(-18*t)))),x=Math.sin(l*(485*t+5.7*(1-Math.exp(-16*t)))),v=Math.sin(l*(972*t+3.2*(1-Math.exp(-31*t))));o[a]=h*(.56*i*Math.exp(-12*t)+.25*x*Math.exp(-7.6*t)+.14*v*Math.exp(-11*t)+.33*s*Math.exp(-21*t))}}let r=o.slice();for(let[a,f]of[[.031,.14],[.067,.09],[.113,.06],[.173,.032]]){let t=Math.round(24e3*a);for(let s=t;s<o.length;s++)o[s]+=f*r[s-t]}for(let a=0;a<240;a++)o[o.length-1-a]*=a/240}let p=c.createBufferSource();p.buffer=R,p.connect(g),p.onended=()=>p.disconnect(),p.start()}function z(){let c=[],g=[],p=[],u=[];function o(r,a,f,t,s){let h=c.length/3;for(let i=0;i<r.length;i++){let[x,v,b,M]=r[i],w=a*(i===0||i===r.length-1?.35:1);if(c.push(x-w,v,b,x+w,v,b),g.push(-1,M,1,M),p.push(f,t,s,f,t,s),i){let m=h+2*i;u.push(m-2,m-1,m,m-1,m+1,m)}}}let l=[0,.12,.27,.35,.48,.54,.69,.77,.93,1];[[[-.28,-.56,-.75,-.51,-.7,-.43,-.49,-.22,-.3,-.08],.2,2.46,-.16,.42],[[.22,.46,.67,.45,.68,.4,.49,.28,.36,.18],-.12,2.78,-.075,.34],[[-.5,-.3,-.51,-.27,-.36,-.16,-.31,-.13,-.17,.03],-.24,2.54,.07,.34],[[.56,.71,.44,.53,.25,.41,.13,.3,.1,.19],.12,2.32,.19,.35]].forEach(([r,a,f,t,s],h)=>{let i=l.map((T,k)=>[r[k],.16+f*T,a+.09*Math.sin(5*T+h),T]),x=y+t;o(i,.072,x,s,h);let[v,b,M,w]=i[4],m=h%2?1:-1;o([i[4],[v+.13*m,b+.14,M,w+.055],[v+.085*m,b+.24,M,w+.095],[v+.26*m,b+.42,M,w+.17]],.039,x,s,h)});let n=new e.BufferGeometry;n.setAttribute("position",new e.Float32BufferAttribute(c,3)),n.setAttribute("uv",new e.Float32BufferAttribute(g,2)),n.setAttribute("stroke",new e.Float32BufferAttribute(p,3)),n.setIndex(u);let E=new e.ShaderMaterial({side:e.DoubleSide,transparent:!0,depthWrite:!1,uniforms:{time:{value:0}},vertexShader:`attribute vec3 stroke; uniform float time;
      varying vec2 ribbon; varying float head;
      float hash(float x){return fract(sin(x)*43758.5453);}
      void main(){
        float age=(time-stroke.x)/stroke.y;
        head=age*1.38;
        ribbon=uv;
        float tick=max(0.,time-stroke.x)*19.;
        float node=floor(uv.y*128.)+19.*stroke.z;
        float jitter=mix(hash(node+floor(tick)*79.), hash(node+(floor(tick)+1.)*79.),
                         smoothstep(.05,.83,fract(tick)))-.5;
        vec3 p=position;
        p.x+=jitter*.18*sin(3.14159*uv.y);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,fragmentShader:`varying vec2 ribbon; varying float head;
      void main(){
        float behind=head-ribbon.y;
        if(behind<-.055 || behind>.39) discard;
        float tip=smoothstep(-.055,.015,behind);
        float wake=1.-smoothstep(.025,.39,behind);
        float edge=abs(ribbon.x)/(.20+.80*wake);
        float halo=exp(-3.2*edge*edge)*(1.-smoothstep(.65,1.,edge));
        float core=(1.-smoothstep(.09,.38,edge))*wake;
        vec3 hue=mix(vec3(.51,.085,.92),vec3(1.,.84,1.),core);
        gl_FragColor=vec4(hue,tip*wake*halo);
        #include <colorspace_fragment>
      }`});return new e.Mesh(n,E)}function G(c,g,p,u){let o=new e.Group,l=new e.Group,d=z(),n=new e.Mesh(new e.PlaneGeometry(1,1),new e.ShaderMaterial({transparent:!0,depthWrite:!1,uniforms:{strength:{value:0}},vertexShader:`varying vec2 p;
      void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 p;uniform float strength;
      void main(){
        float r=length(p);
        float light=exp(-3.4*r*r)*(1.-smoothstep(.65,1.,r));
        gl_FragColor=vec4(mix(vec3(.52,.16,.94),vec3(1.,.79,.96),light),light*strength);
        #include <colorspace_fragment>
      }`}));return n.renderOrder=-1,l.add(g.clone()),o.add(n,d,l),c.add(o),function(r){if(r>=1.8)return o.removeFromParent(),d.geometry.dispose(),d.material.dispose(),n.geometry.dispose(),n.material.dispose(),!1;o.position.copy(p()),d.rotation.y=Math.atan2(u.position.x-o.position.x,u.position.z-o.position.z),d.visible=r<A,d.material.uniforms.time.value=r;let a=Math.min(1,r/.95),f=Math.min(1,(1.8-r)/.45);l.position.y=.9+1.23*(1-(1-a)**2)+Math.max(0,r-.95)*.16,l.quaternion.copy(u.quaternion);let t=r-y;n.visible=t>-.06&&t<.38,n.visible&&(n.position.copy(l.position),n.quaternion.copy(u.quaternion),n.translateZ(-.3),n.scale.setScalar(1.2+3.5*Math.max(0,t)),n.material.uniforms.strength.value=.85*Math.exp(t<0?55*t:-9*t)),l.rotateY(Math.sin(r*3.7)*.36);let s=Math.exp(-(((r-y)/.095)**2)),h=.12*s-.075*Math.exp(-(((r-y-.14)/.12)**2)),i=(.8+.25*s)*Math.min(1,r/.11)*f;return l.scale.set(i*(1+h),i*(1-h),i),!0}}export{B as loadHeartEffect,G as showLionHeart,F as soundLionHeart};

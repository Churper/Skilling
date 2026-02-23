import * as THREE from "three";

function addSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      cTop: { value: new THREE.Color("#3d87d1") },
      cMid: { value: new THREE.Color("#77c0f0") },
      cBot: { value: new THREE.Color("#d8effb") },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPos = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 cTop;
      uniform vec3 cMid;
      uniform vec3 cBot;
      uniform float uTime;
      varying vec3 vPos;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.55;
        for (int i = 0; i < 4; i++) {
          v += noise(p) * a;
          p *= 2.05;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        float h = normalize(vPos).y * 0.5 + 0.5;
        vec3 c = mix(cBot, cMid, smoothstep(0.0, 0.62, h));
        c = mix(c, cTop, smoothstep(0.60, 1.0, h));
        vec2 uv = normalize(vPos).xz * 3.2 + vec2(uTime * 0.01, -uTime * 0.004);
        float cloud = smoothstep(0.62, 0.9, fbm(uv + vec2(0.0, 8.0)));
        c = mix(c, vec3(1.0), cloud * smoothstep(0.46, 0.9, h) * 0.24);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(420, 32, 18), skyMat));
  return skyMat;
}

function createGround(scene) {
  const terrainGeo = new THREE.PlaneGeometry(230, 230, 140, 140);
  const tPos = terrainGeo.attributes.position;
  const tCol = [];
  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getY(i);
    const r = Math.hypot(x, z);
    const h = Math.sin(x * 0.045) * 0.6 + Math.cos(z * 0.037) * 0.56 + Math.sin((x + z) * 0.021) * 0.42;
    const bowlFalloff = 1.0 - THREE.MathUtils.smoothstep(r, 0, 30.5);
    const lakeBasin = Math.pow(bowlFalloff, 1.55) * 1.06;
    tPos.setZ(i, h * 0.30 - lakeBasin);
    const g = 0.53 + h * 0.045;
    tCol.push(0.42, g, 0.43);
  }
  terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(tCol, 3));
  terrainGeo.computeVertexNormals();

  const ground = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshToonMaterial({ vertexColors: true })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  return ground;
}

function createLakeBowlMesh(radius = 24.15, segments = 140) {
  const geo = new THREE.CircleGeometry(radius, segments);
  const p = geo.attributes.position;
  const colors = [];
  const deep = new THREE.Color("#2f7bb2");
  const mid = new THREE.Color("#58b6db");
  const shelf = new THREE.Color("#d7c79f");

  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getY(i);
    const r = Math.min(1, Math.hypot(x, z) / radius);
    const depth = Math.pow(1 - r, 1.45);
    const lip = THREE.MathUtils.smoothstep(r, 0.82, 1.0);
    p.setZ(i, -(0.05 + depth * 0.44 + lip * 0.06));

    const c = new THREE.Color();
    if (r < 0.68) {
      c.copy(deep).lerp(mid, r / 0.68);
    } else {
      c.copy(mid).lerp(shelf, (r - 0.68) / 0.32);
    }
    c.multiplyScalar(0.84 + (1 - r) * 0.2);
    colors.push(c.r, c.g, c.b);
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const bowl = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  bowl.rotation.x = -Math.PI / 2;
  bowl.position.y = 0.58;
  return bowl;
}

function createWater(scene) {
  const waterUniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color("#7ce8ff") },
    uDeep: { value: new THREE.Color("#218ad8") },
  };

  const lakeFloor = createLakeBowlMesh();
  scene.add(lakeFloor);

  const causticMap = createCausticTexture();
  const floorCaustics = new THREE.Mesh(
    new THREE.CircleGeometry(24.0, 140),
    new THREE.MeshBasicMaterial({
      map: causticMap,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  floorCaustics.rotation.x = -Math.PI / 2;
  floorCaustics.position.y = 0.53;
  scene.add(floorCaustics);

  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: waterUniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;
      void main() {
        vUv = uv;
        vec3 p = position;
        float w0 = sin((uv.x * 9.0 + uv.y * 6.0) + uTime * 1.7) * 0.06;
        float w1 = sin((uv.x * 15.0 - uv.y * 8.0) - uTime * 1.2) * 0.04;
        float w2 = sin((uv.x * 22.0 + uv.y * 16.0) + uTime * 2.3) * 0.02;
        p.y += w0 + w1 + w2;
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform vec3 uShallow;
      uniform vec3 uDeep;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.55;
        for (int i = 0; i < 4; i++) {
          v += noise(p) * a;
          p *= 2.05;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = vUv;
        float t = uTime;
        float distCenter = distance(uv, vec2(0.5));
        float shore = smoothstep(0.03, 0.9, distCenter);
        vec2 wp = vWorldPos.xz * 0.12;

        vec2 flowA = wp * 2.3 + vec2(t * 0.18, -t * 0.10);
        vec2 flowB = wp * 3.1 + vec2(-t * 0.14, t * 0.12);
        float causticA = fbm(flowA);
        float causticB = fbm(flowB);
        float caustic = smoothstep(0.44, 0.84, causticA * 0.58 + causticB * 0.42);

        float waveA = sin(wp.x * 8.0 + wp.y * 2.6 + t * 1.8) * 0.5 + 0.5;
        float waveB = sin(wp.y * 7.2 - wp.x * 3.1 - t * 1.5) * 0.5 + 0.5;
        float crest = smoothstep(0.84, 1.0, waveA * 0.58 + waveB * 0.42);
        float streaks = smoothstep(0.62, 0.95, caustic) * smoothstep(0.45, 1.0, shore);

        vec3 base = mix(uDeep, uShallow, shore);
        base += vec3(0.08, 0.13, 0.17) * caustic;
        base += vec3(0.11, 0.16, 0.2) * crest * 0.42;

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 2.6);
        base += vec3(0.08, 0.14, 0.19) * fresnel;

        float spark = smoothstep(0.75, 1.0, sin((wp.x + wp.y) * 6.6 + t * 1.9) * 0.5 + 0.5);
        base += vec3(0.09, 0.1, 0.1) * spark * (0.36 + 0.64 * shore);

        float foamEdge = smoothstep(0.84, 1.0, distCenter) * smoothstep(0.46, 0.98, caustic);
        vec3 color = mix(base, vec3(0.98, 1.0, 1.0), foamEdge * 0.88);
        color = mix(color, vec3(0.95, 1.0, 1.0), streaks * 0.12);

        float alpha = mix(0.60, 0.30, shore) + foamEdge * 0.16 + fresnel * 0.04;
        gl_FragColor = vec4(color, clamp(alpha, 0.28, 0.82));
      }
    `,
  });

  const water = new THREE.Mesh(new THREE.CircleGeometry(24.55, 140), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.585;
  scene.add(water);

  const deepTint = new THREE.Mesh(
    new THREE.CircleGeometry(21.6, 80),
    new THREE.MeshBasicMaterial({ color: "#176fc0", transparent: true, opacity: 0.06, depthWrite: false })
  );
  deepTint.rotation.x = -Math.PI / 2;
  deepTint.position.y = 0.405;
  scene.add(deepTint);

  return { waterUniforms, causticMap };
}

function createCausticTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const r = 8 + Math.random() * 16;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2.2, 2.2);
  return tex;
}

function radialTexture(inner = 0.05, outer = 1.0) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 128 * inner, 128, 128, 128 * outer);
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.7, "rgba(255,255,255,0.45)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addShadowBlob(scene, blobTex, x, z, radius = 1.8, opacity = 0.2) {
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: "#3f4f4f", opacity })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(x, 0.17, z);
  scene.add(blob);
  return blob;
}

function addRock(scene, blobTex, x, z, scale = 1) {
  const geo = new THREE.DodecahedronGeometry(1.0 * scale, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i);
    const ny = p.getY(i);
    const nz = p.getZ(i);
    const jitter = 1.0 + Math.sin(nx * 7.1 + ny * 5.3 + nz * 6.4) * 0.09;
    p.setXYZ(i, nx * jitter, ny * jitter, nz * jitter);
  }
  geo.computeVertexNormals();

  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshToonMaterial({ color: "#98a49f" })
  );
  rock.position.set(x, 0.8 * scale, z);
  rock.rotation.y = Math.random() * Math.PI;
  scene.add(rock);
  addShadowBlob(scene, blobTex, x, z, 1.45 * scale, 0.17);
}

function addWaterRock(scene, x, z, scale = 1) {
  const geo = new THREE.DodecahedronGeometry(0.75 * scale, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i);
    const ny = p.getY(i);
    const nz = p.getZ(i);
    const jitter = 1.0 + Math.sin(nx * 8.2 + ny * 6.4 + nz * 7.6) * 0.08;
    p.setXYZ(i, nx * jitter, ny * jitter, nz * jitter);
  }
  geo.computeVertexNormals();

  const rock = new THREE.Mesh(
    geo,
    new THREE.MeshToonMaterial({ color: "#7f8f96" })
  );
  rock.position.set(x, 0.47, z);
  rock.rotation.y = Math.random() * Math.PI;
  scene.add(rock);
}

function addTree(scene, blobTex, x, z, scale = 1) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3 * scale, 0.46 * scale, 4.3 * scale, 8),
    new THREE.MeshToonMaterial({ color: "#9f7b63" })
  );
  trunk.position.set(x, 2.16 * scale, z);
  trunk.rotation.z = (Math.random() - 0.5) * 0.16;
  scene.add(trunk);

  const leafMat = new THREE.MeshToonMaterial({ color: "#7fe2c5" });
  const top = new THREE.Vector3(x, 4.3 * scale, z);
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.34 * scale, 3.0 * scale, 6), leafMat);
    frond.position.copy(top);
    frond.rotation.y = (i / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    frond.rotation.z = Math.PI * 0.5 + 0.34 + (Math.random() - 0.5) * 0.08;
    frond.position.x += Math.cos(frond.rotation.y) * 0.14 * scale;
    frond.position.z += Math.sin(frond.rotation.y) * 0.14 * scale;
    scene.add(frond);
  }

  addShadowBlob(scene, blobTex, x, z, 2.6 * scale, 0.16);
}

function addReedPatch(scene, x, z, count = 7) {
  for (let i = 0; i < count; i++) {
    const reed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.95 + Math.random() * 0.45, 5),
      new THREE.MeshToonMaterial({ color: "#93b86e" })
    );
    reed.position.set(x + (Math.random() - 0.5) * 0.9, 0.48, z + (Math.random() - 0.5) * 0.9);
    reed.rotation.z = (Math.random() - 0.5) * 0.28;
    scene.add(reed);
  }
}

function addLounge(scene, blobTex, x, z, rot = 0) {
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.24, 1.05),
    new THREE.MeshToonMaterial({ color: "#ffe600" })
  );
  base.position.set(x, 0.72, z);
  base.rotation.y = rot;
  scene.add(base);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.2, 0.7),
    new THREE.MeshToonMaterial({ color: "#ffe84a" })
  );
  back.position.set(x - Math.sin(rot) * 0.42, 0.98, z - Math.cos(rot) * 0.42);
  back.rotation.y = rot;
  back.rotation.x = -0.28;
  scene.add(back);

  addShadowBlob(scene, blobTex, x, z, 1.7, 0.12);
}

function addShoreDecor(scene, blobTex) {
  [[-28, 21], [28, 20], [-21, -24], [20, -26], [0, 30], [34, -2], [-33, 0]].forEach(([x, z], i) =>
    addTree(scene, blobTex, x, z, 0.85 + (i % 4) * 0.08)
  );
  [[10, 25, 1.15], [-11, 23, 1.08], [23, 10, 0.9], [-24, -3, 1.22], [16, -19, 1.0], [-5, -27, 1.12]].forEach(
    ([x, z, s]) => addRock(scene, blobTex, x, z, s)
  );
  [[19, 17], [24, -8], [-19, 14], [-21, -11], [4, 24], [-3, 24], [17, -18], [-13, -20], [26, 5], [-26, 4]].forEach(
    ([x, z]) => addReedPatch(scene, x, z)
  );
  [[14, 18, Math.PI * 0.1], [17, 13, Math.PI * 0.1], [-15, 18, -Math.PI * 0.15], [-18, 13, -Math.PI * 0.15]].forEach(
    ([x, z, r]) => addLounge(scene, blobTex, x, z, r)
  );
}

function addWaterRocks(scene) {
  [[-7.2, 4.3, 1.05], [5.6, 7.1, 0.95], [8.8, -4.5, 1.1], [-6.5, -6.2, 0.9], [0.6, 9.2, 0.8]].forEach(
    ([x, z, s]) => addWaterRock(scene, x, z, s)
  );
}

function addLakeRings(scene) {
  const beachRing = new THREE.Mesh(
    new THREE.RingGeometry(26, 33.5, 120),
    new THREE.MeshToonMaterial({ color: "#f4e7c5", side: THREE.DoubleSide })
  );
  beachRing.rotation.x = -Math.PI / 2;
  beachRing.position.y = 0.62;
  scene.add(beachRing);

  const shorelineFoam = new THREE.Mesh(
    new THREE.RingGeometry(25.2, 26.6, 120),
    new THREE.MeshBasicMaterial({ color: "#f8ffff", transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide })
  );
  shorelineFoam.rotation.x = -Math.PI / 2;
  shorelineFoam.position.y = 0.64;
  scene.add(shorelineFoam);

  const shorelineAO = new THREE.Mesh(
    new THREE.RingGeometry(26.5, 28.3, 120),
    new THREE.MeshBasicMaterial({ color: "#9db79b", transparent: true, opacity: 0.03, depthWrite: false, side: THREE.DoubleSide })
  );
  shorelineAO.rotation.x = -Math.PI / 2;
  shorelineAO.position.y = 0.61;
  scene.add(shorelineAO);

  const poolEdge = new THREE.Mesh(
    new THREE.RingGeometry(24.8, 25.2, 120),
    new THREE.MeshToonMaterial({ color: "#f7fbff", side: THREE.DoubleSide })
  );
  poolEdge.rotation.x = -Math.PI / 2;
  poolEdge.position.y = 0.66;
  scene.add(poolEdge);
}

export function createWorld(scene) {
  const skyMat = addSky(scene);
  const ground = createGround(scene);
  addLakeRings(scene);
  const { waterUniforms, causticMap } = createWater(scene);
  addWaterRocks(scene);
  const blobTex = radialTexture();
  addShoreDecor(scene, blobTex);
  const addBlob = (x, z, radius, opacity) => addShadowBlob(scene, blobTex, x, z, radius, opacity);
  return { ground, skyMat, waterUniforms, causticMap, addShadowBlob: addBlob };
}

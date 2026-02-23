import * as THREE from "three";

function createToonGradient() {
  const c = document.createElement("canvas");
  c.width = 6;
  c.height = 1;
  const ctx = c.getContext("2d");
  const ramp = [26, 68, 118, 176, 232, 255];
  for (let i = 0; i < ramp.length; i++) {
    const v = ramp[i];
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(i, 0, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const TOON_GRADIENT = createToonGradient();

function toonMat(color, options = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRADIENT, ...options });
}

const TERRAIN_BASIN_RADIUS = 31.0;
const LAKE_RADIUS = 24.15;
const WATER_RADIUS = 24.34;
const LAKE_BOWL_Y = 0.58;
const WATER_SURFACE_Y = 0.596;

function sampleTerrainNoise(x, z) {
  return Math.sin(x * 0.045) * 0.6 + Math.cos(z * 0.037) * 0.56 + Math.sin((x + z) * 0.021) * 0.42;
}

function sampleTerrainHeight(x, z) {
  const r = Math.hypot(x, z);
  const noise = sampleTerrainNoise(x, z);
  const bowlFalloff = 1.0 - THREE.MathUtils.smoothstep(r, 0, TERRAIN_BASIN_RADIUS);
  const lakeBasin = Math.pow(bowlFalloff, 1.65) * 1.15;
  return noise * 0.29 - lakeBasin;
}

function sampleLakeFloorHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r > LAKE_RADIUS) return -Infinity;

  const radius01 = Math.min(1, r / LAKE_RADIUS);
  const depth = Math.pow(1 - radius01, 1.82);
  const lip = THREE.MathUtils.smoothstep(radius01, 0.74, 1.0);
  const localY = -(0.1 + depth * 1.95 + lip * 0.08);
  return LAKE_BOWL_Y + localY;
}

export function getWorldSurfaceHeight(x, z) {
  const terrain = sampleTerrainHeight(x, z);
  const lakeFloor = sampleLakeFloorHeight(x, z);
  return Number.isFinite(lakeFloor) ? lakeFloor : terrain;
}

export function getWaterSurfaceHeight(x, z, time = 0) {
  const r = Math.hypot(x, z);
  if (r > WATER_RADIUS) return -Infinity;

  const uvx = x / (WATER_RADIUS * 2) + 0.5;
  const uvy = z / (WATER_RADIUS * 2) + 0.5;
  const w0 = Math.sin((uvx * 6.2 + uvy * 4.9) + time * 1.22) * 0.012;
  const w1 = Math.sin((uvx * 10.5 - uvy * 7.2) - time * 1.0) * 0.007;
  const w2 = Math.sin((uvx * 19.0 + uvy * 12.0) + time * 1.58) * 0.003;
  return WATER_SURFACE_Y + w0 + w1 + w2;
}

function addSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      cTop: { value: new THREE.Color("#2f83d2") },
      cMid: { value: new THREE.Color("#77caf8") },
      cBot: { value: new THREE.Color("#e8f7ff") },
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
  const colGrassDark = new THREE.Color("#5f8e59");
  const colGrassLight = new THREE.Color("#8ab26f");
  const colBeachBlend = new THREE.Color("#ceb785");
  const colTmp = new THREE.Color();

  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getY(i);
    const r = Math.hypot(x, z);
    const y = sampleTerrainHeight(x, z);
    tPos.setZ(i, y);

    const noise = sampleTerrainNoise(x, z);
    const hillShade = THREE.MathUtils.clamp((y + 0.8) / 1.75, 0, 1);
    const shoreBlend = THREE.MathUtils.smoothstep(r, 21.4, 34.0);
    colTmp.copy(colGrassDark).lerp(colGrassLight, hillShade * 0.85 + noise * 0.04 + 0.08);
    colTmp.lerp(colBeachBlend, shoreBlend * 0.38);
    colTmp.multiplyScalar(0.92 + (noise + 0.8) * 0.05);
    tCol.push(colTmp.r, colTmp.g, colTmp.b);
  }
  terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(tCol, 3));
  terrainGeo.computeVertexNormals();

  const ground = new THREE.Mesh(
    terrainGeo,
    toonMat("#ffffff", { vertexColors: true })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  return ground;
}

function createLakeBowlMesh(radius = LAKE_RADIUS, segments = 180) {
  const geo = new THREE.CircleGeometry(radius, segments);
  const p = geo.attributes.position;
  const colors = [];
  const deep = new THREE.Color("#062f5b");
  const mid = new THREE.Color("#2779ad");
  const shelf = new THREE.Color("#d6c291");

  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getY(i);
    const r = Math.min(1, Math.hypot(x, z) / radius);
    const depth = Math.pow(1 - r, 1.82);
    const lip = THREE.MathUtils.smoothstep(r, 0.74, 1.0);
    p.setZ(i, -(0.1 + depth * 1.95 + lip * 0.08));

    const c = new THREE.Color();
    if (r < 0.58) {
      c.copy(deep).lerp(mid, r / 0.58);
    } else {
      c.copy(mid).lerp(shelf, (r - 0.58) / 0.42);
    }
    c.multiplyScalar(0.9 + (1 - r) * 0.26);
    colors.push(c.r, c.g, c.b);
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const bowl = new THREE.Mesh(geo, toonMat("#ffffff", { vertexColors: true, side: THREE.DoubleSide }));
  bowl.rotation.x = -Math.PI / 2;
  bowl.position.y = LAKE_BOWL_Y;
  return bowl;
}

function createWater(scene) {
  const waterUniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color("#a8f6ff") },
    uDeep: { value: new THREE.Color("#0a4a86") },
  };

  const lakeFloor = createLakeBowlMesh();
  scene.add(lakeFloor);

  const shallowShelf = new THREE.Mesh(
    new THREE.RingGeometry(22.3, 24.3, 180),
    new THREE.MeshBasicMaterial({ color: "#d7c291", transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide })
  );
  shallowShelf.rotation.x = -Math.PI / 2;
  shallowShelf.position.y = 0.54;
  scene.add(shallowShelf);

  const dropoffBand = new THREE.Mesh(
    new THREE.RingGeometry(18.8, 22.6, 180),
    new THREE.MeshBasicMaterial({ color: "#1b5b89", transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide })
  );
  dropoffBand.rotation.x = -Math.PI / 2;
  dropoffBand.position.y = 0.48;
  scene.add(dropoffBand);

  const causticMap = createCausticTexture();
  const floorCaustics = new THREE.Mesh(
    new THREE.CircleGeometry(24.08, 180),
    new THREE.MeshBasicMaterial({
      map: causticMap,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  floorCaustics.rotation.x = -Math.PI / 2;
  floorCaustics.position.y = 0.34;
  scene.add(floorCaustics);

  const foamStripMap = createFoamStripTexture();
  const shorelineFoam = new THREE.Mesh(
    new THREE.RingGeometry(24.04, 24.66, 220),
    new THREE.MeshBasicMaterial({
      map: foamStripMap,
      color: "#f6fdff",
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  shorelineFoam.rotation.x = -Math.PI / 2;
  shorelineFoam.position.y = 0.607;
  scene.add(shorelineFoam);

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
        float w0 = sin((uv.x * 6.2 + uv.y * 4.9) + uTime * 1.22) * 0.012;
        float w1 = sin((uv.x * 10.5 - uv.y * 7.2) - uTime * 1.0) * 0.007;
        float w2 = sin((uv.x * 19.0 + uv.y * 12.0) + uTime * 1.58) * 0.003;
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
        float a = 0.52;
        for (int i = 0; i < 4; i++) {
          v += noise(p) * a;
          p *= 2.04;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        float t = uTime;
        float radial = clamp(distance(vUv, vec2(0.5)) / 0.5, 0.0, 1.0);
        float depth01 = pow(1.0 - radial, 1.45);
        vec2 wp = vWorldPos.xz;

        float warp = fbm(wp * 0.13 + vec2(t * 0.14, -t * 0.11)) * 2.0 - 1.0;
        float lineA = sin((wp.x * 0.9 + wp.y * 0.52) + warp * 2.1 + t * 1.95);
        float lineB = sin((wp.x * 1.27 - wp.y * 0.82) - warp * 1.6 - t * 1.48);
        float rippleMix = lineA * 0.58 + lineB * 0.42;
        float rippleLines = smoothstep(0.45, 0.95, rippleMix * 0.5 + 0.5);

        float shoreWaves = sin(radial * 72.0 - t * 2.2 + warp * 3.0) * 0.5 + 0.5;
        float shoreRipples = smoothstep(0.62, 0.95, shoreWaves) * smoothstep(0.68, 0.98, radial);

        vec3 base = mix(uShallow, uDeep, pow(depth01, 1.12));
        base += vec3(0.07, 0.11, 0.14) * rippleLines * 0.42;
        base += vec3(0.10, 0.12, 0.13) * shoreRipples * 0.26;

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 2.4);
        base += vec3(0.07, 0.12, 0.16) * fresnel * 0.62;

        float foamNoise = fbm(wp * 0.28 + vec2(t * 0.38, -t * 0.24));
        float foamEdge = smoothstep(0.78, 1.0, radial + (foamNoise - 0.5) * 0.07);
        vec3 color = mix(base, vec3(0.97, 1.0, 1.0), foamEdge * 0.78);

        float alpha = mix(0.2, 0.82, pow(depth01, 1.1));
        alpha += rippleLines * 0.03 + shoreRipples * 0.05 + fresnel * 0.03 + foamEdge * 0.08;
        gl_FragColor = vec4(color, clamp(alpha, 0.18, 0.88));
      }
    `,
  });

  const water = new THREE.Mesh(new THREE.CircleGeometry(WATER_RADIUS, 180), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_SURFACE_Y;
  scene.add(water);

  const deepTint = new THREE.Mesh(
    new THREE.CircleGeometry(18.7, 100),
    new THREE.MeshBasicMaterial({ color: "#063867", transparent: true, opacity: 0.35, depthWrite: false })
  );
  deepTint.rotation.x = -Math.PI / 2;
  deepTint.position.y = 0.12;
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
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const r = 12 + Math.random() * 24;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.22)");
    g.addColorStop(0.5, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 8; i++) {
    const y = ((i + 1) / 10) * c.height;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(i * 0.8) * 6);
    ctx.bezierCurveTo(c.width * 0.32, y + 7, c.width * 0.68, y - 7, c.width, y + Math.sin(i * 0.44) * 6);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(1.7, 1.7);
  return tex;
}

function createFoamStripTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);

  for (let x = 0; x < c.width; x += 2) {
    const a = THREE.MathUtils.clamp(
      0.35 +
        Math.sin(x * 0.027) * 0.18 +
        Math.sin(x * 0.071 + 1.6) * 0.14 +
        (Math.random() - 0.5) * 0.18,
      0.06,
      0.92
    );
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0.0, "rgba(255,255,255,0)");
    g.addColorStop(0.33, `rgba(255,255,255,${(a * 0.42).toFixed(3)})`);
    g.addColorStop(0.56, `rgba(255,255,255,${(a * 0.95).toFixed(3)})`);
    g.addColorStop(0.84, `rgba(255,255,255,${(a * 0.28).toFixed(3)})`);
    g.addColorStop(1.0, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 2, c.height);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(1.4, 1);
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
  const baseY = getWorldSurfaceHeight(x, z);
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: "#344347", opacity })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(x, baseY + 0.03, z);
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

  const baseY = getWorldSurfaceHeight(x, z);
  const rock = new THREE.Mesh(
    geo,
    toonMat("#8e9d98")
  );
  rock.position.set(x, baseY + 0.78 * scale, z);
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

  const baseY = getWorldSurfaceHeight(x, z);
  const rock = new THREE.Mesh(
    geo,
    toonMat("#738993")
  );
  rock.position.set(x, baseY + 0.42, z);
  rock.rotation.y = Math.random() * Math.PI;
  scene.add(rock);
}

function addTree(scene, blobTex, x, z, scale = 1) {
  const baseY = getWorldSurfaceHeight(x, z);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3 * scale, 0.46 * scale, 4.3 * scale, 8),
    toonMat("#8f6d4f")
  );
  trunk.position.set(x, baseY + 2.16 * scale, z);
  trunk.rotation.z = (Math.random() - 0.5) * 0.16;
  scene.add(trunk);

  const leafMat = toonMat("#73cfa9");
  const top = new THREE.Vector3(x, baseY + 4.3 * scale, z);
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
  const baseY = getWorldSurfaceHeight(x, z);
  for (let i = 0; i < count; i++) {
    const reed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.95 + Math.random() * 0.45, 5),
      toonMat("#89b162")
    );
    reed.position.set(x + (Math.random() - 0.5) * 0.9, baseY + 0.48, z + (Math.random() - 0.5) * 0.9);
    reed.rotation.z = (Math.random() - 0.5) * 0.28;
    scene.add(reed);
  }
}

function addLounge(scene, blobTex, x, z, rot = 0) {
  const baseY = getWorldSurfaceHeight(x, z);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.24, 1.05),
    toonMat("#f4d93e")
  );
  base.position.set(x, baseY + 0.72, z);
  base.rotation.y = rot;
  scene.add(base);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.2, 0.7),
    toonMat("#f8df67")
  );
  back.position.set(x - Math.sin(rot) * 0.42, baseY + 0.98, z - Math.cos(rot) * 0.42);
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
    toonMat("#ddcd9e", { side: THREE.DoubleSide })
  );
  beachRing.rotation.x = -Math.PI / 2;
  beachRing.position.y = 0.62;
  scene.add(beachRing);

  const wetSand = new THREE.Mesh(
    new THREE.RingGeometry(24.66, 26.06, 160),
    new THREE.MeshBasicMaterial({ color: "#b9bda9", transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide })
  );
  wetSand.rotation.x = -Math.PI / 2;
  wetSand.position.y = 0.618;
  scene.add(wetSand);

  const innerSandShelf = new THREE.Mesh(
    new THREE.RingGeometry(23.2, 24.58, 160),
    new THREE.MeshBasicMaterial({ color: "#e5d2a6", transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide })
  );
  innerSandShelf.rotation.x = -Math.PI / 2;
  innerSandShelf.position.y = 0.55;
  scene.add(innerSandShelf);

  const poolEdge = new THREE.Mesh(
    new THREE.RingGeometry(24.84, 25.04, 160),
    new THREE.MeshBasicMaterial({ color: "#f1fbff", transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide })
  );
  poolEdge.rotation.x = -Math.PI / 2;
  poolEdge.position.y = 0.624;
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

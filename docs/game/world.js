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
const SHORE_TRANSITION_INNER = 24.18;
const SHORE_TRANSITION_OUTER = 26.1;
const SHORE_LIFT = 0.028;
const RENDER_GROUND = 0;
const RENDER_SHORE = 1;
const RENDER_WATER = 2;
const RENDER_DECOR = 3;

const TREE_TRUNK_GEO = new THREE.CylinderGeometry(0.24, 0.36, 4.1, 7);
const TREE_LEAF_GEO = new THREE.BoxGeometry(0.2, 0.08, 2.28);
const TREE_CORE_GEO = new THREE.OctahedronGeometry(0.62, 0);
const TREE_TRUNK_MAT = toonMat("#8b6a4e");
const TREE_LEAF_MAT = toonMat("#6fd1a8");
const TREE_CORE_MAT = toonMat("#65c39d");
const FISH_SPOT_RING_MAT = new THREE.MeshBasicMaterial({ color: "#dcf8ff", transparent: true, opacity: 0.72 });
const FISH_SPOT_BOBBER_MAT = toonMat("#ffcc58");

function sampleTerrainNoise(x, z) {
  const n0 = Math.sin(x * 0.045) * 0.56;
  const n1 = Math.cos(z * 0.037) * 0.52;
  const n2 = Math.sin((x + z) * 0.021) * 0.4;
  const n3 = Math.sin(x * 0.12 - z * 0.09) * 0.22;
  const ridge = Math.abs(Math.sin(x * 0.082 + z * 0.073)) * 0.16;
  return n0 + n1 + n2 + n3 - ridge;
}

function sampleTerrainHeight(x, z) {
  const r = Math.hypot(x, z);
  const noise = sampleTerrainNoise(x, z);
  const bowlFalloff = 1.0 - THREE.MathUtils.smoothstep(r, 0, TERRAIN_BASIN_RADIUS);
  const lakeBasin = Math.pow(bowlFalloff, 1.65) * 1.15;
  const roughnessBoost = THREE.MathUtils.smoothstep(r, 17.5, 96.0);
  const amplitude = THREE.MathUtils.lerp(0.31, 0.45, roughnessBoost);
  return noise * amplitude - lakeBasin;
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

function setResourceNode(node, resourceType, label) {
  node.userData.resourceType = resourceType;
  node.userData.resourceLabel = label;
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
  const lightX = 0.54;
  const lightY = 0.78;
  const lightZ = 0.31;
  const sampleStep = 0.8;

  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getY(i);
    const r = Math.hypot(x, z);
    const y = sampleTerrainHeight(x, z);
    tPos.setZ(i, y);

    const noise = sampleTerrainNoise(x, z);
    const hx = sampleTerrainHeight(x + sampleStep, z) - sampleTerrainHeight(x - sampleStep, z);
    const hz = sampleTerrainHeight(x, z + sampleStep) - sampleTerrainHeight(x, z - sampleStep);
    const nx = -hx;
    const ny = 2.0;
    const nz = -hz;
    const invLen = 1 / Math.hypot(nx, ny, nz);
    const litRaw = THREE.MathUtils.clamp((nx * lightX + ny * lightY + nz * lightZ) * invLen * 0.5 + 0.5, 0, 1);
    const litBanded = Math.floor(litRaw * 4.5) / 4;
    const litStylized = THREE.MathUtils.lerp(litRaw, litBanded, 0.52);

    const hillShadeRaw = THREE.MathUtils.clamp((y + 0.8) / 1.75, 0, 1);
    const hillShadeBanded = Math.floor(hillShadeRaw * 5.0) / 4.0;
    const hillShade = THREE.MathUtils.lerp(hillShadeRaw, hillShadeBanded, 0.45);
    const tonal = THREE.MathUtils.clamp(litStylized * 0.72 + hillShade * 0.48, 0, 1);
    const shoreBlend = THREE.MathUtils.smoothstep(r, 21.4, 34.0);

    colTmp.copy(colGrassDark).lerp(colGrassLight, tonal * 0.95 + noise * 0.03 + 0.02);
    colTmp.lerp(colBeachBlend, shoreBlend * 0.42);
    const contrastBand = Math.floor(tonal * 3.2) / 3.0;
    colTmp.multiplyScalar(0.86 + contrastBand * 0.24);
    tCol.push(colTmp.r, colTmp.g, colTmp.b);
  }
  terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(tCol, 3));
  terrainGeo.computeVertexNormals();

  const ground = new THREE.Mesh(
    terrainGeo,
    toonMat("#ffffff", { vertexColors: true })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.renderOrder = RENDER_GROUND;
  scene.add(ground);
  return ground;
}

function createLakeBowlMesh(radius = LAKE_RADIUS, segments = 180) {
  const geo = new THREE.CircleGeometry(radius, segments);
  const p = geo.attributes.position;
  const colors = [];
  const deep = new THREE.Color("#4f3f2e");
  const mid = new THREE.Color("#6e5a3f");
  const shelf = new THREE.Color("#9f855a");

  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getY(i);
    const r = Math.min(1, Math.hypot(x, z) / radius);
    const depth = Math.pow(1 - r, 1.82);
    const lip = THREE.MathUtils.smoothstep(r, 0.74, 1.0);
    p.setZ(i, -(0.1 + depth * 1.95 + lip * 0.08));

    const c = new THREE.Color();
    const tMid = THREE.MathUtils.smoothstep(r, 0.0, 0.68);
    const tShelf = THREE.MathUtils.smoothstep(r, 0.5, 1.0);
    c.copy(deep).lerp(mid, tMid);
    c.lerp(shelf, tShelf * 0.82);

    // Subtle sediment variation without hard banding.
    const n0 = Math.sin(x * 0.27 + z * 0.18) * 0.5 + 0.5;
    const n1 = Math.sin(x * 0.5 - z * 0.31 + 1.7) * 0.5 + 0.5;
    const n2 = Math.sin((x + z) * 0.16 + 2.4) * 0.5 + 0.5;
    const sediment = n0 * 0.46 + n1 * 0.34 + n2 * 0.2;

    c.offsetHSL(0.0, -0.03 + sediment * 0.03, -0.08 + sediment * 0.14);
    c.multiplyScalar(0.9 + sediment * 0.1 - r * 0.05);
    colors.push(c.r, c.g, c.b);
  }

  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const bowl = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  bowl.rotation.x = -Math.PI / 2;
  bowl.position.y = LAKE_BOWL_Y;
  return bowl;
}

function createWater(scene) {
  const waterUniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color("#a6efff") },
    uDeep: { value: new THREE.Color("#2f94c7") },
  };

  const lakeFloor = createLakeBowlMesh();
  lakeFloor.renderOrder = RENDER_SHORE;
  scene.add(lakeFloor);

  // Keep this texture output so the main loop can animate offsets without special-casing.
  const causticMap = createCausticTexture();

  const foamStripMap = createFoamStripTexture();
  const shorelineFoam = new THREE.Mesh(
    new THREE.RingGeometry(WATER_RADIUS - 0.24, WATER_RADIUS + 0.32, 320),
    new THREE.MeshBasicMaterial({
      map: foamStripMap,
      color: "#f6fdff",
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      side: THREE.DoubleSide,
    })
  );
  shorelineFoam.rotation.x = -Math.PI / 2;
  shorelineFoam.position.y = WATER_SURFACE_Y + 0.008;
  shorelineFoam.renderOrder = RENDER_WATER + 1;
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
        float w0 = sin((uv.x * 5.9 + uv.y * 4.7) + uTime * 1.22) * 0.011;
        float w1 = sin((uv.x * 9.6 - uv.y * 7.4) - uTime * 1.0) * 0.006;
        float w2 = sin((uv.x * 14.4 + uv.y * 11.2) + uTime * 1.42) * 0.003;
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

      void main() {
        float t = uTime;
        float radial = clamp(distance(vUv, vec2(0.5)) / 0.5, 0.0, 1.0);
        vec2 wp = vWorldPos.xz;
        float depthCore = pow(1.0 - radial, 1.03);
        float contourA = sin(wp.x * 0.13 + wp.y * 0.11 + t * 0.14) * 0.5 + 0.5;
        float contourB = sin(wp.x * 0.09 - wp.y * 0.14 - t * 0.18) * 0.5 + 0.5;
        float basinBreakup = (contourA * 0.52 + contourB * 0.48 - 0.5) * 0.24;
        float depth01 = clamp(depthCore + basinBreakup * smoothstep(0.12, 0.96, depthCore), 0.0, 1.0);

        float rippleA = sin(wp.x * 1.02 + wp.y * 0.54 + t * 1.62) * 0.5 + 0.5;
        float rippleB = sin(wp.x * 0.7 - wp.y * 1.18 - t * 1.24) * 0.5 + 0.5;
        float rippleC = sin((wp.x + wp.y) * 0.43 + t * 1.08) * 0.5 + 0.5;
        float rippleMix = rippleA * 0.46 + rippleB * 0.36 + rippleC * 0.18;
        float rippleLines = smoothstep(0.64, 0.95, rippleMix);

        vec3 base = mix(uShallow, uDeep, pow(depth01, 0.86));
        base += vec3(0.06, 0.1, 0.14) * rippleLines * 0.18;

        float shoreBand = smoothstep(0.72, 0.98, radial);
        float shorePulse = sin((wp.x - wp.y) * 0.62 + t * 1.85) * 0.5 + 0.5;
        float foam = shoreBand * smoothstep(0.58, 0.96, shorePulse);

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 2.2);
        base += vec3(0.06, 0.11, 0.14) * fresnel * 0.45;

        vec3 color = mix(base, vec3(0.95, 0.99, 1.0), foam * 0.36);

        float alpha = mix(0.3, 0.72, pow(depth01, 0.94));
        alpha += rippleLines * 0.035 + foam * 0.09 + fresnel * 0.02;
        gl_FragColor = vec4(color, clamp(alpha, 0.28, 0.82));
      }
    `,
  });

  const water = new THREE.Mesh(new THREE.CircleGeometry(WATER_RADIUS, 256), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_SURFACE_Y;
  water.renderOrder = RENDER_WATER;
  scene.add(water);

  return { waterUniforms, causticMap };
}

function createCausticTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 18; i++) {
    const y = ((i + 1) / 20) * c.height;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(i * 0.75) * 3.6);
    ctx.bezierCurveTo(c.width * 0.27, y + 5.2, c.width * 0.72, y - 5.2, c.width, y + Math.sin(i * 0.5) * 3.6);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.repeat.set(1.1, 1.1);
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
        Math.sin(x * 0.071 + 1.6) * 0.14,
      0.28,
      0.86
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
  ctx.clearRect(0, 0, c.width, c.height);
  const g = ctx.createRadialGradient(128, 128, 128 * inner, 128, 128, 128 * outer);
  g.addColorStop(0.0, "rgba(255,255,255,0.82)");
  g.addColorStop(0.55, "rgba(255,255,255,0.32)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 32; i++) {
    const x = 70 + Math.random() * 116;
    const y = 70 + Math.random() * 116;
    const r = 12 + Math.random() * 28;
    const blotch = ctx.createRadialGradient(x, y, 0, x, y, r);
    blotch.addColorStop(0, "rgba(255,255,255,0.12)");
    blotch.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = blotch;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function addShadowBlob(scene, blobTex, x, z, radius = 1.8, opacity = 0.2) {
  const baseY = getWorldSurfaceHeight(x, z);
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: "#344347", opacity })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.rotation.z = Math.random() * Math.PI;
  blob.position.set(x, baseY + 0.03, z);
  blob.renderOrder = RENDER_GROUND + 1;
  scene.add(blob);
  return blob;
}

function addRock(scene, blobTex, x, z, scale = 1, resourceNodes = null) {
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
  rock.renderOrder = RENDER_DECOR;
  setResourceNode(rock, "mining", "Rock");
  scene.add(rock);
  if (resourceNodes) resourceNodes.push(rock);
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
  rock.renderOrder = RENDER_DECOR;
  scene.add(rock);
}

function addTree(scene, blobTex, x, z, scale = 1, resourceNodes = null) {
  const baseY = getWorldSurfaceHeight(x, z);
  const tree = new THREE.Group();
  tree.position.set(x, baseY, z);
  setResourceNode(tree, "woodcutting", "Tree");

  const trunk = new THREE.Mesh(TREE_TRUNK_GEO, TREE_TRUNK_MAT);
  trunk.scale.setScalar(scale);
  trunk.position.set(0, 2.05 * scale, 0);
  trunk.rotation.z = (Math.random() - 0.5) * 0.16;
  trunk.renderOrder = RENDER_DECOR;
  tree.add(trunk);

  const crownY = 4.18 * scale;
  const core = new THREE.Mesh(TREE_CORE_GEO, TREE_CORE_MAT);
  core.scale.setScalar(scale * 0.72);
  core.position.set(0, crownY, 0);
  core.renderOrder = RENDER_DECOR;
  tree.add(core);

  for (let i = 0; i < 6; i++) {
    const frond = new THREE.Mesh(TREE_LEAF_GEO, TREE_LEAF_MAT);
    frond.scale.setScalar(scale);
    const yaw = (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
    frond.rotation.y = yaw;
    frond.rotation.x = -0.3 + (Math.random() - 0.5) * 0.06;
    frond.position.set(
      Math.cos(yaw) * 0.22 * scale,
      crownY + (Math.random() - 0.5) * 0.05 * scale,
      Math.sin(yaw) * 0.22 * scale
    );
    frond.renderOrder = RENDER_DECOR;
    tree.add(frond);
  }

  scene.add(tree);
  if (resourceNodes) resourceNodes.push(tree);
  addShadowBlob(scene, blobTex, x, z, 2.2 * scale, 0.15);
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
    reed.renderOrder = RENDER_DECOR;
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
  base.renderOrder = RENDER_DECOR;
  scene.add(base);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.2, 0.7),
    toonMat("#f8df67")
  );
  back.position.set(x - Math.sin(rot) * 0.42, baseY + 0.98, z - Math.cos(rot) * 0.42);
  back.rotation.y = rot;
  back.rotation.x = -0.28;
  back.renderOrder = RENDER_DECOR;
  scene.add(back);

  addShadowBlob(scene, blobTex, x, z, 1.7, 0.12);
}

function addShoreDecor(scene, blobTex, resourceNodes) {
  [[-28, 21], [28, 20], [-21, -24], [20, -26], [0, 30], [34, -2], [-33, 0]].forEach(([x, z], i) =>
    addTree(scene, blobTex, x, z, 0.85 + (i % 4) * 0.08, resourceNodes)
  );
  [[10, 25, 1.15], [-11, 23, 1.08], [23, 10, 0.9], [-24, -3, 1.22], [16, -19, 1.0], [-5, -27, 1.12]].forEach(
    ([x, z, s]) => addRock(scene, blobTex, x, z, s, resourceNodes)
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

function addFishingSpots(scene, resourceNodes) {
  const spots = [];
  const ringGeo = new THREE.TorusGeometry(0.5, 0.045, 8, 24);
  const bobberGeo = new THREE.SphereGeometry(0.13, 8, 7);
  const coordinates = [
    [-6.5, 10.4],
    [8.4, 9.2],
    [10.6, -5.3],
    [-9.2, -7.4],
    [2.3, 13.1],
  ];

  for (let i = 0; i < coordinates.length; i++) {
    const [x, z] = coordinates[i];
    const spot = new THREE.Group();
    setResourceNode(spot, "fishing", "Fishing Spot");
    spot.userData.bobPhase = i * 1.23;
    spot.position.set(x, WATER_SURFACE_Y + 0.02, z);
    spot.renderOrder = RENDER_WATER + 2;

    const ring = new THREE.Mesh(ringGeo, FISH_SPOT_RING_MAT.clone());
    ring.rotation.x = Math.PI / 2;
    spot.add(ring);

    const bobber = new THREE.Mesh(bobberGeo, FISH_SPOT_BOBBER_MAT);
    bobber.position.y = 0.12;
    spot.add(bobber);

    spot.userData.ring = ring;
    scene.add(spot);
    resourceNodes.push(spot);
    spots.push(spot);
  }
  return spots;
}

function updateFishingSpots(spots, time) {
  for (const spot of spots) {
    const phase = spot.userData.bobPhase || 0;
    const bob = Math.sin(time * 2.0 + phase) * 0.03;
    spot.position.y = WATER_SURFACE_Y + 0.02 + bob;
    if (spot.userData.ring) {
      spot.userData.ring.scale.setScalar(1 + Math.sin(time * 2.2 + phase) * 0.06);
      spot.userData.ring.material.opacity = 0.62 + Math.sin(time * 2.4 + phase) * 0.08;
    }
  }
}

function createConformingRing(innerRadius, outerRadius, radialSegments = 14, thetaSegments = 320, yOffset = SHORE_LIFT) {
  const ringGeo = new THREE.RingGeometry(innerRadius, outerRadius, thetaSegments, radialSegments);
  const p = ringGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getY(i);
    const y = getWorldSurfaceHeight(x, z);
    p.setZ(i, Number.isFinite(y) ? y + yOffset : yOffset);
  }
  ringGeo.computeVertexNormals();
  return ringGeo;
}

function addLakeRings(scene) {
  const beachRing = new THREE.Mesh(
    createConformingRing(26, 33.5, 18, 320, SHORE_LIFT),
    toonMat("#ddcd9e", { side: THREE.DoubleSide })
  );
  beachRing.rotation.x = -Math.PI / 2;
  beachRing.position.y = 0;
  beachRing.renderOrder = RENDER_SHORE;
  scene.add(beachRing);

  const shoreTransition = new THREE.Mesh(
    createConformingRing(SHORE_TRANSITION_INNER, SHORE_TRANSITION_OUTER, 16, 320, SHORE_LIFT + 0.004),
    new THREE.MeshBasicMaterial({
      color: "#b6c3b0",
      transparent: true,
      opacity: 0.46,
      depthWrite: true,
      side: THREE.DoubleSide,
    })
  );
  shoreTransition.rotation.x = -Math.PI / 2;
  shoreTransition.position.y = 0;
  shoreTransition.renderOrder = RENDER_SHORE + 1;
  scene.add(shoreTransition);

  const innerWetLine = new THREE.Mesh(
    createConformingRing(WATER_RADIUS - 0.16, WATER_RADIUS + 0.62, 14, 320, SHORE_LIFT + 0.009),
    new THREE.MeshBasicMaterial({
      color: "#d8d9c8",
      transparent: true,
      opacity: 0.38,
      depthWrite: true,
      side: THREE.DoubleSide,
    })
  );
  innerWetLine.rotation.x = -Math.PI / 2;
  innerWetLine.position.y = 0;
  innerWetLine.renderOrder = RENDER_SHORE + 1;
  scene.add(innerWetLine);
}

export function createWorld(scene) {
  const resourceNodes = [];
  const skyMat = addSky(scene);
  const ground = createGround(scene);
  addLakeRings(scene);
  const { waterUniforms, causticMap } = createWater(scene);
  addWaterRocks(scene);
  const blobTex = radialTexture();
  addShoreDecor(scene, blobTex, resourceNodes);
  const fishingSpots = addFishingSpots(scene, resourceNodes);
  const addBlob = (x, z, radius, opacity) => addShadowBlob(scene, blobTex, x, z, radius, opacity);
  const updateWorld = (time) => {
    updateFishingSpots(fishingSpots, time);
  };
  return { ground, skyMat, waterUniforms, causticMap, addShadowBlob: addBlob, resourceNodes, updateWorld };
}

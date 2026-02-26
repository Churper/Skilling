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
const SHORE_LIFT = 0.05;
const RENDER_GROUND = 0;
const RENDER_SHORE = 1;
const RENDER_WATER = 2;
const RENDER_DECOR = 3;

// Organic lake shape — sine harmonics vary radius by angle
function getLakeRadiusAtAngle(a) {
  return LAKE_RADIUS
    + Math.sin(a * 1.0 + 0.5) * 2.8
    + Math.sin(a * 2.3 + 1.8) * 1.6
    + Math.cos(a * 3.1 + 0.3) * 1.0
    + Math.sin(a * 5.2 + 2.5) * 0.5;
}
function getWaterRadiusAtAngle(a) {
  return getLakeRadiusAtAngle(a) + (WATER_RADIUS - LAKE_RADIUS);
}
function getLakeRadiusAt(x, z) {
  return getLakeRadiusAtAngle(Math.atan2(z, x));
}
function getWaterRadiusAt(x, z) {
  return getWaterRadiusAtAngle(Math.atan2(z, x));
}

const TREE_TRUNK_GEO = new THREE.CylinderGeometry(0.18, 0.38, 4.6, 6);
const TREE_LEAF_GEO = new THREE.BoxGeometry(0.22, 0.06, 2.6);
const TREE_CORE_GEO = new THREE.OctahedronGeometry(0.55, 0);
const TREE_TRUNK_MAT = toonMat("#a0734e");
const TREE_LEAF_MAT = toonMat("#4cc992");
const TREE_CORE_MAT = toonMat("#3dba84");
const FISH_SPOT_RING_MAT = new THREE.MeshBasicMaterial({ color: "#dcf8ff", transparent: true, opacity: 0.72 });
const FISH_SPOT_BOBBER_MAT = toonMat("#ffcc58");
const SERVICE_HOTSPOT_MAT = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  depthTest: false,
});

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
  const amplitude = THREE.MathUtils.lerp(0.31, 0.55, roughnessBoost);
  // Rolling hills around the shore
  const hillNoise = Math.sin(x * 0.065 + z * 0.048) * Math.cos(x * 0.031 - z * 0.057);
  const hillBoost = THREE.MathUtils.smoothstep(r, 26.0, 60.0) * hillNoise * 0.8;
  return noise * amplitude - lakeBasin + hillBoost;
}

function sampleLakeFloorHeight(x, z) {
  const r = Math.hypot(x, z);
  const lakeR = getLakeRadiusAt(x, z);
  if (r > lakeR) return -Infinity;

  const radius01 = Math.min(1, r / lakeR);
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
  const dist = Math.hypot(x, z);
  const waterR = getWaterRadiusAt(x, z);
  if (dist > waterR) return -Infinity;

  const w0 = Math.sin(x * 0.16 + z * 0.12 + time * 0.82) * 0.032;
  const w1 = Math.sin(x * 0.28 - z * 0.22 + time * 0.65) * 0.022;
  const w2 = Math.cos(x * 0.11 + z * 0.34 - time * 0.74) * 0.026;
  const w3 = Math.sin(x * 0.48 + z * 0.38 + time * 1.3) * 0.012;
  const w4 = Math.sin(x * 0.65 - z * 0.52 - time * 1.05) * 0.008;
  const damp = 1.0 - (dist / waterR) * 0.18;
  return WATER_SURFACE_Y + (w0 + w1 + w2 + w3 + w4) * damp;
}

function setResourceNode(node, resourceType, label) {
  node.userData.resourceType = resourceType;
  node.userData.resourceLabel = label;
}

function setServiceNode(node, serviceType, label) {
  node.userData.serviceType = serviceType;
  node.userData.resourceLabel = label;
}

function addServiceHotspot(parent, x, y, z, radius = 0.9, height = 1.6) {
  const hotspot = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 12),
    SERVICE_HOTSPOT_MAT
  );
  hotspot.position.set(x, y, z);
  hotspot.renderOrder = RENDER_DECOR + 10;
  parent.add(hotspot);
  return hotspot;
}

function addSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      cTop: { value: new THREE.Color("#2e8ed8") },
      cMid: { value: new THREE.Color("#7dcdf8") },
      cBot: { value: new THREE.Color("#fffae8") },
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
  const colGrassDark = new THREE.Color("#4d8c42");
  const colGrassLight = new THREE.Color("#7dba5e");
  const colBeachBlend = new THREE.Color("#dcc28a");
  const colTmp = new THREE.Color();
  const lightX = 0.54;
  const lightY = 0.78;
  const lightZ = 0.31;
  const sampleStep = 0.8;

  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getY(i);
    const r = Math.hypot(x, z);
    let y = sampleTerrainHeight(x, z);
    const waterR = getWaterRadiusAt(x, z);
    if (r < waterR + 4.0) {
      y -= (1.0 - THREE.MathUtils.smoothstep(r, waterR - 3.0, waterR + 4.0)) * 0.8;
    }
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
    const waterProx = 1.0 - THREE.MathUtils.smoothstep(r, waterR - 2, waterR + 4);
    if (waterProx > 0) colTmp.lerp(colBeachBlend, waterProx * 0.85);
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

function createLakeBowlMesh() {
  const segments = 360;
  const rings = 20;
  const positions = [];
  const colors = [];
  const indices = [];
  const deep = new THREE.Color("#2a7a9c");
  const mid = new THREE.Color("#52a8b8");
  const shelf = new THREE.Color("#c4b68a");

  // Center vertex
  positions.push(0, -(0.1 + 1.95), 0);
  const cDeep = new THREE.Color().copy(deep);
  colors.push(cDeep.r, cDeep.g, cDeep.b);

  for (let r = 1; r <= rings; r++) {
    const ringT = r / rings;
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const lakeR = getLakeRadiusAtAngle(angle);
      const radius = lakeR * ringT;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const depth = Math.pow(1 - ringT, 1.82);
      const lip = THREE.MathUtils.smoothstep(ringT, 0.74, 1.0);
      const y = -(0.1 + depth * 1.95 + lip * 0.08);
      positions.push(x, y, z);

      const c = new THREE.Color();
      const tMid = THREE.MathUtils.smoothstep(ringT, 0.0, 0.68);
      const tShelf = THREE.MathUtils.smoothstep(ringT, 0.5, 1.0);
      c.copy(deep).lerp(mid, tMid);
      c.lerp(shelf, tShelf * 0.82);
      const n0 = Math.sin(x * 0.27 + z * 0.18) * 0.5 + 0.5;
      const n1 = Math.sin(x * 0.5 - z * 0.31 + 1.7) * 0.5 + 0.5;
      const sediment = n0 * 0.55 + n1 * 0.45;
      c.offsetHSL(0.0, -0.03 + sediment * 0.03, -0.08 + sediment * 0.14);
      c.multiplyScalar(0.9 + sediment * 0.1 - ringT * 0.05);
      colors.push(c.r, c.g, c.b);
    }
  }

  for (let s = 0; s < segments; s++) {
    indices.push(0, s + 1, ((s + 1) % segments) + 1);
  }
  for (let r = 1; r < rings; r++) {
    const inner = 1 + (r - 1) * segments;
    const outer = 1 + r * segments;
    for (let s = 0; s < segments; s++) {
      const sn = (s + 1) % segments;
      indices.push(inner + s, outer + s, outer + sn);
      indices.push(inner + s, outer + sn, inner + sn);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const bowl = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  }));
  bowl.position.y = LAKE_BOWL_Y;
  return bowl;
}

function createWater(scene) {
  const waterUniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color("#c4fef8") },
    uMid: { value: new THREE.Color("#4dd8ee") },
    uDeep: { value: new THREE.Color("#1a9ec8") },
    uBeach: { value: new THREE.Color("#e3cea1") },
  };

  const lakeFloor = createLakeBowlMesh();
  lakeFloor.renderOrder = RENDER_SHORE;
  scene.add(lakeFloor);

  // Keep caustic texture for main.js compat
  const causticMap = createCausticTexture();

  // Build subdivided organic water mesh
  const wSegs = 360, wRings = 20, maxR = 32;
  const wPos = [0, 0, 0], wUvs = [0.5, 0.5], wRads = [0], wIdx = [];
  for (let r = 1; r <= wRings; r++) {
    const rt = r / wRings;
    for (let s = 0; s < wSegs; s++) {
      const a = (s / wSegs) * Math.PI * 2;
      const rad = getWaterRadiusAtAngle(a) * rt;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      wPos.push(x, 0, z);
      wUvs.push(x / (maxR * 2) + 0.5, z / (maxR * 2) + 0.5);
      wRads.push(rt);
    }
  }
  for (let s = 0; s < wSegs; s++) wIdx.push(0, s + 1, ((s + 1) % wSegs) + 1);
  for (let r = 1; r < wRings; r++) {
    const inner = 1 + (r - 1) * wSegs, outer = 1 + r * wSegs;
    for (let s = 0; s < wSegs; s++) {
      const sn = (s + 1) % wSegs;
      wIdx.push(inner + s, outer + s, outer + sn, inner + s, outer + sn, inner + sn);
    }
  }
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setIndex(wIdx);
  waterGeo.setAttribute("position", new THREE.Float32BufferAttribute(wPos, 3));
  waterGeo.setAttribute("uv", new THREE.Float32BufferAttribute(wUvs, 2));
  waterGeo.setAttribute("aRadial", new THREE.Float32BufferAttribute(wRads, 1));
  waterGeo.computeVertexNormals();

  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: waterUniforms,
    vertexShader: `
      attribute float aRadial;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vRadial;
      uniform float uTime;
      void main() {
        vUv = uv;
        vRadial = aRadial;
        vec3 p = position;
        vec2 pp = p.xz;
        float t = uTime;
        // Large gentle swells
        float w0 = sin(pp.x * 0.16 + pp.y * 0.12 + t * 0.82) * 0.032;
        float w1 = sin(pp.x * 0.28 - pp.y * 0.22 + t * 0.65) * 0.022;
        float w2 = cos(pp.x * 0.11 + pp.y * 0.34 - t * 0.74) * 0.026;
        // Medium waves
        float w3 = sin(pp.x * 0.48 + pp.y * 0.38 + t * 1.3) * 0.012;
        float w4 = sin(pp.x * 0.65 - pp.y * 0.52 - t * 1.05) * 0.008;
        float w5 = cos(pp.x * 0.42 - pp.y * 0.56 + t * 1.15) * 0.010;
        // Small detail ripples
        float w6 = sin(pp.x * 1.2 + pp.y * 0.85 + t * 2.0) * 0.004;
        float w7 = sin(pp.x * 0.9 - pp.y * 1.3 + t * 1.7) * 0.004;
        float damp = 1.0 - aRadial * 0.18;
        p.y += (w0 + w1 + w2 + w3 + w4 + w5 + w6 + w7) * damp;
        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vRadial;
      uniform float uTime;
      uniform vec3 uShallow;
      uniform vec3 uMid;
      uniform vec3 uDeep;
      uniform vec3 uBeach;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(269.5, 183.3))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          v += noise(p) * a;
          p = rot * p * 2.0;
          a *= 0.5;
        }
        return v;
      }
      // Voronoi for caustic cell patterns
      float voronoi(vec2 p) {
        vec2 ip = floor(p);
        vec2 fp = fract(p);
        float d = 1.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 nb = vec2(float(x), float(y));
            vec2 pt = vec2(hash(ip + nb), hash2(ip + nb));
            pt = 0.5 + 0.5 * sin(uTime * 0.4 + 6.2831 * pt);
            vec2 diff = nb + pt - fp;
            d = min(d, dot(diff, diff));
          }
        }
        return sqrt(d);
      }

      void main() {
        float t = uTime;
        float radial = vRadial;
        vec2 wp = vWorldPos.xz;

        // Vibrant tropical depth gradient
        vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.45, radial));
        col = mix(col, uShallow, smoothstep(0.35, 0.82, radial));
        float clarity = smoothstep(0.15, 0.75, radial);
        col = mix(col, vec3(0.82, 0.97, 0.96), clarity * 0.25);

        // Animated voronoi caustics — view-independent, organic light patterns
        vec2 cuv = wp * 0.11 + vec2(t * 0.02, -t * 0.015);
        float c1 = voronoi(cuv);
        float c2 = voronoi(cuv * 1.7 + vec2(3.7, 1.2));
        float c3 = voronoi(cuv * 0.6 + vec2(-t * 0.03, t * 0.02));
        float caustic = c1 * 0.4 + c2 * 0.35 + c3 * 0.25;
        float causticBright = (1.0 - smoothstep(0.0, 0.5, caustic)) * 0.42;
        causticBright *= smoothstep(0.02, 0.3, radial) * (1.0 - radial * 0.35);
        col += causticBright * vec3(0.6, 0.92, 1.0);

        // FBM wave color variation (view-independent)
        float waveTex = fbm(wp * 0.18 + vec2(t * 0.04, -t * 0.03));
        float waveTex2 = fbm(wp * 0.32 + vec2(-t * 0.05, t * 0.035));
        col = mix(col, col * 1.15, waveTex * 0.22 * (1.0 - radial * 0.3));
        col += vec3(0.1, 0.18, 0.2) * waveTex2 * 0.08 * (1.0 - radial * 0.5);

        // Animated concentric ripple rings — stronger, view-independent
        float dist1 = length(wp - vec2(2.5, 4.0));
        float dist2 = length(wp - vec2(-5.0, -2.5));
        float dist3 = length(wp - vec2(7.0, -4.0));
        float dist4 = length(wp - vec2(-3.0, 8.0));
        float dist5 = length(wp - vec2(4.0, -7.0));
        float ripple = sin(dist1 * 3.0 - t * 2.5) * 0.5 + 0.5;
        ripple += sin(dist2 * 2.8 - t * 2.0) * 0.5 + 0.5;
        ripple += sin(dist3 * 3.2 - t * 2.8) * 0.5 + 0.5;
        ripple += sin(dist4 * 2.5 - t * 1.6) * 0.5 + 0.5;
        ripple += sin(dist5 * 2.9 - t * 2.3) * 0.5 + 0.5;
        ripple /= 5.0;
        col += ripple * 0.06 * vec3(0.7, 0.9, 1.0) * (1.0 - radial * 0.4);

        // Gentle view-dependent specular (much reduced)
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 sunDir = normalize(vec3(0.6, 0.8, 0.3));
        vec3 waveN = normalize(vec3(
          sin(wp.x * 0.8 + t * 0.5) * 0.04 + sin(wp.x * 1.8 - t * 0.4) * 0.025,
          1.0,
          sin(wp.y * 0.8 - t * 0.45) * 0.04 + cos(wp.y * 1.8 + t * 0.35) * 0.025
        ));

        // Single soft sun highlight
        float spec = pow(max(dot(reflect(-sunDir, waveN), viewDir), 0.0), 16.0);
        col += vec3(1.0, 0.97, 0.92) * spec * 0.3 * (1.0 - radial * 0.2);

        // Subtle fresnel — sky tint at edges
        float NdotV = max(dot(viewDir, waveN), 0.0);
        float fresnel = pow(1.0 - NdotV, 4.0) * 0.2;
        vec3 skyCol = vec3(0.48, 0.74, 0.88);
        col = mix(col, skyCol, fresnel);

        // Shore foam — noise-driven, animated
        float foamNoise = fbm(wp * 0.7 + vec2(t * 0.1, -t * 0.07));
        float ang = atan(wp.y, wp.x);
        float foamWobble = sin(ang * 8.0 + t * 1.2) * 0.013
                         + sin(ang * 13.0 - t * 0.8) * 0.010
                         + sin(ang * 21.0 + t * 1.6) * 0.005;
        float foamEdge = radial + foamWobble;
        float foam = smoothstep(0.87, 0.95, foamEdge) * (1.0 - smoothstep(0.955, 0.993, foamEdge));
        foam *= 0.65 + foamNoise * 0.55;
        foam = clamp(foam, 0.0, 1.0);
        col = mix(col, vec3(1.0, 1.0, 0.97), foam * 0.9);

        // Alpha — slightly more opaque overall for better visibility
        float bodyAlpha = mix(0.62, 0.18, smoothstep(0.04, 0.78, radial));
        float edgeFade = 1.0 - smoothstep(0.88, 0.995, foamEdge);
        float alpha = max(bodyAlpha * edgeFade, foam * 0.96);
        if (alpha < 0.002) discard;

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const water = new THREE.Mesh(waterGeo, waterMat);
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

  // Slightly curved trunk using two segments
  const lean = (Math.random() - 0.5) * 0.2;
  const trunk = new THREE.Mesh(TREE_TRUNK_GEO, TREE_TRUNK_MAT);
  trunk.scale.setScalar(scale);
  trunk.position.set(lean * 0.3, 2.3 * scale, 0);
  trunk.rotation.z = lean;
  trunk.renderOrder = RENDER_DECOR;
  tree.add(trunk);

  // Trunk ring details
  const ringMat = toonMat("#8a6340");
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.32 * scale, 0.04 * scale, 5, 8),
      ringMat
    );
    ring.position.set(lean * 0.15, (1.2 + r * 1.4) * scale, 0);
    ring.rotation.x = Math.PI / 2 + lean * 0.2;
    ring.renderOrder = RENDER_DECOR;
    tree.add(ring);
  }

  const crownY = 4.6 * scale;
  const core = new THREE.Mesh(TREE_CORE_GEO, TREE_CORE_MAT);
  core.scale.setScalar(scale * 0.65);
  core.position.set(lean * 0.5, crownY, 0);
  core.renderOrder = RENDER_DECOR;
  tree.add(core);

  // 8 palm fronds — long, drooping, varied
  const frondCount = 8;
  const frondLeafGeo = new THREE.BoxGeometry(0.24, 0.05, 2.8);
  const frondColors = [TREE_LEAF_MAT, toonMat("#58d49e"), toonMat("#42c088")];
  for (let i = 0; i < frondCount; i++) {
    const mat = frondColors[i % frondColors.length];
    const frond = new THREE.Mesh(frondLeafGeo, mat);
    frond.scale.set(scale * (0.9 + Math.random() * 0.2), scale, scale * (0.85 + Math.random() * 0.3));
    const yaw = (i / frondCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    frond.rotation.y = yaw;
    frond.rotation.x = -0.35 - Math.random() * 0.15;
    frond.position.set(
      Math.cos(yaw) * 0.3 * scale + lean * 0.5,
      crownY + (Math.random() - 0.5) * 0.08 * scale,
      Math.sin(yaw) * 0.3 * scale
    );
    frond.renderOrder = RENDER_DECOR;
    tree.add(frond);
  }

  scene.add(tree);
  if (resourceNodes) resourceNodes.push(tree);
  addShadowBlob(scene, blobTex, x, z, 2.4 * scale, 0.16);
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

function addBank(scene, blobTex, x, z, interactables = null) {
  const baseY = getWorldSurfaceHeight(x, z);
  const bank = new THREE.Group();
  bank.position.set(x, baseY, z);
  setServiceNode(bank, "bank", "Bank Chest");

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.32, 1.4), toonMat("#4e7f9b"));
  base.position.y = 0.2;
  base.renderOrder = RENDER_DECOR;
  bank.add(base);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.66, 0.82), toonMat("#c89d4d"));
  chest.position.y = 0.66;
  chest.renderOrder = RENDER_DECOR;
  bank.add(chest);

  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 1.26, 7, 1, false, 0, Math.PI), toonMat("#d7b16a"));
  lid.rotation.z = Math.PI * 0.5;
  lid.position.y = 1.0;
  lid.renderOrder = RENDER_DECOR;
  bank.add(lid);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.08), toonMat("#e7de8a"));
  lock.position.set(0, 0.64, 0.45);
  lock.renderOrder = RENDER_DECOR;
  bank.add(lock);

  scene.add(bank);
  addShadowBlob(scene, blobTex, x, z, 1.65, 0.16);
  if (interactables) interactables.push(addServiceHotspot(bank, 0, 0.95, 0.55, 0.86, 1.75));
}

function addStore(scene, blobTex, x, z, interactables = null) {
  const baseY = getWorldSurfaceHeight(x, z);
  const store = new THREE.Group();
  store.position.set(x, baseY, z);
  setServiceNode(store, "store", "General Store");

  const booth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.34, 1.3), toonMat("#7f5c38"));
  booth.position.y = 0.22;
  booth.renderOrder = RENDER_DECOR;
  store.add(booth);

  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.22, 1.36), toonMat("#e7a74a"));
  awning.position.y = 1.46;
  awning.renderOrder = RENDER_DECOR;
  store.add(awning);

  const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 6), toonMat("#a97a4e"));
  postL.position.set(-0.95, 0.78, 0.44);
  postL.renderOrder = RENDER_DECOR;
  store.add(postL);
  const postR = postL.clone();
  postR.position.x = 0.95;
  store.add(postR);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.08), toonMat("#3f657d"));
  sign.position.set(0, 1.0, 0.71);
  sign.renderOrder = RENDER_DECOR;
  store.add(sign);

  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 12), toonMat("#f1d173"));
  coin.rotation.x = Math.PI * 0.5;
  coin.position.set(0, 1.0, 0.76);
  coin.renderOrder = RENDER_DECOR;
  store.add(coin);

  scene.add(store);
  addShadowBlob(scene, blobTex, x, z, 1.75, 0.16);
  if (interactables) interactables.push(addServiceHotspot(store, 0, 0.9, 0.66, 0.95, 1.8));
}

function addBlacksmith(scene, blobTex, x, z, interactables = null) {
  const baseY = getWorldSurfaceHeight(x, z);
  const smith = new THREE.Group();
  smith.position.set(x, baseY, z);
  setServiceNode(smith, "blacksmith", "Blacksmith Forge");

  const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.36, 1.7), toonMat("#545b64"));
  base.position.y = 0.2;
  base.renderOrder = RENDER_DECOR;
  smith.add(base);

  const house = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.15, 1.4), toonMat("#7b8793"));
  house.position.y = 0.95;
  house.renderOrder = RENDER_DECOR;
  smith.add(house);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.65, 4), toonMat("#4a4f59"));
  roof.position.y = 1.88;
  roof.rotation.y = Math.PI * 0.25;
  roof.renderOrder = RENDER_DECOR;
  smith.add(roof);

  const forge = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.5, 7), toonMat("#3f454f"));
  forge.position.set(0, 0.53, 0.82);
  forge.renderOrder = RENDER_DECOR;
  smith.add(forge);

  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 7), toonMat("#ff9b54"));
  ember.position.set(0, 0.67, 0.82);
  ember.renderOrder = RENDER_DECOR;
  smith.add(ember);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.46, 0.09), toonMat("#273547"));
  sign.position.set(0, 1.2, 0.9);
  sign.renderOrder = RENDER_DECOR;
  smith.add(sign);

  const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.09), toonMat("#dce6ed"));
  hammerHead.position.set(-0.07, 1.23, 0.96);
  hammerHead.renderOrder = RENDER_DECOR + 1;
  smith.add(hammerHead);

  const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 6), toonMat("#9d7549"));
  hammerHandle.position.set(0.05, 1.2, 0.96);
  hammerHandle.rotation.z = Math.PI * 0.35;
  hammerHandle.renderOrder = RENDER_DECOR + 1;
  smith.add(hammerHandle);

  scene.add(smith);
  addShadowBlob(scene, blobTex, x, z, 1.85, 0.18);
  if (interactables) interactables.push(addServiceHotspot(smith, 0, 0.95, 0.9, 1.0, 1.95));
}

function addConstructionYard(scene, blobTex, x, z, interactables = null) {
  const baseY = getWorldSurfaceHeight(x, z);
  const yard = new THREE.Group();
  yard.position.set(x, baseY, z);
  setServiceNode(yard, "construction", "House Construction Yard");

  const lot = new THREE.Mesh(
    new THREE.CylinderGeometry(9.4, 9.8, 0.34, 36),
    toonMat("#cdb88f")
  );
  lot.position.y = 0.17;
  lot.renderOrder = RENDER_SHORE;
  yard.add(lot);

  const lotRing = new THREE.Mesh(
    new THREE.TorusGeometry(6.0, 0.18, 8, 48),
    toonMat("#ebdfc2")
  );
  lotRing.rotation.x = Math.PI * 0.5;
  lotRing.position.y = 0.36;
  lotRing.renderOrder = RENDER_SHORE + 1;
  yard.add(lotRing);

  const buildPad = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.2, 0.12, 26),
    toonMat("#f2e8cf")
  );
  buildPad.position.y = 0.31;
  buildPad.renderOrder = RENDER_SHORE + 1;
  yard.add(buildPad);

  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.45, 6), toonMat("#8f6742"));
  signPost.position.set(-3.8, 0.98, 3.7);
  signPost.renderOrder = RENDER_DECOR;
  yard.add(signPost);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.7, 0.1), toonMat("#2f536d"));
  sign.position.set(-3.8, 1.52, 3.78);
  sign.renderOrder = RENDER_DECOR + 1;
  yard.add(sign);

  const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.11, 0.12), toonMat("#dce6ed"));
  hammerHead.position.set(-3.98, 1.54, 3.86);
  hammerHead.renderOrder = RENDER_DECOR + 2;
  yard.add(hammerHead);

  const hammerHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 6), toonMat("#9d7549"));
  hammerHandle.position.set(-3.72, 1.5, 3.86);
  hammerHandle.rotation.z = Math.PI * 0.35;
  hammerHandle.renderOrder = RENDER_DECOR + 2;
  yard.add(hammerHandle);

  const houseGroup = new THREE.Group();
  houseGroup.position.set(0.15, 0.31, -0.2);
  yard.add(houseGroup);

  const foundation = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 3.7), toonMat("#b7aea0"));
  foundation.position.y = 0.18;
  foundation.renderOrder = RENDER_DECOR;
  houseGroup.add(foundation);

  const frame = new THREE.Group();
  houseGroup.add(frame);
  const frameBaseMat = toonMat("#9c7048");
  const frameBeamGeo = new THREE.BoxGeometry(0.2, 1.5, 0.2);
  for (const [fx, fz] of [[-2.0, -1.5], [2.0, -1.5], [-2.0, 1.5], [2.0, 1.5]]) {
    const post = new THREE.Mesh(frameBeamGeo, frameBaseMat);
    post.position.set(fx, 1.0, fz);
    post.renderOrder = RENDER_DECOR + 1;
    frame.add(post);
  }
  const beamGeo = new THREE.BoxGeometry(4.25, 0.2, 0.2);
  const beamFront = new THREE.Mesh(beamGeo, frameBaseMat);
  beamFront.position.set(0, 1.74, 1.5);
  beamFront.renderOrder = RENDER_DECOR + 1;
  frame.add(beamFront);
  const beamBack = beamFront.clone();
  beamBack.position.z = -1.5;
  frame.add(beamBack);

  const walls = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.0, 3.2), toonMat("#d8c09a"));
  walls.position.y = 1.25;
  walls.renderOrder = RENDER_DECOR + 2;
  houseGroup.add(walls);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.28, 0.09), toonMat("#7d5737"));
  door.position.set(0, 0.86, 1.66);
  door.renderOrder = RENDER_DECOR + 3;
  houseGroup.add(door);

  const windowLeft = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, 0.09), toonMat("#83c8df"));
  windowLeft.position.set(-1.15, 1.45, 1.66);
  windowLeft.renderOrder = RENDER_DECOR + 3;
  houseGroup.add(windowLeft);
  const windowRight = windowLeft.clone();
  windowRight.position.x = 1.15;
  houseGroup.add(windowRight);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.08, 1.38, 4), toonMat("#91684e"));
  roof.position.y = 2.78;
  roof.rotation.y = Math.PI * 0.25;
  roof.renderOrder = RENDER_DECOR + 3;
  houseGroup.add(roof);

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.86, 0.34), toonMat("#757980"));
  chimney.position.set(1.0, 3.0, -0.4);
  chimney.renderOrder = RENDER_DECOR + 4;
  houseGroup.add(chimney);

  const logPile = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.92, 0.46, 8), toonMat("#9a6d45"));
  logPile.position.set(-2.7, 0.45, -2.3);
  logPile.renderOrder = RENDER_DECOR;
  yard.add(logPile);

  const orePile = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 0), toonMat("#7f878f"));
  orePile.position.set(2.6, 0.7, -2.15);
  orePile.scale.y = 0.56;
  orePile.renderOrder = RENDER_DECOR;
  yard.add(orePile);

  const completionGlow = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.08, 26), toonMat("#8adfa6"));
  completionGlow.position.y = 0.36;
  completionGlow.renderOrder = RENDER_DECOR;
  completionGlow.visible = false;
  yard.add(completionGlow);

  let currentStage = -1;
  const setProgress = (progress, stock = { logs: 0, ore: 0 }) => {
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    foundation.scale.set(1, 0.5 + p * 0.5, 1);

    frame.visible = p >= 0.12;
    frame.scale.y = THREE.MathUtils.clamp((p - 0.12) / 0.22, 0.2, 1);

    walls.visible = p >= 0.33;
    walls.scale.set(1, THREE.MathUtils.clamp((p - 0.33) / 0.28, 0.12, 1), 1);

    const roofBlend = THREE.MathUtils.clamp((p - 0.62) / 0.2, 0, 1);
    roof.visible = p >= 0.62;
    roof.scale.setScalar(0.45 + roofBlend * 0.55);

    chimney.visible = p >= 0.82;
    chimney.scale.y = THREE.MathUtils.clamp((p - 0.82) / 0.18, 0.25, 1);

    const logsRatio = THREE.MathUtils.clamp((stock.logs || 0) / 120, 0, 1);
    const oreRatio = THREE.MathUtils.clamp((stock.ore || 0) / 80, 0, 1);
    logPile.scale.set(0.4 + logsRatio * 0.9, 0.45 + logsRatio * 1.0, 0.4 + logsRatio * 0.9);
    orePile.scale.set(0.45 + oreRatio * 0.8, 0.32 + oreRatio * 0.85, 0.45 + oreRatio * 0.8);

    completionGlow.visible = p >= 1;

    if (p >= 1) currentStage = 4;
    else if (p >= 0.82) currentStage = 3;
    else if (p >= 0.62) currentStage = 2;
    else if (p >= 0.33) currentStage = 1;
    else currentStage = 0;
  };

  setProgress(0);
  scene.add(yard);
  addShadowBlob(scene, blobTex, x, z, 4.6, 0.16);
  if (interactables) interactables.push(addServiceHotspot(yard, -3.8, 1.05, 3.7, 1.45, 2.1));
  return {
    node: yard,
    setProgress,
    getStage: () => currentStage,
  };
}

function addTrainingDummy(scene, blobTex, x, z, interactables) {
  const dummy = new THREE.Group();
  const baseY = getWorldSurfaceHeight(x, z);
  dummy.position.set(x, baseY, z);

  // Body — vertical cylinder (wood)
  const bodyMat = toonMat("#a07040");
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.4, 8), bodyMat);
  body.position.y = 0.7;
  dummy.add(body);

  // Crossbar arms — horizontal cylinder
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 6), bodyMat);
  arm.position.y = 1.1;
  arm.rotation.z = Math.PI / 2;
  dummy.add(arm);

  // Head — sphere (burlap)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), toonMat("#c4a868"));
  head.position.y = 1.6;
  dummy.add(head);

  // Base stake
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), toonMat("#8a6038"));
  stake.position.y = 0.05;
  dummy.add(stake);

  setServiceNode(dummy, "dummy", "Training Dummy");
  scene.add(dummy);

  // Invisible hotspot for raycasting
  const hotspot = addServiceHotspot(dummy, 0, 0.8, 0, 0.6, 1.8);
  interactables.push(hotspot);

  // Shadow blob
  addShadowBlob(scene, blobTex, x, z, 0.5, 0.18);
}

function addServicePlaza(scene, blobTex, resourceNodes, collisionObstacles = []) {
  const cx = 0;
  const cz = -34;
  const cy = getWorldSurfaceHeight(cx, cz);

  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(9.4, 9.8, 0.34, 36),
    toonMat("#d5c9a9")
  );
  plaza.position.set(cx, cy + 0.17, cz);
  plaza.renderOrder = RENDER_SHORE;
  scene.add(plaza);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(5.9, 0.17, 8, 48),
    toonMat("#efe5cc")
  );
  innerRing.rotation.x = Math.PI * 0.5;
  innerRing.position.set(cx, cy + 0.36, cz);
  innerRing.renderOrder = RENDER_SHORE + 1;
  scene.add(innerRing);

  const centerPad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.25, 1.25, 0.12, 20),
    toonMat("#f4ecd9")
  );
  centerPad.position.set(cx, cy + 0.31, cz);
  centerPad.renderOrder = RENDER_SHORE + 1;
  scene.add(centerPad);

  const markerMat = toonMat("#36607c");
  for (let i = 0; i < 3; i++) {
    const a = i * ((Math.PI * 2) / 3) - Math.PI * 0.5;
    const mx = cx + Math.cos(a) * 4.2;
    const mz = cz + Math.sin(a) * 4.2;
    const y = getWorldSurfaceHeight(mx, mz);
    const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.1, 18), markerMat);
    marker.position.set(mx, y + 0.24, mz);
    marker.renderOrder = RENDER_SHORE + 1;
    scene.add(marker);
  }

  // Clear, grouped service buildings around one plaza.
  addBank(scene, blobTex, cx - 6.2, cz + 1.5, resourceNodes);
  addStore(scene, blobTex, cx + 6.2, cz + 1.5, resourceNodes);
  addBlacksmith(scene, blobTex, cx, cz - 6.8, resourceNodes);

  // Training dummies — row left of the plaza
  addTrainingDummy(scene, blobTex, cx - 14, cz, resourceNodes);
  addTrainingDummy(scene, blobTex, cx - 17, cz, resourceNodes);
  addTrainingDummy(scene, blobTex, cx - 20, cz, resourceNodes);

  // Construction yard sits beside the service plaza with matching footprint.
  const constructionSite = addConstructionYard(scene, blobTex, cx + 22.5, cz, resourceNodes);
  const houseCenterX = cx + 22.65;
  const houseCenterZ = cz - 0.2;
  collisionObstacles.push(
    { x: cx - 6.2, z: cz + 1.5, radius: 1.35, id: "bank" },
    { x: cx + 6.2, z: cz + 1.5, radius: 1.45, id: "store" },
    { x: cx, z: cz - 6.8, radius: 1.6, id: "blacksmith" },
    // Wider, multi-circle collision hull so the player cannot enter and get trapped.
    { x: houseCenterX, z: houseCenterZ, radius: 2.35, id: "house-core" },
    { x: houseCenterX - 1.2, z: houseCenterZ, radius: 1.45, id: "house-left" },
    { x: houseCenterX + 1.2, z: houseCenterZ, radius: 1.45, id: "house-right" }
  );
  return { constructionSite };
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
  // Use a FIXED inner radius so adjacent angle segments don't jump at concavities.
  // Minimum lake radius ≈ 18.25, so 10 is safely inside the lake at all angles.
  const segs = 480, rings = 36, fixedInnerR = 10, outerR = 44;
  const positions = [], colors = [], indices = [];
  const vpr = segs + 1;
  const cWaterEdge = new THREE.Color("#a8ddd8");
  const cSand = new THREE.Color("#e0c888");
  const cGrass = new THREE.Color("#7dba5e");
  for (let r = 0; r <= rings; r++) {
    const rt = r / rings;
    for (let s = 0; s <= segs; s++) {
      const angle = (s / segs) * Math.PI * 2;
      const radius = fixedInnerR + (outerR - fixedInnerR) * rt;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const distR = Math.hypot(x, z);
      const waterR = getWaterRadiusAtAngle(angle);
      let y;
      if (distR < waterR - 3.0) {
        // Well inside the lake — sit just below water surface
        y = WATER_SURFACE_Y - 0.04;
      } else if (distR < waterR + 4.0) {
        // Transition zone — smooth blend from water level to terrain
        const t = THREE.MathUtils.smoothstep(distR, waterR - 3.0, waterR + 4.0);
        const shoreH = Math.max(sampleTerrainHeight(x, z), WATER_SURFACE_Y + 0.02);
        y = THREE.MathUtils.lerp(WATER_SURFACE_Y - 0.04, shoreH + SHORE_LIFT, t);
      } else {
        y = sampleTerrainHeight(x, z) + SHORE_LIFT;
      }
      positions.push(x, y, z);

      const shoreT = THREE.MathUtils.smoothstep(distR, waterR - 2.0, waterR + 4.5);
      const grassT = THREE.MathUtils.smoothstep(distR, waterR + 3.0, waterR + 8.0);
      const c = new THREE.Color().copy(cWaterEdge).lerp(cSand, shoreT);
      c.lerp(cGrass, grassT);
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * vpr + s, b = a + 1, c = (r + 1) * vpr + s, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const beachRing = new THREE.Mesh(geo, toonMat("#ffffff", { side: THREE.DoubleSide, vertexColors: true }));
  beachRing.renderOrder = RENDER_SHORE;
  scene.add(beachRing);
}

function addLilyPads(scene) {
  const padPositions = [
    { x: -8, z: 6, r: 0.55, flower: false },
    { x: -5, z: 12, r: 0.45, flower: true, flowerColor: "#f5a0c0" },
    { x: 3, z: 14, r: 0.6, flower: false },
    { x: 7, z: 11, r: 0.5, flower: true, flowerColor: "#f7e663" },
    { x: -11, z: 3, r: 0.4, flower: false },
    { x: 12, z: -3, r: 0.55, flower: false },
    { x: -4, z: -10, r: 0.5, flower: true, flowerColor: "#f5a0c0" },
    { x: 6, z: -8, r: 0.45, flower: false },
    { x: -9, z: -5, r: 0.65, flower: false },
    { x: 10, z: 5, r: 0.5, flower: false },
  ];
  for (const pad of padPositions) {
    // Circle with wedge notch
    const geo = new THREE.CircleGeometry(pad.r, 16, 0.2, Math.PI * 2 - 0.4);
    const lilyMat = toonMat("#4a9e6b");
    const lily = new THREE.Mesh(geo, lilyMat);
    lily.rotation.x = -Math.PI / 2;
    lily.rotation.z = Math.random() * Math.PI * 2;
    lily.position.set(pad.x, WATER_SURFACE_Y + 0.01, pad.z);
    lily.renderOrder = RENDER_WATER + 1;
    scene.add(lily);
    if (pad.flower) {
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 6),
        toonMat(pad.flowerColor)
      );
      flower.position.set(pad.x + (Math.random() - 0.5) * 0.15, WATER_SURFACE_Y + 0.07, pad.z + (Math.random() - 0.5) * 0.15);
      flower.renderOrder = RENDER_WATER + 2;
      scene.add(flower);
    }
  }
}

function addWildflowers(scene) {
  const patches = [
    { cx: 26, cz: 14, count: 7 },
    { cx: -24, cz: 12, count: 6 },
    { cx: 18, cz: -22, count: 5 },
    { cx: -20, cz: -18, count: 8 },
    { cx: 30, cz: 0, count: 6 },
  ];
  const flowerColors = ["#f5a0c0", "#f7e663", "#c4a0f5", "#ff9e7a", "#a0d8f0"];
  for (const patch of patches) {
    for (let i = 0; i < patch.count; i++) {
      const fx = patch.cx + (Math.random() - 0.5) * 3.5;
      const fz = patch.cz + (Math.random() - 0.5) * 3.5;
      const baseY = getWorldSurfaceHeight(fx, fz);
      const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      // Stem
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.018, 0.35, 4),
        toonMat("#5a9e48")
      );
      stem.position.set(fx, baseY + 0.18, fz);
      stem.renderOrder = RENDER_DECOR;
      scene.add(stem);
      // Blossom
      const blossom = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 6, 6),
        toonMat(color)
      );
      blossom.position.set(fx, baseY + 0.37, fz);
      blossom.renderOrder = RENDER_DECOR;
      scene.add(blossom);
    }
  }
}

function addExtraTrees(scene, blobTex, resourceNodes) {
  const extraTrees = [
    [-35, 14, 0.92], [36, -10, 0.88], [-15, 32, 0.95], [25, -28, 0.82],
    [-38, -8, 1.0], [32, 16, 0.9], [12, -34, 0.86], [-10, -33, 0.94],
    [40, 4, 0.84], [-30, 22, 0.88], [22, 32, 0.92], [-36, -18, 0.86],
  ];
  for (const [x, z, scale] of extraTrees) {
    addTree(scene, blobTex, x, z, scale, resourceNodes);
  }
}

function addExtraReeds(scene) {
  const patches = [
    [22, 12, 8], [-22, 10, 6], [15, 22, 7], [-14, 22, 5],
    [25, -12, 6], [-25, -8, 7], [8, 26, 5], [-8, 26, 6],
  ];
  const reedColors = ["#89b162", "#7da858", "#96bd6e", "#80a954"];
  for (const [x, z, count] of patches) {
    const baseY = getWorldSurfaceHeight(x, z);
    for (let i = 0; i < count; i++) {
      const color = reedColors[Math.floor(Math.random() * reedColors.length)];
      const reed = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.04, 0.95 + Math.random() * 0.45, 5),
        toonMat(color)
      );
      reed.position.set(x + (Math.random() - 0.5) * 0.9, baseY + 0.48, z + (Math.random() - 0.5) * 0.9);
      reed.rotation.z = (Math.random() - 0.5) * 0.28;
      reed.renderOrder = RENDER_DECOR;
      scene.add(reed);
    }
  }
}

function addBushes(scene) {
  const bushPositions = [
    [26, 17, 0.7], [-23, 15, 0.6], [18, -21, 0.8], [-19, -17, 0.65],
    [30, 4, 0.55], [-28, -4, 0.7], [14, 26, 0.6], [-12, 26, 0.65],
    [32, -14, 0.5], [-34, 10, 0.55], [8, -28, 0.6], [-6, 30, 0.7],
    [28, 22, 0.5], [-26, 20, 0.55], [35, -6, 0.6], [-32, -12, 0.5],
  ];
  const bushColors = ["#4daf6a", "#3d9e5c", "#5cbc78", "#48a862"];
  for (const [x, z, scale] of bushPositions) {
    const baseY = getWorldSurfaceHeight(x, z);
    const color = bushColors[Math.floor(Math.random() * bushColors.length)];
    const bush = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.6 * scale, 1),
      toonMat(color)
    );
    bush.position.set(x, baseY + 0.35 * scale, z);
    bush.scale.set(1, 0.65, 1);
    bush.rotation.y = Math.random() * Math.PI;
    bush.renderOrder = RENDER_DECOR;
    scene.add(bush);
  }
}

export function createWorld(scene) {
  const resourceNodes = [];
  const collisionObstacles = [];
  const skyMat = addSky(scene);
  const ground = createGround(scene);
  addLakeRings(scene);
  const { waterUniforms, causticMap } = createWater(scene);
  addWaterRocks(scene);
  const blobTex = radialTexture();
  addShoreDecor(scene, blobTex, resourceNodes);
  addExtraTrees(scene, blobTex, resourceNodes);
  addBushes(scene);
  addLilyPads(scene);
  addWildflowers(scene);
  addExtraReeds(scene);
  const fishingSpots = addFishingSpots(scene, resourceNodes);
  const { constructionSite } = addServicePlaza(scene, blobTex, resourceNodes, collisionObstacles);
  const addBlob = (x, z, radius, opacity) => addShadowBlob(scene, blobTex, x, z, radius, opacity);
  const updateWorld = (time) => {
    updateFishingSpots(fishingSpots, time);
  };
  return { ground, skyMat, waterUniforms, causticMap, addShadowBlob: addBlob, resourceNodes, updateWorld, constructionSite, collisionObstacles };
}

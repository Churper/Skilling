import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// ── Toon material helper ──
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

function stabilizeModelLook(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (!obj || !obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const tuned = mats.map((mat) => {
      if (!mat) return mat;
      if ("metalness" in mat) mat.metalness = 0;
      if ("roughness" in mat) mat.roughness = 1;
      if ("shininess" in mat) mat.shininess = 0;
      if ("specular" in mat && mat.specular?.setScalar) mat.specular.setScalar(0);
      if ("envMapIntensity" in mat) mat.envMapIntensity = 0;
      if ("flatShading" in mat) mat.flatShading = true;
      mat.needsUpdate = true;
      return mat;
    });
    obj.material = Array.isArray(obj.material) ? tuned : tuned[0];
  });
}

// ── Constants ──
const LAKE_RADIUS = 24.0;
const WATER_RADIUS = 24.8;
const LAKE_BOWL_Y = 0.58;
const WATER_SURFACE_Y = 0.596;
const MOUNTAIN_START = 46;
const MOUNTAIN_END = 100;
const MAP_RADIUS = 115;
const RENDER_GROUND = 0;
const RENDER_SHORE = 1;
const RENDER_WATER = 2;
const RENDER_DECOR = 3;

const SERVICE_LAYOUT = Object.freeze({
  plaza: { x: 0, z: -34, radius: 14 },
  construction: { x: 18, z: -37, radius: 10 },
  training: { x: -24, z: -36, radius: 10 },
});

const DECOR_KEEP_OUT_ZONES = Object.freeze([
  { x: SERVICE_LAYOUT.plaza.x, z: SERVICE_LAYOUT.plaza.z, radius: SERVICE_LAYOUT.plaza.radius },
  { x: SERVICE_LAYOUT.construction.x, z: SERVICE_LAYOUT.construction.z, radius: SERVICE_LAYOUT.construction.radius },
  { x: SERVICE_LAYOUT.training.x, z: SERVICE_LAYOUT.training.z, radius: SERVICE_LAYOUT.training.radius },
]);

function isInDecorKeepOutZone(x, z, padding = 0) {
  for (const zone of DECOR_KEEP_OUT_ZONES) {
    if (Math.hypot(x - zone.x, z - zone.z) <= zone.radius + padding) return true;
  }
  return false;
}

// ── Organic shoreline shape ──
function getLakeRadiusAtAngle(a) {
  return LAKE_RADIUS
    + Math.sin(a * 1.7 + 0.5) * 1.05
    + Math.sin(a * 3.4 - 1.2) * 0.65
    + Math.cos(a * 5.1 + 0.2) * 0.45;
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

// ── Shared materials ──
const FISH_SPOT_RING_MAT = new THREE.MeshBasicMaterial({ color: "#dcf8ff", transparent: true, opacity: 0.72 });
const FISH_SPOT_BOBBER_MAT = toonMat("#ffcc58");
const SERVICE_HOTSPOT_MAT = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false, depthTest: false,
});

// ── Shared geometries ──
const SHARED_GEO = {
  hotspot: new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12),
  fencePost: new THREE.CylinderGeometry(0.07, 0.08, 0.72, 6),
  signPost: new THREE.CylinderGeometry(0.07, 0.08, 1.2, 6),
  fishRing: new THREE.TorusGeometry(0.5, 0.045, 8, 24),
  fishBobber: new THREE.SphereGeometry(0.13, 8, 7),
};

// ── Terrain noise ──
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
  const bowlFalloff = 1.0 - THREE.MathUtils.smoothstep(r, 0, 31);
  const lakeBasin = Math.pow(bowlFalloff, 1.65) * 1.15;
  const roughnessBoost = THREE.MathUtils.smoothstep(r, 17.5, 50);
  const amplitude = THREE.MathUtils.lerp(0.31, 0.55, roughnessBoost);
  const hillNoise = Math.sin(x * 0.065 + z * 0.048) * Math.cos(x * 0.031 - z * 0.057);
  const hillBoost = THREE.MathUtils.smoothstep(r, 26.0, 50.0) * hillNoise * 0.8;
  const flatTerrain = noise * amplitude - lakeBasin + hillBoost;

  if (r > MOUNTAIN_START) {
    const mt = THREE.MathUtils.smoothstep(r, MOUNTAIN_START, MOUNTAIN_END);
    const mountainH = mt * mt * 70;
    const angle = Math.atan2(z, x);
    const ridge = (Math.sin(angle * 13.7 + x * 0.15) * 0.5 + 0.5) * mt * 8;
    const ridge2 = (Math.cos(angle * 7.3 - z * 0.12) * 0.5 + 0.5) * mt * 5;
    const detail = Math.sin(x * 0.18) * Math.cos(z * 0.14) * mt * 3;
    return flatTerrain + mountainH + ridge + ridge2 + detail;
  }

  return flatTerrain;
}

function sampleLakeFloorHeight(x, z) {
  const r = Math.hypot(x, z);
  const lakeR = getLakeRadiusAt(x, z);
  if (r > lakeR) return -Infinity;
  const radius01 = r / lakeR;
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

// ── Node helpers ──
function setResourceNode(node, resourceType, label) {
  node.userData.resourceType = resourceType;
  node.userData.resourceLabel = label;
}
function setServiceNode(node, serviceType, label) {
  node.userData.serviceType = serviceType;
  node.userData.resourceLabel = label;
}
function addServiceHotspot(parent, x, y, z, radius = 0.9, height = 1.6) {
  const hotspot = new THREE.Mesh(SHARED_GEO.hotspot, SERVICE_HOTSPOT_MAT);
  hotspot.position.set(x, y, z);
  hotspot.renderOrder = RENDER_DECOR + 10;
  parent.add(hotspot);
  return hotspot;
}

// ── Sky ──
function addSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    uniforms: {
      cTop: { value: new THREE.Color("#2888d4") },
      cMid: { value: new THREE.Color("#6ec8f4") },
      cBot: { value: new THREE.Color("#a8d8ee") },
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

// ── Unified radial terrain mesh ──
function createRadialTerrain(scene) {
  const innerR = WATER_RADIUS - 3;
  const outerR = MAP_RADIUS;
  const angSegs = 128;
  const radRings = 55;
  const positions = [];
  const colors = [];
  const indices = [];
  const colSand = new THREE.Color("#dcc890");
  const colGrassLight = new THREE.Color("#6bcf4f");
  const colGrassMid = new THREE.Color("#4cad3a");
  const colGrassDark = new THREE.Color("#2c8228");
  const colGrassEdge = new THREE.Color("#7ba55c");
  const colRock = new THREE.Color("#7a8771");
  const colCliff = new THREE.Color("#6d655b");
  const colTmp = new THREE.Color();
  const lightX = 0.54, lightY = 0.78, lightZ = 0.31;
  const sampleStep = 0.8;
  const vpr = angSegs + 1;

  for (let ri = 0; ri <= radRings; ri++) {
    const t = ri / radRings;
    const biased = Math.pow(t, 0.45);
    const radius = innerR + (outerR - innerR) * biased;
    for (let ai = 0; ai <= angSegs; ai++) {
      const angle = (ai / angSegs) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const r = Math.hypot(x, z);
      let y = sampleTerrainHeight(x, z);
      const coastNoise =
        Math.sin(angle * 4.2 + 0.4) * 0.95 +
        Math.sin(angle * 8.6 - 1.1) * 0.48 +
        Math.sin((x + z) * 0.055) * 0.42 +
        sampleTerrainNoise(x * 0.7, z * 0.7) * 0.85;
      const coastRadius = getWaterRadiusAt(x, z) + coastNoise * 0.55;

      if (r < coastRadius + 2.9) {
        const blend = THREE.MathUtils.smoothstep(r, coastRadius - 2.3, coastRadius + 2.9);
        y = THREE.MathUtils.lerp(WATER_SURFACE_Y - 0.06, y, blend);
      }
      positions.push(x, y, z);

      const hx = sampleTerrainHeight(x + sampleStep, z) - sampleTerrainHeight(x - sampleStep, z);
      const hz = sampleTerrainHeight(x, z + sampleStep) - sampleTerrainHeight(x, z - sampleStep);
      const nx = -hx, ny = 2.0, nz = -hz;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      const litRaw = THREE.MathUtils.clamp((nx * lightX + ny * lightY + nz * lightZ) * invLen * 0.5 + 0.5, 0, 1);
      const litBanded = Math.floor(litRaw * 4.5) / 4;
      const litStylized = THREE.MathUtils.lerp(litRaw, litBanded, 0.45);
      const noise = sampleTerrainNoise(x, z);
      const tonal = THREE.MathUtils.clamp(litStylized * 0.7 + noise * 0.15 + 0.15, 0, 1);

      // Sharp sand→grass transition (1.2 unit band instead of 3.35)
      const sandFade = THREE.MathUtils.smoothstep(r, coastRadius + 0.4, coastRadius + 1.6);
      // Darker edge strip at transition boundary
      const edgePulse = THREE.MathUtils.smoothstep(r, coastRadius + 0.8, coastRadius + 1.2)
                      * (1 - THREE.MathUtils.smoothstep(r, coastRadius + 1.2, coastRadius + 1.6));
      const grassDeepen = THREE.MathUtils.smoothstep(r, coastRadius + 3.0, coastRadius + 11.6);
      const forestBlend = THREE.MathUtils.smoothstep(r, 41.5, 56.5);
      const edgeRock = THREE.MathUtils.smoothstep(r, 44.0, 52.2);
      const mountainRock = THREE.MathUtils.smoothstep(y, 3.0, 11.8);
      const rockBlend = Math.max(edgeRock * 0.88, mountainRock * 0.72);
      const cliffBlend = THREE.MathUtils.smoothstep(r, 56, 73);

      colTmp.copy(colSand);
      colTmp.lerp(colGrassLight, sandFade);
      if (edgePulse > 0) colTmp.lerp(colGrassEdge, edgePulse * 0.6);
      if (grassDeepen > 0) colTmp.lerp(colGrassMid, grassDeepen * 0.68);
      if (forestBlend > 0) colTmp.lerp(colGrassDark, forestBlend * 0.76);
      if (rockBlend > 0) colTmp.lerp(colRock, THREE.MathUtils.clamp(rockBlend, 0, 1));
      if (cliffBlend > 0) colTmp.lerp(colCliff, cliffBlend * 0.84);
      colTmp.multiplyScalar(0.95 + tonal * 0.23);
      colTmp.offsetHSL(0, 0, (noise - 0.5) * 0.045);

      colors.push(colTmp.r, colTmp.g, colTmp.b);
    }
  }

  for (let ri = 0; ri < radRings; ri++) {
    for (let ai = 0; ai < angSegs; ai++) {
      const a = ri * vpr + ai, b = a + 1;
      const c = (ri + 1) * vpr + ai, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const terrain = new THREE.Mesh(geo, toonMat("#ffffff", { vertexColors: true, fog: false }));
  terrain.renderOrder = RENDER_GROUND;
  scene.add(terrain);
  return terrain;
}

// ── Lake bowl mesh ──
function createLakeBowlMesh() {
  const segments = 120;
  const rings = 30;
  const innerRing = 0.035;
  const positions = [];
  const colors = [];
  const indices = [];
  const deep = new THREE.Color("#2e8faf");
  const mid = new THREE.Color("#55bdd0");
  const shelf = new THREE.Color("#95c9b4");

  for (let r = 0; r <= rings; r++) {
    const ringT = innerRing + (1 - innerRing) * (r / rings);
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const radius = getLakeRadiusAtAngle(angle) * ringT;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const depth = Math.pow(1 - ringT, 1.72);
      const lip = THREE.MathUtils.smoothstep(ringT, 0.72, 1.0);
      const y = -(0.16 + depth * 1.78 + lip * 0.05);
      positions.push(x, y, z);

      const c = new THREE.Color();
      const depth01 = THREE.MathUtils.clamp((-y - 0.16) / 1.92, 0, 1);
      const tMid = THREE.MathUtils.smoothstep(depth01, 0.18, 0.7);
      const tDeep = THREE.MathUtils.smoothstep(depth01, 0.58, 1.0);
      c.copy(shelf).lerp(mid, tMid);
      c.lerp(deep, tDeep);
      const sediment = (Math.sin(x * 0.18 + z * 0.13) * 0.5 + 0.5) * 0.55
        + (Math.sin(x * 0.33 - z * 0.29 + 1.6) * 0.5 + 0.5) * 0.45;
      c.offsetHSL(0.0, -0.04 + sediment * 0.05, -0.06 + sediment * 0.12);
      colors.push(c.r, c.g, c.b);
    }
  }

  for (let r = 0; r < rings; r++) {
    const inner = r * segments;
    const outer = (r + 1) * segments;
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

  const bowl = new THREE.Mesh(geo, toonMat("#ffffff", { vertexColors: true, side: THREE.DoubleSide }));
  bowl.position.y = LAKE_BOWL_Y;
  return bowl;
}

// ── Caustic texture ──
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

// ── Water mesh + shader ──
function createWater(scene) {
  const waterUniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color("#7fc9d6") },
    uMid: { value: new THREE.Color("#2f9ab8") },
    uDeep: { value: new THREE.Color("#145f86") },
    uBeach: { value: new THREE.Color("#e3cea1") },
  };

  const lakeFloor = createLakeBowlMesh();
  lakeFloor.renderOrder = RENDER_SHORE;
  scene.add(lakeFloor);

  const causticMap = createCausticTexture();

  const wSegs = 120;
  const wRings = 30;
  const wInner = 0.03;
  const wPos = [];
  const wUvs = [];
  const wRads = [];
  const wIdx = [];
  for (let r = 0; r <= wRings; r++) {
    const rt = wInner + (1 - wInner) * (r / wRings);
    for (let s = 0; s < wSegs; s++) {
      const a = (s / wSegs) * Math.PI * 2;
      const shorelineR = getWaterRadiusAtAngle(a);
      const rad = shorelineR * rt;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      wPos.push(x, 0, z);
      wUvs.push(x / ((WATER_RADIUS + 2.0) * 2) + 0.5, z / ((WATER_RADIUS + 2.0) * 2) + 0.5);
      wRads.push(rt);
    }
  }
  for (let r = 0; r < wRings; r++) {
    const inner = r * wSegs;
    const outer = (r + 1) * wSegs;
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
        float w0 = sin(pp.x * 0.16 + pp.y * 0.12 + t * 0.82) * 0.032;
        float w1 = sin(pp.x * 0.28 - pp.y * 0.22 + t * 0.65) * 0.022;
        float w2 = cos(pp.x * 0.11 + pp.y * 0.34 - t * 0.74) * 0.026;
        float w3 = sin(pp.x * 0.48 + pp.y * 0.38 + t * 1.3) * 0.012;
        float w4 = sin(pp.x * 0.65 - pp.y * 0.52 - t * 1.05) * 0.008;
        float w5 = cos(pp.x * 0.42 - pp.y * 0.56 + t * 1.15) * 0.010;
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
        float shoreAng = atan(wp.y, wp.x);
        float radialWarp = radial
          + sin(shoreAng * 5.2 + t * 0.32) * 0.028
          + sin(shoreAng * 11.3 - t * 0.22) * 0.012
          + (fbm(wp * 0.09 + vec2(t * 0.01, -t * 0.008)) - 0.5) * 0.045;
        float rw = clamp(radialWarp, 0.0, 1.15);

        vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.46, rw));
        col = mix(col, uShallow, smoothstep(0.32, 0.83, rw));
        float clarity = smoothstep(0.14, 0.72, rw);
        col = mix(col, vec3(0.74, 0.9, 0.94), clarity * 0.13);
        float shoreTint = smoothstep(0.82, 0.99, rw);
        col = mix(col, uBeach * 0.96 + vec3(0.08, 0.1, 0.09), shoreTint * 0.09);

        vec2 cuv = wp * 0.11 + vec2(t * 0.02, -t * 0.015);
        float c1 = voronoi(cuv);
        float c2 = voronoi(cuv * 1.7 + vec2(3.7, 1.2));
        float c3 = voronoi(cuv * 0.6 + vec2(-t * 0.03, t * 0.02));
        float caustic = c1 * 0.4 + c2 * 0.35 + c3 * 0.25;
        float causticBright = (1.0 - smoothstep(0.0, 0.5, caustic)) * 0.24;
        causticBright *= smoothstep(0.02, 0.3, rw) * (1.0 - rw * 0.35);
        col += causticBright * vec3(0.6, 0.92, 1.0);

        float waveTex = fbm(wp * 0.18 + vec2(t * 0.04, -t * 0.03));
        float waveTex2 = fbm(wp * 0.32 + vec2(-t * 0.05, t * 0.035));
        col = mix(col, col * 1.15, waveTex * 0.22 * (1.0 - rw * 0.3));
        col += vec3(0.1, 0.18, 0.2) * waveTex2 * 0.08 * (1.0 - rw * 0.5);

        float flowA = sin(dot(wp, normalize(vec2(0.92, 0.39))) * 0.95 - t * 2.1) * 0.5 + 0.5;
        float flowB = sin(dot(wp, normalize(vec2(-0.44, 0.9))) * 1.38 - t * 1.55) * 0.5 + 0.5;
        float flowC = fbm(wp * 0.42 + vec2(t * 0.08, -t * 0.05));
        float ripple = (flowA * 0.36 + flowB * 0.31 + flowC * 0.33);
        col += ripple * 0.055 * vec3(0.7, 0.9, 1.0) * (1.0 - rw * 0.4);

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 sunDir = normalize(vec3(0.6, 0.8, 0.3));
        vec3 waveN = normalize(vec3(
          sin(wp.x * 0.8 + t * 0.5) * 0.04 + sin(wp.x * 1.8 - t * 0.4) * 0.025,
          1.0,
          sin(wp.y * 0.8 - t * 0.45) * 0.04 + cos(wp.y * 1.8 + t * 0.35) * 0.025
        ));

        float spec = pow(max(dot(reflect(-sunDir, waveN), viewDir), 0.0), 16.0);
        col += vec3(1.0, 0.97, 0.92) * spec * 0.16 * (1.0 - rw * 0.2);

        float NdotV = max(dot(viewDir, waveN), 0.0);
        float fresnel = pow(1.0 - NdotV, 4.0) * 0.1;
        vec3 skyCol = vec3(0.48, 0.74, 0.88);
        col = mix(col, skyCol, fresnel);

        float foamNoise = fbm(wp * 0.74 + vec2(t * 0.08, -t * 0.06));
        float foamWobble = sin(shoreAng * 8.0 + t * 1.2) * 0.011
                         + sin(shoreAng * 13.0 - t * 0.8) * 0.008
                         + sin(shoreAng * 21.0 + t * 1.6) * 0.004;
        float foamEdge = rw + foamWobble;
        float foamBand = smoothstep(0.9, 0.965, foamEdge) * (1.0 - smoothstep(1.0, 1.045, foamEdge));
        float foam = clamp(foamBand * (0.62 + foamNoise * 0.38), 0.0, 1.0);
        col = mix(col, vec3(0.96, 0.98, 1.0), foam * 0.26);

        float shoreFade = smoothstep(0.86, 1.02, rw);
        float bodyAlpha = mix(0.63, 0.17, shoreFade);
        float alpha = max(bodyAlpha, foam * 0.54);
        if (rw > 1.04) discard;
        if (alpha < 0.002) discard;

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = WATER_SURFACE_Y;
  water.renderOrder = RENDER_WATER;
  scene.add(water);
  addShoreFoamRing(scene, waterUniforms);

  return { waterUniforms, causticMap };
}

function addShoreFoamRing(scene, waterUniforms) {
  const segs = 320;
  const foamPos = [];
  const foamUvs = [];
  const foamIdx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = t * Math.PI * 2;
    const shorelineR = getWaterRadiusAtAngle(a);
    const contourNoise =
      Math.sin(a * 6.7 + 0.4) * 0.16 +
      Math.sin(a * 14.3 - 1.1) * 0.08 +
      Math.sin(a * 22.1 + 0.9) * 0.04;
    const innerR = shorelineR - 0.06 + contourNoise * 0.035;
    const outerR = shorelineR + 1.04 + contourNoise * 0.12;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const innerX = c * innerR;
    const innerZ = s * innerR;
    const outerX = c * outerR;
    const outerZ = s * outerR;
    const innerY = 0.012 + Math.sin(a * 10.0 + 0.5) * 0.003;
    const groundOuterY = getWorldSurfaceHeight(outerX, outerZ) - WATER_SURFACE_Y;
    const outerY = THREE.MathUtils.clamp(groundOuterY + 0.055, 0.03, 0.24);
    foamPos.push(innerX, innerY, innerZ);
    foamPos.push(outerX, outerY, outerZ);
    foamUvs.push(t, 0);
    foamUvs.push(t, 1);
    if (i < segs) {
      const j = i * 2;
      foamIdx.push(j, j + 1, j + 2);
      foamIdx.push(j + 1, j + 3, j + 2);
    }
  }

  const foamGeo = new THREE.BufferGeometry();
  foamGeo.setIndex(foamIdx);
  foamGeo.setAttribute("position", new THREE.Float32BufferAttribute(foamPos, 3));
  foamGeo.setAttribute("uv", new THREE.Float32BufferAttribute(foamUvs, 2));

  const foamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: waterUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      varying vec2 vXZ;
      void main() {
        vUv = uv;
        vXZ = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec2 vXZ;
      uniform float uTime;

      void main() {
        float edge = vUv.y;
        float ang = vUv.x;
        float wave = sin(ang * 78.0 + uTime * 1.8) * 0.5 + 0.5;
        wave += sin(ang * 131.0 - uTime * 1.35) * 0.5 + 0.5;
        wave *= 0.5;
        float body = smoothstep(0.05, 0.24, edge) * (1.0 - smoothstep(0.62, 0.96, edge));
        float feather = smoothstep(0.0, 0.12, edge) * (1.0 - smoothstep(0.86, 1.0, edge));
        float edgeNoise = sin(length(vXZ) * 0.45 - uTime * 1.5) * 0.06 + 0.94;
        float alpha = (body * (0.5 + wave * 0.22) + feather * 0.16) * edgeNoise;
        if (alpha < 0.01) discard;
        vec3 foamCol = mix(vec3(0.9, 0.96, 0.98), vec3(1.0), wave * 0.35);
        gl_FragColor = vec4(foamCol, alpha * 0.7);
      }
    `,
  });
  const foam = new THREE.Mesh(foamGeo, foamMat);
  foam.rotation.x = 0;
  foam.position.y = WATER_SURFACE_Y;
  foam.renderOrder = RENDER_WATER + 2;
  scene.add(foam);
}

// ── Shadow blobs ──
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
    const x = 70 + (Math.sin(i * 1.73 + 0.41) * 0.5 + 0.5) * 116;
    const y = 70 + (Math.cos(i * 1.37 + 1.22) * 0.5 + 0.5) * 116;
    const r = 12 + (Math.sin(i * 2.41 + 0.78) * 0.5 + 0.5) * 28;
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
    new THREE.MeshBasicMaterial({
      map: blobTex,
      transparent: true,
      depthWrite: false,
      color: "#344347",
      opacity,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    })
  );
  blob.rotation.x = -Math.PI / 2;
  const phase = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  blob.rotation.z = (phase - Math.floor(phase)) * Math.PI;
  blob.position.set(x, baseY + 0.02, z);
  blob.renderOrder = RENDER_GROUND + 1;
  scene.add(blob);
  return blob;
}

// ── Model loading ──
async function loadModels() {
  THREE.Cache.enabled = true;
  const loader = new GLTFLoader();
  const load = (url) => new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });

  const entries = {
    tree1a: 'models/Tree_1_A_Color1.gltf',
    tree1b: 'models/Tree_1_B_Color1.gltf',
    tree2a: 'models/Tree_2_A_Color1.gltf',
    tree2b: 'models/Tree_2_B_Color1.gltf',
    tree3a: 'models/Tree_3_A_Color1.gltf',
    tree3b: 'models/Tree_3_B_Color1.gltf',
    tree4a: 'models/Tree_4_A_Color1.gltf',
    tree4b: 'models/Tree_4_B_Color1.gltf',
    treeBare1a: 'models/Tree_Bare_1_A_Color1.gltf',
    treeBare1b: 'models/Tree_Bare_1_B_Color1.gltf',
    treeBare2a: 'models/Tree_Bare_2_A_Color1.gltf',
    bush1a: 'models/Bush_1_A_Color1.gltf',
    bush1b: 'models/Bush_1_B_Color1.gltf',
    bush2a: 'models/Bush_2_A_Color1.gltf',
    bush2b: 'models/Bush_2_B_Color1.gltf',
    bush3a: 'models/Bush_3_A_Color1.gltf',
    bush4a: 'models/Bush_4_A_Color1.gltf',
    rock1a: 'models/Rock_1_A_Color1.gltf',
    rock1b: 'models/Rock_1_B_Color1.gltf',
    rock2a: 'models/Rock_2_A_Color1.gltf',
    rock2b: 'models/Rock_2_B_Color1.gltf',
    rock3a: 'models/Rock_3_A_Color1.gltf',
    rock3b: 'models/Rock_3_B_Color1.gltf',
    grass1a: 'models/Grass_1_A_Color1.gltf',
    grass1b: 'models/Grass_1_B_Color1.gltf',
    grass2a: 'models/Grass_2_A_Color1.gltf',
    grass2b: 'models/Grass_2_B_Color1.gltf',
    sword: 'models/sword_A.gltf',
    bow: 'models/bow_A_withString.gltf',
    staff: 'models/staff_A.gltf',
    arrow: 'models/arrow_A.gltf',
  };

  const keys = Object.keys(entries);
  const results = await Promise.all(keys.map(k => load(entries[k]).catch(err => {
    console.warn(`Failed to load ${entries[k]}:`, err);
    return null;
  })));

  for (const model of results) stabilizeModelLook(model);

  const models = {};
  keys.forEach((k, i) => { models[k] = results[i]; });

  return {
    trees: [models.tree1a, models.tree1b, models.tree2a, models.tree2b,
            models.tree3a, models.tree3b, models.tree4a, models.tree4b].filter(Boolean),
    bareTrees: [models.treeBare1a, models.treeBare1b, models.treeBare2a].filter(Boolean),
    bushes: [models.bush1a, models.bush1b, models.bush2a, models.bush2b,
             models.bush3a, models.bush4a].filter(Boolean),
    rocks: [models.rock1a, models.rock1b, models.rock2a, models.rock2b].filter(Boolean),
    bigRocks: [models.rock3a, models.rock3b].filter(Boolean),
    grass: [models.grass1a, models.grass1b, models.grass2a, models.grass2b].filter(Boolean),
    weapons: {
      sword: models.sword,
      bow: models.bow,
      staff: models.staff,
      arrow: models.arrow,
    },
  };
}

// ── Model placement: Trees (cluster-based) ──
function placeTrees(scene, blobTex, models, resourceNodes) {
  const templates = models.trees;
  if (!templates.length) return;

  // South shore is OPEN — trees only on north, east, west sides + behind village
  const TREE_CLUSTERS = [
    // ── North shore clusters (behind the lake, z > 0) ──
    { center: [6, 30], trees: [{dx:0,dz:0,s:2.0,r:0.6}, {dx:2.8,dz:1.5,s:1.7,r:1.4}, {dx:-1.5,dz:2.2,s:1.8,r:2.8}] },
    { center: [-8, 31], trees: [{dx:0,dz:0,s:1.9,r:3.2}, {dx:-2.5,dz:0.8,s:1.65,r:4.6}, {dx:1.2,dz:2.0,s:1.75,r:5.8}] },
    { center: [20, 26], trees: [{dx:0,dz:0,s:1.85,r:1.0}, {dx:2.2,dz:-1.4,s:1.6,r:2.2}] },
    { center: [-22, 25], trees: [{dx:0,dz:0,s:1.8,r:4.0}, {dx:-2.0,dz:-1.0,s:1.55,r:5.4}] },
    { center: [0, 36], trees: [{dx:0,dz:0,s:2.1,r:0.2}, {dx:3.0,dz:0.5,s:1.7,r:1.8}, {dx:-2.5,dz:1.8,s:1.85,r:3.6}, {dx:1.0,dz:3.0,s:1.6,r:5.0}] },

    // ── East side clusters (x > 20) ──
    { center: [32, 12], trees: [{dx:0,dz:0,s:1.9,r:0.8}, {dx:2.4,dz:1.8,s:1.6,r:2.0}, {dx:-1.0,dz:2.5,s:1.7,r:3.4}] },
    { center: [34, -4], trees: [{dx:0,dz:0,s:1.75,r:4.4}, {dx:2.0,dz:-1.5,s:1.55,r:5.6}] },

    // ── West side clusters (x < -20) ──
    { center: [-33, 10], trees: [{dx:0,dz:0,s:1.85,r:1.2}, {dx:-2.2,dz:1.6,s:1.65,r:2.6}, {dx:1.5,dz:2.8,s:1.7,r:4.2}] },
    { center: [-35, -6], trees: [{dx:0,dz:0,s:1.8,r:5.0}, {dx:-1.8,dz:-1.2,s:1.6,r:0.4}] },

    // ── Village accent trees (just a few, not blocking the view) ──
    { center: [-16, -36], trees: [{dx:0,dz:0,s:2.2,r:1.8}] },  // shade tree between training & bank
    { center: [13, -39], trees: [{dx:0,dz:0,s:1.9,r:2.7}] },  // near construction yard

    // ── Forest backdrop (treeline south of village, z ≈ -44 to -47) ──
    { center: [-18, -45], trees: [{dx:0,dz:0,s:2.0,r:0.9}, {dx:2.8,dz:0.5,s:1.8,r:1.7}, {dx:-2.0,dz:1.2,s:1.9,r:2.4}, {dx:5.0,dz:-0.8,s:1.7,r:3.0}] },
    { center: [6, -46], trees: [{dx:0,dz:0,s:2.1,r:3.6}, {dx:-2.5,dz:0.8,s:1.85,r:4.4}, {dx:3.0,dz:1.0,s:1.95,r:5.2}, {dx:0.5,dz:-1.5,s:1.75,r:0.3}] },
    { center: [24, -44], trees: [{dx:0,dz:0,s:1.9,r:1.4}, {dx:2.5,dz:1.5,s:1.7,r:2.8}] },
    { center: [-6, -47], trees: [{dx:0,dz:0,s:1.85,r:4.8}, {dx:-3.0,dz:-0.5,s:1.75,r:0.6}] },
  ];

  let treeIdx = 0;
  for (const cluster of TREE_CLUSTERS) {
    const [cx, cz] = cluster.center;
    for (const t of cluster.trees) {
      const x = cx + t.dx;
      const z = cz + t.dz;
      if (isInDecorKeepOutZone(x, z, 2.2)) continue;
      const template = templates[treeIdx % templates.length];
      const instance = template.clone();
      instance.scale.setScalar(t.s);
      instance.rotation.y = t.r;
      instance.position.set(x, getWorldSurfaceHeight(x, z), z);
      setResourceNode(instance, "woodcutting", "Tree");
      scene.add(instance);
      resourceNodes.push(instance);
      addShadowBlob(scene, blobTex, x, z, t.s * 1.0, 0.15);
      treeIdx++;
    }
  }
}

// ── Model placement: Rocks (interactable, grouped) ──
function placeRocks(scene, blobTex, models, resourceNodes) {
  const templates = models.rocks;
  if (!templates.length) return;

  // 3 clusters of 2 rocks each — east, west, and north of lake
  const ROCK_GROUPS = [
    { center: [34, 4], rocks: [{dx:0,dz:0,s:1.9,r:0.3}, {dx:1.8,dz:1.2,s:1.5,r:2.1}] },
    { center: [-32, 6], rocks: [{dx:0,dz:0,s:2.0,r:3.2}, {dx:-1.5,dz:1.8,s:1.6,r:5.0}] },
    { center: [14, 32], rocks: [{dx:0,dz:0,s:1.8,r:4.1}, {dx:2.0,dz:-1.2,s:1.5,r:1.4}] },
  ];

  let rockIdx = 0;
  for (const group of ROCK_GROUPS) {
    const [cx, cz] = group.center;
    for (const rk of group.rocks) {
      const x = cx + rk.dx;
      const z = cz + rk.dz;
      const template = templates[rockIdx % templates.length];
      const instance = template.clone();
      instance.scale.setScalar(rk.s);
      instance.rotation.y = rk.r;
      instance.position.set(x, getWorldSurfaceHeight(x, z), z);
      setResourceNode(instance, "mining", "Rock");
      scene.add(instance);
      resourceNodes.push(instance);
      addShadowBlob(scene, blobTex, x, z, rk.s * 0.7, 0.17);
      rockIdx++;
    }
  }
}

// ── Model placement: Water rocks (decorative) ──
function placeWaterRocks(scene, models) {
  const templates = models.rocks;
  if (!templates.length) return;

  const positions = [
    [-7.2, 4.3, 1.4, 0.4], [5.6, 7.1, 1.2, 1.2], [8.8, -4.5, 1.5, 2.0],
    [-6.5, -6.2, 1.1, 3.4], [0.6, 9.2, 1.0, 4.8],
  ];

  for (let i = 0; i < positions.length; i++) {
    const [x, z, scale, rot] = positions[i];
    const template = templates[i % templates.length];
    const instance = template.clone();
    instance.scale.setScalar(scale);
    instance.rotation.y = rot;
    instance.position.set(x, getWorldSurfaceHeight(x, z), z);
    instance.renderOrder = RENDER_DECOR;
    scene.add(instance);
  }
}

// ── Model placement: Bushes (purposeful along paths & buildings) ──
function placeBushes(scene, models) {
  const templates = models.bushes;
  if (!templates.length) return;

  const positions = [
    // Along shore promenade path edges
    [-14, -30.5, 1.1, 0.4], [14, -30.8, 1.12, 2.8],
    // Flanking the village buildings
    [-10, -33, 1.0, 3.4], [10, -33, 0.98, 5.6],
    // North shore (behind the lake, decorative)
    [8, 29, 1.14, 2.1], [-10, 30, 1.1, 2.8], [22, 24, 1.18, 0.2], [-24, 22, 1.2, 4.2],
    // East/west side accents
    [30, 8, 1.15, 0.5], [-30, 6, 1.1, 1.1], [32, -8, 1.08, 1.9], [-32, -10, 1.06, 2.7],
    // Near training ground entrance
    [-20, -34, 0.96, 3.7],
    // Near construction yard entrance
    [15, -35, 1.04, 0.4],
    // Forest backdrop edge
    [-10, -43, 1.0, 5.2], [16, -43, 1.0, 5.8], [0, -44, 0.96, 1.2], [-22, -44, 1.02, 3.0],
  ];

  for (let i = 0; i < positions.length; i++) {
    const [x, z, scale, rot] = positions[i];
    if (isInDecorKeepOutZone(x, z, 1.6)) continue;
    const template = templates[i % templates.length];
    const instance = template.clone();
    instance.scale.setScalar(scale);
    instance.rotation.y = rot;
    instance.position.set(x, getWorldSurfaceHeight(x, z), z);
    instance.renderOrder = RENDER_DECOR;
    scene.add(instance);
  }
}

// ── Model placement: Grass patches (meadow areas) ──
function placeGrass(scene, models) {
  const templates = models.grass;
  if (!templates.length) return;

  const placements = [
    // Wildflower meadow behind village
    [-8, -40], [4, -41], [-4, -39], [8, -40], [-12, -41], [12, -42],
    // North shore meadow (behind the lake)
    [4, 32], [-6, 34], [14, 30], [-14, 32], [0, 38], [8, 36], [-10, 37],
    // East side meadows
    [34, 11], [37, 3], [36, -7], [33, -16],
    // West side meadows
    [-33, 14], [-37, 4], [-33, -15], [-36, -8],
    // Outer rings (beyond tree line)
    [40, 14], [42, 4], [41, -8],
    [-38, 17], [-42, 6], [-38, -18],
    [28, 28], [-27, 27], [18, 34], [-20, 33],
  ];

  for (let i = 0; i < placements.length; i++) {
    const [x, z] = placements[i];
    if (isInDecorKeepOutZone(x, z, 1.0)) continue;
    const template = templates[i % templates.length];
    const instance = template.clone();
    const scale = 0.86 + (i % 5) * 0.12;
    instance.scale.setScalar(scale);
    instance.rotation.y = (i % 16) * (Math.PI / 8);
    instance.position.set(x, getWorldSurfaceHeight(x, z), z);
    instance.renderOrder = RENDER_DECOR;
    scene.add(instance);
  }
}

// ── Model placement: Mountain decor ──
function placeMountainDecor(scene, models) {
  const rockTemplates = models.bigRocks.length ? models.bigRocks : models.rocks;
  const treeTemplates = models.trees;

  const mountainRocks = [
    // East mountains
    [52, 10, 2.8, 0.4], [57, 23, 2.5, 1.2], [61, -8, 2.7, 2.9], [54, -22, 2.6, 0.9],
    // West mountains
    [-52, 12, 2.8, 0.5], [-58, 25, 2.6, 1.4], [-62, -9, 2.8, 3.1], [-55, -24, 2.7, 1.1],
    // North mountains (dramatic backdrop behind lake)
    [30, 52, 3.2, 3.8], [-25, 55, 3.0, 4.1], [8, 58, 3.4, 4.6], [-12, 54, 2.9, 4.8],
    // South mountains (behind village, framing it)
    [38, -48, 2.8, 5.2], [-35, -50, 3.0, 5.4], [10, -54, 3.1, 2.0], [-10, -52, 2.9, 2.2],
  ];

  if (rockTemplates.length) {
    for (let i = 0; i < mountainRocks.length; i++) {
      const [x, z, scale, rot] = mountainRocks[i];
      const template = rockTemplates[i % rockTemplates.length];
      const instance = template.clone();
      instance.scale.setScalar(scale);
      instance.rotation.y = rot;
      instance.rotation.x = ((i % 5) - 2) * 0.05;
      instance.position.set(x, sampleTerrainHeight(x, z), z);
      scene.add(instance);
    }
  }

  const mountainTrees = [
    // East slopes
    [48, 15, 1.8, 0.2], [51, 28, 1.7, 1.0], [56, 4, 1.9, 1.8],
    // West slopes
    [-48, 15, 1.8, 0.4], [-51, 28, 1.7, 1.2], [-56, 2, 1.9, 2.0],
    // North slopes (behind lake)
    [15, 48, 1.8, 2.5], [-12, 50, 1.7, 3.2], [0, 52, 1.9, 3.8],
    // South slopes (behind village treeline)
    [22, -48, 1.7, 2.7], [-20, -49, 1.8, 3.4],
  ];

  if (treeTemplates.length) {
    for (let i = 0; i < mountainTrees.length; i++) {
      const [x, z, scale, rot] = mountainTrees[i];
      const template = treeTemplates[i % treeTemplates.length];
      const instance = template.clone();
      instance.scale.setScalar(scale);
      instance.rotation.y = rot;
      instance.position.set(x, sampleTerrainHeight(x, z), z);
      scene.add(instance);
    }
  }
}

// ── Lounges ──
function addLounge(scene, blobTex, x, z, rot = 0) {
  const baseY = getWorldSurfaceHeight(x, z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.24, 1.05), toonMat("#f4d93e"));
  base.position.set(x, baseY + 0.72, z);
  base.rotation.y = rot;
  base.renderOrder = RENDER_DECOR;
  scene.add(base);

  const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.2, 0.7), toonMat("#f8df67"));
  back.position.set(x - Math.sin(rot) * 0.42, baseY + 0.98, z - Math.cos(rot) * 0.42);
  back.rotation.y = rot;
  back.rotation.x = -0.28;
  back.renderOrder = RENDER_DECOR;
  scene.add(back);

  addShadowBlob(scene, blobTex, x, z, 1.7, 0.12);
}

// ── Path network ──
function buildPathRibbonGeometry(curve, width, samples, yOffset = 0.02, uvScale = 1.0) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const half = width * 0.5;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const lx = p.x + side.x * half;
    const lz = p.z + side.z * half;
    const rx = p.x - side.x * half;
    const rz = p.z - side.z * half;
    const ly = getWorldSurfaceHeight(lx, lz) + yOffset;
    const ry = getWorldSurfaceHeight(rx, rz) + yOffset;

    positions.push(lx, ly, lz, rx, ry, rz);
    uvs.push(t * uvScale, 0, t * uvScale, 1);
    if (i < samples) {
      const j = i * 2;
      indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

function addDirtPath(scene, points, options = {}) {
  if (!Array.isArray(points) || points.length < 2) return;
  const width = THREE.MathUtils.clamp(options.width ?? 1.5, 0.8, 3.4);
  const edgeWidth = Math.max(0.09, width * 0.12);
  const pathHeight = options.height ?? 0.034;
  const smooth = THREE.MathUtils.clamp(options.smooth ?? 0.22, 0, 0.6);
  const useCaps = options.caps === true;
  const coreMat = toonMat(options.color || "#b79669");
  const edgeMat = toonMat(options.edgeColor || "#d8c39a", {
    transparent: true,
    opacity: THREE.MathUtils.clamp(options.edgeOpacity ?? 0.66, 0.2, 0.92),
  });
  const pointVec = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pointVec, false, "catmullrom", smooth);

  const len = curve.getLength();
  const samples = Math.max(42, Math.floor(len * 6));
  const edgeGeo = buildPathRibbonGeometry(curve, width + edgeWidth * 2.2, samples, pathHeight + 0.006, 2.2);
  const coreGeo = buildPathRibbonGeometry(curve, width, samples, pathHeight + 0.014, 2.8);

  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  edge.renderOrder = RENDER_SHORE;
  scene.add(edge);

  const core = new THREE.Mesh(coreGeo, coreMat);
  core.renderOrder = RENDER_SHORE + 1;
  scene.add(core);

  if (useCaps) {
    const capGeo = new THREE.CircleGeometry(width * 0.55, 20);
    for (const [x, z] of [points[0], points[points.length - 1]]) {
      const cap = new THREE.Mesh(capGeo, coreMat);
      cap.rotation.x = -Math.PI * 0.5;
      cap.position.set(x, getWorldSurfaceHeight(x, z) + pathHeight + 0.02, z);
      cap.renderOrder = RENDER_SHORE + 1;
      scene.add(cap);
    }
  }
}

// ── Oasis inlet & waterfall ──
function addOasisInlet(scene, waterUniforms) {
  const streamPoints = [
    [58.5, -19.8], [52.1, -17.1], [45.0, -13.9],
    [37.9, -10.9], [31.4, -8.8], [27.1, -7.3],
  ];

  addDirtPath(scene, streamPoints, {
    width: 2.7, color: "#bea47a", edgeColor: "#d9c8a3", height: 0.015, smooth: 0.16,
  });

  const curve = new THREE.CatmullRomCurve3(
    streamPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false, "catmullrom", 0.16
  );
  const flowGeo = buildPathRibbonGeometry(curve, 1.42, 110, 0.034, 5.5);
  const flowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: waterUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float t = uTime;
        float flow = sin(vUv.x * 40.0 - t * 4.2) * 0.5 + 0.5;
        flow += sin(vUv.x * 73.0 - t * 3.1 + vUv.y * 4.0) * 0.5 + 0.5;
        flow *= 0.5;
        float edge = smoothstep(0.02, 0.2, vUv.y) * (1.0 - smoothstep(0.8, 0.98, vUv.y));
        vec3 c = mix(vec3(0.28, 0.74, 0.9), vec3(0.62, 0.9, 0.98), flow * 0.45);
        float alpha = edge * 0.78;
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(c, alpha);
      }
    `,
  });
  const flow = new THREE.Mesh(flowGeo, flowMat);
  flow.renderOrder = RENDER_WATER + 1;
  scene.add(flow);

  const fallWidth = 1.65;
  const fallHeight = 2.45;
  const fallX = 26.2;
  const fallZ = -7.7;
  const fallBaseY = getWorldSurfaceHeight(fallX, fallZ) + 0.05;
  const waterfallMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: waterUniforms.uTime },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      void main() {
        float t = uTime;
        float bands = sin((vUv.y * 18.0 + vUv.x * 4.0) - t * 5.8) * 0.5 + 0.5;
        bands += sin((vUv.y * 29.0 - vUv.x * 3.0) - t * 4.4) * 0.5 + 0.5;
        bands *= 0.5;
        float sideFade = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));
        float topFade = smoothstep(0.02, 0.12, vUv.y);
        float alpha = sideFade * topFade * (0.45 + bands * 0.38);
        vec3 c = mix(vec3(0.72, 0.9, 0.98), vec3(0.9, 0.97, 1.0), bands * 0.45);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(c, alpha);
      }
    `,
  });
  const waterfall = new THREE.Mesh(new THREE.PlaneGeometry(fallWidth, fallHeight), waterfallMat);
  waterfall.position.set(fallX, fallBaseY + fallHeight * 0.5, fallZ);
  waterfall.rotation.y = -Math.PI * 0.42;
  waterfall.renderOrder = RENDER_WATER + 2;
  scene.add(waterfall);

  const splash = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 22),
    new THREE.MeshBasicMaterial({ color: "#dff8ff", transparent: true, opacity: 0.38, depthWrite: false })
  );
  splash.rotation.x = -Math.PI * 0.5;
  splash.position.set(fallX - 0.7, WATER_SURFACE_Y + 0.018, fallZ + 0.55);
  splash.renderOrder = RENDER_WATER + 3;
  scene.add(splash);
}

// ── Buildings ──
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
  houseGroup.position.set(0.15, 0.06, -0.2);
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
  door.visible = false;
  houseGroup.add(door);

  const windowLeft = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, 0.09), toonMat("#83c8df"));
  windowLeft.position.set(-1.15, 1.45, 1.66);
  windowLeft.renderOrder = RENDER_DECOR + 3;
  windowLeft.visible = false;
  houseGroup.add(windowLeft);
  const windowRight = windowLeft.clone();
  windowRight.position.x = 1.15;
  houseGroup.add(windowRight);

  const yardRoof = new THREE.Mesh(new THREE.ConeGeometry(3.08, 1.38, 4), toonMat("#91684e"));
  yardRoof.position.y = 2.78;
  yardRoof.rotation.y = Math.PI * 0.25;
  yardRoof.renderOrder = RENDER_DECOR + 3;
  houseGroup.add(yardRoof);

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

  const completionGlow = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.05, 26), toonMat("#8adfa6"));
  completionGlow.position.y = 0.08;
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
    door.visible = p >= 0.44;
    windowLeft.visible = p >= 0.5;
    windowRight.visible = p >= 0.5;
    const roofBlend = THREE.MathUtils.clamp((p - 0.62) / 0.2, 0, 1);
    yardRoof.visible = p >= 0.62;
    yardRoof.scale.setScalar(0.45 + roofBlend * 0.55);
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
  return { node: yard, setProgress, getStage: () => currentStage };
}

function addTrainingDummy(scene, blobTex, x, z, interactables) {
  const dummy = new THREE.Group();
  const baseY = getWorldSurfaceHeight(x, z);
  dummy.position.set(x, baseY, z);

  const bodyMat = toonMat("#a07040");
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.4, 8), bodyMat);
  body.position.y = 0.7;
  dummy.add(body);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 6), bodyMat);
  arm.position.y = 1.1;
  arm.rotation.z = Math.PI / 2;
  dummy.add(arm);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), toonMat("#c4a868"));
  head.position.y = 1.6;
  dummy.add(head);

  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), toonMat("#8a6038"));
  stake.position.y = 0.05;
  dummy.add(stake);

  setServiceNode(dummy, "dummy", "Training Dummy");
  scene.add(dummy);

  const hotspot = addServiceHotspot(dummy, 0, 0.8, 0, 0.6, 1.8);
  interactables.push(hotspot);
  addShadowBlob(scene, blobTex, x, z, 0.5, 0.18);
}

function addTrainingGround(scene, blobTex, x, z) {
  const baseY = getWorldSurfaceHeight(x, z);
  const yard = new THREE.Group();
  yard.position.set(x, baseY, z);

  const fencePostMat = toonMat("#8f6642");
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const px = Math.cos(a) * 5.4;
    const pz = Math.sin(a) * 5.4;
    const post = new THREE.Mesh(SHARED_GEO.fencePost, fencePostMat);
    post.position.set(px, 0.42, pz);
    post.renderOrder = RENDER_DECOR;
    yard.add(post);
  }

  const signPost = new THREE.Mesh(SHARED_GEO.signPost, toonMat("#8a6240"));
  signPost.position.set(0, 0.74, -4.7);
  signPost.renderOrder = RENDER_DECOR;
  yard.add(signPost);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.52, 0.08), toonMat("#3d6079"));
  sign.position.set(0, 1.15, -4.38);
  sign.renderOrder = RENDER_DECOR + 1;
  yard.add(sign);

  const crossedA = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.06), toonMat("#e5d08b"));
  crossedA.position.set(-0.12, 1.18, -4.32);
  crossedA.rotation.z = Math.PI * 0.2;
  crossedA.renderOrder = RENDER_DECOR + 2;
  yard.add(crossedA);

  const crossedB = crossedA.clone();
  crossedB.position.x = 0.12;
  crossedB.rotation.z = -Math.PI * 0.2;
  yard.add(crossedB);

  scene.add(yard);
  addShadowBlob(scene, blobTex, x, z, 3.5, 0.13);
}

// ── Service Plaza (Lakeside Village layout) ──
function addServicePlaza(scene, blobTex, resourceNodes, collisionObstacles = []) {
  const trainingX = SERVICE_LAYOUT.training.x;
  const trainingZ = SERVICE_LAYOUT.training.z;
  const houseX = SERVICE_LAYOUT.construction.x;
  const houseZ = SERVICE_LAYOUT.construction.z;

  const bankPos = { x: -7, z: -34 };
  const storePos = { x: 0, z: -34.5 };
  const smithPos = { x: 7, z: -34 };

  // Shore promenade (east-west at z=-31)
  addDirtPath(scene, [[-32, -31], [32, -31]], {
    width: 3.05, color: "#b79063", edgeColor: "#d8c39a", smooth: 0.02,
  });

  // Main south path from promenade
  addDirtPath(scene, [[0, -31], [0, -42]], {
    width: 1.85, color: "#b58d61", edgeColor: "#d6c19a", smooth: 0.04,
  });

  // Branch paths to buildings
  for (const pos of [bankPos, storePos, smithPos]) {
    addDirtPath(scene, [[pos.x, -31], [pos.x, pos.z + 1.55]], {
      width: 1.2, color: "#b58d61", edgeColor: "#d6c19a", smooth: 0.04,
    });
  }

  // Path to construction yard (east)
  addDirtPath(scene, [[8, -31], [12, -33], [houseX, houseZ]], {
    width: 1.62, smooth: 0.2,
  });

  // Path to training ground (west)
  addDirtPath(scene, [[-8, -31], [-14, -33], [trainingX, trainingZ]], {
    width: 1.62, smooth: 0.2,
  });

  // Place buildings
  addBank(scene, blobTex, bankPos.x, bankPos.z, resourceNodes);
  addStore(scene, blobTex, storePos.x, storePos.z, resourceNodes);
  addBlacksmith(scene, blobTex, smithPos.x, smithPos.z, resourceNodes);

  addTrainingGround(scene, blobTex, trainingX, trainingZ);
  addTrainingDummy(scene, blobTex, trainingX + 3.1, trainingZ, resourceNodes);
  addTrainingDummy(scene, blobTex, trainingX, trainingZ, resourceNodes);
  addTrainingDummy(scene, blobTex, trainingX - 3.1, trainingZ, resourceNodes);

  const constructionSite = addConstructionYard(scene, blobTex, houseX, houseZ, resourceNodes);
  const houseCenterX = houseX + 0.15;
  const houseCenterZ = houseZ - 0.2;
  collisionObstacles.push(
    { x: bankPos.x, z: bankPos.z, radius: 1.35, id: "bank" },
    { x: storePos.x, z: storePos.z, radius: 1.45, id: "store" },
    { x: smithPos.x, z: smithPos.z, radius: 1.6, id: "blacksmith" },
    { x: houseCenterX, z: houseCenterZ, radius: 2.35, id: "house-core" },
    { x: houseCenterX - 1.2, z: houseCenterZ, radius: 1.45, id: "house-left" },
    { x: houseCenterX + 1.2, z: houseCenterZ, radius: 1.45, id: "house-right" }
  );
  return { constructionSite };
}

// ── Fishing spots ──
function addFishingSpots(scene, resourceNodes) {
  const spots = [];
  const coordinates = [
    [-6.5, 10.4], [8.4, 9.2], [10.6, -5.3], [-9.2, -7.4], [2.3, 13.1],
  ];

  for (let i = 0; i < coordinates.length; i++) {
    const [x, z] = coordinates[i];
    const spot = new THREE.Group();
    setResourceNode(spot, "fishing", "Fishing Spot");
    spot.userData.bobPhase = i * 1.23;
    spot.position.set(x, WATER_SURFACE_Y + 0.02, z);
    spot.renderOrder = RENDER_WATER + 2;

    const ring = new THREE.Mesh(SHARED_GEO.fishRing, FISH_SPOT_RING_MAT.clone());
    ring.rotation.x = Math.PI / 2;
    spot.add(ring);

    const bobber = new THREE.Mesh(SHARED_GEO.fishBobber, FISH_SPOT_BOBBER_MAT);
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

// ── Lily pads ──
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
  for (let i = 0; i < padPositions.length; i++) {
    const pad = padPositions[i];
    const geo = new THREE.CircleGeometry(pad.r, 16, 0.2, Math.PI * 2 - 0.4);
    const lily = new THREE.Mesh(geo, toonMat("#4a9e6b"));
    lily.rotation.x = -Math.PI / 2;
    lily.rotation.z = (i * 0.73) % (Math.PI * 2);
    lily.position.set(pad.x, WATER_SURFACE_Y + 0.01, pad.z);
    lily.renderOrder = RENDER_WATER + 1;
    scene.add(lily);
    if (pad.flower) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toonMat(pad.flowerColor));
      const offX = Math.sin(i * 1.31) * 0.07;
      const offZ = Math.cos(i * 1.53) * 0.07;
      flower.position.set(pad.x + offX, WATER_SURFACE_Y + 0.07, pad.z + offZ);
      flower.renderOrder = RENDER_WATER + 2;
      scene.add(flower);
    }
  }
}

// ── Wildflowers ──
function addWildflowers(scene) {
  const flowerColors = ["#f5a0c0", "#f7e663", "#c4a0f5", "#ff9e7a", "#a0d8f0", "#ffb6d9"];
  const flowerSpots = [
    // Wildflower meadow behind village (z < -39)
    [-6, -40], [2, -41], [-10, -42], [8, -43], [14, -41], [-14, -43],
    [-2, -44], [10, -45], [-8, -46], [4, -44], [18, -43], [-18, -45],
    // Along village path edges
    [10, -35], [8, -33], [-8, -32], [-10, -31], [3, -36], [-5, -37],
    // North shore meadow (behind the lake)
    [6, 33], [8, 35], [-4, 34], [-8, 32], [14, 31], [-12, 33],
    [2, 37], [-6, 38], [10, 36],
    // East/west flanks
    [30, 6], [32, -4], [-30, 8], [-32, -2],
    [35, 20], [-34, 18], [28, 24], [-26, 22],
  ];

  const stemGeo = new THREE.CylinderGeometry(0.015, 0.018, 0.35, 4);
  const blossomGeo = new THREE.SphereGeometry(0.055, 6, 6);
  const stemMat = toonMat("#5a9e48");

  for (let i = 0; i < flowerSpots.length; i++) {
    const [fx, fz] = flowerSpots[i];
    if (isInDecorKeepOutZone(fx, fz, 0.6)) continue;
    const baseY = getWorldSurfaceHeight(fx, fz);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(fx, baseY + 0.18, fz);
    stem.renderOrder = RENDER_DECOR;
    scene.add(stem);
    const blossom = new THREE.Mesh(blossomGeo, toonMat(flowerColors[i % flowerColors.length]));
    blossom.position.set(fx, baseY + 0.37, fz);
    blossom.renderOrder = RENDER_DECOR;
    scene.add(blossom);
  }
}

// ── Main entry ──
export async function createWorld(scene) {
  const resourceNodes = [];
  const collisionObstacles = [];
  const skyMat = addSky(scene);
  const ground = createRadialTerrain(scene);
  const { waterUniforms, causticMap } = createWater(scene);
  addOasisInlet(scene, waterUniforms);
  const blobTex = radialTexture();

  let models = null;
  try {
    models = await loadModels();
  } catch (err) {
    console.warn("Model loading failed, using minimal scene:", err);
  }

  if (models) {
    placeTrees(scene, blobTex, models, resourceNodes);
    placeRocks(scene, blobTex, models, resourceNodes);
    placeWaterRocks(scene, models);
    placeBushes(scene, models);
    placeGrass(scene, models);
    placeMountainDecor(scene, models);
  }

  // 4 lounges on the south beach facing the lake
  [[-10, -27, Math.PI], [-3.5, -27.5, Math.PI], [3.5, -27.5, Math.PI], [10, -27, Math.PI]].forEach(
    ([x, z, r]) => addLounge(scene, blobTex, x, z, r)
  );

  addLilyPads(scene);
  addWildflowers(scene);
  const fishingSpots = addFishingSpots(scene, resourceNodes);
  const { constructionSite } = addServicePlaza(scene, blobTex, resourceNodes, collisionObstacles);

  const addBlob = (x, z, radius, opacity) => addShadowBlob(scene, blobTex, x, z, radius, opacity);
  const updateWorld = (time) => {
    updateFishingSpots(fishingSpots, time);
  };

  return {
    ground,
    skyMat,
    waterUniforms,
    causticMap,
    addShadowBlob: addBlob,
    resourceNodes,
    updateWorld,
    constructionSite,
    collisionObstacles,
    weaponModels: models ? models.weapons : null,
  };
}

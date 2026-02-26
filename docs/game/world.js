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

// ── Constants ──
const LAKE_RADIUS = 24.0;
const WATER_RADIUS = 24.2;
const LAKE_BOWL_Y = 0.58;
const WATER_SURFACE_Y = 0.596;
const MOUNTAIN_START = 52;
const MOUNTAIN_END = 105;
const MAP_RADIUS = 115;
const RENDER_GROUND = 0;
const RENDER_SHORE = 1;
const RENDER_WATER = 2;
const RENDER_DECOR = 3;

// ── Perfect circle lake shape ──
function getLakeRadiusAtAngle(_a) { return LAKE_RADIUS; }
function getWaterRadiusAtAngle(_a) { return WATER_RADIUS; }
function getLakeRadiusAt(_x, _z) { return LAKE_RADIUS; }
function getWaterRadiusAt(_x, _z) { return WATER_RADIUS; }

// ── Shared materials ──
const FISH_SPOT_RING_MAT = new THREE.MeshBasicMaterial({ color: "#dcf8ff", transparent: true, opacity: 0.72 });
const FISH_SPOT_BOBBER_MAT = toonMat("#ffcc58");
const SERVICE_HOTSPOT_MAT = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, depthWrite: false, depthTest: false,
});

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

  // Lake basin depression
  const bowlFalloff = 1.0 - THREE.MathUtils.smoothstep(r, 0, 31);
  const lakeBasin = Math.pow(bowlFalloff, 1.65) * 1.15;

  // Playable terrain
  const roughnessBoost = THREE.MathUtils.smoothstep(r, 17.5, 50);
  const amplitude = THREE.MathUtils.lerp(0.31, 0.55, roughnessBoost);
  const hillNoise = Math.sin(x * 0.065 + z * 0.048) * Math.cos(x * 0.031 - z * 0.057);
  const hillBoost = THREE.MathUtils.smoothstep(r, 26.0, 50.0) * hillNoise * 0.8;
  const flatTerrain = noise * amplitude - lakeBasin + hillBoost;

  // Mountains at map edges
  if (r > MOUNTAIN_START) {
    const mt = THREE.MathUtils.smoothstep(r, MOUNTAIN_START, MOUNTAIN_END);
    const mountainH = mt * mt * 25;
    const angle = Math.atan2(z, x);
    const ridge = (Math.sin(angle * 13.7 + x * 0.15) * 0.5 + 0.5) * mt * 5;
    const ridge2 = (Math.cos(angle * 7.3 - z * 0.12) * 0.5 + 0.5) * mt * 3;
    const detail = Math.sin(x * 0.18) * Math.cos(z * 0.14) * mt * 1.5;
    return flatTerrain + mountainH + ridge + ridge2 + detail;
  }

  return flatTerrain;
}

function sampleLakeFloorHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r > LAKE_RADIUS) return -Infinity;
  const radius01 = r / LAKE_RADIUS;
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
  if (dist > WATER_RADIUS) return -Infinity;
  const w0 = Math.sin(x * 0.16 + z * 0.12 + time * 0.82) * 0.032;
  const w1 = Math.sin(x * 0.28 - z * 0.22 + time * 0.65) * 0.022;
  const w2 = Math.cos(x * 0.11 + z * 0.34 - time * 0.74) * 0.026;
  const w3 = Math.sin(x * 0.48 + z * 0.38 + time * 1.3) * 0.012;
  const w4 = Math.sin(x * 0.65 - z * 0.52 - time * 1.05) * 0.008;
  const damp = 1.0 - (dist / WATER_RADIUS) * 0.18;
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
  const hotspot = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 12),
    SERVICE_HOTSPOT_MAT
  );
  hotspot.position.set(x, y, z);
  hotspot.renderOrder = RENDER_DECOR + 10;
  parent.add(hotspot);
  return hotspot;
}

// ── Sky ──
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

// ── Unified radial terrain mesh ──
function createRadialTerrain(scene) {
  const innerR = WATER_RADIUS - 2;
  const outerR = MAP_RADIUS;
  const angSegs = 128;
  const radRings = 55;
  const positions = [];
  const colors = [];
  const indices = [];
  const colSand = new THREE.Color("#e0c888");
  const colGrassLight = new THREE.Color("#7dba5e");
  const colGrassDark = new THREE.Color("#4d8c42");
  const colRock = new THREE.Color("#8a8a7a");
  const colSnow = new THREE.Color("#e8e8e0");
  const colTmp = new THREE.Color();
  const lightX = 0.54, lightY = 0.78, lightZ = 0.31;
  const sampleStep = 0.8;
  const vpr = angSegs + 1;

  for (let ri = 0; ri <= radRings; ri++) {
    const t = ri / radRings;
    const biased = Math.pow(t, 0.55);
    const radius = innerR + (outerR - innerR) * biased;
    for (let ai = 0; ai <= angSegs; ai++) {
      const angle = (ai / angSegs) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const r = Math.hypot(x, z);
      let y = sampleTerrainHeight(x, z);

      // Blend under water at inner edge
      if (r < WATER_RADIUS + 2) {
        const blend = THREE.MathUtils.smoothstep(r, WATER_RADIUS - 2, WATER_RADIUS + 2);
        y = THREE.MathUtils.lerp(WATER_SURFACE_Y - 0.06, y, blend);
      }
      positions.push(x, y, z);

      // Lighting for vertex color
      const hx = sampleTerrainHeight(x + sampleStep, z) - sampleTerrainHeight(x - sampleStep, z);
      const hz = sampleTerrainHeight(x, z + sampleStep) - sampleTerrainHeight(x, z - sampleStep);
      const nx = -hx, ny = 2.0, nz = -hz;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      const litRaw = THREE.MathUtils.clamp((nx * lightX + ny * lightY + nz * lightZ) * invLen * 0.5 + 0.5, 0, 1);
      const litBanded = Math.floor(litRaw * 4.5) / 4;
      const litStylized = THREE.MathUtils.lerp(litRaw, litBanded, 0.45);
      const noise = sampleTerrainNoise(x, z);
      const tonal = THREE.MathUtils.clamp(litStylized * 0.7 + noise * 0.15 + 0.15, 0, 1);

      // Color zones
      const shoreBlend = THREE.MathUtils.smoothstep(r, WATER_RADIUS - 1, WATER_RADIUS + 5);
      const grassBlend = THREE.MathUtils.smoothstep(r, WATER_RADIUS + 4, WATER_RADIUS + 12);
      const mountainBlend = THREE.MathUtils.smoothstep(r, 48, 68);
      const snowBlend = THREE.MathUtils.smoothstep(r, 78, 100);

      colTmp.copy(colSand);
      colTmp.lerp(colGrassLight, shoreBlend);
      if (grassBlend > 0) colTmp.lerp(colGrassDark, grassBlend * tonal * 0.55);
      if (mountainBlend > 0) colTmp.lerp(colRock, mountainBlend);
      if (snowBlend > 0) colTmp.lerp(colSnow, snowBlend * 0.7);
      colTmp.multiplyScalar(0.82 + tonal * 0.34);

      colors.push(colTmp.r, colTmp.g, colTmp.b);
    }
  }

  for (let ri = 0; ri < radRings; ri++) {
    for (let ai = 0; ai < angSegs; ai++) {
      const a = ri * vpr + ai, b = a + 1;
      const c = (ri + 1) * vpr + ai, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const terrain = new THREE.Mesh(geo, toonMat("#ffffff", { vertexColors: true }));
  terrain.renderOrder = RENDER_GROUND;
  scene.add(terrain);
  return terrain;
}

// ── Lake bowl mesh (simplified) ──
function createLakeBowlMesh() {
  const segments = 64;
  const rings = 12;
  const positions = [];
  const colors = [];
  const indices = [];
  const deep = new THREE.Color("#2a7a9c");
  const mid = new THREE.Color("#52a8b8");
  const shelf = new THREE.Color("#c4b68a");

  positions.push(0, -(0.1 + 1.95), 0);
  const cDeep = new THREE.Color().copy(deep);
  colors.push(cDeep.r, cDeep.g, cDeep.b);

  for (let r = 1; r <= rings; r++) {
    const ringT = r / rings;
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const radius = LAKE_RADIUS * ringT;
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
    uShallow: { value: new THREE.Color("#c4fef8") },
    uMid: { value: new THREE.Color("#4dd8ee") },
    uDeep: { value: new THREE.Color("#1a9ec8") },
    uBeach: { value: new THREE.Color("#e3cea1") },
  };

  const lakeFloor = createLakeBowlMesh();
  lakeFloor.renderOrder = RENDER_SHORE;
  scene.add(lakeFloor);

  const causticMap = createCausticTexture();

  const wSegs = 64, wRings = 16;
  const wPos = [0, 0, 0], wUvs = [0.5, 0.5], wRads = [0], wIdx = [];
  for (let r = 1; r <= wRings; r++) {
    const rt = r / wRings;
    for (let s = 0; s < wSegs; s++) {
      const a = (s / wSegs) * Math.PI * 2;
      const rad = WATER_RADIUS * rt;
      const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
      wPos.push(x, 0, z);
      wUvs.push(x / (WATER_RADIUS * 2) + 0.5, z / (WATER_RADIUS * 2) + 0.5);
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

        vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.45, radial));
        col = mix(col, uShallow, smoothstep(0.35, 0.82, radial));
        float clarity = smoothstep(0.15, 0.75, radial);
        col = mix(col, vec3(0.82, 0.97, 0.96), clarity * 0.25);

        vec2 cuv = wp * 0.11 + vec2(t * 0.02, -t * 0.015);
        float c1 = voronoi(cuv);
        float c2 = voronoi(cuv * 1.7 + vec2(3.7, 1.2));
        float c3 = voronoi(cuv * 0.6 + vec2(-t * 0.03, t * 0.02));
        float caustic = c1 * 0.4 + c2 * 0.35 + c3 * 0.25;
        float causticBright = (1.0 - smoothstep(0.0, 0.5, caustic)) * 0.42;
        causticBright *= smoothstep(0.02, 0.3, radial) * (1.0 - radial * 0.35);
        col += causticBright * vec3(0.6, 0.92, 1.0);

        float waveTex = fbm(wp * 0.18 + vec2(t * 0.04, -t * 0.03));
        float waveTex2 = fbm(wp * 0.32 + vec2(-t * 0.05, t * 0.035));
        col = mix(col, col * 1.15, waveTex * 0.22 * (1.0 - radial * 0.3));
        col += vec3(0.1, 0.18, 0.2) * waveTex2 * 0.08 * (1.0 - radial * 0.5);

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

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 sunDir = normalize(vec3(0.6, 0.8, 0.3));
        vec3 waveN = normalize(vec3(
          sin(wp.x * 0.8 + t * 0.5) * 0.04 + sin(wp.x * 1.8 - t * 0.4) * 0.025,
          1.0,
          sin(wp.y * 0.8 - t * 0.45) * 0.04 + cos(wp.y * 1.8 + t * 0.35) * 0.025
        ));

        float spec = pow(max(dot(reflect(-sunDir, waveN), viewDir), 0.0), 16.0);
        col += vec3(1.0, 0.97, 0.92) * spec * 0.3 * (1.0 - radial * 0.2);

        float NdotV = max(dot(viewDir, waveN), 0.0);
        float fresnel = pow(1.0 - NdotV, 4.0) * 0.2;
        vec3 skyCol = vec3(0.48, 0.74, 0.88);
        col = mix(col, skyCol, fresnel);

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

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Model placement: Trees ──
function placeTrees(scene, blobTex, models, resourceNodes) {
  const templates = models.trees;
  if (!templates.length) return;

  // Shore area trees — ring around the lake
  const shoreTreePositions = [
    [-28, 21], [28, 20], [-24, -27], [23, -28], [2, 31], [35, -4], [-34, 2],
    [-30, 12], [31, 10], [18, 28], [-16, 30], [30, -18], [-28, -16],
  ];
  // Scattered forest trees further out
  const forestPositions = [
    [-36, 14], [37, -10], [-17, 33], [26, -30], [-39, -9], [33, 17],
    [13, -35], [-12, -34], [41, 5], [-31, 23], [23, 33], [-37, -19],
    [42, 14], [-40, -22], [15, 38], [-8, 40], [38, 25], [-35, 28],
    [-22, 38], [35, -28], [-42, 8], [28, 38], [-18, -40], [40, -20],
  ];

  const allPositions = [...shoreTreePositions, ...forestPositions];
  for (let i = 0; i < allPositions.length; i++) {
    const [x, z] = allPositions[i];
    const template = pickRandom(templates);
    const instance = template.clone();
    const scale = 1.6 + Math.random() * 0.8;
    instance.scale.setScalar(scale);
    instance.rotation.y = Math.random() * Math.PI * 2;
    const baseY = getWorldSurfaceHeight(x, z);
    instance.position.set(x, baseY, z);
    setResourceNode(instance, "woodcutting", "Tree");
    scene.add(instance);
    resourceNodes.push(instance);
    addShadowBlob(scene, blobTex, x, z, 2.2 * scale * 0.5, 0.15);
  }
}

// ── Model placement: Rocks (interactable) ──
function placeRocks(scene, blobTex, models, resourceNodes) {
  const templates = models.rocks;
  if (!templates.length) return;

  const rockPositions = [
    [12, 26, 1.8], [-13, 25, 1.6], [25, 12, 1.5], [-26, -5, 2.0],
    [18, -22, 1.7], [-7, -28, 1.9],
  ];

  for (const [x, z, scale] of rockPositions) {
    const template = pickRandom(templates);
    const instance = template.clone();
    instance.scale.setScalar(scale);
    instance.rotation.y = Math.random() * Math.PI * 2;
    const baseY = getWorldSurfaceHeight(x, z);
    instance.position.set(x, baseY, z);
    setResourceNode(instance, "mining", "Rock");
    scene.add(instance);
    resourceNodes.push(instance);
    addShadowBlob(scene, blobTex, x, z, 1.4 * scale * 0.5, 0.17);
  }
}

// ── Model placement: Water rocks (decorative) ──
function placeWaterRocks(scene, models) {
  const templates = models.rocks;
  if (!templates.length) return;

  const waterRockPositions = [
    [-7.2, 4.3, 1.4], [5.6, 7.1, 1.2], [8.8, -4.5, 1.5],
    [-6.5, -6.2, 1.1], [0.6, 9.2, 1.0],
  ];

  for (const [x, z, scale] of waterRockPositions) {
    const template = pickRandom(templates);
    const instance = template.clone();
    instance.scale.setScalar(scale);
    instance.rotation.y = Math.random() * Math.PI * 2;
    const baseY = getWorldSurfaceHeight(x, z);
    instance.position.set(x, baseY, z);
    instance.renderOrder = RENDER_DECOR;
    scene.add(instance);
  }
}

// ── Model placement: Bushes ──
function placeBushes(scene, models) {
  const templates = models.bushes;
  if (!templates.length) return;

  const bushPositions = [
    [27, 18, 1.4], [-24, 16, 1.2], [19, -23, 1.5], [-20, -18, 1.3],
    [31, 5, 1.1], [-29, -5, 1.4], [15, 27, 1.2], [-13, 27, 1.3],
    [33, -15, 1.0], [-35, 11, 1.1], [9, -29, 1.2], [-7, 31, 1.4],
    [29, 23, 1.0], [-27, 21, 1.1], [36, -7, 1.2], [-33, -13, 1.0],
    [20, 35, 1.3], [-25, 32, 1.1], [38, 10, 1.0], [-15, -35, 1.2],
  ];

  for (const [x, z, scale] of bushPositions) {
    const template = pickRandom(templates);
    const instance = template.clone();
    instance.scale.setScalar(scale);
    instance.rotation.y = Math.random() * Math.PI * 2;
    const baseY = getWorldSurfaceHeight(x, z);
    instance.position.set(x, baseY, z);
    instance.renderOrder = RENDER_DECOR;
    scene.add(instance);
  }
}

// ── Model placement: Grass patches ──
function placeGrass(scene, models) {
  const templates = models.grass;
  if (!templates.length) return;

  // Scatter grass in clusters around the playable area
  const grassClusters = [
    [22, 13, 5], [-22, 11, 4], [16, 23, 5], [-15, 23, 4],
    [26, -13, 4], [-26, -9, 5], [9, 27, 4], [-9, 27, 4],
    [30, 8, 3], [-30, 6, 3], [20, -18, 4], [-18, -20, 3],
    [8, 33, 3], [-8, -30, 3], [34, -2, 3], [-34, -4, 3],
    [14, 36, 3], [-12, 36, 2], [36, 18, 3], [-36, 16, 2],
  ];

  for (const [cx, cz, count] of grassClusters) {
    for (let i = 0; i < count; i++) {
      const x = cx + (Math.random() - 0.5) * 3.0;
      const z = cz + (Math.random() - 0.5) * 3.0;
      const template = pickRandom(templates);
      const instance = template.clone();
      const scale = 1.0 + Math.random() * 0.6;
      instance.scale.setScalar(scale);
      instance.rotation.y = Math.random() * Math.PI * 2;
      const baseY = getWorldSurfaceHeight(x, z);
      instance.position.set(x, baseY, z);
      instance.renderOrder = RENDER_DECOR;
      scene.add(instance);
    }
  }
}

// ── Model placement: Mountain rocks + bare trees ──
function placeMountainDecor(scene, models) {
  const rockTemplates = models.bigRocks.length ? models.bigRocks : models.rocks;
  const bareTemplates = models.bareTrees;

  // Large rocks scattered across mountain slopes
  if (rockTemplates.length) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 55 + Math.random() * 35;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const template = pickRandom(rockTemplates);
      const instance = template.clone();
      const scale = 2.5 + Math.random() * 3.0;
      instance.scale.setScalar(scale);
      instance.rotation.y = Math.random() * Math.PI * 2;
      instance.rotation.x = (Math.random() - 0.5) * 0.3;
      const baseY = sampleTerrainHeight(x, z);
      instance.position.set(x, baseY, z);
      scene.add(instance);
    }
  }

  // Bare trees on lower mountain slopes
  if (bareTemplates.length) {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 53 + Math.random() * 18;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const template = pickRandom(bareTemplates);
      const instance = template.clone();
      const scale = 1.2 + Math.random() * 0.8;
      instance.scale.setScalar(scale);
      instance.rotation.y = Math.random() * Math.PI * 2;
      const baseY = sampleTerrainHeight(x, z);
      instance.position.set(x, baseY, z);
      scene.add(instance);
    }
  }
}

// ── Lounges (procedural, moved outside lake) ──
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

// ── Services (all unchanged) ──
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

  const lot = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.8, 0.34, 36), toonMat("#cdb88f"));
  lot.position.y = 0.17;
  lot.renderOrder = RENDER_SHORE;
  yard.add(lot);

  const lotRing = new THREE.Mesh(new THREE.TorusGeometry(6.0, 0.18, 8, 48), toonMat("#ebdfc2"));
  lotRing.rotation.x = Math.PI * 0.5;
  lotRing.position.y = 0.36;
  lotRing.renderOrder = RENDER_SHORE + 1;
  yard.add(lotRing);

  const buildPad = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.12, 26), toonMat("#f2e8cf"));
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

function addServicePlaza(scene, blobTex, resourceNodes, collisionObstacles = []) {
  const cx = 0;
  const cz = -34;
  const cy = getWorldSurfaceHeight(cx, cz);

  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(9.4, 9.8, 0.34, 36), toonMat("#d5c9a9"));
  plaza.position.set(cx, cy + 0.17, cz);
  plaza.renderOrder = RENDER_SHORE;
  scene.add(plaza);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(5.9, 0.17, 8, 48), toonMat("#efe5cc"));
  innerRing.rotation.x = Math.PI * 0.5;
  innerRing.position.set(cx, cy + 0.36, cz);
  innerRing.renderOrder = RENDER_SHORE + 1;
  scene.add(innerRing);

  const centerPad = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.12, 20), toonMat("#f4ecd9"));
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

  addBank(scene, blobTex, cx - 6.2, cz + 1.5, resourceNodes);
  addStore(scene, blobTex, cx + 6.2, cz + 1.5, resourceNodes);
  addBlacksmith(scene, blobTex, cx, cz - 6.8, resourceNodes);

  addTrainingDummy(scene, blobTex, cx - 14, cz, resourceNodes);
  addTrainingDummy(scene, blobTex, cx - 17, cz, resourceNodes);
  addTrainingDummy(scene, blobTex, cx - 20, cz, resourceNodes);

  const constructionSite = addConstructionYard(scene, blobTex, cx + 22.5, cz, resourceNodes);
  const houseCenterX = cx + 22.65;
  const houseCenterZ = cz - 0.2;
  collisionObstacles.push(
    { x: cx - 6.2, z: cz + 1.5, radius: 1.35, id: "bank" },
    { x: cx + 6.2, z: cz + 1.5, radius: 1.45, id: "store" },
    { x: cx, z: cz - 6.8, radius: 1.6, id: "blacksmith" },
    { x: houseCenterX, z: houseCenterZ, radius: 2.35, id: "house-core" },
    { x: houseCenterX - 1.2, z: houseCenterZ, radius: 1.45, id: "house-left" },
    { x: houseCenterX + 1.2, z: houseCenterZ, radius: 1.45, id: "house-right" }
  );
  return { constructionSite };
}

// ── Fishing spots ──
function addFishingSpots(scene, resourceNodes) {
  const spots = [];
  const ringGeo = new THREE.TorusGeometry(0.5, 0.045, 8, 24);
  const bobberGeo = new THREE.SphereGeometry(0.13, 8, 7);
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
  for (const pad of padPositions) {
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

// ── Wildflowers ──
function addWildflowers(scene) {
  const patches = [
    { cx: 27, cz: 15, count: 8 },
    { cx: -25, cz: 13, count: 7 },
    { cx: 19, cz: -24, count: 6 },
    { cx: -21, cz: -19, count: 9 },
    { cx: 31, cz: 1, count: 7 },
    { cx: -32, cz: -8, count: 5 },
    { cx: 15, cz: 32, count: 6 },
    { cx: -18, cz: 30, count: 5 },
  ];
  const flowerColors = ["#f5a0c0", "#f7e663", "#c4a0f5", "#ff9e7a", "#a0d8f0", "#ffb6d9"];
  for (const patch of patches) {
    for (let i = 0; i < patch.count; i++) {
      const fx = patch.cx + (Math.random() - 0.5) * 4.0;
      const fz = patch.cz + (Math.random() - 0.5) * 4.0;
      const baseY = getWorldSurfaceHeight(fx, fz);
      const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.018, 0.35, 4),
        toonMat("#5a9e48")
      );
      stem.position.set(fx, baseY + 0.18, fz);
      stem.renderOrder = RENDER_DECOR;
      scene.add(stem);
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

// ── Main entry ──
export async function createWorld(scene) {
  const resourceNodes = [];
  const collisionObstacles = [];
  const skyMat = addSky(scene);
  const ground = createRadialTerrain(scene);
  const { waterUniforms, causticMap } = createWater(scene);
  const blobTex = radialTexture();

  // Load asset pack models
  let models = null;
  try {
    models = await loadModels();
  } catch (err) {
    console.warn("Model loading failed, using minimal scene:", err);
  }

  // Place asset models
  if (models) {
    placeTrees(scene, blobTex, models, resourceNodes);
    placeRocks(scene, blobTex, models, resourceNodes);
    placeWaterRocks(scene, models);
    placeBushes(scene, models);
    placeGrass(scene, models);
    placeMountainDecor(scene, models);
  }

  // Lounges on the beach (moved outward for circular lake)
  [[19, 22, Math.PI * 0.1], [23, 16, Math.PI * 0.1], [-20, 21, -Math.PI * 0.15], [-23, 16, -Math.PI * 0.15]].forEach(
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

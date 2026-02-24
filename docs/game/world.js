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
  const w0 = Math.sin((uvx * 5.9 + uvy * 4.7) + time * 1.22) * 0.011;
  const w1 = Math.sin((uvx * 9.6 - uvy * 7.4) - time * 1.0) * 0.006;
  const w2 = Math.sin((uvx * 14.4 + uvy * 11.2) + time * 1.42) * 0.003;
  const w3 = Math.sin((uvx * 3.2 + uvy * 2.5) + time * 0.75) * 0.015;
  return WATER_SURFACE_Y + w0 + w1 + w2 + w3;
}

function setResourceNode(node, resourceType, label) {
  node.userData.resourceType = resourceType;
  node.userData.resourceLabel = label;
}

function addSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      cTop: { value: new THREE.Color("#3a8ed6") },
      cMid: { value: new THREE.Color("#8dcef4") },
      cBot: { value: new THREE.Color("#fff0d8") },
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
    let y = sampleTerrainHeight(x, z);
    if (r < WATER_RADIUS + 0.5) {
      y -= (1.0 - THREE.MathUtils.smoothstep(r, WATER_RADIUS - 3, WATER_RADIUS + 0.5)) * 3.0;
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
    const waterProx = 1.0 - THREE.MathUtils.smoothstep(r, WATER_RADIUS - 2, WATER_RADIUS + 4);
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
    uShallow: { value: new THREE.Color("#7eeadf") },
    uMid: { value: new THREE.Color("#3cc4c4") },
    uDeep: { value: new THREE.Color("#1a7ab5") },
    uBeach: { value: new THREE.Color("#e0c888") },
  };

  const lakeFloor = createLakeBowlMesh();
  lakeFloor.renderOrder = RENDER_SHORE;
  scene.add(lakeFloor);

  // Keep caustic texture for main.js compat
  const causticMap = createCausticTexture();

  const waterMat = new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
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
        float w3 = sin((uv.x * 3.2 + uv.y * 2.5) + uTime * 0.75) * 0.015;
        p.y += w0 + w1 + w2 + w3;
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
      uniform vec3 uMid;
      uniform vec3 uDeep;
      uniform vec3 uBeach;

      void main() {
        float t = uTime;
        float radial = clamp(distance(vUv, vec2(0.5)) / 0.5, 0.0, 1.0);

        // 3-zone radial gradient: deep center -> mid -> shallow edge
        vec3 col = uDeep;
        col = mix(col, uMid, smoothstep(0.0, 0.45, radial));
        col = mix(col, uShallow, smoothstep(0.45, 0.85, radial));

        // Single subtle sun specular with gently wave-perturbed normal
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec2 wp = vWorldPos.xz;
        vec3 waveN = normalize(vec3(
          sin(wp.x * 1.2 + t * 0.8) * 0.04,
          1.0,
          sin(wp.y * 1.2 - t * 0.7) * 0.04
        ));
        vec3 sunDir = normalize(vec3(0.6, 0.8, 0.3));
        float spec = pow(max(dot(reflect(-sunDir, waveN), viewDir), 0.0), 80.0);
        col += vec3(1.0, 0.98, 0.92) * spec * 0.3 * (1.0 - radial * 0.4);

        // Clean fresnel: sky tint at edges
        float NdotV = max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0);
        float fresnel = pow(1.0 - NdotV, 4.0) * 0.25;
        col = mix(col, vec3(0.75, 0.9, 1.0), fresnel);

        // Thin static edge foam band
        float foam = smoothstep(0.92, 0.97, radial) * (1.0 - smoothstep(0.97, 1.0, radial));
        col = mix(col, vec3(1.0, 1.0, 1.0), foam * 0.45);

        // Blend outer edge to beach color for seamless shore transition
        float edgeBlend = smoothstep(0.93, 1.0, radial);
        col = mix(col, uBeach, edgeBlend);

        gl_FragColor = vec4(col, 1.0);
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
    createConformingRing(WATER_RADIUS - 0.5, 34, 18, 320, SHORE_LIFT),
    toonMat("#e0c888", { side: THREE.DoubleSide })
  );
  beachRing.rotation.x = -Math.PI / 2;
  beachRing.position.y = 0;
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
    [-35, 14, 0.92],
    [36, -10, 0.88],
    [-15, 32, 0.95],
    [25, -28, 0.82],
  ];
  const leafHues = ["#6fd1a8", "#5ec99a", "#7dddb0", "#62c490"];
  for (let i = 0; i < extraTrees.length; i++) {
    const [x, z, scale] = extraTrees[i];
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
    const leafColor = leafHues[i % leafHues.length];
    const coreMat = toonMat(leafColor);
    const core = new THREE.Mesh(TREE_CORE_GEO, coreMat);
    core.scale.setScalar(scale * 0.72);
    core.position.set(0, crownY, 0);
    core.renderOrder = RENDER_DECOR;
    tree.add(core);

    const leafMat = toonMat(leafColor);
    for (let j = 0; j < 6; j++) {
      const frond = new THREE.Mesh(TREE_LEAF_GEO, leafMat);
      frond.scale.setScalar(scale);
      const yaw = (j / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
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
    resourceNodes.push(tree);
    addShadowBlob(scene, blobTex, x, z, 2.2 * scale, 0.15);
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

export function createWorld(scene) {
  const resourceNodes = [];
  const skyMat = addSky(scene);
  const ground = createGround(scene);
  addLakeRings(scene);
  const { waterUniforms, causticMap } = createWater(scene);
  addWaterRocks(scene);
  const blobTex = radialTexture();
  addShoreDecor(scene, blobTex, resourceNodes);
  addExtraTrees(scene, blobTex, resourceNodes);
  addLilyPads(scene);
  addWildflowers(scene);
  addExtraReeds(scene);
  const fishingSpots = addFishingSpots(scene, resourceNodes);
  const addBlob = (x, z, radius, opacity) => addShadowBlob(scene, blobTex, x, z, radius, opacity);
  const updateWorld = (time) => {
    updateFishingSpots(fishingSpots, time);
  };
  return { ground, skyMat, waterUniforms, causticMap, addShadowBlob: addBlob, resourceNodes, updateWorld };
}

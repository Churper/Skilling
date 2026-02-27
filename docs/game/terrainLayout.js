import * as THREE from "three";
import {
  TILE_S, WATER_Y, GRASS_Y,
  GX_MIN, GX_MAX, GZ_MIN, GZ_MAX,
  isInRiver, isBeach, isOnPath,
  terrainH,
} from "./terrainHeight.js";

/* ══════════════════════════════════════════════════════════
   terrainLayout.js — procedural mesh terrain + structures
   ══════════════════════════════════════════════════════════ */

const R_GND = 0, R_WATER = 2, R_DECOR = 3;

/* ── toon gradient ── */
const TOON_GRAD = (() => {
  const c = document.createElement("canvas"); c.width = 6; c.height = 1;
  const ctx = c.getContext("2d");
  [26, 68, 118, 176, 232, 255].forEach((v, i) => {
    ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(i, 0, 1, 1);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
})();
function tMat(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: TOON_GRAD, ...opts });
}

/* ═══════════════════════════════════════════
   buildTerrainMesh — vertex-colored ground + water plane
   ═══════════════════════════════════════════ */

export function buildTerrainMesh(waterUniforms) {
  const group = new THREE.Group();
  group.name = "terrain";

  /* ── ground ── */
  const step = 1.5;
  const xMin = (GX_MIN - 2) * TILE_S, xMax = (GX_MAX + 2) * TILE_S;
  const zMin = (GZ_MIN - 2) * TILE_S, zMax = (GZ_MAX + 2) * TILE_S;
  const nx = Math.ceil((xMax - xMin) / step) + 1;
  const nz = Math.ceil((zMax - zMin) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const col = new Float32Array(nx * nz * 3);
  const idx = [];

  const cGrass = new THREE.Color("#5a9f3f");
  const cPath  = new THREE.Color("#b09070");
  const cSand  = new THREE.Color("#d4b87a");
  const cHill  = new THREE.Color("#4a8a35");
  const cRiver = new THREE.Color("#6a7a5a");
  const cCliff = new THREE.Color("#8a8a7a");

  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const x = xMin + ix * step, z = zMin + iz * step;
      const y = terrainH(x, z);
      const i3 = (iz * nx + ix) * 3;
      pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
      let c;
      if (isInRiver(x, z))        c = cRiver;
      else if (isBeach(x, z))     c = cSand;
      else if (isOnPath(x, z))    c = cPath;
      else if (y > GRASS_Y + 2)   c = cCliff;
      else if (y > GRASS_Y + 0.5) c = cHill;
      else                        c = cGrass;
      col[i3] = c.r; col[i3 + 1] = c.g; col[i3 + 2] = c.b;
      if (ix < nx - 1 && iz < nz - 1) {
        const a = iz * nx + ix, b = a + 1, d = a + nx, e = d + 1;
        idx.push(a, d, b, b, d, e);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const groundMesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({
    vertexColors: true, gradientMap: TOON_GRAD, flatShading: true,
  }));
  groundMesh.renderOrder = R_GND;
  group.add(groundMesh);

  /* ── water ── */
  const ww = xMax - xMin + 20, wh = zMax - zMin + 20;
  const waterGeo = new THREE.PlaneGeometry(ww, wh, 48, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshBasicMaterial({
    color: "#93d8f6", transparent: true, opacity: 0.62,
    depthWrite: false, depthTest: true,
  });
  waterMat.onBeforeCompile = shader => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = "uniform float uTime;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       transformed.y += sin(position.x*0.14 + position.z*0.10 + uTime*0.7)*0.025
                      + cos(position.x*0.09 + position.z*0.22 - uTime*0.5)*0.02;`
    );
  };
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set((xMin + xMax) / 2, WATER_Y, (zMin + zMax) / 2);
  waterMesh.userData.isWaterSurface = true;
  waterMesh.renderOrder = R_WATER;
  group.add(waterMesh);

  return group;
}

/* ═══════════════════════════════════════════
   buildBridge — procedural log bridge
   ═══════════════════════════════════════════ */

export function buildBridge() {
  const group = new THREE.Group();
  group.name = "bridge";
  const bz = 8, deckY = WATER_Y + 0.35;
  const hw = 4 * TILE_S * 0.5;

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(hw * 2 + 2, 0.18, TILE_S * 1.5), tMat("#8B6A40"));
  deck.position.set(0, deckY, bz);
  deck.name = "bridge_deck";
  group.add(deck);

  for (let i = -4; i <= 4; i++) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(TILE_S * 0.42, 0.07, TILE_S * 1.4), tMat("#7a5a30"));
    p.position.set(i * TILE_S * 0.5, deckY + 0.1, bz);
    group.add(p);
  }

  const postGeo = new THREE.CylinderGeometry(0.14, 0.18, 1.5, 6);
  for (const ox of [-hw, hw]) {
    const p = new THREE.Mesh(postGeo, tMat("#6a4a20"));
    p.position.set(ox, WATER_Y - 0.05, bz);
    group.add(p);
  }
  const railGeo = new THREE.BoxGeometry(hw * 2 + 1.5, 0.07, 0.07);
  for (const zo of [-TILE_S * 0.7, TILE_S * 0.7]) {
    const r = new THREE.Mesh(railGeo, tMat("#9a7a50"));
    r.position.set(0, deckY + 0.48, bz + zo);
    group.add(r);
  }
  group.renderOrder = R_DECOR;
  return group;
}

/* ═══════════════════════════════════════════
   buildDock — procedural wooden dock
   ═══════════════════════════════════════════ */

export function buildDock() {
  const group = new THREE.Group();
  group.name = "dock";
  const dx = 40, dz = -16, deckY = WATER_Y + 0.3;

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(6 * TILE_S, 0.15, TILE_S * 1.5), tMat("#8B6A40"));
  deck.position.set(dx + 2.5 * TILE_S, deckY, dz);
  deck.name = "dock_deck";
  group.add(deck);

  const pGeo = new THREE.CylinderGeometry(0.12, 0.15, 1.5, 6);
  const pMat = tMat("#6a4a20");
  for (let i = 0; i < 6; i += 2)
    for (const zo of [-0.5, 0.5]) {
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set(dx + i * TILE_S, deckY - 0.9, dz + zo * TILE_S);
      group.add(p);
    }
  group.renderOrder = R_DECOR;
  return group;
}

/* ═══════════════════════════════════════════
   buildFences — procedural fence runs
   ═══════════════════════════════════════════ */

export function buildFences() {
  const group = new THREE.Group();
  group.name = "fences";
  const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6);
  const boardGeo = new THREE.BoxGeometry(TILE_S * 0.9, 0.5, 0.06);
  const pM = tMat("#8a6240"), bM = tMat("#a07848");
  const runs = [
    [[4,8],[8,4],[12,0],[16,-4],[20,-8],[24,-12],[28,-15]],
    [[9,-24],[15,-26],[21,-28],[27,-30],[34,-30]],
    [[-26,-40],[-26,-30],[-18,-30],[-18,-40],[-26,-40]],
    [[-2,10],[2,10],[6,8]],
  ];
  for (const run of runs)
    for (let i = 0; i < run.length - 1; i++) {
      const [ax, az] = run[i], [bx, bz] = run[i + 1];
      const dx = bx - ax, dz = bz - az;
      const steps = Math.max(1, Math.round(Math.hypot(dx, dz) / TILE_S));
      const rot = Math.atan2(dx, dz);
      for (let s = 0; s <= steps; s++) {
        if (i > 0 && s === 0) continue;
        const t = s / steps, x = ax + dx * t, z = az + dz * t;
        const y = terrainH(x, z);
        const post = new THREE.Mesh(postGeo, pM);
        post.position.set(x, y + 0.45, z);
        group.add(post);
        if (s < steps) {
          const mt = (s + 0.5) / steps;
          const board = new THREE.Mesh(boardGeo, bM);
          board.position.set(ax + dx * mt, terrainH(ax + dx * mt, az + dz * mt) + 0.4, az + dz * mt);
          board.rotation.y = rot;
          group.add(board);
        }
      }
    }
  group.renderOrder = R_DECOR;
  return group;
}

/* ═══════════════════════════════════════════
   buildSteppingStones — gray stones in the river
   ═══════════════════════════════════════════ */

export function buildSteppingStones() {
  const group = new THREE.Group();
  group.name = "stepping_stones";
  const geo = new THREE.CylinderGeometry(0.55, 0.65, 0.25, 8);
  const mat = tMat("#8a8a82");
  for (const [x, z] of [[0,20],[-1,18],[1,16],[4,-1],[8,-4],[12,-7]]) {
    const s = new THREE.Mesh(geo, mat);
    s.position.set(x, WATER_Y - 0.05, z);
    s.rotation.y = Math.random() * Math.PI;
    s.renderOrder = R_WATER + 1;
    group.add(s);
  }
  return group;
}

/* ═══════════════════════════════════════════
   addWaterfall — cascading from north cliff
   ═══════════════════════════════════════════ */

export function addWaterfall(scene, waterUniforms) {
  const cx = 0, topZ = 40.9, endZ = 34.4;
  const topY = terrainH(cx, 40) + 4.8, botY = WATER_Y + 0.16;
  const midZ = (topZ + endZ) / 2, midY = topY * 0.58 + botY * 0.42;

  const makeMat = (phase, alpha = 1) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: waterUniforms.uTime, uPhase: { value: phase }, uAlpha: { value: alpha } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime,uPhase,uAlpha;
      void main(){
        float t=fract(vUv.y*2.2-uTime*0.45+uPhase);
        float streak=smoothstep(0.0,0.24,t)*smoothstep(1.0,0.62,t);
        float edge=smoothstep(0.0,0.15,vUv.x)*smoothstep(1.0,0.85,vUv.x);
        vec3 col=mix(vec3(0.62,0.86,0.97),vec3(0.80,0.95,1.0),streak*0.65);
        float a=edge*(0.26+streak*0.48)*uAlpha;
        gl_FragColor=vec4(col,clamp(a,0.0,0.85)); }`,
  });

  const addRibbon = (rx, w, phase, alpha = 1) => {
    const pts = [[rx, topY, topZ], [rx, midY, midZ], [rx, botY, endZ]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1];
      const len = Math.hypot(y1 - y0, z1 - z0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len, 1, 12), makeMat(phase + i * 0.17, alpha));
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, y1 - y0, z1 - z0).normalize());
      m.renderOrder = R_DECOR + 1;
      scene.add(m);
    }
  };
  addRibbon(cx, 3.6, 0, 1);
  addRibbon(cx - 1.05, 1.4, 0.22, 0.7);
  addRibbon(cx + 1.05, 1.4, 0.41, 0.7);

  const lip = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.9), tMat("#8a8f92", { flatShading: true }));
  lip.position.set(cx, topY + 0.02, topZ + 0.2);
  lip.renderOrder = R_DECOR;
  scene.add(lip);

  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(2.25, 20),
    new THREE.MeshBasicMaterial({ color: "#dff6ff", transparent: true, opacity: 0.42, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(cx, WATER_Y + 0.03, endZ + 0.15);
  foam.renderOrder = R_WATER + 1;
  scene.add(foam);
}

/* ═══════════════════════════════════════════
   Placement data for world.js
   ═══════════════════════════════════════════ */

export const TREE_SPOTS = [
  [20,18,2.2,1.8],[28,28,2.4,3.6],[18,28,2.1,0.9],[32,20,1.9,2.4],[24,32,2.3,4.2],
  [-22,18,2.0,1.0],[-30,24,1.9,5.2],[-20,26,2.2,4.5],[-16,-18,1.7,2.1],[14,-18,1.6,0.7],[-8,-42,2.4,3.3],
];
export const ROCK_MAJOR_SPOTS = [
  [30,30,1.55,0.3],[-28,26,1.6,1.4],[-14,8,1.45,2.1],[10,16,1.5,4.8],[-20,-6,1.4,0.9],
];
export const ROCK_SMALL_SPOTS = [
  [22,34,1.04,3.2],[-26,30,1.0,4.1],[34,22,0.98,5.0],[-32,18,0.95,2.6],
  [-10,14,0.95,1.7],[-16,10,1.0,5.3],[8,20,0.9,0.5],[14,12,1.05,3.9],
  [-22,-2,0.92,2.4],[-18,-10,0.98,4.6],[6,8,0.88,1.2],[-8,4,1.02,3.5],
  [12,24,0.96,5.8],[-24,16,0.94,0.3],
];
export const BUSH_SPOTS = [
  [-12,-28,1.1,0.4],[12,-28,1.12,2.8],[20,-10,1.1,1.9],[-18,-12,1.08,5.0],[8,-38,1.0,3.8],
];
export const CLIFF_ROCK_SPOTS = [
  [-38,38,4.2,0],[0,42,3.8,1.6],[38,38,4.5,3.1],[-36,40,4.0,4.7],[36,40,3.6,0.8],
  [-42,20,4.1,2.3],[-42,4,3.9,5.5],[-42,-12,4.4,3.9],[-42,-28,3.5,1.2],
  [0,-40,4.3,4.1],[-18,-40,3.7,2.8],[18,-40,4.0,5.8],[-34,-38,4.6,0.4],[28,-38,3.8,3.5],
];
export const FISHING_SPOT_POSITIONS = [
  { x:-4, z:14, phase:0 },{ x:4, z:4, phase:1.2 },{ x:8, z:-4, phase:2.4 },
  { x:42, z:-16, phase:3.6 },{ x:46, z:-18, phase:4.8 },
];

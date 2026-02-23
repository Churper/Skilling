import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.36;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#d7f3ff", 165, 520);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(28, 30, 28);

scene.add(new THREE.HemisphereLight("#ffffff", "#c2d8b1", 1.26));
const sun = new THREE.DirectionalLight("#fff9ee", 1.7);
sun.position.set(45, 52, 16);
scene.add(sun);
const fill = new THREE.DirectionalLight("#d6f7ff", 0.58);
fill.position.set(-36, 24, -22);
scene.add(fill);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    cTop: { value: new THREE.Color("#6ac2ff") },
    cMid: { value: new THREE.Color("#a7e4ff") },
    cBot: { value: new THREE.Color("#f3fcff") },
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
      c = mix(c, vec3(1.0), cloud * smoothstep(0.46, 0.9, h) * 0.36);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(420, 32, 18), skyMat));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 16;
controls.maxDistance = 44;
controls.minPolarAngle = 0.75;
controls.maxPolarAngle = 1.07;
controls.mouseButtons.LEFT = -1; // click-to-move
controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN; // hold wheel pan
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.touches.ONE = THREE.TOUCH.PAN;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
controls.target.set(0, 1.1, 0);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.16, 0.5, 0.95));

const terrainGeo = new THREE.PlaneGeometry(230, 230, 140, 140);
const tPos = terrainGeo.attributes.position;
const tCol = [];
for (let i = 0; i < tPos.count; i++) {
  const x = tPos.getX(i);
  const z = tPos.getY(i);
  const h = Math.sin(x * 0.045) * 0.6 + Math.cos(z * 0.037) * 0.56 + Math.sin((x + z) * 0.021) * 0.42;
  tPos.setZ(i, h * 0.45);
  const g = 0.73 + h * 0.06;
  tCol.push(0.56, g, 0.56);
}
terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(tCol, 3));
terrainGeo.computeVertexNormals();

const ground = new THREE.Mesh(
  terrainGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.0 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const beachRing = new THREE.Mesh(
  new THREE.RingGeometry(26, 33.5, 120),
  new THREE.MeshStandardMaterial({ color: "#f4e7c5", roughness: 0.86, metalness: 0.0, side: THREE.DoubleSide })
);
beachRing.rotation.x = -Math.PI / 2;
beachRing.position.y = 0.62;
scene.add(beachRing);

const shorelineFoam = new THREE.Mesh(
  new THREE.RingGeometry(25.2, 26.6, 120),
  new THREE.MeshBasicMaterial({ color: "#fbffff", transparent: true, opacity: 0.44, depthWrite: false, side: THREE.DoubleSide })
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
  new THREE.MeshStandardMaterial({ color: "#f7fbff", roughness: 0.42, metalness: 0.0, side: THREE.DoubleSide })
);
poolEdge.rotation.x = -Math.PI / 2;
poolEdge.position.y = 0.66;
scene.add(poolEdge);

const waterUniforms = {
  uTime: { value: 0 },
  uShallow: { value: new THREE.Color("#95eeff") },
  uDeep: { value: new THREE.Color("#35a6df") },
};

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
      float w0 = sin((uv.x * 11.0 + uv.y * 7.0) + uTime * 1.85) * 0.12;
      float w1 = sin((uv.x * 18.0 - uv.y * 9.0) - uTime * 1.3) * 0.08;
      float w2 = sin((uv.x * 24.0 + uv.y * 20.0) + uTime * 2.5) * 0.04;
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
    uniform vec3 cameraPosition;

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

      vec2 flowA = uv * 6.5 + vec2(t * 0.08, t * 0.1);
      vec2 flowB = uv * 9.0 + vec2(-t * 0.06, t * 0.05);
      float causticA = fbm(flowA);
      float causticB = fbm(flowB);
      float caustic = smoothstep(0.36, 0.8, causticA * 0.62 + causticB * 0.38);

      float waveA = sin((uv.x * 44.0 + uv.y * 16.0) + t * 2.8) * 0.5 + 0.5;
      float waveB = sin((uv.y * 38.0 - uv.x * 13.0) - t * 2.3) * 0.5 + 0.5;
      float crest = smoothstep(0.78, 0.98, waveA * 0.55 + waveB * 0.45);
      float streaks = smoothstep(0.62, 0.95, caustic) * smoothstep(0.45, 1.0, shore);

      vec3 base = mix(uDeep, uShallow, shore);
      base += vec3(0.16, 0.23, 0.26) * caustic;
      base += vec3(0.18, 0.24, 0.25) * crest * 0.38;

      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 2.6);
      base += vec3(0.2, 0.27, 0.3) * fresnel;

      float spark = smoothstep(0.74, 1.0, sin((uv.x + uv.y) * 32.0 + t * 2.0) * 0.5 + 0.5);
      base += vec3(0.14, 0.16, 0.16) * spark * (0.32 + 0.68 * shore);

      float foamEdge = smoothstep(0.78, 1.0, distCenter) * smoothstep(0.45, 0.95, caustic);
      vec3 color = mix(base, vec3(0.98, 1.0, 1.0), foamEdge * 0.76);
      color = mix(color, vec3(0.96, 1.0, 1.0), streaks * 0.18);

      float alpha = 0.9 - shore * 0.05 + foamEdge * 0.06 + fresnel * 0.03;
      gl_FragColor = vec4(color, clamp(alpha, 0.8, 0.96));
    }
  `,
});

const water = new THREE.Mesh(new THREE.PlaneGeometry(50, 50, 140, 140), waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = 0.6;
scene.add(water);

const deepTint = new THREE.Mesh(
  new THREE.CircleGeometry(21.6, 80),
  new THREE.MeshBasicMaterial({ color: "#59bae6", transparent: true, opacity: 0.075, depthWrite: false })
);
deepTint.rotation.x = -Math.PI / 2;
deepTint.position.y = 0.42;
scene.add(deepTint);

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

const blobTex = radialTexture();
function addShadowBlob(x, z, radius = 1.8, opacity = 0.2) {
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: "#3f4f4f", opacity })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(x, 0.17, z);
  scene.add(blob);
  return blob;
}

function addRock(x, z, scale = 1) {
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
    new THREE.MeshStandardMaterial({ color: "#98a49f", roughness: 0.92, metalness: 0.0 })
  );
  rock.position.set(x, 0.8 * scale, z);
  rock.rotation.y = Math.random() * Math.PI;
  scene.add(rock);
  addShadowBlob(x, z, 1.45 * scale, 0.17);
}

function addTree(x, z, scale = 1) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3 * scale, 0.46 * scale, 4.3 * scale, 8),
    new THREE.MeshStandardMaterial({ color: "#9f7b63", roughness: 0.95 })
  );
  trunk.position.set(x, 2.16 * scale, z);
  trunk.rotation.z = (Math.random() - 0.5) * 0.16;
  scene.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: "#7fe2c5", roughness: 0.9 });
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

  addShadowBlob(x, z, 2.6 * scale, 0.16);
}

function addReedPatch(x, z, count = 7) {
  for (let i = 0; i < count; i++) {
    const reed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, 0.95 + Math.random() * 0.45, 5),
      new THREE.MeshStandardMaterial({ color: "#93b86e", roughness: 0.92 })
    );
    reed.position.set(x + (Math.random() - 0.5) * 0.9, 0.48, z + (Math.random() - 0.5) * 0.9);
    reed.rotation.z = (Math.random() - 0.5) * 0.28;
    scene.add(reed);
  }
}

[[-28, 21], [28, 20], [-21, -24], [20, -26], [0, 30], [34, -2], [-33, 0]].forEach(([x, z], i) => addTree(x, z, 0.85 + (i % 4) * 0.08));
[[10, 25, 1.15], [-11, 23, 1.08], [23, 10, 0.9], [-24, -3, 1.22], [16, -19, 1.0], [-5, -27, 1.12]].forEach(([x, z, s]) => addRock(x, z, s));
[[19, 17], [24, -8], [-19, 14], [-21, -11], [4, 24], [-3, 24], [17, -18], [-13, -20], [26, 5], [-26, 4]].forEach(([x, z]) => addReedPatch(x, z));

function addLounge(x, z, rot = 0) {
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.24, 1.05),
    new THREE.MeshStandardMaterial({ color: "#ffe600", roughness: 0.55 })
  );
  base.position.set(x, 0.72, z);
  base.rotation.y = rot;
  scene.add(base);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.2, 0.7),
    new THREE.MeshStandardMaterial({ color: "#ffe84a", roughness: 0.56 })
  );
  back.position.set(x - Math.sin(rot) * 0.42, 0.98, z - Math.cos(rot) * 0.42);
  back.rotation.y = rot;
  back.rotation.x = -0.28;
  scene.add(back);

  addShadowBlob(x, z, 1.7, 0.12);
}

[[14, 18, Math.PI * 0.1], [17, 13, Math.PI * 0.1], [-15, 18, -Math.PI * 0.15], [-18, 13, -Math.PI * 0.15]].forEach(([x, z, r]) => addLounge(x, z, r));

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.45, 0.95, 6, 12),
  new THREE.MeshStandardMaterial({ color: "#ffd463", roughness: 0.68, metalness: 0.04 })
);
player.position.set(0, 1.2, 10);
scene.add(player);
const playerBlob = addShadowBlob(player.position.x, player.position.z, 1.5, 0.24);

const marker = new THREE.Group();
const markerRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.62, 0.06, 10, 40),
  new THREE.MeshBasicMaterial({ color: "#fef8a2", transparent: true, opacity: 0.9 })
);
markerRing.rotation.x = Math.PI / 2;
marker.add(markerRing);
const markerBeam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.05, 0.14, 1.15, 10),
  new THREE.MeshBasicMaterial({ color: "#f4ec8a", transparent: true, opacity: 0.42 })
);
markerBeam.position.y = 0.58;
marker.add(markerBeam);
marker.visible = false;
scene.add(marker);

const moveTarget = new THREE.Vector3();
let hasMoveTarget = false;
const keys = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downInfo = null;

const worldUp = new THREE.Vector3(0, 1, 0);
const camForward = new THREE.Vector3();
const camRight = new THREE.Vector3();
const moveDir = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();
const walkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -player.position.y);

function pointerToNdc(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
}

function getGroundPoint(clientX, clientY) {
  pointerToNdc(clientX, clientY);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(ground, false)[0];
  if (hit) return hit.point;

  const out = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(walkPlane, out)) return out;
  return null;
}

function setMoveTarget(point) {
  if (!point) return;
  moveTarget.copy(point);
  moveTarget.y = player.position.y;
  hasMoveTarget = true;
  marker.visible = true;
  marker.position.set(point.x, player.position.y + 0.02, point.z);
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  downInfo = { id: event.pointerId, x: event.clientX, y: event.clientY, button: event.button, moved: false };
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (!downInfo || downInfo.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - downInfo.x, event.clientY - downInfo.y) > 8) downInfo.moved = true;
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (!downInfo || downInfo.id !== event.pointerId) return;
  if (!downInfo.moved && downInfo.button === 0) {
    setMoveTarget(getGroundPoint(event.clientX, event.clientY));
  }
  downInfo = null;
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(key)) keys.add(key);
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(0.033, clock.getDelta());
  const t = clock.elapsedTime;
  waterUniforms.uTime.value += dt;
  skyMat.uniforms.uTime.value = t;

  moveDir.set(0, 0, 0);
  camera.getWorldDirection(camForward);
  camForward.y = 0;
  camForward.normalize();
  camRight.crossVectors(camForward, worldUp).normalize();

  if (keys.has("w") || keys.has("arrowup")) moveDir.add(camForward);
  if (keys.has("s") || keys.has("arrowdown")) moveDir.sub(camForward);
  if (keys.has("d") || keys.has("arrowright")) moveDir.add(camRight);
  if (keys.has("a") || keys.has("arrowleft")) moveDir.sub(camRight);

  const keyboardMove = moveDir.lengthSq() > 0.0001;
  if (keyboardMove) {
    hasMoveTarget = false;
    marker.visible = false;
    moveDir.normalize();
  } else if (hasMoveTarget) {
    moveDir.subVectors(moveTarget, player.position);
    moveDir.y = 0;
    const dist = moveDir.length();
    if (dist < 0.20) {
      hasMoveTarget = false;
      marker.visible = false;
      moveDir.set(0, 0, 0);
    } else {
      moveDir.divideScalar(dist);
    }
  }

  if (moveDir.lengthSq() > 0.0001) {
    player.position.addScaledVector(moveDir, 7.0 * dt);
    const targetYaw = Math.atan2(moveDir.x, moveDir.z);
    let delta = targetYaw - player.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    player.rotation.y += delta * Math.min(1, dt * 13);
  }

  playerBlob.position.set(player.position.x, 0.17, player.position.z);

  if (marker.visible) {
    markerRing.rotation.z += dt * 1.8;
    marker.position.y = player.position.y + 0.02 + Math.sin(t * 4.0) * 0.03;
    markerBeam.material.opacity = 0.32 + Math.sin(t * 6.0) * 0.10;
  }

  desiredTarget.set(player.position.x, 1.08, player.position.z);
  controls.target.lerp(desiredTarget, Math.min(1, dt * 8.0));
  controls.update();

  composer.render();
  requestAnimationFrame(animate);
}

animate();

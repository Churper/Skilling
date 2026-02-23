import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("game-canvas");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#90d0ef", 36, 180);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 450);
camera.position.set(30, 26, 28);

const skyGeo = new THREE.SphereGeometry(360, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    topColor: { value: new THREE.Color("#66c0f0") },
    midColor: { value: new THREE.Color("#97d6ff") },
    botColor: { value: new THREE.Color("#dff4ff") },
  },
  vertexShader: `
    varying vec3 vWorld;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorld = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 midColor;
    uniform vec3 botColor;
    varying vec3 vWorld;
    void main() {
      float h = normalize(vWorld).y * 0.5 + 0.5;
      vec3 c = mix(botColor, midColor, smoothstep(0.0, 0.62, h));
      c = mix(c, topColor, smoothstep(0.58, 1.0, h));
      gl_FragColor = vec4(c, 1.0);
    }
  `,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

scene.add(new THREE.HemisphereLight("#f6feff", "#4b7f50", 0.85));
const sun = new THREE.DirectionalLight("#fffaf0", 1.45);
sun.position.set(34, 44, 12);
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1.0, 0);
controls.minDistance = 8;
controls.maxDistance = 62;
controls.minPolarAngle = 0.48;
controls.maxPolarAngle = 1.33;
controls.mouseButtons.LEFT = -1; // preserve click-to-move
controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN; // requested wheel-hold pan
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.touches.ONE = THREE.TOUCH.PAN;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

const terrainGeo = new THREE.PlaneGeometry(180, 180, 120, 120);
const pos = terrainGeo.attributes.position;
const colors = [];
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getY(i);
  const h = Math.sin(x * 0.05) * 0.5 + Math.cos(z * 0.04) * 0.55 + Math.sin((x + z) * 0.022) * 0.45;
  pos.setZ(i, h * 0.55);

  const lush = 0.52 + h * 0.08;
  colors.push(0.27, lush, 0.30);
}
terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();

const ground = new THREE.Mesh(
  terrainGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = false;
scene.add(ground);

const shore = new THREE.Mesh(
  new THREE.CylinderGeometry(28.3, 31.3, 1.1, 56, 1, false),
  new THREE.MeshStandardMaterial({ color: "#d9c79c", roughness: 0.96, metalness: 0.0 })
);
shore.position.y = 0.05;
scene.add(shore);

const waterUniforms = {
  uTime: { value: 0 },
  uShallow: { value: new THREE.Color("#3fd7ff") },
  uDeep: { value: new THREE.Color("#1a5bfd") },
};

const waterMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: waterUniforms,
  vertexShader: `
    varying vec2 vUv;
    uniform float uTime;
    void main() {
      vUv = uv;
      vec3 p = position;
      float w0 = sin((uv.x * 12.0 + uv.y * 6.0) + uTime * 1.8) * 0.10;
      float w1 = sin((uv.x * 19.0 - uv.y * 11.0) - uTime * 1.4) * 0.06;
      p.y += w0 + w1;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uTime;
    uniform vec3 uShallow;
    uniform vec3 uDeep;

    float band(vec2 uv, float f, float t, float s) {
      float v = sin(dot(uv, vec2(cos(f), sin(f))) * s + t);
      return smoothstep(0.58, 0.93, v * 0.5 + 0.5);
    }

    void main() {
      float d = distance(vUv, vec2(0.5));
      float shore = smoothstep(0.02, 0.75, d);
      vec3 col = mix(uDeep, uShallow, shore);

      float t = uTime * 2.4;
      float b0 = band(vUv, 0.6, t, 34.0);
      float b1 = band(vUv, 2.1, -t * 0.8, 28.0);
      float b2 = band(vUv, 1.2, t * 1.2, 19.0);

      float ripple = (b0 * 0.55 + b1 * 0.35 + b2 * 0.25);
      col += vec3(0.11, 0.23, 0.32) * ripple;
      col += vec3(0.13, 0.20, 0.22) * smoothstep(0.84, 1.0, ripple);

      float foamEdge = smoothstep(0.80, 1.0, d) * smoothstep(0.48, 0.95, ripple);
      col = mix(col, vec3(0.94, 0.99, 1.0), foamEdge * 0.72);

      float alpha = 0.86 - shore * 0.16 + foamEdge * 0.08;
      gl_FragColor = vec4(col, alpha);
    }
  `,
});

const water = new THREE.Mesh(new THREE.PlaneGeometry(46, 46, 120, 120), waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = 0.58;
scene.add(water);

const deepTint = new THREE.Mesh(
  new THREE.CircleGeometry(20.5, 64),
  new THREE.MeshBasicMaterial({ color: "#0b2f8f", transparent: true, opacity: 0.30 })
);
deepTint.rotation.x = -Math.PI / 2;
deepTint.position.y = 0.35;
scene.add(deepTint);

function addTree(x, z, scale = 1) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * scale, 0.3 * scale, 2.2 * scale, 7),
    new THREE.MeshStandardMaterial({ color: "#6c4e2f", roughness: 0.98 })
  );
  trunk.position.set(x, 1.1 * scale, z);
  scene.add(trunk);

  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(1.55 * scale, 2.5 * scale, 8),
    new THREE.MeshStandardMaterial({ color: "#42a05a", roughness: 0.9 })
  );
  canopy.position.set(x, 3.0 * scale, z);
  scene.add(canopy);
}

[[-24, 20], [24, 22], [-20, -22], [18, -24], [0, 28]].forEach(([x, z], i) => addTree(x, z, 0.9 + i * 0.05));

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.45, 0.95, 6, 12),
  new THREE.MeshStandardMaterial({ color: "#ffd463", roughness: 0.68, metalness: 0.04 })
);
player.position.set(0, 1.2, 10);
scene.add(player);

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
const walkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -player.position.y);

function pointerToNdc(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
}

function getGroundPoint(clientX, clientY) {
  pointerToNdc(clientX, clientY);
  raycaster.setFromCamera(pointer, camera);

  const hit = raycaster.intersectObject(ground, false)[0];
  if (hit) {
    return hit.point;
  }

  const out = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(walkPlane, out)) {
    return out;
  }
  return null;
}

function setMoveTarget(point) {
  if (!point) return;
  moveTarget.copy(point);
  moveTarget.y = player.position.y;
  hasMoveTarget = true;
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  downInfo = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    button: event.button,
    moved: false,
  };
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (!downInfo || downInfo.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - downInfo.x, event.clientY - downInfo.y) > 8) {
    downInfo.moved = true;
  }
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
  if (["w", "a", "s", "d", "arrowup", "arrowleft", "arrowdown", "arrowright"].includes(key)) {
    keys.add(key);
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
const desiredTarget = new THREE.Vector3();

function animate() {
  const dt = Math.min(0.033, clock.getDelta());
  waterUniforms.uTime.value += dt;

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
    moveDir.normalize();
  } else if (hasMoveTarget) {
    moveDir.subVectors(moveTarget, player.position);
    moveDir.y = 0;
    const dist = moveDir.length();
    if (dist < 0.20) {
      hasMoveTarget = false;
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

  desiredTarget.set(player.position.x, 1.0, player.position.z);
  controls.target.lerp(desiredTarget, Math.min(1, dt * 4.5));
  controls.update();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
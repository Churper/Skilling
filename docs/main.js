import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/controls/OrbitControls.js";

const canvas = document.getElementById("game-canvas");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#89d1ff");
scene.fog = new THREE.Fog("#8fd6ff", 28, 105);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(18, 18, 18);

const hemi = new THREE.HemisphereLight("#d5f3ff", "#517e54", 1.0);
scene.add(hemi);

const sun = new THREE.DirectionalLight("#ffffff", 1.15);
sun.position.set(14, 25, 10);
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.7, 0);
controls.minDistance = 7;
controls.maxDistance = 50;
controls.minPolarAngle = 0.45;
controls.maxPolarAngle = 1.34;
controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
controls.touches.ONE = THREE.TOUCH.PAN;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

const groundGeo = new THREE.PlaneGeometry(140, 140, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({ color: "#4f8e4f", roughness: 0.92, metalness: 0.02 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const shore = new THREE.Mesh(
  new THREE.CylinderGeometry(26.4, 27.2, 0.9, 28, 1, false),
  new THREE.MeshStandardMaterial({ color: "#c7b584", roughness: 0.98, metalness: 0 })
);
shore.position.y = -0.45;
scene.add(shore);

const waterUniforms = {
  uTime: { value: 0 },
  uShallow: { value: new THREE.Color("#25e6ff") },
  uDeep: { value: new THREE.Color("#1149f5") },
};

const waterMat = new THREE.ShaderMaterial({
  transparent: true,
  uniforms: waterUniforms,
  vertexShader: `
    varying vec2 vUv;
    uniform float uTime;
    void main() {
      vUv = uv;
      vec3 p = position;
      float w = sin((uv.x + uv.y) * 14.0 + uTime * 2.2) * 0.11;
      float w2 = cos((uv.x - uv.y) * 18.0 - uTime * 1.8) * 0.08;
      p.y += w + w2;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uTime;
    uniform vec3 uShallow;
    uniform vec3 uDeep;
    void main() {
      float d = distance(vUv, vec2(0.5));
      float shore = smoothstep(0.0, 0.66, d);
      vec3 col = mix(uDeep, uShallow, shore);

      float r1 = sin((vUv.x + vUv.y) * 30.0 + uTime * 5.5);
      float r2 = cos((vUv.x - vUv.y) * 24.0 - uTime * 4.8);
      float ripple = r1 * 0.6 + r2 * 0.4;

      float brightBands = smoothstep(0.70, 0.97, ripple * 0.5 + 0.5);
      float darkBands = smoothstep(0.03, 0.22, ripple * 0.5 + 0.5);
      float edgeFoam = smoothstep(0.76, 0.98, d) * smoothstep(0.42, 0.95, ripple * 0.5 + 0.5);

      col += vec3(0.10, 0.24, 0.35) * brightBands;
      col -= vec3(0.07, 0.16, 0.18) * darkBands;
      col = mix(col, vec3(0.96, 0.99, 1.0), edgeFoam * 0.72);

      float alpha = 0.84 - shore * 0.18 + edgeFoam * 0.10;
      gl_FragColor = vec4(col, alpha);
    }
  `,
});

const water = new THREE.Mesh(new THREE.PlaneGeometry(42, 42, 80, 80), waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = 0.02;
scene.add(water);

const player = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.45, 0.95, 6, 12),
  new THREE.MeshStandardMaterial({ color: "#ffd75b", roughness: 0.78, metalness: 0.04 })
);
player.position.set(0, 0.95, 8);
scene.add(player);

const facing = new THREE.Vector3(0, 0, -1);
const moveTarget = new THREE.Vector3();
let hasMoveTarget = false;

const keys = new Set();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downInfo = null;

const worldUp = new THREE.Vector3(0, 1, 0);
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const moveDir = new THREE.Vector3();

const walkPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function pointerToNdc(clientX, clientY) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
}

function getGroundPoint(clientX, clientY) {
  pointerToNdc(clientX, clientY);
  raycaster.setFromCamera(pointer, camera);

  const groundHit = raycaster.intersectObject(ground, false)[0];
  if (groundHit) {
    return groundHit.point;
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
  moveTarget.y = 0.95;
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
  if (Math.hypot(event.clientX - downInfo.x, event.clientY - downInfo.y) > 9) {
    downInfo.moved = true;
  }
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (!downInfo || downInfo.id !== event.pointerId) return;
  if (!downInfo.moved && downInfo.button === 0) {
    const point = getGroundPoint(event.clientX, event.clientY);
    setMoveTarget(point);
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

function animate() {
  const dt = Math.min(0.033, clock.getDelta());
  waterUniforms.uTime.value += dt;

  moveDir.set(0, 0, 0);
  camera.getWorldDirection(cameraForward);
  cameraForward.y = 0;
  cameraForward.normalize();
  cameraRight.crossVectors(cameraForward, worldUp).normalize();

  if (keys.has("w") || keys.has("arrowup")) moveDir.add(cameraForward);
  if (keys.has("s") || keys.has("arrowdown")) moveDir.sub(cameraForward);
  if (keys.has("d") || keys.has("arrowright")) moveDir.add(cameraRight);
  if (keys.has("a") || keys.has("arrowleft")) moveDir.sub(cameraRight);

  const hasKeyboardMove = moveDir.lengthSq() > 0.0001;
  if (hasKeyboardMove) {
    hasMoveTarget = false;
    moveDir.normalize();
  } else if (hasMoveTarget) {
    moveDir.subVectors(moveTarget, player.position);
    moveDir.y = 0;
    const dist = moveDir.length();
    if (dist < 0.18) {
      hasMoveTarget = false;
      moveDir.set(0, 0, 0);
    } else {
      moveDir.divideScalar(dist);
    }
  }

  if (moveDir.lengthSq() > 0.0001) {
    const speed = 6.8;
    player.position.addScaledVector(moveDir, speed * dt);

    const targetYaw = Math.atan2(moveDir.x, moveDir.z);
    let deltaYaw = targetYaw - player.rotation.y;
    deltaYaw = Math.atan2(Math.sin(deltaYaw), Math.cos(deltaYaw));
    player.rotation.y += deltaYaw * Math.min(1, dt * 12);

    facing.copy(moveDir);
  }

  controls.target.lerp(new THREE.Vector3(player.position.x, 0.8, player.position.z), Math.min(1, dt * 4));
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
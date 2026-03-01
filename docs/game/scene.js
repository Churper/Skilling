import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createSceneContext(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor("#68b8d8", 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#93bfd4", 120, 340);

  const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.5, 400);
  camera.position.set(28, 30, 28);

  scene.add(new THREE.HemisphereLight("#f0fbff", "#6aa057", 0.92));
  scene.add(new THREE.AmbientLight("#ffffff", 0.18));
  const sun = new THREE.DirectionalLight("#fff2d0", 1.46);
  sun.position.set(42, 54, 18);
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#d8efff", 0.32);
  fill.position.set(-34, 26, -24);
  scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.dampingFactor = 0.0;
  controls.rotateSpeed = 0.9;
  controls.panSpeed = 0.0;
  controls.zoomSpeed = 1.08;
  controls.minDistance = 4.5;
  controls.maxDistance = 58;
  controls.minPolarAngle = 0.68;
  controls.maxPolarAngle = 1.16;
  controls.screenSpacePanning = false;
  controls.enableRotate = true;
  controls.enablePan = false;
  if ("zoomToCursor" in controls) controls.zoomToCursor = false;
  if ("minTargetRadius" in controls) controls.minTargetRadius = 0;
  if ("maxTargetRadius" in controls) controls.maxTargetRadius = Infinity;
  controls.mouseButtons.LEFT = -1;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  controls.target.set(0, 1.1, 0);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, controls };
}

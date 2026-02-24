import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export function createSceneContext(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor("#88b2c4", 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#b8ccb8", 180, 560);

  const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(28, 30, 28);

  scene.add(new THREE.HemisphereLight("#eaf8ff", "#6e9058", 0.82));
  const sun = new THREE.DirectionalLight("#fff2d6", 1.35);
  sun.position.set(45, 52, 16);
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#c4e6fb", 0.3);
  fill.position.set(-36, 24, -22);
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

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.5, 0.95));
  composer.addPass(new OutputPass());

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, controls, composer };
}

import * as THREE from "three";
import { createSceneContext } from "./game/scene.js";
import { createWorld } from "./game/world.js";
import { createPlayer, createMoveMarker } from "./game/entities.js";
import { createInputController } from "./game/input.js";
import { initializeUI } from "./game/ui.js";

const canvas = document.getElementById("game-canvas");
const { renderer, scene, camera, controls, composer } = createSceneContext(canvas);
const { ground, skyMat, waterUniforms, causticMap, addShadowBlob } = createWorld(scene);
const { player, playerBlob } = createPlayer(scene, addShadowBlob);
const { marker, markerRing, markerBeam } = createMoveMarker(scene);
initializeUI();

const moveTarget = new THREE.Vector3();
let hasMoveTarget = false;

function setMoveTarget(point) {
  if (!point) return;
  moveTarget.copy(point);
  moveTarget.y = player.position.y;
  hasMoveTarget = true;
  marker.visible = true;
  marker.position.set(point.x, player.position.y + 0.02, point.z);
}

const input = createInputController({
  domElement: renderer.domElement,
  camera,
  ground,
  player,
  setMoveTarget,
});

const worldUp = new THREE.Vector3(0, 1, 0);
const camForward = new THREE.Vector3();
const camRight = new THREE.Vector3();
const moveDir = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(0.033, clock.getDelta());
  const t = clock.elapsedTime;
  waterUniforms.uTime.value += dt;
  causticMap.offset.x = t * 0.005;
  causticMap.offset.y = -t * 0.0038;
  skyMat.uniforms.uTime.value = t;

  moveDir.set(0, 0, 0);
  camera.getWorldDirection(camForward);
  camForward.y = 0;
  camForward.normalize();
  camRight.crossVectors(camForward, worldUp).normalize();

  if (input.keys.has("w") || input.keys.has("arrowup")) moveDir.add(camForward);
  if (input.keys.has("s") || input.keys.has("arrowdown")) moveDir.sub(camForward);
  if (input.keys.has("d") || input.keys.has("arrowright")) moveDir.add(camRight);
  if (input.keys.has("a") || input.keys.has("arrowleft")) moveDir.sub(camRight);

  const keyboardMove = moveDir.lengthSq() > 0.0001;
  if (keyboardMove) {
    hasMoveTarget = false;
    marker.visible = false;
    moveDir.normalize();
  } else if (hasMoveTarget) {
    moveDir.subVectors(moveTarget, player.position);
    moveDir.y = 0;
    const dist = moveDir.length();
    if (dist < 0.2) {
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
    markerBeam.material.opacity = 0.32 + Math.sin(t * 6.0) * 0.1;
  }

  desiredTarget.set(player.position.x, 1.08, player.position.z);
  controls.target.lerp(desiredTarget, Math.min(1, dt * 8.0));
  controls.update();

  composer.render();
  requestAnimationFrame(animate);
}

animate();

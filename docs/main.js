import * as THREE from "three";
import { createSceneContext } from "./game/scene.js";
import { createWorld, getWorldSurfaceHeight, getWaterSurfaceHeight } from "./game/world.js";
import { createPlayer, createMoveMarker } from "./game/entities.js";
import { createInputController } from "./game/input.js";
import { initializeUI } from "./game/ui.js";

const REQUIRED_TOOL = {
  fishing: "fishing",
  mining: "pickaxe",
  woodcutting: "axe",
};

const TOOL_LABEL = {
  axe: "Axe",
  pickaxe: "Pickaxe",
  fishing: "Fishing Pole",
};

const SKILL_BY_RESOURCE = {
  fishing: "fishing",
  mining: "mining",
  woodcutting: "woodcutting",
};

const INVENTORY_BY_RESOURCE = {
  fishing: "fish",
  mining: "ore",
  woodcutting: "logs",
};

const XP_BY_RESOURCE = {
  fishing: 18,
  mining: 16,
  woodcutting: 16,
};

const canvas = document.getElementById("game-canvas");
const { renderer, scene, camera, controls, composer } = createSceneContext(canvas);
const { ground, skyMat, waterUniforms, causticMap, addShadowBlob, resourceNodes, updateWorld } = createWorld(scene);
const { player, playerBlob, setEquippedTool } = createPlayer(scene, addShadowBlob);
const { marker, markerRing, markerBeam } = createMoveMarker(scene);

let equippedTool = "fishing";
const inventory = { fish: 0, ore: 0, logs: 0 };
const skills = {
  fishing: { xp: 0, level: 1 },
  mining: { xp: 0, level: 1 },
  woodcutting: { xp: 0, level: 1 },
};

const ui = initializeUI({
  onToolSelect: (tool) => {
    equippedTool = tool;
    setEquippedTool(tool);
    ui?.setStatus(`Equipped ${TOOL_LABEL[tool]}.`, "info");
  },
});

setEquippedTool(equippedTool);
ui?.setActiveTool(equippedTool);
ui?.setInventory(inventory);
ui?.setSkills({
  fishing: skills.fishing.level,
  mining: skills.mining.level,
  woodcutting: skills.woodcutting.level,
});

const moveTarget = new THREE.Vector3();
const resourceTargetPos = new THREE.Vector3();
const markerTarget = new THREE.Vector3();
let hasMoveTarget = false;
let markerBaseY = 0;
let markerOnWater = false;
let pendingResource = null;

player.geometry.computeBoundingBox();
const playerFootOffset = -player.geometry.boundingBox.min.y;
const playerHeadOffset = player.geometry.boundingBox.max.y;

function xpToLevel(xp) {
  return Math.floor(Math.sqrt(xp / 34)) + 1;
}

function getPlayerGroundY(x, z) {
  return getWorldSurfaceHeight(x, z);
}

function getPlayerStandY(x, z) {
  return getPlayerGroundY(x, z) + playerFootOffset;
}

player.position.y = getPlayerStandY(player.position.x, player.position.z);

function setMoveTarget(point, preservePending = false) {
  if (!point) return;
  if (!preservePending) pendingResource = null;
  markerTarget.copy(point);
  moveTarget.copy(point);
  moveTarget.y = getPlayerGroundY(point.x, point.z);
  hasMoveTarget = true;
  marker.visible = true;
  const waterY = getWaterSurfaceHeight(point.x, point.z, waterUniforms.uTime.value);
  markerOnWater = Number.isFinite(waterY);
  markerBaseY = (markerOnWater ? waterY : moveTarget.y) + 0.1;
  marker.position.set(point.x, markerBaseY, point.z);
}

function resourceWorldPosition(node, out) {
  node.getWorldPosition(out);
  out.y = getPlayerGroundY(out.x, out.z);
  return out;
}

function tryGather(node) {
  const resourceType = node.userData.resourceType;
  if (!resourceType) return;

  const requiredTool = REQUIRED_TOOL[resourceType];
  if (equippedTool !== requiredTool) {
    ui?.setStatus(`Need ${TOOL_LABEL[requiredTool]} equipped to gather this.`, "warn");
    return;
  }

  const skillKey = SKILL_BY_RESOURCE[resourceType];
  const itemKey = INVENTORY_BY_RESOURCE[resourceType];
  const xpGain = XP_BY_RESOURCE[resourceType];
  const prevLevel = skills[skillKey].level;
  skills[skillKey].xp += xpGain;
  skills[skillKey].level = xpToLevel(skills[skillKey].xp);
  inventory[itemKey] += 1;

  ui?.setInventory(inventory);
  ui?.setSkills({
    fishing: skills.fishing.level,
    mining: skills.mining.level,
    woodcutting: skills.woodcutting.level,
  });

  const leveled = skills[skillKey].level > prevLevel;
  if (leveled) {
    ui?.setStatus(`${node.userData.resourceLabel} gathered. ${skillKey} level ${skills[skillKey].level}!`, "success");
  } else {
    ui?.setStatus(`+1 ${itemKey}, +${xpGain} XP ${skillKey}.`, "success");
  }
}

function onInteractResource(node) {
  const resourceType = node.userData.resourceType;
  const requiredTool = REQUIRED_TOOL[resourceType];
  if (equippedTool !== requiredTool) {
    ui?.setStatus(`Need ${TOOL_LABEL[requiredTool]} equipped to use ${node.userData.resourceLabel}.`, "warn");
    pendingResource = null;
    return;
  }

  pendingResource = node;
  resourceWorldPosition(node, resourceTargetPos);
  const distance = resourceTargetPos.distanceTo(player.position);
  if (distance > 2.7) {
    setMoveTarget(resourceTargetPos, true);
    ui?.setStatus(`Walking to ${node.userData.resourceLabel}...`, "info");
    return;
  }
  tryGather(node);
  pendingResource = null;
}

const input = createInputController({
  domElement: renderer.domElement,
  camera,
  ground,
  player,
  setMoveTarget,
  interactables: resourceNodes,
  onInteract: onInteractResource,
});

const worldUp = new THREE.Vector3(0, 1, 0);
const camForward = new THREE.Vector3();
const camRight = new THREE.Vector3();
const moveDir = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();
const fogAboveWater = new THREE.Color("#88a8b6");
const fogUnderwater = new THREE.Color("#4b88a4");
let underwaterFogActive = false;

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(0.033, clock.getDelta());
  const t = clock.elapsedTime;
  waterUniforms.uTime.value += dt;
  causticMap.offset.x = t * 0.0034;
  causticMap.offset.y = -t * 0.0026;
  skyMat.uniforms.uTime.value = t;
  updateWorld?.(t);

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
    pendingResource = null;
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

  if (pendingResource) {
    resourceWorldPosition(pendingResource, resourceTargetPos);
    const gatherDistance = resourceTargetPos.distanceTo(player.position);
    if (gatherDistance <= 2.7) {
      tryGather(pendingResource);
      pendingResource = null;
      hasMoveTarget = false;
      marker.visible = false;
    }
  }

  const groundY = getPlayerGroundY(player.position.x, player.position.z);
  const standY = groundY + playerFootOffset;
  player.position.y = THREE.MathUtils.damp(player.position.y, standY, 16, dt);
  playerBlob.position.set(player.position.x, groundY + 0.03, player.position.z);

  if (marker.visible) {
    if (markerOnWater) {
      const waterY = getWaterSurfaceHeight(markerTarget.x, markerTarget.z, waterUniforms.uTime.value);
      if (Number.isFinite(waterY)) markerBaseY = waterY + 0.1;
    } else {
      markerBaseY = getPlayerGroundY(markerTarget.x, markerTarget.z) + 0.1;
    }
    markerRing.rotation.z += dt * 1.8;
    marker.position.y = markerBaseY + Math.sin(t * 4.0) * 0.03;
    markerBeam.material.opacity = 0.32 + Math.sin(t * 6.0) * 0.1;
  }

  const waterY = getWaterSurfaceHeight(player.position.x, player.position.z, waterUniforms.uTime.value);
  const playerHeadY = player.position.y + playerHeadOffset;
  const isUnderwater = Number.isFinite(waterY) && waterY > playerHeadY;
  if (scene.fog && isUnderwater !== underwaterFogActive) {
    underwaterFogActive = isUnderwater;
    scene.fog.color.copy(isUnderwater ? fogUnderwater : fogAboveWater);
  }

  desiredTarget.set(player.position.x, player.position.y + 0.1, player.position.z);
  controls.target.lerp(desiredTarget, Math.min(1, dt * 8.0));
  controls.update();

  composer.render();
  requestAnimationFrame(animate);
}

animate();

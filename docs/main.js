import * as THREE from "three";
import { createSceneContext } from "./game/scene.js";
import { createWorld, getWorldSurfaceHeight, getWaterSurfaceHeight } from "./game/world.js";
import { createPlayer, createMoveMarker } from "./game/entities.js";
import { createInputController } from "./game/input.js";
import { initializeUI } from "./game/ui.js";
import {
  TOOL_FOR_RESOURCE,
  TOOL_LABEL,
  SKILL_BY_RESOURCE,
  INVENTORY_BY_RESOURCE,
  XP_BY_RESOURCE,
  GATHER_DURATION_BY_RESOURCE,
  BAG_CAPACITY,
  BAG_ITEM_KEYS,
  SELL_PRICE_BY_ITEM,
  TOOL_UPGRADE_BASE_COST,
  TOOL_UPGRADE_COST_STEP,
  TOOL_UPGRADE_MAX_LEVEL,
  HOUSE_BUILD_TARGET,
  SLIME_COLOR_SHOP,
} from "./game/config.js";
import { createBagSystem } from "./game/systems/bagSystem.js";
import { createConstructionProgress } from "./game/systems/constructionProgress.js";
import { xpToLevel, getGatherFailChance } from "./game/systems/progression.js";
import { createRemotePlayers } from "./game/systems/remotePlayers.js";
import { createRealtimeClient, resolveOnlineConfig } from "./game/net/realtimeClient.js";

const canvas = document.getElementById("game-canvas");
const { renderer, scene, camera, controls, composer } = createSceneContext(canvas);
const { ground, skyMat, waterUniforms, causticMap, addShadowBlob, resourceNodes, updateWorld, constructionSite } = createWorld(scene);
const { player, playerBlob, setEquippedTool, updateAnimation, setSlimeColor } = createPlayer(scene, addShadowBlob);
const { marker, markerRing, markerBeam } = createMoveMarker(scene);

let equippedTool = "fishing";
const bagSystem = createBagSystem({ capacity: BAG_CAPACITY, itemKeys: BAG_ITEM_KEYS });
const inventory = bagSystem.counts;
const bagSlots = bagSystem.slots;
let coins = 0;
const toolUpgrades = { axe: 0, pickaxe: 0, fishing: 0 };
const constructionProgress = createConstructionProgress({ target: HOUSE_BUILD_TARGET });
let currentSlimeColorId = "lime";
const unlockedSlimeColors = new Set(["lime"]);
const skills = {
  fishing: { xp: 0, level: 1 },
  mining: { xp: 0, level: 1 },
  woodcutting: { xp: 0, level: 1 },
};
const onlineConfig = resolveOnlineConfig();
const remotePlayers = createRemotePlayers({
  scene,
  addShadowBlob,
  getGroundY: (x, z) => getPlayerGroundY(x, z),
});

const ui = initializeUI({
  onToolSelect: (tool) => {
    equipTool(tool, true);
  },
  onEmote: (emoji) => showEmote(emoji),
  onBlacksmithUpgrade: (tool) => {
    purchaseToolUpgrade(tool);
  },
  onStoreSell: () => {
    sellBagViaStoreUI();
  },
  onStoreColor: (colorId) => {
    buyOrEquipSlimeColor(colorId);
  },
});

function equipTool(tool, announce = false) {
  equippedTool = tool;
  setEquippedTool(tool);
  ui?.setActiveTool(tool);
  if (announce) ui?.setStatus(`Equipped ${TOOL_LABEL[tool]}.`, "info");
}

function bagUsedCount() {
  return bagSystem.usedCount();
}

function bagIsFull() {
  return bagSystem.isFull();
}

function updateInventoryCountsFromSlots() {
  bagSystem.recount();
}

function syncInventoryUI() {
  updateInventoryCountsFromSlots();
  ui?.setInventory({
    counts: inventory,
    slots: bagSlots,
    used: bagUsedCount(),
    capacity: BAG_CAPACITY,
  });
  ui?.setCoins(coins);
  ui?.setBlacksmith(getBlacksmithState());
  ui?.setStore(getStoreState());
}

function addItemToBag(itemKey) {
  return bagSystem.addItem(itemKey);
}

function clearBagToBank() {
  return bagSystem.clearToBank();
}

function sellBagToStore() {
  const { sold, coinsGained } = bagSystem.sellAll(SELL_PRICE_BY_ITEM);
  coins += coinsGained;
  return { sold, coinsGained };
}

function consumeBuildMaterialsFromBag() {
  const { removed, total } = bagSystem.consumeMatching((item) => item === "logs" || item === "ore");
  return { logs: removed.logs || 0, ore: removed.ore || 0, total };
}

function getHouseBuildProgress01() {
  return constructionProgress.getProgress01();
}

function syncHouseBuildVisual() {
  if (!constructionSite || typeof constructionSite.setProgress !== "function") return;
  constructionSite.setProgress(getHouseBuildProgress01(), constructionProgress.getStock());
}

function getHouseBuildMissing() {
  return constructionProgress.getMissing();
}

function getSlimeColorById(colorId) {
  const entry = SLIME_COLOR_SHOP.find((it) => it.id === colorId);
  return entry?.color || "#58df78";
}

function getCurrentSlimeColorHex() {
  return getSlimeColorById(currentSlimeColorId);
}

let onlineConnected = false;
function syncFriendsUI() {
  ui?.setFriendsState?.({ connected: onlineConnected, peers: remotePlayers.count() });
}

const netClient = createRealtimeClient({
  wsUrl: onlineConfig.wsUrl,
  room: onlineConfig.room,
  name: onlineConfig.name,
  color: getCurrentSlimeColorHex(),
  onConnected: ({ room }) => {
    onlineConnected = true;
    syncFriendsUI();
    ui?.setStatus(`Online connected: room ${room}.`, "info");
  },
  onDisconnected: ({ reconnecting }) => {
    onlineConnected = false;
    remotePlayers.clear();
    syncFriendsUI();
    if (reconnecting) ui?.setStatus("Online disconnected. Reconnecting...", "warn");
  },
  onWelcome: (msg) => {
    remotePlayers.setSnapshot(msg?.peers || []);
    syncFriendsUI();
  },
  onPeerJoin: (peer) => {
    remotePlayers.upsertPeer(peer);
    syncFriendsUI();
  },
  onPeerLeave: (id) => {
    remotePlayers.removePeer(id);
    syncFriendsUI();
  },
  onPeerState: (msg) => {
    remotePlayers.applyState(msg.id, msg.state, { name: msg.name, color: msg.color });
    syncFriendsUI();
  },
});

if (netClient.isEnabled) {
  netClient.connect();
} else {
  syncFriendsUI();
}
window.addEventListener("beforeunload", () => {
  netClient.disconnect();
});

equipTool(equippedTool, false);
setSlimeColor(getCurrentSlimeColorHex());
syncInventoryUI();
syncHouseBuildVisual();
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
let pendingService = null;
let activeGather = null;

const clickEffects = [];
const clickRingGeo = new THREE.RingGeometry(0.28, 0.38, 24);

function getSurfaceIndicatorY(x, z, time = waterUniforms.uTime.value) {
  const waterY = getWaterSurfaceHeight(x, z, time);
  if (Number.isFinite(waterY)) return waterY;
  return getPlayerGroundY(x, z);
}

function spawnClickEffect(x, z, tone = "neutral") {
  const colorByTone = {
    neutral: "#f6efab",
    success: "#96efbf",
    warn: "#ffd2a3",
    tree: "#96efbf",
    rock: "#ffd2a3",
    fish: "#a0d8f0",
  };
  const effectMat = new THREE.MeshBasicMaterial({
    color: colorByTone[tone] || colorByTone.neutral,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(clickRingGeo, effectMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, getSurfaceIndicatorY(x, z) + 0.12, z);
  ring.renderOrder = 98;
  scene.add(ring);
  const isResource = tone === "tree" || tone === "rock" || tone === "fish";
  clickEffects.push({ ring, age: 0, duration: isResource ? 0.4 : 0.3 });
}

function updateClickEffects(dt) {
  for (let i = clickEffects.length - 1; i >= 0; i--) {
    const fx = clickEffects[i];
    fx.age += dt;
    const t = THREE.MathUtils.clamp(fx.age / fx.duration, 0, 1);
    const scale = 1 + t * 2.4;
    fx.ring.scale.setScalar(scale);
    fx.ring.material.opacity = 1 - t;
    fx.ring.position.y += dt * 0.28;
    if (t >= 1) {
      scene.remove(fx.ring);
      fx.ring.material.dispose();
      clickEffects.splice(i, 1);
    }
  }
}

// ── Emote chat bubbles ──
const emoteBubbles = [];
const floatingDrops = [];
let bubbleLayer = null;

function getBubbleLayer() {
  if (!bubbleLayer) {
    bubbleLayer = document.createElement("div");
    bubbleLayer.id = "chat-bubble-layer";
    document.body.appendChild(bubbleLayer);
  }
  return bubbleLayer;
}

function showEmote(emoji) {
  for (const b of emoteBubbles) b.el.remove();
  emoteBubbles.length = 0;
  const el = document.createElement("div");
  el.className = "chat-bubble";
  el.textContent = emoji;
  getBubbleLayer().appendChild(el);
  emoteBubbles.push({ el, age: 0, duration: 3.0 });
}

const _bubbleProj = new THREE.Vector3();

function updateEmoteBubbles(dt) {
  if (!emoteBubbles.length) return;
  _bubbleProj.set(player.position.x, player.position.y + playerHeadOffset + 0.45, player.position.z);
  _bubbleProj.project(camera);
  const hw = renderer.domElement.clientWidth * 0.5;
  const hh = renderer.domElement.clientHeight * 0.5;
  const sx = _bubbleProj.x * hw + hw;
  const sy = -_bubbleProj.y * hh + hh;
  for (let i = emoteBubbles.length - 1; i >= 0; i--) {
    const b = emoteBubbles[i];
    b.age += dt;
    b.el.style.left = sx + "px";
    b.el.style.top = sy + "px";
    if (b.age > b.duration - 0.5) {
      b.el.style.opacity = String(Math.max(0, (b.duration - b.age) / 0.5));
    }
    if (b.age >= b.duration) {
      b.el.remove();
      emoteBubbles.splice(i, 1);
    }
  }
}

// ── Slime trail ──
const _dropProj = new THREE.Vector3();

function spawnFloatingDrop(x, z, text, tone = "xp") {
  const el = document.createElement("div");
  el.className = `xp-drop xp-drop-${tone}`;
  el.textContent = text;
  getBubbleLayer().appendChild(el);
  floatingDrops.push({
    el,
    age: 0,
    duration: tone === "level" ? 1.4 : 1.05,
    x,
    z,
    y: getSurfaceIndicatorY(x, z) + 0.26,
    driftX: (Math.random() - 0.5) * 0.28,
    rise: tone === "level" ? 0.88 : 0.66,
  });
}

function updateFloatingDrops(dt) {
  if (!floatingDrops.length) return;
  const hw = renderer.domElement.clientWidth * 0.5;
  const hh = renderer.domElement.clientHeight * 0.5;
  for (let i = floatingDrops.length - 1; i >= 0; i--) {
    const d = floatingDrops[i];
    d.age += dt;
    const t = THREE.MathUtils.clamp(d.age / d.duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 2);
    _dropProj.set(d.x + d.driftX * eased, d.y + d.rise * eased, d.z);
    _dropProj.project(camera);
    d.el.style.left = (_dropProj.x * hw + hw) + "px";
    d.el.style.top = (-_dropProj.y * hh + hh) + "px";
    d.el.style.opacity = String(Math.max(0, 1 - t * 1.15));
    d.el.style.transform = `translate(-50%, -100%) scale(${0.92 + t * 0.12})`;
    if (t >= 1) {
      d.el.remove();
      floatingDrops.splice(i, 1);
    }
  }
}

const ENABLE_SLIME_TRAIL = true;
const slimeTrails = [];
const trailSegmentGeo = new THREE.PlaneGeometry(1, 1);
let lastTrailTime = 0;
let hasTrailPoint = false;
const lastTrailPoint = new THREE.Vector2();

function updateSlimeTrail(dt, t, isMoving) {
  if (!ENABLE_SLIME_TRAIL) {
    for (let i = slimeTrails.length - 1; i >= 0; i--) {
      scene.remove(slimeTrails[i].mesh);
      slimeTrails[i].mesh.material.dispose();
      slimeTrails.splice(i, 1);
    }
    hasTrailPoint = false;
    return;
  }

  if (!isMoving) {
    hasTrailPoint = false;
  }

  if (isMoving && t - lastTrailTime > 0.045) {
    lastTrailTime = t;
    const x = player.position.x;
    const z = player.position.z;
    if (!hasTrailPoint) {
      lastTrailPoint.set(x, z);
      hasTrailPoint = true;
    } else {
      const dx = x - lastTrailPoint.x;
      const dz = z - lastTrailPoint.y;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.03) {
        const midX = (lastTrailPoint.x + x) * 0.5;
        const midZ = (lastTrailPoint.y + z) * 0.5;
        const gy = getPlayerGroundY(midX, midZ);
        const width = THREE.MathUtils.clamp(0.15 + dist * 0.1, 0.15, 0.24);
        const length = dist + 0.22;
        const heading = Math.atan2(dx, dz);
        const mat = new THREE.MeshBasicMaterial({
          color: "#4fd472",
          transparent: true,
          opacity: 0.27,
          depthWrite: false,
          depthTest: true,
          side: THREE.DoubleSide,
        });
        const segment = new THREE.Mesh(trailSegmentGeo, mat);
        segment.rotation.x = -Math.PI / 2;
        segment.rotation.y = heading;
        segment.position.set(midX, gy + 0.018, midZ);
        segment.scale.set(width, length, 1);
        segment.renderOrder = 1;
        scene.add(segment);
        slimeTrails.push({
          mesh: segment,
          age: 0,
          duration: 2.3,
          baseWidth: width,
          baseLength: length,
          baseY: gy + 0.018,
        });
      }
      lastTrailPoint.set(x, z);
    }
  }

  for (let i = slimeTrails.length - 1; i >= 0; i--) {
    const tr = slimeTrails[i];
    tr.age += dt;
    const life = THREE.MathUtils.clamp(tr.age / tr.duration, 0, 1);
    const fade = Math.pow(1 - life, 1.35);
    tr.mesh.material.opacity = fade * 0.27;
    tr.mesh.scale.set(
      tr.baseWidth * (1 + life * 0.08),
      tr.baseLength * (1 + life * 0.12),
      1
    );
    tr.mesh.position.y = tr.baseY + life * 0.03;
    if (tr.age >= tr.duration) {
      scene.remove(tr.mesh);
      tr.mesh.material.dispose();
      slimeTrails.splice(i, 1);
    }
  }
}

player.geometry.computeBoundingBox();
const playerFootOffset = -player.geometry.boundingBox.min.y;
const playerHeadOffset = player.geometry.boundingBox.max.y;
const playerGroundSink = 0.0;

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
  if (!preservePending) pendingService = null;
  if (!preservePending) activeGather = null;
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

  const skillKey = SKILL_BY_RESOURCE[resourceType];
  const itemKey = INVENTORY_BY_RESOURCE[resourceType];
  const xpGain = XP_BY_RESOURCE[resourceType];

  if (bagIsFull()) {
    activeGather = null;
    pendingResource = null;
    ui?.setStatus(`Bag full (${bagUsedCount()}/${BAG_CAPACITY}). Click Bank to deposit or Store to sell.`, "warn");
    const fullPos = resourceWorldPosition(node, resourceTargetPos);
    spawnClickEffect(fullPos.x, fullPos.z, "warn");
    return;
  }

  const preLevel = skills[skillKey].level;
  const failChance = getGatherFailChance(preLevel);
  if (Math.random() < failChance) {
    const failPos = resourceWorldPosition(node, resourceTargetPos);
    spawnClickEffect(failPos.x, failPos.z, "warn");
    spawnFloatingDrop(failPos.x, failPos.z, "Miss", "warn");
    ui?.setStatus(`Missed ${node.userData.resourceLabel}.`, "warn");
    return;
  }

  if (!addItemToBag(itemKey)) return;

  const prevLevel = preLevel;
  skills[skillKey].xp += xpGain;
  skills[skillKey].level = xpToLevel(skills[skillKey].xp);

  syncInventoryUI();
  ui?.setSkills({
    fishing: skills.fishing.level,
    mining: skills.mining.level,
    woodcutting: skills.woodcutting.level,
  });

  const leveled = skills[skillKey].level > prevLevel;
  if (leveled) {
    ui?.setStatus(`${node.userData.resourceLabel} gathered. ${skillKey} level ${skills[skillKey].level}!`, "success");
  } else {
    ui?.setStatus(`+${xpGain} XP ${skillKey}.`, "success");
  }
  const successPos = resourceWorldPosition(node, resourceTargetPos);
  spawnClickEffect(successPos.x, successPos.z, "success");
  spawnFloatingDrop(successPos.x, successPos.z, `+${xpGain} XP`, "xp");
  if (leveled) {
    spawnFloatingDrop(successPos.x - 0.14, successPos.z + 0.1, `${skillKey} Lv ${skills[skillKey].level}!`, "level");
  }
}

function startGather(node) {
  const resourceType = node.userData.resourceType;
  const neededTool = TOOL_FOR_RESOURCE[resourceType] || "fishing";
  const toolLevel = toolUpgrades[neededTool] || 0;
  const speedMultiplier = 1 + toolLevel * 0.1;
  const baseDuration = GATHER_DURATION_BY_RESOURCE[resourceType] ?? 0.8;
  activeGather = {
    node,
    resourceType,
    elapsed: 0,
    duration: baseDuration / speedMultiplier,
  };
  hasMoveTarget = false;
  marker.visible = false;
  ui?.setStatus(`Gathering ${node.userData.resourceLabel}...`, "info");
}

function getToolUpgradeCost(tool) {
  const level = toolUpgrades[tool] || 0;
  return TOOL_UPGRADE_BASE_COST + level * TOOL_UPGRADE_COST_STEP;
}

function getBlacksmithState() {
  const tools = {};
  for (const tool of Object.keys(TOOL_LABEL)) {
    const level = toolUpgrades[tool] || 0;
    const maxed = level >= TOOL_UPGRADE_MAX_LEVEL;
    tools[tool] = {
      level,
      cost: maxed ? 0 : getToolUpgradeCost(tool),
      maxed,
    };
  }
  return { coins, tools };
}

function getStoreState() {
  const colors = {};
  for (const entry of SLIME_COLOR_SHOP) {
    const unlocked = unlockedSlimeColors.has(entry.id);
    colors[entry.id] = {
      label: entry.label,
      cost: entry.cost,
      unlocked,
      color: entry.color,
    };
  }
  return {
    coins,
    selectedColorId: currentSlimeColorId,
    colors,
  };
}

function sellBagViaStoreUI() {
  const { sold, coinsGained } = sellBagToStore();
  syncInventoryUI();
  if (sold <= 0) {
    ui?.setStatus("Store: nothing to sell from your bag.", "warn");
  } else {
    ui?.setStatus(`Sold ${sold} item${sold === 1 ? "" : "s"} for ${coinsGained} coins.`, "success");
  }
}

function buyOrEquipSlimeColor(colorId) {
  const entry = SLIME_COLOR_SHOP.find((it) => it.id === colorId);
  if (!entry) return;
  if (!unlockedSlimeColors.has(colorId)) {
    if (coins < entry.cost) {
      ui?.setStatus(`Store: ${entry.label} costs ${entry.cost} coins.`, "warn");
      ui?.setStore(getStoreState());
      return;
    }
    coins -= entry.cost;
    unlockedSlimeColors.add(colorId);
  }
  currentSlimeColorId = colorId;
  const nextColor = getCurrentSlimeColorHex();
  setSlimeColor(nextColor);
  netClient.updateProfile({ color: nextColor });
  syncInventoryUI();
  ui?.setStatus(`Slime color equipped: ${entry.label}.`, "success");
}

function purchaseToolUpgrade(tool) {
  if (!tool || !Object.prototype.hasOwnProperty.call(toolUpgrades, tool)) return;
  const currentLevel = toolUpgrades[tool] || 0;
  if (currentLevel >= TOOL_UPGRADE_MAX_LEVEL) {
    ui?.setStatus(`Blacksmith: ${TOOL_LABEL[tool]} is already maxed.`, "warn");
    ui?.setBlacksmith(getBlacksmithState());
    return;
  }
  const cost = getToolUpgradeCost(tool);
  if (coins < cost) {
    ui?.setStatus(`Blacksmith: ${TOOL_LABEL[tool]} upgrade costs ${cost} coins.`, "warn");
    ui?.setBlacksmith(getBlacksmithState());
    return;
  }
  coins -= cost;
  toolUpgrades[tool] = currentLevel + 1;
  syncInventoryUI();
  const next = getToolUpgradeCost(tool);
  const maxed = toolUpgrades[tool] >= TOOL_UPGRADE_MAX_LEVEL;
  ui?.setStatus(
    maxed
      ? `${TOOL_LABEL[tool]} upgraded to +${toolUpgrades[tool]} (MAX).`
      : `${TOOL_LABEL[tool]} upgraded to +${toolUpgrades[tool]}. Next: ${next} coins.`,
    "success"
  );
}

function runServiceAction(node) {
  const serviceType = node.userData.serviceType;
  if (!serviceType) return;

  if (serviceType === "bank") {
    const moved = clearBagToBank();
    syncInventoryUI();
    if (moved <= 0) {
      ui?.setStatus("Bank: your bag is already empty.", "warn");
    } else {
      ui?.setStatus(`Banked ${moved} item${moved === 1 ? "" : "s"}.`, "success");
    }
    return;
  }

  if (serviceType === "store") {
    ui?.openStore(getStoreState());
    ui?.setStatus("Store open. Sell your bag and buy slime colors.", "info");
    return;
  }

  if (serviceType === "blacksmith") {
    ui?.openBlacksmith(getBlacksmithState());
    ui?.setStatus("Blacksmith open. Buy tool upgrades with coins.", "info");
    return;
  }

  if (serviceType === "construction") {
    const deposited = consumeBuildMaterialsFromBag();
    if (deposited.total <= 0) {
      const missing = getHouseBuildMissing();
      if (missing.logs <= 0 && missing.ore <= 0) {
        ui?.setStatus("Construction complete. House is fully upgraded.", "success");
      } else {
        ui?.setStatus(`Bring Logs + Ore. Missing ${missing.logs} logs and ${missing.ore} ore.`, "warn");
      }
      return;
    }

    const applied = constructionProgress.deposit({ logs: deposited.logs, ore: deposited.ore });
    syncHouseBuildVisual();
    syncInventoryUI();

    const progressPercent = Math.round(getHouseBuildProgress01() * 100);
    const missing = getHouseBuildMissing();
    if (missing.logs <= 0 && missing.ore <= 0) {
      ui?.setStatus("Construction complete. The new house is finished.", "success");
      return;
    }
    ui?.setStatus(
      `Built +${applied.logsAdded} logs, +${applied.oreAdded} ore (${progressPercent}%). Remaining ${missing.logs} logs, ${missing.ore} ore.`,
      "success"
    );
  }
}

function onInteractNode(node, hitPoint) {
  if (node.userData?.serviceType) {
    if (hitPoint) spawnClickEffect(hitPoint.x, hitPoint.z, "neutral");
    else {
      const clickPos = resourceWorldPosition(node, resourceTargetPos);
      spawnClickEffect(clickPos.x, clickPos.z, "neutral");
    }

    pendingResource = null;
    activeGather = null;
    pendingService = node;
    resourceWorldPosition(node, resourceTargetPos);
    const distance = resourceTargetPos.distanceTo(player.position);
    if (distance > 2.7) {
      setMoveTarget(resourceTargetPos, true);
      ui?.setStatus(`Walking to ${node.userData.resourceLabel}...`, "info");
      return;
    }
    hasMoveTarget = false;
    marker.visible = false;
    runServiceAction(node);
    pendingService = null;
    return;
  }

  const resourceType = node.userData.resourceType;
  if (!resourceType) return;
  if (bagIsFull()) {
    ui?.setStatus(`Bag full (${bagUsedCount()}/${BAG_CAPACITY}). Visit Bank or Store first.`, "warn");
    if (hitPoint) spawnClickEffect(hitPoint.x, hitPoint.z, "warn");
    else {
      const fullPos = resourceWorldPosition(node, resourceTargetPos);
      spawnClickEffect(fullPos.x, fullPos.z, "warn");
    }
    return;
  }

  const toneLookup = { woodcutting: "tree", mining: "rock", fishing: "fish" };
  const clickTone = toneLookup[resourceType] || "neutral";
  if (hitPoint) spawnClickEffect(hitPoint.x, hitPoint.z, clickTone);
  else {
    const clickPos = resourceWorldPosition(node, resourceTargetPos);
    spawnClickEffect(clickPos.x, clickPos.z, clickTone);
  }

  const neededTool = TOOL_FOR_RESOURCE[resourceType];
  if (neededTool && equippedTool !== neededTool) equipTool(neededTool, false);

  pendingService = null;
  pendingResource = node;
  activeGather = null;
  resourceWorldPosition(node, resourceTargetPos);
  const distance = resourceTargetPos.distanceTo(player.position);
  if (distance > 2.7) {
    setMoveTarget(resourceTargetPos, true);
    ui?.setStatus(`Walking to ${node.userData.resourceLabel}...`, "info");
    return;
  }
  startGather(node);
}

const input = createInputController({
  domElement: renderer.domElement,
  camera,
  ground,
  player,
  setMoveTarget,
  interactables: resourceNodes,
  onInteract: onInteractNode,
});

const worldUp = new THREE.Vector3(0, 1, 0);
const camForward = new THREE.Vector3();
const camRight = new THREE.Vector3();
const moveDir = new THREE.Vector3();
const gatherDir = new THREE.Vector3();
const cameraFocus = new THREE.Vector3();
const cameraDelta = new THREE.Vector3();
const cameraInitBack = new THREE.Vector3();
const fogAboveWater = new THREE.Color("#b8ccb8");
const fogUnderwater = new THREE.Color("#4b88a4");
let underwaterFogActive = false;

const clock = new THREE.Clock();

// Initialize chase camera centered above and behind player.
cameraFocus.set(player.position.x, player.position.y + 0.4, player.position.z);
controls.target.copy(cameraFocus);
cameraInitBack.set(Math.sin(player.rotation.y + Math.PI), 0, Math.cos(player.rotation.y + Math.PI));
camera.position.copy(cameraFocus).addScaledVector(cameraInitBack, 12).addScaledVector(worldUp, 6);

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
    pendingService = null;
    activeGather = null;
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

  if (moveDir.lengthSq() > 0.0001 && !activeGather) {
    player.position.addScaledVector(moveDir, 7.0 * dt);
    const targetYaw = Math.atan2(moveDir.x, moveDir.z);
    let delta = targetYaw - player.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    player.rotation.y += delta * Math.min(1, dt * 13);
  }

  if (pendingResource && !activeGather) {
    resourceWorldPosition(pendingResource, resourceTargetPos);
    const gatherDistance = resourceTargetPos.distanceTo(player.position);
    if (gatherDistance <= 2.7) {
      startGather(pendingResource);
    }
  }

  if (pendingService && !activeGather) {
    resourceWorldPosition(pendingService, resourceTargetPos);
    const serviceDistance = resourceTargetPos.distanceTo(player.position);
    if (serviceDistance <= 2.7) {
      runServiceAction(pendingService);
      pendingService = null;
      hasMoveTarget = false;
      marker.visible = false;
    }
  }

  if (activeGather) {
    resourceWorldPosition(activeGather.node, resourceTargetPos);
    const dirToNode = gatherDir.subVectors(resourceTargetPos, player.position);
    dirToNode.y = 0;
    const distToNode = dirToNode.length();
    if (distToNode > 0.001) {
      dirToNode.divideScalar(distToNode);
      const targetYaw = Math.atan2(dirToNode.x, dirToNode.z);
      let delta = targetYaw - player.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      player.rotation.y += delta * Math.min(1, dt * 15);
    }

    if (distToNode > 3.0) {
      pendingResource = activeGather.node;
      activeGather = null;
      setMoveTarget(resourceTargetPos, true);
      ui?.setStatus(`Walking to ${pendingResource.userData.resourceLabel}...`, "info");
    } else {
      activeGather.elapsed += dt;
      if (activeGather.elapsed >= activeGather.duration) {
        activeGather.elapsed = 0;
        tryGather(activeGather.node);
      }
    }
  }

  const groundY = getPlayerGroundY(player.position.x, player.position.z);
  const standY = groundY + playerFootOffset - playerGroundSink;
  player.position.y = standY;
  playerBlob.position.set(player.position.x, groundY + 0.03, player.position.z);
  const isMovingNow = moveDir.lengthSq() > 0.0001 && !activeGather;
  updateAnimation(dt, {
    moving: isMovingNow,
    gathering: !!activeGather,
    resourceType: activeGather?.resourceType,
  });
  updateClickEffects(dt);
  updateEmoteBubbles(dt);
  updateFloatingDrops(dt);
  updateSlimeTrail(dt, t, isMovingNow);
  remotePlayers.update(dt);

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

  cameraFocus.set(player.position.x, player.position.y + 0.4, player.position.z);
  cameraDelta.subVectors(cameraFocus, controls.target);
  camera.position.add(cameraDelta);
  controls.target.copy(cameraFocus);
  controls.update();

  netClient.sendState({
    x: player.position.x,
    z: player.position.z,
    yaw: player.rotation.y,
    moving: isMovingNow,
    gathering: !!activeGather,
    tool: equippedTool,
  });

  composer.render();
  requestAnimationFrame(animate);
}

animate();

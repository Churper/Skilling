import * as THREE from "three";
import { createSceneContext } from "./game/scene.js";
import { createWorld, getWorldSurfaceHeight, getWaterSurfaceHeight } from "./game/world.js";
import { createPlayer, createMoveMarker, createCombatEffects } from "./game/entities.js";
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
import { xpToLevel, xpForLevel, getGatherFailChance } from "./game/systems/progression.js";
import { createRemotePlayers } from "./game/systems/remotePlayers.js";
import { createRealtimeClient, resolveOnlineConfig } from "./game/net/realtimeClient.js";

const canvas = document.getElementById("game-canvas");
const { renderer, scene, camera, controls, composer } = createSceneContext(canvas);
const { ground, skyMat, waterUniforms, causticMap, addShadowBlob, resourceNodes, updateWorld, constructionSite, collisionObstacles = [], weaponModels } = await createWorld(scene);
const { player, playerBlob, setEquippedTool, updateAnimation, setSlimeColor } = createPlayer(scene, addShadowBlob, weaponModels);
const { marker, markerRing, markerBeam } = createMoveMarker(scene);
const combatEffects = createCombatEffects(scene);
let combatStyle = "melee";
const COMBAT_TOOL_BY_STYLE = Object.freeze({
  melee: "sword",
  bow: "bow",
  mage: "staff",
});
const COMBAT_TOOLS = new Set(["sword", "bow", "staff"]);

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
  melee: { xp: 0, level: 1 },
  bow: { xp: 0, level: 1 },
  mage: { xp: 0, level: 1 },
};
const onlineConfig = resolveOnlineConfig();
const remotePlayers = createRemotePlayers({
  scene,
  addShadowBlob,
  getGroundY: (x, z) => getPlayerGroundY(x, z),
});
let netClient = null;

const ui = initializeUI({
  onToolSelect: (tool) => {
    equipTool(tool, true);
    if (!isCombatTool(tool)) {
      activeAttack = null;
      if (pendingService?.userData?.serviceType === "dummy") pendingService = null;
    }
  },
  onEmote: (emoji) => triggerEmote(emoji),
  onBlacksmithUpgrade: (tool) => {
    purchaseToolUpgrade(tool);
  },
  onStoreSell: () => {
    sellBagViaStoreUI();
  },
  onStoreColor: (colorId) => {
    buyOrEquipSlimeColor(colorId);
  },
  onBankTransfer: (direction, itemKey, qtyRaw) => {
    transferBankItem(direction, itemKey, qtyRaw);
  },
  onCombatStyle: (style) => {
    combatStyle = style;
    equipTool(getCombatToolForStyle(style), false);
  },
});

function getCombatToolForStyle(style) {
  return COMBAT_TOOL_BY_STYLE[style] || "sword";
}

function isCombatTool(tool) {
  return COMBAT_TOOLS.has(tool);
}

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
  ui?.setBank(getBankState());
}

function getSkillProgress(skillKey) {
  const s = skills[skillKey];
  if (!s) return 0;
  const curLevelXp = xpForLevel(s.level);
  const nextLevelXp = xpForLevel(s.level + 1);
  const range = nextLevelXp - curLevelXp;
  if (range <= 0) return 100;
  return Math.min(100, Math.round(((s.xp - curLevelXp) / range) * 100));
}

function syncSkillsUI() {
  ui?.setSkills({
    fishing: skills.fishing.level,
    mining: skills.mining.level,
    woodcutting: skills.woodcutting.level,
    melee: skills.melee.level,
    bow: skills.bow.level,
    mage: skills.mage.level,
    _progress: {
      fishing: getSkillProgress("fishing"),
      mining: getSkillProgress("mining"),
      woodcutting: getSkillProgress("woodcutting"),
      melee: getSkillProgress("melee"),
      bow: getSkillProgress("bow"),
      mage: getSkillProgress("mage"),
    },
  });
}

function addItemToBag(itemKey) {
  return bagSystem.addItem(itemKey);
}

function depositItemToBank(itemKey, limit = 1) {
  return bagSystem.depositItemToBank(itemKey, limit);
}

function withdrawItemFromBank(itemKey, limit = 1) {
  return bagSystem.withdrawItemFromBank(itemKey, limit);
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

netClient = createRealtimeClient({
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
  onPeerEmote: (msg) => {
    showEmote(msg.emoji, {
      key: `peer:${msg.id}`,
      anchor: (out) => remotePlayers.getEmoteAnchor(msg.id, out),
      duration: 2.8,
    });
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
syncSkillsUI();

const moveTarget = new THREE.Vector3();
const resourceTargetPos = new THREE.Vector3();
const markerTarget = new THREE.Vector3();
let hasMoveTarget = false;
let markerBaseY = 0;
let markerOnWater = false;
let pendingResource = null;
let pendingService = null;
const pendingServicePos = new THREE.Vector3();
let activeGather = null;
let activeAttack = null;
let nextAttackAllowedAt = 0;

function getAttackRange() {
  if (combatStyle === "bow") return 14.0;
  if (combatStyle === "mage") return 12.0;
  return 2.7;
}

function getAttackInterval() {
  if (combatStyle === "bow") return 1.0;
  if (combatStyle === "mage") return 1.2;
  return 0.7;
}

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
const _localEmoteAnchor = new THREE.Vector3();

function getBubbleLayer() {
  if (!bubbleLayer) {
    bubbleLayer = document.createElement("div");
    bubbleLayer.id = "chat-bubble-layer";
    document.body.appendChild(bubbleLayer);
  }
  return bubbleLayer;
}

function getLocalEmoteAnchor(out = _localEmoteAnchor) {
  out.set(player.position.x, player.position.y + playerHeadOffset + 0.45, player.position.z);
  return out;
}

function showEmote(emoji, options = {}) {
  if (typeof emoji !== "string" || !emoji.trim()) return;
  const key = typeof options.key === "string" ? options.key : "local";
  const anchor = typeof options.anchor === "function" ? options.anchor : getLocalEmoteAnchor;
  const duration = Number.isFinite(options.duration) ? Math.max(0.5, options.duration) : 3.0;

  for (let i = emoteBubbles.length - 1; i >= 0; i--) {
    if (emoteBubbles[i].key !== key) continue;
    emoteBubbles[i].el.remove();
    emoteBubbles.splice(i, 1);
  }

  const el = document.createElement("div");
  el.className = "chat-bubble";
  el.textContent = emoji.trim();
  getBubbleLayer().appendChild(el);
  emoteBubbles.push({ key, anchor, el, age: 0, duration });
}

function triggerEmote(emoji) {
  showEmote(emoji, { key: "local", anchor: getLocalEmoteAnchor, duration: 3.0 });
  netClient?.sendEmote?.(emoji);
}

const _bubbleProj = new THREE.Vector3();

function updateEmoteBubbles(dt) {
  if (!emoteBubbles.length) return;
  const hw = renderer.domElement.clientWidth * 0.5;
  const hh = renderer.domElement.clientHeight * 0.5;
  for (let i = emoteBubbles.length - 1; i >= 0; i--) {
    const b = emoteBubbles[i];
    b.age += dt;
    const anchorPos = b.anchor(_bubbleProj);
    if (!anchorPos) {
      b.el.remove();
      emoteBubbles.splice(i, 1);
      continue;
    }
    anchorPos.project(camera);
    b.el.style.left = (anchorPos.x * hw + hw) + "px";
    b.el.style.top = (-anchorPos.y * hh + hh) + "px";
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
const playerCollisionRadius = 0.48;

function pushPointOutsideObstacles(point, extraRadius = 0) {
  if (!collisionObstacles.length || !point) return point;
  for (let i = 0; i < collisionObstacles.length; i++) {
    const obstacle = collisionObstacles[i];
    const minDistance = (obstacle.radius || 0) + extraRadius;
    const dx = point.x - obstacle.x;
    const dz = point.z - obstacle.z;
    const distSq = dx * dx + dz * dz;
    if (distSq >= minDistance * minDistance) continue;
    if (distSq < 0.000001) {
      point.x = obstacle.x + minDistance;
      point.z = obstacle.z;
      continue;
    }
    const dist = Math.sqrt(distSq);
    const scale = minDistance / dist;
    point.x = obstacle.x + dx * scale;
    point.z = obstacle.z + dz * scale;
  }
  return point;
}

function resolvePlayerCollisions() {
  if (!collisionObstacles.length) return;
  // Two passes for stable separation when obstacles are close.
  pushPointOutsideObstacles(player.position, playerCollisionRadius);
  pushPointOutsideObstacles(player.position, playerCollisionRadius);
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
  if (!preservePending) pendingService = null;
  if (!preservePending) activeGather = null;
  if (!preservePending) activeAttack = null;
  markerTarget.copy(point);
  pushPointOutsideObstacles(markerTarget, playerCollisionRadius + 0.14);
  moveTarget.copy(point);
  pushPointOutsideObstacles(moveTarget, playerCollisionRadius + 0.14);
  moveTarget.y = getPlayerGroundY(moveTarget.x, moveTarget.z);
  hasMoveTarget = true;
  marker.visible = true;
  const waterY = getWaterSurfaceHeight(markerTarget.x, markerTarget.z, waterUniforms.uTime.value);
  markerOnWater = Number.isFinite(waterY);
  markerBaseY = (markerOnWater ? waterY : moveTarget.y) + 0.1;
  marker.position.set(markerTarget.x, markerBaseY, markerTarget.z);
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
  syncSkillsUI();

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

function getBankState() {
  return {
    bag: { ...inventory },
    bank: { ...bagSystem.bankStorage },
    used: bagUsedCount(),
    capacity: BAG_CAPACITY,
  };
}

function transferBankItem(direction, itemKey, qtyRaw) {
  if (!itemKey || !Object.prototype.hasOwnProperty.call(bagSystem.bankStorage, itemKey)) return;
  const sourceCount = direction === "deposit"
    ? Math.max(0, Math.floor(Number(inventory[itemKey]) || 0))
    : Math.max(0, Math.floor(Number(bagSystem.bankStorage[itemKey]) || 0));
  if (sourceCount <= 0) {
    ui?.setStatus(`Bank: no ${itemKey} available to ${direction}.`, "warn");
    ui?.setBank(getBankState());
    return;
  }

  const parsedQty = qtyRaw === "all" ? sourceCount : Math.max(0, Math.floor(Number(qtyRaw) || 0));
  const limit = Math.max(1, parsedQty);
  let moved = 0;
  if (direction === "deposit") moved = depositItemToBank(itemKey, Math.min(limit, sourceCount));
  else moved = withdrawItemFromBank(itemKey, Math.min(limit, sourceCount));

  syncInventoryUI();
  if (moved <= 0) {
    if (direction === "withdraw" && bagIsFull()) {
      ui?.setStatus(`Bank: bag is full (${bagUsedCount()}/${BAG_CAPACITY}).`, "warn");
    } else {
      ui?.setStatus(`Bank: unable to ${direction} ${itemKey}.`, "warn");
    }
    return;
  }
  const verb = direction === "deposit" ? "Deposited" : "Withdrew";
  ui?.setStatus(`${verb} ${moved} ${itemKey}.`, "success");
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
    ui?.openBank(getBankState());
    ui?.setStatus("Bank open. Choose item + amount to deposit or withdraw.", "info");
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

function performAttackHit(node) {
  const dummyPos = new THREE.Vector3();
  node.getWorldPosition(dummyPos);
  const dx = dummyPos.x - player.position.x;
  const dz = dummyPos.z - player.position.z;
  const yaw = Math.atan2(dx, dz);
  player.rotation.y = yaw;
  combatEffects.attack(combatStyle, player.position.clone(), yaw, 0.5, dummyPos.clone());
  const minDmg = 1, maxDmg = 15;
  const damage = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;
  spawnFloatingDrop(dummyPos.x, dummyPos.z, `Hit ${damage}`, "combat");

  const combatXp = 10 + damage;
  const combatSkill = skills[combatStyle];
  if (combatSkill) {
    const prevLevel = combatSkill.level;
    combatSkill.xp += combatXp;
    combatSkill.level = xpToLevel(combatSkill.xp);
    syncSkillsUI();
    if (combatSkill.level > prevLevel) {
      spawnFloatingDrop(dummyPos.x - 0.14, dummyPos.z + 0.1, `${combatStyle} Lv ${combatSkill.level}!`, "level");
      ui?.setStatus(`${combatStyle} level ${combatSkill.level}!`, "success");
    } else {
      spawnFloatingDrop(dummyPos.x + 0.14, dummyPos.z - 0.1, `+${combatXp} XP`, "xp");
      ui?.setStatus(`Hit Training Dummy for ${damage} damage! +${combatXp} XP`, "success");
    }
  } else {
    ui?.setStatus(`Hit Training Dummy for ${damage} damage!`, "success");
  }
}

function startActiveAttack(node) {
  const now = clock.elapsedTime;
  if (now < nextAttackAllowedAt) return;
  const requiredTool = getCombatToolForStyle(combatStyle);
  if (equippedTool !== requiredTool) equipTool(requiredTool, false);
  const interval = getAttackInterval();
  activeAttack = { node, elapsed: 0, interval };
  activeGather = null;
  pendingResource = null;
  pendingService = null;
  hasMoveTarget = false;
  marker.visible = false;
  performAttackHit(node);
  nextAttackAllowedAt = now + Math.max(0.2, interval * 0.92);
}

function onInteractNode(node, hitPoint) {
  // Training dummy: walk to it and auto-attack continuously
  if (node.userData?.serviceType === "dummy") {
    if (activeAttack && activeAttack.node === node) return;
    const dummyPos = new THREE.Vector3();
    node.getWorldPosition(dummyPos);
    spawnClickEffect(dummyPos.x, dummyPos.z, "neutral");
    const distance = dummyPos.distanceTo(player.position);
    const range = getAttackRange();
    if (distance > range) {
      pendingResource = null;
      activeGather = null;
      activeAttack = null;
      pendingService = node;
      pendingServicePos.copy(dummyPos);
      pendingServicePos.y = getPlayerGroundY(dummyPos.x, dummyPos.z);
      setMoveTarget(pendingServicePos, true);
      ui?.setStatus("Walking to Training Dummy...", "info");
      return;
    }
    startActiveAttack(node);
    return;
  }

  if (node.userData?.serviceType) {
    if (hitPoint) pendingServicePos.copy(hitPoint);
    else resourceWorldPosition(node, pendingServicePos);
    pushPointOutsideObstacles(pendingServicePos, playerCollisionRadius + 0.14);
    pendingServicePos.y = getPlayerGroundY(pendingServicePos.x, pendingServicePos.z);
    spawnClickEffect(pendingServicePos.x, pendingServicePos.z, "neutral");
    pendingResource = null;
    activeGather = null;
    activeAttack = null;
    pendingService = node;
    const distance = pendingServicePos.distanceTo(player.position);
    if (distance > 2.7) {
      setMoveTarget(pendingServicePos, true);
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
  activeAttack = null;
  resourceWorldPosition(node, resourceTargetPos);
  const distance = resourceTargetPos.distanceTo(player.position);
  if (distance > 2.7) {
    setMoveTarget(resourceTargetPos, true);
    ui?.setStatus(`Walking to ${node.userData.resourceLabel}...`, "info");
    return;
  }
  startGather(node);
}

// ── Hover selection indicator ──
let hoverIndicator = null;
let hoveredNode = null;
const hoverRingGeo = new THREE.RingGeometry(0.7, 0.88, 32);
const hoverRingMat = new THREE.MeshBasicMaterial({
  color: "#ffffff",
  transparent: true,
  opacity: 0.0,
  depthWrite: false,
  depthTest: false,
  side: THREE.DoubleSide,
});
hoverIndicator = new THREE.Mesh(hoverRingGeo, hoverRingMat);
hoverIndicator.rotation.x = -Math.PI / 2;
hoverIndicator.renderOrder = 99;
hoverIndicator.visible = false;
scene.add(hoverIndicator);

function onHoverChange(node) {
  hoveredNode = node;
  if (!node) {
    hoverIndicator.visible = false;
    return;
  }
  const pos = new THREE.Vector3();
  node.getWorldPosition(pos);
  const gy = getPlayerGroundY(pos.x, pos.z);
  const waterY = getWaterSurfaceHeight(pos.x, pos.z, waterUniforms.uTime.value);
  const baseY = Number.isFinite(waterY) ? waterY + 0.04 : gy + 0.06;
  hoverIndicator.position.set(pos.x, baseY, pos.z);

  // Scale ring based on object type
  const isTree = node.userData?.resourceType === "woodcutting";
  const isService = !!node.userData?.serviceType;
  const scale = isTree ? 2.2 : isService ? 1.8 : 1.4;
  hoverIndicator.scale.setScalar(scale);

  // Color by type
  const colorMap = {
    woodcutting: "#7dff7d",
    mining: "#ffcc66",
    fishing: "#66ccff",
  };
  const serviceColor = "#ffffff";
  const col = node.userData?.resourceType ? (colorMap[node.userData.resourceType] || "#ffffff") : serviceColor;
  hoverRingMat.color.set(col);
  hoverIndicator.visible = true;
}

const input = createInputController({
  domElement: renderer.domElement,
  camera,
  ground,
  player,
  setMoveTarget,
  interactables: resourceNodes,
  onInteract: onInteractNode,
  onHoverChange,
});

if (scene.fog) {
  scene.fog.color.set("#95b57a");
  scene.fog.near = 620;
  scene.fog.far = 1650;
}

const worldUp = new THREE.Vector3(0, 1, 0);
const camForward = new THREE.Vector3();
const camRight = new THREE.Vector3();
const moveDir = new THREE.Vector3();
const gatherDir = new THREE.Vector3();
const cameraFocus = new THREE.Vector3();
const cameraDelta = new THREE.Vector3();
const cameraInitBack = new THREE.Vector3();

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
  if (causticMap) { causticMap.offset.x = t * 0.0034; causticMap.offset.y = -t * 0.0026; }
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
    activeAttack = null;
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

  if (moveDir.lengthSq() > 0.0001 && !activeGather && !activeAttack) {
    player.position.addScaledVector(moveDir, 7.0 * dt);
    const targetYaw = Math.atan2(moveDir.x, moveDir.z);
    let delta = targetYaw - player.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    player.rotation.y += delta * Math.min(1, dt * 13);
  }

  resolvePlayerCollisions();

  // Clamp player to playable area (before mountains)
  const playerR = Math.hypot(player.position.x, player.position.z);
  if (playerR > 48) {
    const scale = 48 / playerR;
    player.position.x *= scale;
    player.position.z *= scale;
  }

  if (pendingResource && !activeGather) {
    resourceWorldPosition(pendingResource, resourceTargetPos);
    const gatherDistance = resourceTargetPos.distanceTo(player.position);
    if (gatherDistance <= 2.7) {
      startGather(pendingResource);
    }
  }

  if (pendingService && !activeGather && !activeAttack) {
    const serviceDistance = pendingServicePos.distanceTo(player.position);
    const arrivalDist = pendingService.userData?.serviceType === "dummy" ? getAttackRange() : 2.7;
    if (serviceDistance <= arrivalDist) {
      if (pendingService.userData?.serviceType === "dummy") {
        startActiveAttack(pendingService);
      } else {
        runServiceAction(pendingService);
        pendingService = null;
      }
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

  if (activeAttack) {
    if (equippedTool !== getCombatToolForStyle(combatStyle)) {
      activeAttack = null;
    }
  }

  if (activeAttack) {
    const atkDummyPos = new THREE.Vector3();
    activeAttack.node.getWorldPosition(atkDummyPos);
    const atkDir = gatherDir.subVectors(atkDummyPos, player.position);
    atkDir.y = 0;
    const atkDist = atkDir.length();
    if (atkDist > 0.001) {
      atkDir.divideScalar(atkDist);
      const targetYaw = Math.atan2(atkDir.x, atkDir.z);
      let delta = targetYaw - player.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      player.rotation.y += delta * Math.min(1, dt * 15);
    }
    if (atkDist > getAttackRange() + 1.0) {
      activeAttack = null;
    } else {
      activeAttack.elapsed += dt;
      if (activeAttack.elapsed >= activeAttack.interval) {
        const now = clock.elapsedTime;
        if (now >= nextAttackAllowedAt) {
          activeAttack.elapsed = 0;
          performAttackHit(activeAttack.node);
          nextAttackAllowedAt = now + Math.max(0.2, activeAttack.interval * 0.92);
        }
      }
    }
  }

  const groundY = getPlayerGroundY(player.position.x, player.position.z);
  const standY = groundY + playerFootOffset - playerGroundSink;
  player.position.y = standY;
  playerBlob.position.set(player.position.x, groundY + 0.03, player.position.z);
  const isMovingNow = moveDir.lengthSq() > 0.0001 && !activeGather && !activeAttack;
  updateAnimation(dt, {
    moving: isMovingNow,
    gathering: !!activeGather,
    attacking: !!activeAttack,
    combatStyle,
    resourceType: activeGather?.resourceType,
  });
  updateClickEffects(dt);
  updateEmoteBubbles(dt);
  updateFloatingDrops(dt);
  combatEffects.update(dt);
  updateSlimeTrail(dt, t, isMovingNow);
  remotePlayers.update(dt);

  // Animate hover indicator
  if (hoverIndicator.visible && hoveredNode) {
    const pos = new THREE.Vector3();
    hoveredNode.getWorldPosition(pos);
    const gy = getPlayerGroundY(pos.x, pos.z);
    const waterY2 = getWaterSurfaceHeight(pos.x, pos.z, waterUniforms.uTime.value);
    const baseY2 = Number.isFinite(waterY2) ? waterY2 + 0.04 : gy + 0.06;
    hoverIndicator.position.set(pos.x, baseY2, pos.z);
    hoverIndicator.rotation.z += dt * 1.2;
    hoverRingMat.opacity = 0.45 + Math.sin(t * 4.5) * 0.2;
  }

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

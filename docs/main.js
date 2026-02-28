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
  PRAYERS,
} from "./game/config.js";
import { createBagSystem } from "./game/systems/bagSystem.js";
import { createConstructionProgress } from "./game/systems/constructionProgress.js";
import { xpToLevel, xpForLevel, getGatherFailChance } from "./game/systems/progression.js";
import { createRemotePlayers } from "./game/systems/remotePlayers.js";
import { createRealtimeClient, resolveOnlineConfig } from "./game/net/realtimeClient.js";

const canvas = document.getElementById("game-canvas");
/* WebGL check */
try {
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) throw new Error("no webgl");
} catch {
  document.getElementById("webgl-fallback").style.display = "block";
  throw new Error("WebGL not supported");
}
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
let inCave = false;
const activePrayers = new Set();
const onlineConfig = resolveOnlineConfig();
const remotePlayers = createRemotePlayers({
  scene,
  addShadowBlob,
  getGroundY: (x, z) => getPlayerGroundY(x, z),
  weaponModels,
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
  onPrayerToggle: (id, on) => {
    togglePrayer(id, on);
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

function togglePrayer(id, on) {
  const prayer = PRAYERS[id];
  if (!prayer) return;
  if (on) {
    // Overhead prayers are exclusive — only one at a time
    if (prayer.exclusive === "overhead") {
      for (const [pid, p] of Object.entries(PRAYERS)) {
        if (p.exclusive === "overhead" && pid !== id && activePrayers.has(pid)) {
          activePrayers.delete(pid);
          ui?.setPrayerActive(pid, false);
        }
      }
    }
    activePrayers.add(id);
  } else {
    activePrayers.delete(id);
  }
  ui?.setPrayerActive(id, on);
  updateLocalOverheadIcon();
}

function getActiveOverhead() {
  for (const id of activePrayers) {
    const p = PRAYERS[id];
    if (p && p.exclusive === "overhead") return id;
  }
  return null;
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
    if (peer?.id) {
      const tag = getOrCreateNameTag(peer.id);
      tag.nameSpan.textContent = peer.name || "Player";
      tag.name = peer.name || "Player";
      tag.levelSpan.textContent = "";
      tag.level = "";
    }
  },
  onPeerLeave: (id) => {
    remotePlayers.removePeer(id);
    removeNameTag(id);
    removeOverheadIcon(id);
    syncFriendsUI();
  },
  onPeerState: (msg) => {
    remotePlayers.applyState(msg.id, msg.state, { name: msg.name, color: msg.color });
    syncFriendsUI();
    if (msg.id && msg.name) {
      const tag = getOrCreateNameTag(msg.id);
      if (tag.name !== msg.name) { tag.nameSpan.textContent = msg.name; tag.name = msg.name; }
    }
    if (msg.id && msg.state) {
      setRemoteOverhead(msg.id, msg.state.overhead || null);
    }
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
const interactPos = new THREE.Vector3();
const combatPos = new THREE.Vector3();
const hoverPos = new THREE.Vector3();
const PLAYABLE_RADIUS = 300;
let hasMoveTarget = false;
let markerBaseY = 0;
let markerOnWater = false;
let pendingResource = null;
let pendingService = null;
const pendingServicePos = new THREE.Vector3();
let activeGather = null;
let activeAttack = null;
let nextAttackAllowedAt = 0;
const CLICK_TONE_BY_RESOURCE = Object.freeze({ woodcutting: "tree", mining: "rock", fishing: "fish" });
const HOVER_COLOR_BY_RESOURCE = Object.freeze({ woodcutting: "#7dff7d", mining: "#ffcc66", fishing: "#66ccff" });

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

// ── Name tags above slimes ──
const nameTags = new Map(); // key -> { el, anchor }
const _tagProj = new THREE.Vector3();

function getOrCreateNameTag(key) {
  let tag = nameTags.get(key);
  if (tag) return tag;
  const el = document.createElement("div");
  el.className = "nametag";
  const nameSpan = document.createElement("span");
  nameSpan.className = "nametag-name";
  const levelSpan = document.createElement("span");
  levelSpan.className = "nametag-level";
  el.appendChild(nameSpan);
  el.appendChild(document.createElement("br"));
  el.appendChild(levelSpan);
  getBubbleLayer().appendChild(el);
  tag = { el, nameSpan, levelSpan, name: "", level: "" };
  nameTags.set(key, tag);
  return tag;
}

function removeNameTag(key) {
  const tag = nameTags.get(key);
  if (!tag) return;
  tag.el.remove();
  nameTags.delete(key);
}

function updateNameTags() {
  const hw = renderer.domElement.clientWidth * 0.5;
  const hh = renderer.domElement.clientHeight * 0.5;

  // Local player tag
  const localTag = getOrCreateNameTag("local");
  const totalLevel = Object.values(skills).reduce((sum, s) => sum + s.level, 0);
  const localName = onlineConfig.name || "You";
  if (localTag.name !== localName) { localTag.nameSpan.textContent = localName; localTag.name = localName; }
  const lvlStr = `Lv ${totalLevel}`;
  if (localTag.level !== lvlStr) { localTag.levelSpan.textContent = lvlStr; localTag.level = lvlStr; }
  _tagProj.set(player.position.x, player.position.y + playerHeadOffset - 0.15, player.position.z);
  _tagProj.project(camera);
  localTag.el.style.left = (_tagProj.x * hw + hw) + "px";
  localTag.el.style.top = (-_tagProj.y * hh + hh) + "px";

  // Remote player tags
  for (const [key, tag] of nameTags) {
    if (key === "local") continue;
    // Check if peer still exists
    const anchor = remotePlayers.getEmoteAnchor(key, _tagProj);
    if (!anchor) { removeNameTag(key); continue; }
    anchor.y -= 0.35;
    anchor.project(camera);
    tag.el.style.left = (anchor.x * hw + hw) + "px";
    tag.el.style.top = (-anchor.y * hh + hh) + "px";
  }
}

/* ── Overhead prayer icons ── */
const OVERHEAD_ICON_MAP = {
  protect_melee: "\uD83D\uDEE1\uFE0F",
  protect_range: "\uD83C\uDFF9",
  protect_mage: "\uD83D\uDD25",
};
const overheadIcons = new Map(); // key -> { el, prayerId }
const _ohProj = new THREE.Vector3();

function getOrCreateOverheadIcon(key) {
  let entry = overheadIcons.get(key);
  if (entry) return entry;
  const el = document.createElement("div");
  el.className = "prayer-overhead-icon";
  getBubbleLayer().appendChild(el);
  entry = { el, prayerId: null };
  overheadIcons.set(key, entry);
  return entry;
}

function removeOverheadIcon(key) {
  const entry = overheadIcons.get(key);
  if (!entry) return;
  entry.el.remove();
  overheadIcons.delete(key);
}

function updateLocalOverheadIcon() {
  const overhead = getActiveOverhead();
  if (overhead) {
    const entry = getOrCreateOverheadIcon("local");
    if (entry.prayerId !== overhead) {
      entry.el.textContent = OVERHEAD_ICON_MAP[overhead] || "";
      entry.prayerId = overhead;
    }
  } else {
    removeOverheadIcon("local");
  }
}

function updateOverheadIcons() {
  const hw = renderer.domElement.clientWidth * 0.5;
  const hh = renderer.domElement.clientHeight * 0.5;

  // Local player
  const localEntry = overheadIcons.get("local");
  if (localEntry) {
    _ohProj.set(player.position.x, player.position.y + playerHeadOffset + 0.65, player.position.z);
    _ohProj.project(camera);
    localEntry.el.style.left = (_ohProj.x * hw + hw) + "px";
    localEntry.el.style.top = (-_ohProj.y * hh + hh) + "px";
  }

  // Remote players
  for (const [key, entry] of overheadIcons) {
    if (key === "local") continue;
    const anchor = remotePlayers.getEmoteAnchor(key, _ohProj);
    if (!anchor) { removeOverheadIcon(key); continue; }
    anchor.y += 0.25;
    anchor.project(camera);
    entry.el.style.left = (anchor.x * hw + hw) + "px";
    entry.el.style.top = (-anchor.y * hh + hh) + "px";
  }
}

function setRemoteOverhead(id, prayerId) {
  if (!prayerId) {
    removeOverheadIcon(id);
    return;
  }
  const entry = getOrCreateOverheadIcon(id);
  if (entry.prayerId !== prayerId) {
    entry.el.textContent = OVERHEAD_ICON_MAP[prayerId] || "";
    entry.prayerId = prayerId;
  }
}

const ENABLE_SLIME_TRAIL = false;
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
      tr.mesh.geometry.dispose();
      slimeTrails.splice(i, 1);
    }
  }
}

player.geometry.computeBoundingBox();
const playerFootOffset = -player.geometry.boundingBox.min.y;
const playerHeadOffset = player.geometry.boundingBox.max.y;
const playerGroundSink = 0.0;
const playerCollisionRadius = 0.48;
const groundRaycaster = new THREE.Raycaster();
const groundRayOrigin = new THREE.Vector3();
const groundRayDir = new THREE.Vector3(0, -1, 0);

function clampPointToPlayableRadius(point, margin = 0) {
  if (!point) return point;
  const maxRadius = Math.max(0.01, PLAYABLE_RADIUS - Math.max(0, margin));
  const radius = Math.hypot(point.x, point.z);
  if (radius <= maxRadius) return point;
  const scale = maxRadius / radius;
  point.x *= scale;
  point.z *= scale;
  return point;
}

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
  if (inCave) return; // no overworld obstacles in cave
  if (!collisionObstacles.length) return;
  // Two passes for stable separation when obstacles are close.
  pushPointOutsideObstacles(player.position, playerCollisionRadius);
  pushPointOutsideObstacles(player.position, playerCollisionRadius);
}

function getPlayerGroundY(x, z) {
  if (inCave) {
    return 0; // flat cave floor
  }
  const analyticY = getWorldSurfaceHeight(x, z);
  groundRayOrigin.set(x, analyticY + 30, z);
  groundRaycaster.set(groundRayOrigin, groundRayDir);
  groundRaycaster.far = 80;
  const hits = groundRaycaster.intersectObject(ground, true);
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    if (h.object?.userData?.isWaterSurface) continue;
    if (Number.isFinite(h.point?.y)) return h.point.y;
  }
  return analyticY;
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
  clampPointToPlayableRadius(markerTarget, playerCollisionRadius + 0.14);
  pushPointOutsideObstacles(markerTarget, playerCollisionRadius + 0.14);
  moveTarget.copy(point);
  clampPointToPlayableRadius(moveTarget, playerCollisionRadius + 0.14);
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

/* ═══════════════════════════════════════════
   Volcano Cave — dungeon instance
   ═══════════════════════════════════════════ */
const caveObjects = [];
const savedOverworldPos = new THREE.Vector3();

function buildVolcanoCave() {
  const caveGroup = new THREE.Group();
  caveGroup.name = "volcano_cave";

  /* Floor — TzHaar-style reddish-brown volcanic rock with vertex color variation */
  const floorRes = 80;
  const floorGeo = new THREE.PlaneGeometry(60, 60, floorRes, floorRes);
  const floorColors = new Float32Array(floorGeo.attributes.position.count * 3);
  const cFloorBase = new THREE.Color("#7a4530");
  const cFloorDark = new THREE.Color("#5a3018");
  const cFloorLava = new THREE.Color("#ff5500");
  const cFloorGlow = new THREE.Color("#ff8833");
  for (let i = 0; i < floorGeo.attributes.position.count; i++) {
    const fx = floorGeo.attributes.position.getX(i);
    const fz = floorGeo.attributes.position.getY(i);
    const noise = Math.sin(fx * 0.4 + fz * 0.3) * 0.5 + Math.cos(fx * 0.7 - fz * 0.5) * 0.3;
    /* lava veins — multiple overlapping crack patterns */
    const v1 = Math.abs(Math.sin(fx * 0.6 + fz * 1.1));
    const v2 = Math.abs(Math.sin(fx * 1.3 - fz * 0.4 + 2.0));
    const v3 = Math.abs(Math.sin((fx + fz) * 0.9 + 1.5));
    const vein = Math.max(0, Math.min(v1, v2) + v3 * 0.3 - 0.65) * 3.0;
    const t = noise * 0.4 + 0.3;
    const c = cFloorBase.clone().lerp(cFloorDark, t);
    if (vein > 0) c.lerp(cFloorLava, Math.min(vein, 1.0));
    if (vein > 0.5) c.lerp(cFloorGlow, (vein - 0.5) * 0.8);
    floorColors[i * 3] = c.r;
    floorColors[i * 3 + 1] = c.g;
    floorColors[i * 3 + 2] = c.b;
  }
  floorGeo.setAttribute("color", new THREE.BufferAttribute(floorColors, 3));
  const floorMat = new THREE.MeshToonMaterial({ vertexColors: true, flatShading: true });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  caveGroup.add(floor);

  /* Lava pools — glowing orange-red */
  const lavaMat = new THREE.MeshBasicMaterial({
    color: "#ff5500",
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const lavaPositions = [
    [8, 6, 4], [-10, 8, 3.5], [5, -9, 3], [-6, -5, 4], [14, -3, 2.5],
    [-16, -8, 2], [12, 12, 3], [-4, 14, 2.5],
  ];
  for (const [lx, lz, lr] of lavaPositions) {
    const pool = new THREE.Mesh(new THREE.CircleGeometry(lr, 20), lavaMat.clone());
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(lx, 0.02, lz);
    pool.renderOrder = 2;
    caveGroup.add(pool);
    /* glow ring around each lava pool */
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(lr, lr + 0.8, 20),
      new THREE.MeshBasicMaterial({ color: "#ff6622", transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(lx, 0.03, lz);
    ring.renderOrder = 3;
    caveGroup.add(ring);
  }

  /* Stalagmites — warm volcanic rock */
  const stalMat = new THREE.MeshToonMaterial({ color: "#7a4530" });
  for (let i = 0; i < 25; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 18;
    const sx = Math.cos(angle) * dist;
    const sz = Math.sin(angle) * dist;
    const h = 1.5 + Math.random() * 3;
    const r = 0.3 + Math.random() * 0.5;
    const stal = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), stalMat);
    stal.position.set(sx, h / 2, sz);
    caveGroup.add(stal);
  }

  /* Stalactites (hanging from ceiling) */
  const ceilMat = new THREE.MeshToonMaterial({ color: "#6a3a22" });
  for (let i = 0; i < 20; i++) {
    const cx = (Math.random() - 0.5) * 40;
    const cz = (Math.random() - 0.5) * 40;
    const ch = 1 + Math.random() * 2;
    const cr = 0.2 + Math.random() * 0.3;
    const stl = new THREE.Mesh(new THREE.ConeGeometry(cr, ch, 5), ceilMat);
    stl.position.set(cx, 10 - ch / 2, cz);
    stl.rotation.x = Math.PI;
    caveGroup.add(stl);
  }

  /* Ceiling — higher up, warm tone */
  const ceilGeo = new THREE.PlaneGeometry(60, 60);
  const ceilFloor = new THREE.Mesh(ceilGeo, new THREE.MeshToonMaterial({ color: "#5a3018", side: THREE.BackSide }));
  ceilFloor.rotation.x = -Math.PI / 2;
  ceilFloor.position.y = 12;
  caveGroup.add(ceilFloor);

  /* Walls — ring of warm volcanic rock */
  const wallGeo = new THREE.CylinderGeometry(28, 30, 12, 24, 1, true);
  const wallMat = new THREE.MeshToonMaterial({ color: "#6a3820", side: THREE.BackSide });
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.position.y = 6;
  caveGroup.add(walls);

  /* Glowing crystals */
  const crystalColors = ["#ff6622", "#ffaa00", "#ff4400", "#ff8844"];
  for (let i = 0; i < 12; i++) {
    const ca = (i / 12) * Math.PI * 2;
    const cd = 22 + Math.random() * 5;
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4 + Math.random() * 0.3, 0),
      new THREE.MeshBasicMaterial({
        color: crystalColors[i % crystalColors.length],
        transparent: true,
        opacity: 0.8,
      })
    );
    crystal.position.set(Math.cos(ca) * cd, 0.5 + Math.random() * 1.5, Math.sin(ca) * cd);
    crystal.rotation.set(Math.random(), Math.random(), Math.random());
    caveGroup.add(crystal);
  }

  /* Exit portal — to go back */
  const portalGeo = new THREE.TorusGeometry(1.2, 0.15, 8, 24);
  const portalMat = new THREE.MeshBasicMaterial({ color: "#44aaff", transparent: true, opacity: 0.7 });
  const portal = new THREE.Mesh(portalGeo, portalMat);
  portal.position.set(0, 1.5, -20);
  portal.userData.serviceType = "cave_exit";
  portal.userData.resourceLabel = "Exit Portal";
  caveGroup.add(portal);

  /* Bright warm lighting — TzHaar style */
  const lavaLight = new THREE.PointLight("#ff7733", 6, 60);
  lavaLight.position.set(0, 6, 0);
  caveGroup.add(lavaLight);

  /* Secondary lava lights for even illumination */
  const light2 = new THREE.PointLight("#ff5500", 4, 45);
  light2.position.set(15, 5, 10);
  caveGroup.add(light2);
  const light3 = new THREE.PointLight("#ff6600", 4, 45);
  light3.position.set(-12, 5, -8);
  caveGroup.add(light3);
  const light4 = new THREE.PointLight("#ff5500", 3, 40);
  light4.position.set(-5, 5, 15);
  caveGroup.add(light4);
  const light5 = new THREE.PointLight("#ff4400", 3, 40);
  light5.position.set(10, 5, -12);
  caveGroup.add(light5);

  const ambientLight = new THREE.AmbientLight("#aa6633", 2.0);
  caveGroup.add(ambientLight);

  return { group: caveGroup, floor, portal, lavaPositions, lavaLight };
}

function enterCave() {
  if (inCave) return;
  inCave = true;
  savedOverworldPos.copy(player.position);

  /* Hide overworld */
  scene.traverse(child => {
    if (child === scene || child === camera) return;
    if (!child._caveObject) child._overworldVisible = child.visible;
  });
  for (const child of [...scene.children]) {
    if (child === camera || child._caveObject) continue;
    child.visible = false;
  }

  /* Build & add cave */
  const cave = buildVolcanoCave();
  cave.group._caveObject = true;
  cave.group.traverse(c => { c._caveObject = true; });
  scene.add(cave.group);
  caveObjects.push(cave);

  /* cave floor is flat y=0, handled by getPlayerGroundY */

  /* Position player at cave entrance */
  player.position.set(0, playerFootOffset, 18);
  player.visible = true;
  player._caveObject = true;
  playerBlob.visible = true;
  playerBlob._caveObject = true;
  marker._caveObject = true;

  /* Add exit portal to interactables */
  resourceNodes.push(cave.portal);

  hasMoveTarget = false;
  marker.visible = false;
  pendingResource = null;
  pendingService = null;
  activeGather = null;
  activeAttack = null;

  /* Adjust camera */
  cameraFocus.set(player.position.x, player.position.y + 0.4, player.position.z);
  controls.target.copy(cameraFocus);
  camera.position.set(player.position.x, player.position.y + 8, player.position.z + 14);

  /* Adjust fog for warm volcanic atmosphere — keep it light */
  if (scene.fog) {
    scene.fog.color.set("#5a2a10");
    scene.fog.near = 25;
    scene.fog.far = 65;
  }

  ui?.setStatus("You enter the Volcano Cave... heat rises from the lava below.", "info");
}

function exitCave() {
  if (!inCave) return;
  inCave = false;

  /* Remove cave portal from interactables */
  for (const cave of caveObjects) {
    const idx = resourceNodes.indexOf(cave.portal);
    if (idx >= 0) resourceNodes.splice(idx, 1);
  }

  /* Remove cave objects */
  for (const cave of caveObjects) {
    scene.remove(cave.group);
    cave.group.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    });
  }
  caveObjects.length = 0;

  /* Restore overworld */
  scene.traverse(child => {
    if (child._overworldVisible !== undefined) {
      child.visible = child._overworldVisible;
      delete child._overworldVisible;
    }
  });
  delete player._caveObject;
  delete playerBlob._caveObject;

  /* Restore player position */
  player.position.copy(savedOverworldPos);
  player.position.y = getPlayerStandY(player.position.x, player.position.z);

  /* Restore fog */
  if (scene.fog) {
    scene.fog.color.set("#95b57a");
    scene.fog.near = 620;
    scene.fog.far = 1650;
  }

  hasMoveTarget = false;
  marker.visible = false;
  ui?.setStatus("You emerge from the Volcano Cave.", "info");
}

function runServiceAction(node) {
  const serviceType = node.userData.serviceType;
  if (!serviceType) return;

  if (serviceType === "cave") {
    enterCave();
    return;
  }

  if (serviceType === "cave_exit") {
    exitCave();
    return;
  }

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
  const dummyPos = combatPos;
  node.getWorldPosition(dummyPos);
  const dx = dummyPos.x - player.position.x;
  const dz = dummyPos.z - player.position.z;
  const yaw = Math.atan2(dx, dz);
  player.rotation.y = yaw;
  combatEffects.attack(combatStyle, player.position, yaw, 0.5, dummyPos);
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
    const dummyPos = interactPos;
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

  const clickTone = CLICK_TONE_BY_RESOURCE[resourceType] || "neutral";
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
  node.getWorldPosition(hoverPos);
  const pos = hoverPos;
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
  const serviceColor = "#ffffff";
  const col = node.userData?.resourceType ? (HOVER_COLOR_BY_RESOURCE[node.userData.resourceType] || "#ffffff") : serviceColor;
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

/* ── Debug overlay + settings ── */
const debugOverlay = document.getElementById("debug-overlay");
const debugSettings = { fps: false, memory: false, drawcalls: false, position: false };
let _fpsFrames = 0, _fpsLast = performance.now(), _fpsValue = 0;

function updateDebugOverlay() {
  /* FPS counter */
  _fpsFrames++;
  const now = performance.now();
  if (now - _fpsLast >= 500) {
    _fpsValue = Math.round(_fpsFrames / ((now - _fpsLast) / 1000));
    _fpsFrames = 0;
    _fpsLast = now;
  }

  const lines = [];
  if (debugSettings.fps) lines.push(`FPS: ${_fpsValue}`);
  if (debugSettings.memory && performance.memory) {
    const mb = (performance.memory.usedJSHeapSize / 1048576).toFixed(1);
    const total = (performance.memory.totalJSHeapSize / 1048576).toFixed(1);
    lines.push(`MEM: ${mb} / ${total} MB`);
  } else if (debugSettings.memory) {
    lines.push("MEM: N/A");
  }
  if (debugSettings.drawcalls) {
    const info = renderer.info.render;
    lines.push(`Draw: ${info.calls}  Tri: ${info.triangles}`);
  }
  if (debugSettings.position) {
    lines.push(`Pos: ${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}`);
  }

  if (lines.length) {
    debugOverlay.style.display = "block";
    debugOverlay.textContent = lines.join("\n");
  } else {
    debugOverlay.style.display = "none";
  }
}

/* wire up settings checkboxes */
for (const key of ["fps", "memory", "drawcalls", "position"]) {
  const el = document.getElementById(`setting-${key}`);
  if (el) el.addEventListener("change", () => { debugSettings[key] = el.checked; });
}
/* render scale */
const dprSelect = document.getElementById("setting-dpr");
if (dprSelect) {
  dprSelect.value = String(Math.min(renderer.getPixelRatio(), 2));
  dprSelect.addEventListener("change", () => {
    const dpr = parseFloat(dprSelect.value);
    renderer.setPixelRatio(dpr);
    const w = renderer.domElement.parentElement.clientWidth;
    const h = renderer.domElement.parentElement.clientHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
  });
}
/* FPS cap */
let fpsCap = 60;
let lastFrameTime = 0;
const fpsCapSelect = document.getElementById("setting-fps-cap");
if (fpsCapSelect) {
  fpsCapSelect.addEventListener("change", () => { fpsCap = parseInt(fpsCapSelect.value) || 0; });
}
/* bloom toggle */
const bloomCheck = document.getElementById("setting-bloom");
if (bloomCheck && composer.passes) {
  /* start with bloom disabled */
  for (const pass of composer.passes) {
    if (pass.constructor.name === "UnrealBloomPass") pass.enabled = false;
  }
  bloomCheck.addEventListener("change", () => {
    for (const pass of composer.passes) {
      if (pass.constructor.name === "UnrealBloomPass") pass.enabled = bloomCheck.checked;
    }
  });
}
/* name input */
const nameInput = document.getElementById("setting-name");
if (nameInput) {
  nameInput.value = onlineConfig.name;
  const applyName = () => {
    const v = nameInput.value.trim();
    if (v && netClient) { onlineConfig.name = v; netClient.updateProfile({ name: v }); }
  };
  nameInput.addEventListener("change", applyName);
  nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { nameInput.blur(); } });
}
/* connection status */
const connStatus = document.getElementById("setting-connection");
let _lastConnState = null;
function updateConnStatus() {
  if (!connStatus) return;
  const on = netClient && netClient.isConnected();
  if (on === _lastConnState) return;
  _lastConnState = on;
  connStatus.textContent = on ? "Online" : "Offline";
  connStatus.className = "ui-conn-status " + (on ? "connected" : "disconnected");
}

function animate(now) {
  requestAnimationFrame(animate);
  if (fpsCap > 0) {
    const minInterval = 1000 / fpsCap;
    if (now - lastFrameTime < minInterval) return;
    lastFrameTime = now - ((now - lastFrameTime) % minInterval);
  }
  const dt = Math.min(0.033, clock.getDelta());
  const t = clock.elapsedTime;
  waterUniforms.uTime.value += dt;
  if (causticMap) { causticMap.offset.x = t * 0.0034; causticMap.offset.y = -t * 0.0026; }
  skyMat.uniforms.uTime.value = t;
  updateWorld?.(t, player.position.x, player.position.z);

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

  // Clamp player to playable area
  const maxR = inCave ? 26 : PLAYABLE_RADIUS;
  const playerR = Math.hypot(player.position.x, player.position.z);
  if (playerR > maxR) {
    const scale = maxR / playerR;
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
    const atkDummyPos = combatPos;
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
  updateNameTags();
  updateOverheadIcons();
  updateFloatingDrops(dt);
  combatEffects.update(dt);
  updateSlimeTrail(dt, t, isMovingNow);
  remotePlayers.update(dt);

  // Animate hover indicator
  if (hoverIndicator.visible && hoveredNode) {
    hoveredNode.getWorldPosition(hoverPos);
    const pos = hoverPos;
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
    attacking: !!activeAttack,
    combatStyle,
    tool: equippedTool,
    overhead: getActiveOverhead() || "",
  });

  composer.render();
  updateDebugOverlay();
  updateConnStatus();
}

requestAnimationFrame(animate);

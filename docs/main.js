import * as THREE from "three";
import { createSceneContext } from "./game/scene.js";
import { createWorld, getWorldSurfaceHeight, getWaterSurfaceHeight, CHUNK_SIZE, createCampfire } from "./game/world.js";
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
  ANIMAL_DAMAGE,
  POTION_SHOP,
  CAMPFIRE_LOG_COST,
  COOKING_RECIPES,
  EQUIPMENT_ITEMS,
  EQUIPMENT_RECIPES,
  EQUIPMENT_TIERS,
  MONSTER_EQUIPMENT_DROPS,
  STAR_MAX,
  STAR_COSTS,
  STAR_SUCCESS,
  STAR_DESTROY,
  STAR_DOWNGRADE,
  STAR_TIMING_BONUS,
  STAR_ATK_PER,
  STAR_DEF_PER,
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
  cooking: { xp: 0, level: 1 },
};
const inCave = false; /* cave system removed */
const activePrayers = new Set();
const wornEquipment = { body: null, cape: null, ring: null, amulet: null, shield: null, bow: null, staff: null, sword: null };
const wornStars = { body: 0, cape: 0, ring: 0, amulet: 0, shield: 0, bow: 0, staff: 0, sword: 0 };

/* ground raycaster (declared early — needed by remotePlayers.getGroundY before full init) */
const groundRaycaster = new THREE.Raycaster();
const groundRayOrigin = new THREE.Vector3();
const groundRayDir = new THREE.Vector3(0, -1, 0);

/* ── Player HP ── */
let playerHp = 100;
const playerMaxHp = 100;
const hpBarEl = document.getElementById("ui-hp-bar");
const deathOverlay = (() => {
  let el = document.getElementById("death-overlay");
  if (!el) { el = document.createElement("div"); el.id = "death-overlay"; document.body.appendChild(el); }
  return el;
})();

function damagePlayer(amount) {
  if (playerHp <= 0) return;
  const defBonus = getEquipmentDefenseBonus();
  const reduced = Math.max(1, amount - Math.floor(defBonus * 0.15));
  playerHp = Math.max(0, playerHp - reduced);
  ui?.setHp(playerHp, playerMaxHp);
  /* flash HP bar */
  if (hpBarEl) { hpBarEl.classList.remove("damage-flash"); void hpBarEl.offsetWidth; hpBarEl.classList.add("damage-flash"); }
  /* floating damage on player */
  spawnFloatingDrop(player.position.x, player.position.z, `-${reduced}`, "warn");
  if (playerHp <= 0) playerDeath();
}

function playerDeath() {
  /* red flash overlay */
  deathOverlay.classList.add("active");
  setTimeout(() => deathOverlay.classList.remove("active"), 800);
  /* respawn at village */
  player.position.set(0, 0, -32);
  playerHp = playerMaxHp;
  ui?.setHp(playerHp, playerMaxHp);
  /* clear combat state */
  activeAttack = null;
  pendingService = null;
  hasMoveTarget = false;
  /* de-aggro all animals */
  for (const a of animals) { a.aggro = false; a.aggroTarget = null; a.lastHitTime = 0; }
  ui?.setStatus("You died! Respawned at village.", "warn");
}

/* ── Animals ── */
const ANIMAL_HP = { Cow: 50, Horse: 60, Llama: 40, Pig: 30, Pug: 20, Sheep: 35, Zebra: 70 };
const ANIMAL_LOOT = {
  Cow: "Raw Beef", Horse: "Horse Hide", Llama: "Llama Wool",
  Pig: "Raw Pork", Pug: "Bone", Sheep: "Wool", Zebra: "Striped Hide",
};
const animals = [];  // { node, hp, maxHp, spawnPos, alive, wanderTimer, wanderTarget, hpBar, hpFill, respawnTimer, parentModel }

function registerAnimal(hsNode, parentModel) {
  const type = parentModel.userData.animalType || "Cow";
  const maxHp = ANIMAL_HP[type] || 10;
  /* use local position directly — map_objects group is always at origin */
  const spawnPos = parentModel.position.clone();

  const hpBar = document.createElement("div");
  hpBar.className = "animal-hp-bar";
  hpBar.dataset.state = "hidden";
  const hpFill = document.createElement("div");
  hpFill.className = "animal-hp-fill";
  hpBar.appendChild(hpFill);
  getBubbleLayer().appendChild(hpBar);

  animals.push({
    node: hsNode, parentModel, type, hp: maxHp, maxHp,
    spawnPos, alive: true,
    wanderTimer: 1 + Math.random() * 3,
    wanderTarget: null, hpBar, hpFill, respawnTimer: 0,
    origScale: parentModel.scale.x,
    aggro: false, aggroTarget: null, lastHitTime: 0, attackCooldown: 0,
  });
  console.log(`Registered animal: ${type} at pos(${spawnPos.x.toFixed(1)}, ${spawnPos.y.toFixed(1)}, ${spawnPos.z.toFixed(1)}) modelPos(${parentModel.position.x.toFixed(1)}, ${parentModel.position.z.toFixed(1)})`);
}

/* ── Audio context (declared early so saveGame/loadGame can reference volume) ── */
const _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let _masterVolume = 0.5;
const _masterGain = _audioCtx.createGain();
_masterGain.gain.value = _masterVolume;
_masterGain.connect(_audioCtx.destination);

/* Separate gain for music — connects to destination directly, not through _masterGain */
const _musicGain = _audioCtx.createGain();
_musicGain.gain.value = 0.35;
_musicGain.connect(_audioCtx.destination);
let _bgmElement = null;
let _bgmSource = null;
let _musicMuted = false;

function setVolume(v) {
  _masterVolume = Math.max(0, Math.min(1, v));
  _masterGain.gain.value = _masterVolume;
}

function initBGM() {
  if (_bgmElement) return;
  _bgmElement = new Audio("./sounds/churpa1_5.mp3");
  _bgmElement.loop = true;
  _bgmElement.crossOrigin = "anonymous";
  _bgmSource = _audioCtx.createMediaElementSource(_bgmElement);
  _bgmSource.connect(_musicGain);
  _bgmElement.play().catch(() => {
    /* retry on next click if autoplay blocked */
    const retry = () => {
      _bgmElement.play().catch(() => {});
      window.removeEventListener("pointerdown", retry);
    };
    window.addEventListener("pointerdown", retry);
  });
}


/* ── Save / Load system ── */
const SAVE_KEY = "skilling_save";
const SAVE_INTERVAL = 15_000; // auto-save every 15s
let _lastSaveTime = 0;

function saveGame() {
  try {
    const data = {
      coins,
      skills: {},
      toolUpgrades: { ...toolUpgrades },
      equippedTool,
      combatStyle,
      currentSlimeColorId,
      unlockedSlimeColors: [...unlockedSlimeColors],
      wornEquipment: { ...wornEquipment },
      wornStars: { ...wornStars },
      bag: bagSystem.serialize(),
      constructionStock: constructionProgress.getStock(),
      px: player.position.x,
      pz: player.position.z,
      volume: _masterVolume,
      musicVolume: _musicGain.gain.value,
      v: 1,
    };
    for (const [k, s] of Object.entries(skills)) data.skills[k] = { xp: s.xp, level: s.level };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* quota / private browsing */ }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.coins != null) coins = d.coins;
    if (d.skills) for (const [k, s] of Object.entries(d.skills)) {
      if (skills[k]) { skills[k].xp = s.xp || 0; skills[k].level = s.level || 1; }
    }
    if (d.toolUpgrades) Object.assign(toolUpgrades, d.toolUpgrades);
    if (d.equippedTool) equippedTool = d.equippedTool;
    if (d.combatStyle) combatStyle = d.combatStyle;
    if (d.currentSlimeColorId) currentSlimeColorId = d.currentSlimeColorId;
    if (d.unlockedSlimeColors) { unlockedSlimeColors.clear(); for (const c of d.unlockedSlimeColors) unlockedSlimeColors.add(c); }
    if (d.wornEquipment) {
      for (const slot of Object.keys(wornEquipment)) {
        wornEquipment[slot] = d.wornEquipment[slot] || null;
      }
    }
    if (d.wornStars) {
      for (const slot of Object.keys(wornStars)) {
        wornStars[slot] = d.wornStars[slot] || 0;
      }
    }
    if (d.bag) bagSystem.deserialize(d.bag);
    if (d.constructionStock) constructionProgress.deposit(d.constructionStock);
    if (d.px != null) { player.position.x = d.px; player.position.z = d.pz; }
    if (d.volume != null) { setVolume(d.volume); }
    if (d.musicVolume != null) { _musicGain.gain.value = d.musicVolume; _musicMuted = d.musicVolume === 0; }
  } catch (e) { console.warn("Load save failed:", e); }
}

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
      const _ps = pendingService?.userData?.serviceType;
      if (_ps === "dummy" || _ps === "animal") pendingService = null;
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
  onBuyPotion: (potionId) => {
    const pot = POTION_SHOP.find(p => p.id === potionId);
    if (!pot) return;
    if (coins < pot.cost) { ui?.setStatus(`Need ${pot.cost} coins!`, "warn"); return; }
    if (bagSystem.isFull()) { ui?.setStatus("Bag is full!", "warn"); return; }
    coins -= pot.cost;
    bagSystem.addItem(pot.item);
    syncInventoryUI();
    ui?.setStatus(`Bought ${pot.label}!`, "success");
    saveGame();
  },
  onUseItem: (itemType, slotIndex) => {
    if (itemType === "Health Potion") {
      if (playerHp >= playerMaxHp) { ui?.setStatus("Already full HP!", "info"); return; }
      bagSystem.slots[slotIndex] = null;
      bagSystem.recount();
      playerHp = Math.min(playerMaxHp, playerHp + 40);
      ui?.setHp(playerHp, playerMaxHp);
      syncInventoryUI();
      spawnFloatingDrop(player.position.x, player.position.z, "+40 HP", "item");
      ui?.setStatus("Used Health Potion! +40 HP", "success");
    } else if (itemType === "Mana Potion") {
      bagSystem.slots[slotIndex] = null;
      bagSystem.recount();
      syncInventoryUI();
      spawnFloatingDrop(player.position.x, player.position.z, "+30 Mana", "item");
      ui?.setStatus("Used Mana Potion! (no effect yet)", "info");
    } else if (itemType === "logs") {
      placeCampfire();
    }
  },
  onVolumeChange: (v) => {
    setVolume(v);
    saveGame();
  },
  onMusicChange: (v) => {
    _musicGain.gain.value = v;
    _musicMuted = v === 0;
    saveGame();
  },
  onEquipFromBag: (slotIndex) => {
    equipItem(slotIndex);
  },
  onUnequipSlot: (slotName) => {
    unequipItem(slotName);
  },
  onCraftEquipment: (itemId) => {
    craftEquipment(itemId);
  },
  onStarEnhance: (slot, timingBonus) => {
    starEnhanceSlot(slot, timingBonus);
  },
  onStarTimingStop: () => {
    playStarTimingClick();
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

/* ── Equipment helpers ── */
function getCombatLevel() {
  return Math.max(skills.melee.level, skills.bow.level, skills.mage.level);
}

function getEquipmentAttackBonus() {
  let total = 0;
  for (const [slot, itemId] of Object.entries(wornEquipment)) {
    if (!itemId || !EQUIPMENT_ITEMS[itemId]) continue;
    total += EQUIPMENT_ITEMS[itemId].atk;
    const stars = wornStars[slot] || 0;
    for (let i = 0; i < stars; i++) total += (STAR_ATK_PER[i] || 0);
  }
  return total;
}

function getEquipmentDefenseBonus() {
  let total = 0;
  for (const [slot, itemId] of Object.entries(wornEquipment)) {
    if (!itemId || !EQUIPMENT_ITEMS[itemId]) continue;
    total += EQUIPMENT_ITEMS[itemId].def;
    const stars = wornStars[slot] || 0;
    for (let i = 0; i < stars; i++) total += (STAR_DEF_PER[i] || 0);
  }
  return total;
}

function equipItem(bagSlotIndex) {
  const itemId = bagSlots[bagSlotIndex];
  if (!itemId || !EQUIPMENT_ITEMS[itemId]) return;
  const item = EQUIPMENT_ITEMS[itemId];
  const combatLvl = getCombatLevel();
  if (combatLvl < item.level) {
    ui?.setStatus(`Need combat level ${item.level} to equip ${item.label}!`, "warn");
    return;
  }
  const slotName = item.slot;
  const currentlyWorn = wornEquipment[slotName];
  // Remove from bag
  bagSlots[bagSlotIndex] = null;
  // If something is already equipped, put it in the bag slot we just freed
  if (currentlyWorn) {
    bagSlots[bagSlotIndex] = currentlyWorn;
  }
  wornEquipment[slotName] = itemId;
  wornStars[slotName] = 0;
  bagSystem.recount();
  syncInventoryUI();
  syncWornUI();
  ui?.setStatus(`Equipped ${item.label}!`, "success");
  saveGame();
}

function unequipItem(slotName) {
  const itemId = wornEquipment[slotName];
  if (!itemId) return;
  if (bagSystem.isFull()) {
    ui?.setStatus("Bag is full! Can't unequip.", "warn");
    return;
  }
  wornEquipment[slotName] = null;
  wornStars[slotName] = 0;
  bagSystem.addItem(itemId);
  syncInventoryUI();
  syncWornUI();
  const item = EQUIPMENT_ITEMS[itemId];
  ui?.setStatus(`Unequipped ${item ? item.label : itemId}.`, "info");
  saveGame();
}

function craftEquipment(itemId) {
  const recipe = EQUIPMENT_RECIPES[itemId];
  const item = EQUIPMENT_ITEMS[itemId];
  if (!recipe || !item) return;
  const combatLvl = getCombatLevel();
  if (combatLvl < recipe.level) {
    ui?.setStatus(`Need combat level ${recipe.level} to craft ${item.label}!`, "warn");
    return;
  }
  // Check materials
  for (const [matKey, matQty] of Object.entries(recipe.materials)) {
    if ((inventory[matKey] || 0) < matQty) {
      ui?.setStatus(`Not enough materials for ${item.label}!`, "warn");
      return;
    }
  }
  if (bagSystem.isFull()) {
    ui?.setStatus("Bag is full!", "warn");
    return;
  }
  // Consume materials
  for (const [matKey, matQty] of Object.entries(recipe.materials)) {
    bagSystem.removeItems(matKey, matQty);
  }
  bagSystem.addItem(itemId);
  syncInventoryUI();
  syncWornUI();
  spawnFloatingDrop(player.position.x, player.position.z, `+1 ${item.label}`, "item");
  ui?.setStatus(`Crafted ${item.label}!`, "success");
  saveGame();
}

function syncWornUI() {
  ui?.setWorn({ slots: { ...wornEquipment }, stars: { ...wornStars } });
  ui?.setWornSkins?.({ unlocked: [...unlockedSlimeColors], selected: currentSlimeColorId });
  ui?.setBlacksmithCrafting({
    bagCounts: { ...inventory },
    combatLevel: getCombatLevel(),
  });
}

function starEnhanceSlot(slot, timingBonus) {
  const itemId = wornEquipment[slot];
  if (!itemId) return;
  const currentStars = wornStars[slot] || 0;
  if (currentStars >= STAR_MAX) {
    ui?.showStarResult("maxed", currentStars);
    return;
  }
  const cost = STAR_COSTS[currentStars];
  if (coins < cost) {
    ui?.showStarResult("broke", currentStars);
    return;
  }
  coins -= cost;
  const baseChance = STAR_SUCCESS[currentStars];
  const totalChance = Math.min(99, baseChance + timingBonus);
  const destroyChance = STAR_DESTROY[currentStars];
  const roll = Math.random() * 100;
  if (roll < totalChance) {
    // Success!
    wornStars[slot] = currentStars + 1;
    syncInventoryUI();
    syncWornUI();
    spawnFloatingDrop(player.position.x, player.position.z, `\u2605 ${wornStars[slot]} stars!`, "level");
    playStarSuccess(wornStars[slot]);
    ui?.showStarResult("success", wornStars[slot]);
  } else if (roll < totalChance + destroyChance) {
    // Destroyed!
    wornEquipment[slot] = null;
    wornStars[slot] = 0;
    syncInventoryUI();
    syncWornUI();
    spawnFloatingDrop(player.position.x, player.position.z, "DESTROYED!", "warn");
    playStarDestroy();
    ui?.showStarResult("destroy", 0);
  } else {
    // Failed — check for downgrade (stars 7+ can lose a star)
    const downgradeChance = STAR_DOWNGRADE[currentStars] || 0;
    if (downgradeChance > 0 && Math.random() * 100 < downgradeChance && currentStars > 0) {
      wornStars[slot] = currentStars - 1;
      syncInventoryUI();
      syncWornUI();
      playStarFail();
      spawnFloatingDrop(player.position.x, player.position.z, `\u2605 ${wornStars[slot]} stars...`, "warn");
      ui?.showStarResult("downgrade", wornStars[slot]);
    } else {
      syncInventoryUI();
      syncWornUI();
      playStarFail();
      ui?.showStarResult("fail", currentStars);
    }
  }
  saveGame();
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
  ui?.setBlacksmithCrafting({ bagCounts: { ...inventory }, combatLevel: getCombatLevel() });
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
    cooking: skills.cooking.level,
    _progress: {
      fishing: getSkillProgress("fishing"),
      mining: getSkillProgress("mining"),
      woodcutting: getSkillProgress("woodcutting"),
      melee: getSkillProgress("melee"),
      bow: getSkillProgress("bow"),
      mage: getSkillProgress("mage"),
      cooking: getSkillProgress("cooking"),
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
      tag.lvlText.textContent = "";
      tag.level = "";
    }
  },
  onPeerLeave: (id) => {
    remotePlayers.removePeer(id);
    removeNameTag(id);
    removeOverheadIcon(id);
    removeRemoteCampfire(id);
    _peerWasJumping.delete(id);
    syncFriendsUI();
  },
  onPeerState: (msg) => {
    remotePlayers.applyState(msg.id, msg.state, { name: msg.name, color: msg.color });
    syncFriendsUI();
    if (msg.id && msg.name) {
      const tag = getOrCreateNameTag(msg.id);
      const peerLvl = msg.state?.totalLevel || 6;
      const peerLvlStr = `Lv ${peerLvl} · `;
      /* detect remote level-up — fireworks at their position */
      if (tag.level && tag.level !== peerLvlStr) {
        const anchor = remotePlayers.getEmoteAnchor(msg.id);
        if (anchor) {
          spawnFireworks(anchor.x, anchor.z);
          playLevelUpJingle();
        }
      }
      if (tag.level !== peerLvlStr) { tag.lvlText.textContent = peerLvlStr; tag.level = peerLvlStr; }
      if (tag.name !== msg.name) { tag.nameSpan.textContent = msg.name; tag.name = msg.name; }
    }
    if (msg.id && msg.state) {
      setRemoteOverhead(msg.id, msg.state.overhead || null);
      syncRemoteCampfire(msg.id, msg.state.campfireX, msg.state.campfireZ);
      /* directional jump land plop */
      const wasJumping = _peerWasJumping.get(msg.id) || false;
      const nowJumping = !!msg.state.jumping;
      _peerWasJumping.set(msg.id, nowJumping);
      if (wasJumping && !nowJumping && msg.state.x != null) {
        const dx = msg.state.x - player.position.x;
        const dz = msg.state.z - player.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 30) {
          const vol = Math.max(0.05, 1 - dist / 30);
          playJumpLandSound(vol);
        }
      }
    }
  },
  onPeerEmote: (msg) => {
    showEmote(msg.emoji, {
      key: `peer:${msg.id}`,
      anchor: (out) => remotePlayers.getEmoteAnchor(msg.id, out),
      duration: 2.8,
    });
  },
  onServerMessage: (msg) => {
    console.log("[admin broadcast]", msg);
    showAnnouncement(msg.text || "");
  },
});

if (netClient.isEnabled) {
  netClient.connect();
} else {
  syncFriendsUI();
}
window.addEventListener("beforeunload", () => {
  saveGame();
  netClient.disconnect();
});

/* restore saved progress */
loadGame();
equipTool(equippedTool, false);
setSlimeColor(getCurrentSlimeColorHex());
syncInventoryUI();
syncWornUI();
syncHouseBuildVisual();
syncSkillsUI();
ui?.setHp(playerHp, playerMaxHp);
ui?.setVolumeSlider?.(_masterVolume);
ui?.setMusicSlider?.(_musicGain.gain.value);

/* Start BGM on first user gesture (browsers block autoplay) */
function _startBGMOnce() {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  initBGM();
  window.removeEventListener("pointerdown", _startBGMOnce);
  window.removeEventListener("keydown", _startBGMOnce);
}
window.addEventListener("pointerdown", _startBGMOnce);
window.addEventListener("keydown", _startBGMOnce);

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

// ── Admin announcements ──
function showAnnouncement(text) {
  if (!text) return;
  const el = document.createElement("div");
  el.className = "server-announcement";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add("fade-out"); }, 5000);
  setTimeout(() => { el.remove(); }, 6000);
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

  const FLAG_HTML = {
    USA: '<span class="flag-usa"><svg viewBox="0 0 26 18" style="position:absolute;top:0;left:0;width:100%;height:100%"><g fill="#fff" opacity="0.9"><circle cx="2" cy="2" r=".6"/><circle cx="4.5" cy="2" r=".6"/><circle cx="7" cy="2" r=".6"/><circle cx="9.5" cy="2" r=".6"/><circle cx="3.2" cy="3.5" r=".6"/><circle cx="5.8" cy="3.5" r=".6"/><circle cx="8.3" cy="3.5" r=".6"/><circle cx="2" cy="5" r=".6"/><circle cx="4.5" cy="5" r=".6"/><circle cx="7" cy="5" r=".6"/><circle cx="9.5" cy="5" r=".6"/><circle cx="3.2" cy="6.5" r=".6"/><circle cx="5.8" cy="6.5" r=".6"/><circle cx="8.3" cy="6.5" r=".6"/></g></svg></span>',
    UKR: '<span class="flag-ukr"></span>',
    ISR: '<span class="flag-isr"><svg viewBox="0 0 26 18" style="position:absolute;top:0;left:0;width:100%;height:100%"><polygon points="13,5 15.2,10 10.8,10" fill="none" stroke="#0038b8" stroke-width="0.8"/><polygon points="13,13 10.8,8 15.2,8" fill="none" stroke="#0038b8" stroke-width="0.8"/></svg></span>',
    POL: '<span class="flag-pol"></span>',
    TRANS: '<span class="flag-trans"></span>',
  };
  const el = document.createElement("div");
  el.className = "chat-bubble";
  const trimmed = emoji.trim();
  if (FLAG_HTML[trimmed]) {
    el.innerHTML = FLAG_HTML[trimmed];
  } else {
    el.textContent = trimmed;
  }
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
const nameTags = new Map(); // key -> { el, anchor, sx, sy }
const _tagProj = new THREE.Vector3();
const TAG_LERP = 0.25; // smoothing factor per frame (0-1, lower = smoother)

function getOrCreateNameTag(key) {
  let tag = nameTags.get(key);
  if (tag) return tag;
  const el = document.createElement("div");
  el.className = "nametag";
  const levelSpan = document.createElement("span");
  levelSpan.className = "nametag-level";
  const lvlText = document.createTextNode("");
  const nameSpan = document.createElement("span");
  nameSpan.className = "nametag-name";
  levelSpan.appendChild(lvlText);
  levelSpan.appendChild(nameSpan);
  el.appendChild(levelSpan);
  getBubbleLayer().appendChild(el);
  tag = { el, nameSpan, levelSpan, lvlText, name: "", level: "", sx: -1, sy: -1 };
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
  const lvlStr = `Lv ${totalLevel} · `;
  if (localTag.level !== lvlStr) { localTag.lvlText.textContent = lvlStr; localTag.level = lvlStr; }
  if (localTag.name !== localName) { localTag.nameSpan.textContent = localName; localTag.name = localName; }
  _tagProj.set(player.position.x, player.position.y + playerHeadOffset - 1.1, player.position.z);
  _tagProj.project(camera);
  const lxTarget = _tagProj.x * hw + hw;
  const lyTarget = -_tagProj.y * hh + hh;
  if (localTag.sx < 0) { localTag.sx = lxTarget; localTag.sy = lyTarget; }
  else { localTag.sx += (lxTarget - localTag.sx) * TAG_LERP; localTag.sy += (lyTarget - localTag.sy) * TAG_LERP; }
  localTag.el.style.transform = `translate(${localTag.sx.toFixed(1)}px, ${localTag.sy.toFixed(1)}px) translate(-50%, -50%)`;

  // Remote player tags — snap to position (no lerp lag)
  for (const [key, tag] of nameTags) {
    if (key === "local") continue;
    const anchor = remotePlayers.getEmoteAnchor(key, _tagProj);
    if (!anchor) { removeNameTag(key); continue; }
    anchor.y -= 1.3;
    anchor.project(camera);
    tag.sx = anchor.x * hw + hw;
    tag.sy = -anchor.y * hh + hh;
    tag.el.style.transform = `translate(${tag.sx.toFixed(1)}px, ${tag.sy.toFixed(1)}px) translate(-50%, -50%)`;
  }
}

/* ── Animal update (wander + HP bars + death/respawn) ── */
const _animalProj = new THREE.Vector3();
const _animalWanderDir = new THREE.Vector3();

function updateAnimals(dt) {
  const hw = renderer.domElement.clientWidth * 0.5;
  const hh = renderer.domElement.clientHeight * 0.5;
  const px = player.position.x, pz = player.position.z;
  const playerCX = Math.round(px / CHUNK_SIZE), playerCZ = Math.round(pz / CHUNK_SIZE);
  /* purge animals whose chunk was unloaded */
  for (let i = animals.length - 1; i >= 0; i--) {
    const a = animals[i];
    if (!a.parentModel.parent) {
      a.hpBar.remove();
      _registeredAnimalNodes.delete(a.node);
      animals.splice(i, 1);
    }
  }
  for (const a of animals) {
    /* only update animals in player's exact chunk */
    const acx = Math.round(a.spawnPos.x / CHUNK_SIZE), acz = Math.round(a.spawnPos.z / CHUNK_SIZE);
    if (acx !== playerCX || acz !== playerCZ) {
      a.parentModel.visible = false;
      a.parentModel.traverse(c => { c.visible = false; });
      a.hpBar.dataset.state = "hidden";
      continue;
    }
    a.parentModel.visible = true;
    a.parentModel.traverse(c => { c.visible = true; });
    if (!a.alive) {
      /* death shrink animation */
      if (a._deathAnim) {
        a._deathAnim.elapsed += dt;
        const t = Math.min(a._deathAnim.elapsed / a._deathAnim.duration, 1);
        a.parentModel.scale.setScalar(a.origScale * (1 - t));
        if (t >= 1) {
          a.parentModel.visible = false;
          a._deathAnim = null;
          /* remove from interactables */
          const idx = resourceNodes.indexOf(a.node);
          if (idx >= 0) resourceNodes.splice(idx, 1);
        }
      }
      /* respawn countdown */
      a.respawnTimer -= dt;
      if (a.respawnTimer <= 0) respawnAnimal(a);
      continue;
    }

    /* aggro chase + attack */
    if (a.aggro && a.aggroTarget) {
      const elapsed = clock.elapsedTime;
      const adx = px - a.parentModel.position.x;
      const adz = pz - a.parentModel.position.z;
      const adist = Math.sqrt(adx * adx + adz * adz);
      /* de-aggro: too far away or 8s without being hit */
      if (adist > 15 || (elapsed - a.lastHitTime) > 8) {
        a.aggro = false;
        a.aggroTarget = null;
        a.wanderTimer = 1 + Math.random() * 2;
      } else if (adist > 2.0) {
        /* chase player */
        const cnx = adx / adist, cnz = adz / adist;
        const chaseSpeed = 3.5;
        const cstep = Math.min(dt * chaseSpeed, adist - 1.8);
        a.parentModel.position.x += cnx * cstep;
        a.parentModel.position.z += cnz * cstep;
        a.parentModel.position.y = getPlayerGroundY(a.parentModel.position.x, a.parentModel.position.z);
        a.parentModel.rotation.y = Math.atan2(cnx, cnz);
      } else {
        /* in melee range — attack */
        a.parentModel.rotation.y = Math.atan2(adx, adz);
        a.attackCooldown -= dt;
        if (a.attackCooldown <= 0) {
          const dmgRange = ANIMAL_DAMAGE[a.type] || [1, 3];
          const dmg = Math.floor(Math.random() * (dmgRange[1] - dmgRange[0] + 1)) + dmgRange[0];
          damagePlayer(dmg);
          a.attackCooldown = 2.0;
        }
      }
    } else {
      /* idle wandering */
      a.wanderTimer -= dt;
      if (a.wanderTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 1.5 + Math.random() * 2.5;
        a.wanderTarget = new THREE.Vector3(
          a.spawnPos.x + Math.cos(angle) * dist,
          0,
          a.spawnPos.z + Math.sin(angle) * dist,
        );
        a.wanderTarget.y = getPlayerGroundY(a.wanderTarget.x, a.wanderTarget.z);
        a.wanderTimer = 2 + Math.random() * 3;
      }
      if (a.wanderTarget) {
        const wx = a.parentModel.position.x;
        const wz = a.parentModel.position.z;
        const ddx = a.wanderTarget.x - wx;
        const ddz = a.wanderTarget.z - wz;
        const dist = Math.sqrt(ddx * ddx + ddz * ddz);
        if (dist > 0.15) {
          const nx = ddx / dist, nz = ddz / dist;
          const step = Math.min(dt * 2.0, dist);
          a.parentModel.position.x += nx * step;
          a.parentModel.position.z += nz * step;
          a.parentModel.position.y = getPlayerGroundY(a.parentModel.position.x, a.parentModel.position.z);
          a.parentModel.rotation.y = Math.atan2(nx, nz);
        } else {
          a.wanderTarget = null;
        }
      }
    }
    /* subtle bob */
    a.parentModel.position.y += Math.sin(Date.now() * 0.003 + a.spawnPos.x * 7) * 0.01;

    /* update HP bar screen position */
    if (a.hpBar.dataset.state !== "hidden") {
      _animalProj.copy(a.parentModel.position);
      _animalProj.y += 1.6;
      _animalProj.project(camera);
      const sx = _animalProj.x * hw + hw;
      const sy = -_animalProj.y * hh + hh;
      a.hpBar.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`;
    }
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
  if (ui?.isBankOpen?.()) ui.closeBank();
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
    celebrateLevelUp(successPos.x, successPos.z);
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
    slots: [...bagSystem.slots],
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
    if (ui?.isBankOpen?.()) ui.setBank(getBankState());
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
    if (ui?.isBankOpen?.()) ui.setBank(getBankState());
    return;
  }
  const verb = direction === "deposit" ? "Deposited" : "Withdrew";
  ui?.setStatus(`${verb} ${moved} ${itemKey}.`, "success");
  /* refresh the bank overlay so slots update instantly */
  if (ui?.isBankOpen?.()) ui.setBank(getBankState());
  saveGame();
}

function sellBagViaStoreUI() {
  const { sold, coinsGained } = sellBagToStore();
  syncInventoryUI();
  if (sold <= 0) {
    ui?.setStatus("Store: nothing to sell from your bag.", "warn");
  } else {
    ui?.setStatus(`Sold ${sold} item${sold === 1 ? "" : "s"} for ${coinsGained} coins.`, "success");
  }
  saveGame();
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
  syncWornUI();
  ui?.setStatus(`Slime color equipped: ${entry.label}.`, "success");
  saveGame();
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
  saveGame();
}


/* ── Campfire + Cooking system ── */
let activeCampfire = null; // { group, timer, node }
let activeCook = null; // { elapsed, duration }
const remoteCampfires = new Map(); // peerId -> { group, light }
const _peerWasJumping = new Map(); // peerId -> bool (for jump land sound)

function syncRemoteCampfire(peerId, cfX, cfZ) {
  const existing = remoteCampfires.get(peerId);
  if (cfX != null && cfZ != null) {
    /* peer has campfire — spawn if not already there or if position changed */
    if (existing && Math.abs(existing.x - cfX) < 0.5 && Math.abs(existing.z - cfZ) < 0.5) return;
    if (existing) { scene.remove(existing.group); }
    const cy = getPlayerGroundY(cfX, cfZ);
    const { group, light } = createCampfire(scene, cfX, cy, cfZ);
    remoteCampfires.set(peerId, { group, light, x: cfX, z: cfZ });
  } else {
    /* peer no longer has campfire — remove it */
    if (existing) {
      scene.remove(existing.group);
      remoteCampfires.delete(peerId);
    }
  }
}

function removeRemoteCampfire(peerId) {
  const existing = remoteCampfires.get(peerId);
  if (existing) { scene.remove(existing.group); remoteCampfires.delete(peerId); }
}

function placeCampfire() {
  if (activeCampfire) { ui?.setStatus("You already have an active campfire!", "warn"); return; }
  if ((inventory.logs || 0) < CAMPFIRE_LOG_COST) { ui?.setStatus(`Need ${CAMPFIRE_LOG_COST} logs to build a campfire.`, "warn"); return; }
  let removed = 0;
  for (let i = 0; i < bagSlots.length && removed < CAMPFIRE_LOG_COST; i++) {
    if (bagSlots[i] === "logs") { bagSlots[i] = null; removed++; }
  }
  bagSystem.recount();
  syncInventoryUI();

  const cx = player.position.x, cz = player.position.z;
  const cy = getPlayerGroundY(cx, cz);
  const { group, light } = createCampfire(scene, cx, cy, cz);
  const hsNode = group;
  hsNode.userData.serviceType = "campfire";
  hsNode.userData.resourceLabel = "Campfire";
  resourceNodes.push(hsNode);
  activeCampfire = { group, light, timer: 120, node: hsNode, x: cx, z: cz };
  spawnFloatingDrop(cx, cz, "Campfire lit!", "item");
  ui?.setStatus("Campfire placed! Click it to cook.", "success");
  saveGame();
}

function updateCampfire(dt) {
  /* animate remote campfire lights */
  for (const rc of remoteCampfires.values()) {
    if (rc.light) rc.light.intensity = 1.2 + Math.sin(Date.now() * 0.01 + rc.x) * 0.4;
  }
  if (!activeCampfire) return;
  activeCampfire.timer -= dt;
  /* animate fire flicker */
  if (activeCampfire.light) {
    activeCampfire.light.intensity = 1.2 + Math.sin(Date.now() * 0.01) * 0.4;
  }
  if (activeCampfire.timer <= 0) {
    /* burn out */
    scene.remove(activeCampfire.group);
    const idx = resourceNodes.indexOf(activeCampfire.node);
    if (idx >= 0) resourceNodes.splice(idx, 1);
    if (activeCook) { activeCook = null; }
    spawnFloatingDrop(activeCampfire.x, activeCampfire.z, "Fire burned out", "warn");
    activeCampfire = null;
  }
}

function startCooking() {
  /* find cookable items */
  const hasCookable = bagSlots.some(s => s && COOKING_RECIPES[s]);
  if (!hasCookable) { ui?.setStatus("No raw food to cook!", "warn"); return; }
  activeCook = { elapsed: 0, duration: 1.2 };
  activeGather = null;
  activeAttack = null;
  hasMoveTarget = false;
  marker.visible = false;
  ui?.setStatus("Cooking...", "info");
}

function updateCooking(dt) {
  if (!activeCook) return;
  if (!activeCampfire) { activeCook = null; return; }
  /* check distance to campfire */
  const dx = player.position.x - activeCampfire.x;
  const dz = player.position.z - activeCampfire.z;
  if (Math.sqrt(dx * dx + dz * dz) > 3.5) { activeCook = null; ui?.setStatus("Moved away from campfire.", "info"); return; }
  activeCook.elapsed += dt;
  if (activeCook.elapsed < activeCook.duration) return;
  activeCook.elapsed = 0;
  /* cook one item */
  let cookedIdx = -1;
  for (let i = 0; i < bagSlots.length; i++) {
    if (bagSlots[i] && COOKING_RECIPES[bagSlots[i]]) { cookedIdx = i; break; }
  }
  if (cookedIdx < 0) { activeCook = null; ui?.setStatus("Nothing left to cook.", "info"); return; }
  const rawKey = bagSlots[cookedIdx];
  const recipe = COOKING_RECIPES[rawKey];
  const cookLvl = skills.cooking.level;
  const burnChance = Math.max(0.05, recipe.burnChance * (1 - cookLvl * 0.03));
  const burnt = Math.random() < burnChance;
  bagSlots[cookedIdx] = burnt ? "Burnt Food" : recipe.result;
  bagSystem.recount();
  if (!burnt) {
    const prevLevel = skills.cooking.level;
    skills.cooking.xp += recipe.xp;
    skills.cooking.level = xpToLevel(skills.cooking.xp);
    syncSkillsUI();
    spawnFloatingDrop(activeCampfire.x, activeCampfire.z, `+${recipe.xp} XP`, "xp");
    if (skills.cooking.level > prevLevel) {
      spawnFloatingDrop(activeCampfire.x - 0.14, activeCampfire.z + 0.1, `Cooking Lv ${skills.cooking.level}!`, "level");
      celebrateLevelUp(activeCampfire.x, activeCampfire.z);
      ui?.setStatus(`Cooked ${recipe.result}! Cooking level ${skills.cooking.level}!`, "success");
    } else {
      ui?.setStatus(`Cooked ${recipe.result}! +${recipe.xp} XP`, "success");
    }
  } else {
    spawnFloatingDrop(activeCampfire.x, activeCampfire.z, "Burnt!", "warn");
    ui?.setStatus("You burnt the food!", "warn");
  }
  syncInventoryUI();
  /* check if more to cook */
  const moreCookable = bagSlots.some(s => s && COOKING_RECIPES[s]);
  if (!moreCookable) { activeCook = null; ui?.setStatus("Finished cooking.", "info"); }
}

/* ── Jump system ── */
let _jumpVelocity = 0;
let _isJumping = false;
const JUMP_FORCE = 6.0;
const GRAVITY = -18.0;

/* ── Crouch system ── */
let _isCrouching = false;
let _crouchT = 0; // 0 = standing, 1 = fully crouched
const CROUCH_SPEED = 8.0;
let _crouchHoldTimer = 0; // debounce: prevent flicker from Ctrl key quirks
let _smoothGroundY = null; // smoothed ground Y to prevent micro-terrain jitter

function runServiceAction(node) {
  const serviceType = node.userData.serviceType;
  if (!serviceType) return;

  if (serviceType === "cave" || serviceType === "cave_exit") return;

  if (serviceType === "campfire") {
    startCooking();
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
    syncWornUI();
    ui?.setStatus("Blacksmith open. Buy tool upgrades or craft equipment.", "info");
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

/* ── Sound system ── */
let _attackBuffer = null;
fetch("./sounds/attack1.wav")
  .then(r => r.arrayBuffer())
  .then(buf => _audioCtx.decodeAudioData(buf))
  .then(decoded => { _attackBuffer = decoded; })
  .catch(() => {});

function playAttackSound() {
  if (!_attackBuffer) return;
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const src = _audioCtx.createBufferSource();
  src.buffer = _attackBuffer;
  src.playbackRate.value = 0.85 + Math.random() * 0.3;
  src.connect(_masterGain);
  src.start();
}

function playBowSound() {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const osc = _audioCtx.createOscillator();
  const gain = _audioCtx.createGain();
  osc.type = "sine";
  const pitchShift = 0.85 + Math.random() * 0.3;
  osc.frequency.setValueAtTime(800 * pitchShift, _audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200 * pitchShift, _audioCtx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.3, _audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.12);
  osc.connect(gain);
  gain.connect(_masterGain);
  osc.start();
  osc.stop(_audioCtx.currentTime + 0.12);
}

/* ── Gathering sounds ── */
function playChopSound() {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const t = _audioCtx.currentTime;
  const p = 0.9 + Math.random() * 0.2;
  /* sharp transient thwack */
  const bufLen = _audioCtx.sampleRate * 0.06;
  const buf = _audioCtx.createBuffer(1, bufLen, _audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const env = Math.exp(-i / (bufLen * 0.15));
    d[i] = (Math.random() * 2 - 1) * env * 0.6;
  }
  const src = _audioCtx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = p;
  const filt = _audioCtx.createBiquadFilter();
  filt.type = "bandpass"; filt.frequency.value = 1800 * p; filt.Q.value = 1.5;
  const g = _audioCtx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  src.connect(filt); filt.connect(g); g.connect(_masterGain);
  src.start(); src.stop(t + 0.1);
  /* woody thud undertone */
  const osc = _audioCtx.createOscillator();
  osc.type = "sine"; osc.frequency.setValueAtTime(180 * p, t);
  osc.frequency.exponentialRampToValueAtTime(80 * p, t + 0.05);
  const g2 = _audioCtx.createGain();
  g2.gain.setValueAtTime(0.25, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(g2); g2.connect(_masterGain);
  osc.start(); osc.stop(t + 0.08);
}

function playMineSound() {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const t = _audioCtx.currentTime;
  const p = 0.85 + Math.random() * 0.3;
  /* metallic clink */
  const osc = _audioCtx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(2200 * p, t);
  osc.frequency.exponentialRampToValueAtTime(600 * p, t + 0.04);
  const g = _audioCtx.createGain();
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(g); g.connect(_masterGain);
  osc.start(); osc.stop(t + 0.12);
  /* rocky crunch */
  const bufLen = _audioCtx.sampleRate * 0.08;
  const buf = _audioCtx.createBuffer(1, bufLen, _audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const env = Math.exp(-i / (bufLen * 0.2));
    d[i] = (Math.random() * 2 - 1) * env * 0.35;
  }
  const src = _audioCtx.createBufferSource();
  src.buffer = buf; src.playbackRate.value = p * 0.7;
  const filt = _audioCtx.createBiquadFilter();
  filt.type = "highpass"; filt.frequency.value = 800;
  const g2 = _audioCtx.createGain();
  g2.gain.setValueAtTime(0.3, t + 0.01);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  src.connect(filt); filt.connect(g2); g2.connect(_masterGain);
  src.start(t + 0.01); src.stop(t + 0.12);
}

function playFishSound() {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const t = _audioCtx.currentTime;
  const p = 0.9 + Math.random() * 0.2;
  /* water splash — filtered noise burst */
  const bufLen = _audioCtx.sampleRate * 0.12;
  const buf = _audioCtx.createBuffer(1, bufLen, _audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const env = Math.exp(-i / (bufLen * 0.3));
    d[i] = (Math.random() * 2 - 1) * env * 0.5;
  }
  const src = _audioCtx.createBufferSource();
  src.buffer = buf; src.playbackRate.value = p;
  const filt = _audioCtx.createBiquadFilter();
  filt.type = "bandpass"; filt.frequency.value = 600 * p; filt.Q.value = 0.8;
  const g = _audioCtx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  src.connect(filt); filt.connect(g); g.connect(_masterGain);
  src.start(); src.stop(t + 0.18);
  /* soft plop tone */
  const osc = _audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(400 * p, t);
  osc.frequency.exponentialRampToValueAtTime(150 * p, t + 0.08);
  const g2 = _audioCtx.createGain();
  g2.gain.setValueAtTime(0.12, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(g2); g2.connect(_masterGain);
  osc.start(); osc.stop(t + 0.12);
}

function playJumpLandSound(volumeScale = 1) {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const t = _audioCtx.currentTime;
  const p = 0.95 + Math.random() * 0.1;
  const v = volumeScale;

  /* gentle bubble pop — short sine that drops quickly, like a soap bubble */
  const pop = _audioCtx.createOscillator();
  pop.type = "sine";
  pop.frequency.setValueAtTime(280 * p, t);
  pop.frequency.exponentialRampToValueAtTime(160 * p, t + 0.06);
  const pg = _audioCtx.createGain();
  pg.gain.setValueAtTime(0.2 * v, t);
  pg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  pop.connect(pg); pg.connect(_masterGain);
  pop.start(); pop.stop(t + 0.11);

  /* soft airy puff — very gentle lowpass noise, like landing on a pillow */
  const bufLen = Math.floor(_audioCtx.sampleRate * 0.08);
  const buf = _audioCtx.createBuffer(1, bufLen, _audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const env = Math.exp(-i / (bufLen * 0.2));
    d[i] = (Math.random() * 2 - 1) * env * 0.25;
  }
  const src = _audioCtx.createBufferSource();
  src.buffer = buf; src.playbackRate.value = p * 1.4;
  const filt = _audioCtx.createBiquadFilter();
  filt.type = "lowpass"; filt.frequency.value = 600; filt.Q.value = 0.5;
  const ng = _audioCtx.createGain();
  ng.gain.setValueAtTime(0.18 * v, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  src.connect(filt); filt.connect(ng); ng.connect(_masterGain);
  src.start(); src.stop(t + 0.12);

  /* tiny happy bounce — delayed higher-pitched mini blip */
  const bounce = _audioCtx.createOscillator();
  bounce.type = "sine";
  bounce.frequency.setValueAtTime(420 * p, t + 0.06);
  bounce.frequency.exponentialRampToValueAtTime(260 * p, t + 0.1);
  const bg = _audioCtx.createGain();
  bg.gain.setValueAtTime(0.001, t);
  bg.gain.setValueAtTime(0.1 * v, t + 0.06);
  bg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  bounce.connect(bg); bg.connect(_masterGain);
  bounce.start(); bounce.stop(t + 0.14);
}

function playGatherSound(resourceType) {
  if (resourceType === "woodcutting") playChopSound();
  else if (resourceType === "mining") playMineSound();
  else if (resourceType === "fishing") playFishSound();
}

/* ── Star enhancement sounds (MapleStory-inspired) ── */
function playStarSuccess(newStars) {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const t = _audioCtx.currentTime;
  /* ascending sparkle arpeggio — higher pitch at higher star levels */
  const basePitch = 1 + newStars * 0.06;
  const notes = [660, 880, 1100, 1320, 1760].map(n => n * basePitch);
  const timing = [0, 0.06, 0.12, 0.18, 0.24];
  for (let i = 0; i < notes.length; i++) {
    const osc = _audioCtx.createOscillator();
    const g = _audioCtx.createGain();
    osc.type = i < 3 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(notes[i], t + timing[i]);
    g.gain.setValueAtTime(0.2, t + timing[i]);
    g.gain.exponentialRampToValueAtTime(0.001, t + timing[i] + 0.2);
    osc.connect(g); g.connect(_masterGain);
    osc.start(t + timing[i]); osc.stop(t + timing[i] + 0.25);
  }
  /* shimmer sparkle noise */
  const bufLen = Math.floor(_audioCtx.sampleRate * 0.3);
  const buf = _audioCtx.createBuffer(1, bufLen, _audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = (Math.random() * 2 - 1) * 0.08;
  const src = _audioCtx.createBufferSource();
  src.buffer = buf;
  const filt = _audioCtx.createBiquadFilter();
  filt.type = "bandpass"; filt.frequency.value = 8000 * basePitch; filt.Q.value = 3;
  const sg = _audioCtx.createGain();
  sg.gain.setValueAtTime(0.2, t + 0.15);
  sg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  src.connect(filt); filt.connect(sg); sg.connect(_masterGain);
  src.start(t + 0.15); src.stop(t + 0.55);
}

function playStarFail() {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const t = _audioCtx.currentTime;
  /* descending dull buzz — "bonk" */
  const osc = _audioCtx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);
  const g = _audioCtx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  const filt = _audioCtx.createBiquadFilter();
  filt.type = "lowpass"; filt.frequency.value = 600;
  osc.connect(filt); filt.connect(g); g.connect(_masterGain);
  osc.start(); osc.stop(t + 0.3);
  /* dull thud */
  const osc2 = _audioCtx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(80, t);
  osc2.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const g2 = _audioCtx.createGain();
  g2.gain.setValueAtTime(0.25, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc2.connect(g2); g2.connect(_masterGain);
  osc2.start(); osc2.stop(t + 0.2);
}

function playStarDestroy() {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const t = _audioCtx.currentTime;
  /* dramatic glass shatter — noise burst with sharp filter sweep */
  const bufLen = Math.floor(_audioCtx.sampleRate * 0.5);
  const buf = _audioCtx.createBuffer(1, bufLen, _audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) {
    const env = Math.exp(-i / (bufLen * 0.15));
    d[i] = (Math.random() * 2 - 1) * env * 0.7;
  }
  const src = _audioCtx.createBufferSource();
  src.buffer = buf;
  const filt = _audioCtx.createBiquadFilter();
  filt.type = "highpass";
  filt.frequency.setValueAtTime(6000, t);
  filt.frequency.exponentialRampToValueAtTime(400, t + 0.4);
  const g = _audioCtx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  src.connect(filt); filt.connect(g); g.connect(_masterGain);
  src.start(); src.stop(t + 0.55);
  /* low impact rumble */
  const osc = _audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(60, t);
  osc.frequency.exponentialRampToValueAtTime(25, t + 0.3);
  const g2 = _audioCtx.createGain();
  g2.gain.setValueAtTime(0.3, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(g2); g2.connect(_masterGain);
  osc.start(); osc.stop(t + 0.4);
  /* descending shatter tones */
  const shatterNotes = [2400, 1800, 1200, 600];
  for (let i = 0; i < shatterNotes.length; i++) {
    const o = _audioCtx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(shatterNotes[i], t + i * 0.04);
    o.frequency.exponentialRampToValueAtTime(shatterNotes[i] * 0.3, t + i * 0.04 + 0.08);
    const og = _audioCtx.createGain();
    og.gain.setValueAtTime(0.12, t + i * 0.04);
    og.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.1);
    o.connect(og); og.connect(_masterGain);
    o.start(t + i * 0.04); o.stop(t + i * 0.04 + 0.12);
  }
}

function playStarTimingClick() {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const t = _audioCtx.currentTime;
  /* short crisp click */
  const osc = _audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, t);
  const g = _audioCtx.createGain();
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  osc.connect(g); g.connect(_masterGain);
  osc.start(); osc.stop(t + 0.04);
}

/* ── Level-up celebration jingle ── */
function playLevelUpJingle() {
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  const t = _audioCtx.currentTime;
  /* Major arpeggio: C5 E5 G5 C6, then shimmer chord */
  const notes = [523, 659, 784, 1047, 1319];
  const timing = [0, 0.08, 0.16, 0.26, 0.26];
  const durations = [0.18, 0.18, 0.18, 0.45, 0.45];
  for (let i = 0; i < notes.length; i++) {
    const osc = _audioCtx.createOscillator();
    const g = _audioCtx.createGain();
    osc.type = i < 4 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(notes[i], t + timing[i]);
    /* slight vibrato on final notes */
    if (i >= 3) {
      osc.frequency.setValueAtTime(notes[i], t + timing[i]);
      osc.frequency.linearRampToValueAtTime(notes[i] * 1.005, t + timing[i] + 0.15);
      osc.frequency.linearRampToValueAtTime(notes[i], t + timing[i] + 0.3);
    }
    const vol = i >= 3 ? 0.18 : 0.22;
    g.gain.setValueAtTime(vol, t + timing[i]);
    g.gain.exponentialRampToValueAtTime(0.001, t + timing[i] + durations[i]);
    osc.connect(g);
    g.connect(_masterGain);
    osc.start(t + timing[i]);
    osc.stop(t + timing[i] + durations[i] + 0.05);
  }
  /* sparkle shimmer — short noise burst */
  const bufLen = _audioCtx.sampleRate * 0.15;
  const noiseBuf = _audioCtx.createBuffer(1, bufLen, _audioCtx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.12;
  const noise = _audioCtx.createBufferSource();
  noise.buffer = noiseBuf;
  const nf = _audioCtx.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = 6000;
  nf.Q.value = 2;
  const ng = _audioCtx.createGain();
  ng.gain.setValueAtTime(0.15, t + 0.3);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(_masterGain);
  noise.start(t + 0.3);
  noise.stop(t + 0.55);
}

/* ── Fireworks / confetti particles ── */
const _fireworks = []; // { particles: [{x,y,z,vx,vy,vz,color,mesh}], age, duration }
const _fwGeo = new THREE.SphereGeometry(0.06, 4, 3);

function spawnFireworks(worldX, worldZ) {
  const baseY = getPlayerGroundY(worldX, worldZ) + 1.5;
  const particles = [];
  const count = 28 + Math.floor(Math.random() * 12);
  const palette = [
    "#ff3366", "#ffcc00", "#33ccff", "#66ff66", "#ff6633",
    "#cc66ff", "#ff99cc", "#00ffcc", "#ffff66", "#ff4444",
    "#44aaff", "#ff8800", "#aa66ff", "#55ff55",
  ];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const elev = (Math.random() - 0.3) * Math.PI;
    const speed = 3 + Math.random() * 5;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
    const mesh = new THREE.Mesh(_fwGeo, mat);
    const sz = 0.6 + Math.random() * 0.8;
    mesh.scale.setScalar(sz);
    mesh.position.set(worldX, baseY, worldZ);
    mesh.renderOrder = 200;
    scene.add(mesh);
    particles.push({
      mesh, mat,
      x: worldX, y: baseY, z: worldZ,
      vx: Math.cos(angle) * Math.cos(elev) * speed,
      vy: Math.sin(elev) * speed + 3,
      vz: Math.sin(angle) * Math.cos(elev) * speed,
    });
  }
  _fireworks.push({ particles, age: 0, duration: 1.6 });
}

function updateFireworks(dt) {
  for (let i = _fireworks.length - 1; i >= 0; i--) {
    const fw = _fireworks[i];
    fw.age += dt;
    const t = fw.age / fw.duration;
    for (const p of fw.particles) {
      p.vy -= 9 * dt; // gravity
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mat.opacity = Math.max(0, 1 - t * 1.2);
      /* trail sparkle — slight random offset */
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
    }
    if (fw.age >= fw.duration) {
      for (const p of fw.particles) {
        scene.remove(p.mesh);
        p.mat.dispose();
      }
      _fireworks.splice(i, 1);
    }
  }
}

/* ── Unified level-up celebration ── */
function celebrateLevelUp(worldX, worldZ) {
  playLevelUpJingle();
  spawnFireworks(worldX, worldZ);
  /* second burst slightly delayed for a staggered effect */
  setTimeout(() => spawnFireworks(worldX + (Math.random() - 0.5) * 1.5, worldZ + (Math.random() - 0.5) * 1.5), 200);
}

function performAttackHit(node) {
  if (combatStyle === "bow") playBowSound(); else playAttackSound();
  const dummyPos = combatPos;
  node.getWorldPosition(dummyPos);
  const dx = dummyPos.x - player.position.x;
  const dz = dummyPos.z - player.position.z;
  const yaw = Math.atan2(dx, dz);
  player.rotation.y = yaw;
  combatEffects.attack(combatStyle, player.position, yaw, 0.5, dummyPos);
  const atkBonus = getEquipmentAttackBonus();
  const minDmg = 1, maxDmg = 15 + Math.floor(atkBonus * 0.5);
  const damage = Math.floor(Math.random() * (maxDmg - minDmg + 1)) + minDmg;
  spawnFloatingDrop(dummyPos.x, dummyPos.z, `Hit ${damage}`, "combat");

  /* check if this is an animal */
  const animal = animals.find(a => a.node === node || a.parentModel === node);
  if (animal && animal.alive) {
    animal.hp = Math.max(0, animal.hp - damage);
    animal.hpBar.dataset.state = "";
    animal.hpFill.style.width = ((animal.hp / animal.maxHp) * 100) + "%";
    const pct = animal.hp / animal.maxHp;
    animal.hpFill.style.background = pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#facc15" : "#ef4444";
    /* aggro — animal fights back */
    animal.aggro = true;
    animal.aggroTarget = player;
    animal.lastHitTime = clock.elapsedTime;
    /* face the player when hit */
    const dx = player.position.x - animal.parentModel.position.x;
    const dz = player.position.z - animal.parentModel.position.z;
    animal.parentModel.rotation.y = Math.atan2(dx, dz);
    animal.wanderTarget = null;
    animal.wanderTimer = 1.5;
    if (animal.hp <= 0) {
      killAnimal(animal);
      activeAttack = null;
    }
  }

  const label = animal ? animal.type : "Training Dummy";
  const isDummy = !animal;
  const combatXp = isDummy ? Math.max(1, Math.round((10 + damage) * 0.01)) : 10 + damage;
  const combatSkill = skills[combatStyle];
  if (combatSkill) {
    const prevLevel = combatSkill.level;
    combatSkill.xp += combatXp;
    combatSkill.level = xpToLevel(combatSkill.xp);
    syncSkillsUI();
    if (combatSkill.level > prevLevel) {
      spawnFloatingDrop(dummyPos.x - 0.14, dummyPos.z + 0.1, `${combatStyle} Lv ${combatSkill.level}!`, "level");
      celebrateLevelUp(dummyPos.x, dummyPos.z);
      ui?.setStatus(`${combatStyle} level ${combatSkill.level}!`, "success");
    } else {
      spawnFloatingDrop(dummyPos.x + 0.14, dummyPos.z - 0.1, `+${combatXp} XP`, "xp");
      ui?.setStatus(`Hit ${label} for ${damage} damage! +${combatXp} XP`, "success");
    }
  } else {
    ui?.setStatus(`Hit ${label} for ${damage} damage!`, "success");
  }
}

function killAnimal(a) {
  a.alive = false;
  a.respawnTimer = 15;
  a.hpBar.dataset.state = "hidden";
  a.aggro = false;
  a.aggroTarget = null;
  /* loot drop */
  const lootName = ANIMAL_LOOT[a.type];
  if (lootName) {
    const added = bagSystem.addItem(lootName);
    if (added) {
      syncInventoryUI();
      const p = new THREE.Vector3();
      a.parentModel.getWorldPosition(p);
      spawnFloatingDrop(p.x, p.z, `+1 ${lootName}`, "item");
    } else {
      const p = new THREE.Vector3();
      a.parentModel.getWorldPosition(p);
      spawnFloatingDrop(p.x, p.z, "Bag full!", "warn");
    }
  }
  /* equipment drop chance */
  const dropTable = MONSTER_EQUIPMENT_DROPS[a.type];
  if (dropTable && Math.random() < dropTable.chance) {
    const dropId = dropTable.items[Math.floor(Math.random() * dropTable.items.length)];
    const dropItem = EQUIPMENT_ITEMS[dropId];
    if (dropItem && !bagSystem.isFull()) {
      bagSystem.addItem(dropId);
      syncInventoryUI();
      const p2 = new THREE.Vector3();
      a.parentModel.getWorldPosition(p2);
      spawnFloatingDrop(p2.x + 0.2, p2.z - 0.2, `+1 ${dropItem.label}`, "item");
    }
  }
  /* death animation — shrink to 0 */
  a._deathAnim = { elapsed: 0, duration: 0.5 };
}

function respawnAnimal(a) {
  a.alive = true;
  a.hp = a.maxHp;
  a.parentModel.position.copy(a.spawnPos);
  a.parentModel.scale.setScalar(a.origScale);
  a.parentModel.visible = true;
  a.wanderTimer = 3 + Math.random() * 5;
  a.wanderTarget = null;
  a.aggro = false;
  a.aggroTarget = null;
  a.attackCooldown = 0;
  /* re-add hitspot to interactables if missing */
  if (!resourceNodes.includes(a.node)) resourceNodes.push(a.node);
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

  // Animal: walk to it and auto-attack (like dummy but with HP)
  if (node.userData?.serviceType === "animal") {
    const a = animals.find(a => a.parentModel === node);
    if (!a || !a.alive) return;
    if (activeAttack && activeAttack.node === node) return;
    const aPos = interactPos;
    a.parentModel.getWorldPosition(aPos);
    spawnClickEffect(aPos.x, aPos.z, "neutral");
    const distance = aPos.distanceTo(player.position);
    const range = getAttackRange();
    if (distance > range) {
      pendingResource = null;
      activeGather = null;
      activeAttack = null;
      pendingService = node;
      pendingServicePos.copy(aPos);
      pendingServicePos.y = getPlayerGroundY(aPos.x, aPos.z);
      setMoveTarget(pendingServicePos, true);
      ui?.setStatus(`Walking to ${a.type}...`, "info");
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

/* ── World tooltip on hover ── */
let _tooltip = document.getElementById("hover-tooltip");
if (!_tooltip) {
  _tooltip = document.createElement("div");
  _tooltip.id = "hover-tooltip";
  document.body.appendChild(_tooltip);
}

function getTooltipText(node) {
  if (!node?.userData) return null;
  const ud = node.userData;
  /* resource nodes (trees, rocks, fish spots) */
  if (ud.resourceType) {
    const skillKey = SKILL_BY_RESOURCE[ud.resourceType];
    const lvl = skillKey && skills[skillKey] ? skills[skillKey].level : 1;
    return `${ud.resourceLabel || ud.resourceType}\nYour ${skillKey} Lv ${lvl}`;
  }
  /* animals */
  if (ud.serviceType === "animal") {
    const a = animals.find(a => a.parentModel === node);
    if (a && a.alive) return `${a.type}\nHP ${a.hp}/${a.maxHp}`;
    return null;
  }
  /* dummies */
  if (ud.serviceType === "dummy") return "Training Dummy\nAttack to train combat";
  /* buildings */
  if (ud.serviceType === "bank") return "Bank\nClick to open";
  if (ud.serviceType === "store") return "General Store\nBuy & sell items";
  if (ud.serviceType === "blacksmith") return "Blacksmith\nUpgrade tools";
  if (ud.serviceType === "construction") return "Construction Site\nBuild your house";
  if (ud.serviceType === "campfire") return "Campfire\nClick to cook";
  if (ud.resourceLabel) return ud.resourceLabel;
  return null;
}

renderer.domElement.addEventListener("pointermove", (e) => {
  if (!hoveredNode) {
    _tooltip.style.display = "none";
    return;
  }
  const text = getTooltipText(hoveredNode);
  if (!text) { _tooltip.style.display = "none"; return; }
  _tooltip.textContent = text;
  _tooltip.style.display = "block";
  _tooltip.style.left = (e.clientX + 14) + "px";
  _tooltip.style.top = (e.clientY + 14) + "px";
});

function onHoverChange(node) {
  hoveredNode = node;
  if (!node) {
    hoverIndicator.visible = false;
    _tooltip.style.display = "none";
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

/* ── Right-click inspect remote players ── */
let _inspectPopup = null;
const _inspectRay = new THREE.Raycaster();
const _inspectNdc = new THREE.Vector2();

function closeInspectPopup() {
  if (_inspectPopup) { _inspectPopup.remove(); _inspectPopup = null; }
}

renderer.domElement.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  closeInspectPopup();
  _inspectNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
  _inspectNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  _inspectRay.setFromCamera(_inspectNdc, camera);
  const hit = remotePlayers.hitTest(_inspectRay);
  if (!hit) return;
  const popup = document.createElement("div");
  popup.className = "player-inspect-popup";
  let activity = "Idle";
  if (hit.attacking) activity = `Fighting (${hit.combatStyle})`;
  else if (hit.gathering) activity = `Skilling (${hit.tool})`;
  else if (hit.moving) activity = "Walking";
  const sk = hit.skills;
  const skillsHtml = sk ? `<div class="inspect-stats">`
    + `<span>\u{1F41F} Fish ${sk.fishing}</span>`
    + `<span>\u{1FAA8} Mine ${sk.mining}</span>`
    + `<span>\u{1FAB5} WC ${sk.woodcutting}</span>`
    + `<span>\u{1F5E1} Melee ${sk.melee}</span>`
    + `<span>\u{1F3F9} Range ${sk.bow}</span>`
    + `<span>\u{1F525} Mage ${sk.mage}</span>`
    + `<span>\u{1F373} Cook ${sk.cooking || 1}</span>`
    + `</div>` : "";
  popup.innerHTML = `<h3>${hit.name}</h3><div class="inspect-level">Total Lv ${hit.totalLevel}</div>${skillsHtml}<div class="inspect-activity">${activity}</div>`;
  popup.style.left = Math.min(e.clientX, window.innerWidth - 220) + "px";
  popup.style.top = Math.min(e.clientY, window.innerHeight - 180) + "px";
  document.body.appendChild(popup);
  _inspectPopup = popup;
});

renderer.domElement.addEventListener("pointerdown", () => closeInspectPopup());

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

  /* Jump */
  if (input.keys.has(" ") && !_isJumping) {
    _isJumping = true;
    _jumpVelocity = JUMP_FORCE;
  }

  /* Crouch (debounced — Ctrl key can flicker on Windows) */
  const wantCrouch = input.keys.has("control") && !_isJumping;
  if (wantCrouch) {
    _isCrouching = true;
    _crouchHoldTimer = 0;
  } else {
    _crouchHoldTimer += dt;
    if (_crouchHoldTimer > 0.06) _isCrouching = false;
  }

  const keyboardMove = moveDir.lengthSq() > 0.0001;
  if (keyboardMove) {
    hasMoveTarget = false;
    marker.visible = false;
    pendingResource = null;
    pendingService = null;
    activeGather = null;
    activeAttack = null;
    if (ui?.isBankOpen?.()) ui.closeBank();
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
    const moveSpeed = _isCrouching ? 3.5 : 7.0;
    player.position.addScaledVector(moveDir, moveSpeed * dt);
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
    const svcType = pendingService.userData?.serviceType;
    const isAttackable = svcType === "dummy" || svcType === "animal";
    const arrivalDist = isAttackable ? getAttackRange() : 2.7;
    if (serviceDistance <= arrivalDist) {
      if (isAttackable) {
        const a = svcType === "animal" ? animals.find(a => a.parentModel === pendingService) : null;
        if (a && !a.alive) { pendingService = null; }
        else startActiveAttack(pendingService);
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
        playGatherSound(activeGather.resourceType);
        tryGather(activeGather.node);
      }
    }
  }

  if (activeAttack) {
    if (equippedTool !== getCombatToolForStyle(combatStyle)) {
      activeAttack = null;
    }
    /* stop attacking dead animals */
    const atkAnimal = activeAttack ? animals.find(a => a.node === activeAttack.node || a.parentModel === activeAttack.node) : null;
    if (atkAnimal && !atkAnimal.alive) activeAttack = null;
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

  const rawGroundY = getPlayerGroundY(player.position.x, player.position.z);
  /* Smooth ground Y to prevent micro-terrain jitter (especially visible when crouched) */
  if (_smoothGroundY === null) _smoothGroundY = rawGroundY;
  else _smoothGroundY += (rawGroundY - _smoothGroundY) * Math.min(1, dt * 28);
  const groundY = _smoothGroundY;
  const standY = groundY + playerFootOffset - playerGroundSink;
  if (_isJumping) {
    _jumpVelocity += GRAVITY * dt;
    player.position.y += _jumpVelocity * dt;
    if (player.position.y <= standY) {
      player.position.y = standY;
      _isJumping = false;
      _jumpVelocity = 0;
      playJumpLandSound();
    }
  } else {
    player.position.y = standY;
  }
  /* Crouch squish — lerp toward target, snap when close */
  const crouchTarget = _isCrouching ? 1 : 0;
  if (_crouchT < crouchTarget) _crouchT = Math.min(crouchTarget, _crouchT + dt * CROUCH_SPEED);
  else if (_crouchT > crouchTarget) _crouchT = Math.max(crouchTarget, _crouchT - dt * CROUCH_SPEED);

  /* Jump stretch — tall & narrow (opposite of crouch) */
  let jumpStretch = 0;
  if (_isJumping) {
    const upPhase = _jumpVelocity > 0 ? 1 : 0;
    const speed = Math.abs(_jumpVelocity) / JUMP_FORCE;
    jumpStretch = speed * 0.35 * (upPhase ? 1 : 0.6);
  }

  const squishY = (1 - _crouchT * 0.45) * (1 + jumpStretch);
  const squishXZ = (1 + _crouchT * 0.25) * (1 - jumpStretch * 0.4);
  player.scale.set(squishXZ, squishY, squishXZ);

  playerBlob.position.set(player.position.x, groundY + 0.03, player.position.z);
  const isMovingNow = moveDir.lengthSq() > 0.0001 && !activeGather && !activeAttack;
  updateAnimation(dt, {
    moving: isMovingNow,
    gathering: !!activeGather,
    attacking: !!activeAttack,
    combatStyle,
    resourceType: activeGather?.resourceType,
  });
  updateCampfire(dt);
  updateCooking(dt);
  updateFireworks(dt);
  updateClickEffects(dt);
  updateEmoteBubbles(dt);
  updateNameTags();
  updateOverheadIcons();
  updateFloatingDrops(dt);
  /* lazy-register animals from async-loaded chunks (check every ~2s) */
  if (Math.random() < dt * 0.5) scanForNewAnimals();
  updateAnimals(dt);
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
    y: player.position.y,
    z: player.position.z,
    yaw: player.rotation.y,
    moving: isMovingNow,
    gathering: !!activeGather,
    attacking: !!activeAttack,
    crouching: _isCrouching,
    jumping: _isJumping,
    campfireX: activeCampfire ? activeCampfire.x : null,
    campfireZ: activeCampfire ? activeCampfire.z : null,
    scaleY: squishY,
    scaleXZ: squishXZ,
    combatStyle,
    tool: equippedTool,
    overhead: getActiveOverhead() || "",
    totalLevel: Object.values(skills).reduce((s, sk) => s + sk.level, 0),
    skills: {
      fishing: skills.fishing.level,
      mining: skills.mining.level,
      woodcutting: skills.woodcutting.level,
      melee: skills.melee.level,
      bow: skills.bow.level,
      mage: skills.mage.level,
      cooking: skills.cooking.level,
    },
  });

  /* auto-save periodically */
  if (now - _lastSaveTime > SAVE_INTERVAL) { _lastSaveTime = now; saveGame(); }

  composer.render();
  updateDebugOverlay();
  updateConnStatus();
}

/* scan resource nodes for placed animals and register them */
const _registeredAnimalNodes = new Set();
function scanForNewAnimals() {
  for (const n of resourceNodes) {
    if (n.userData?.serviceType === "animal" && !_registeredAnimalNodes.has(n)) {
      _registeredAnimalNodes.add(n);
      registerAnimal(n, n);
    }
  }
}
scanForNewAnimals();
console.log(`Registered ${animals.length} animals total`);

requestAnimationFrame(animate);

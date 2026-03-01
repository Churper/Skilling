import { EQUIPMENT_ITEMS, EQUIPMENT_RECIPES, EQUIPMENT_TIERS, SELL_PRICE_BY_ITEM, SLIME_COLOR_SHOP, STAR_MAX, STAR_COSTS, STAR_SUCCESS, STAR_DESTROY, STAR_DOWNGRADE, STAR_ATK_PER, STAR_DEF_PER, STAR_TIMING_BONUS, ITEM_RARITY } from "./config.js";

function baseItemId(id) { return id ? id.split("#")[0] : id; }
function isNote(id) { return typeof id === "string" && id.startsWith("note:"); }
function parseNote(id) {
  if (!isNote(id)) return null;
  const parts = id.split(":");
  return { baseItem: parts[1], qty: parseInt(parts[2], 10) || 1 };
}

const TOOL_LABEL = {
  axe: "Axe",
  pickaxe: "Pickaxe",
  fishing: "Fishing Pole",
  sword: "Sword",
  bow: "Bow",
  staff: "Staff",
};

const ITEM_ICON = {
  fish: "\u{1F41F}",
  ore: "\u{1FAA8}",
  logs: "\u{1FAB5}",
  "Raw Beef": "\u{1F969}",
  "Raw Pork": "\u{1F356}",
  "Wool": "\u{1F9F6}",
  "Horse Hide": "\u{1F3AF}",
  "Llama Wool": "\u{1F9F6}",
  "Bone": "\u{1F9B4}",
  "Striped Hide": "\u{1F993}",
  "Health Potion": "\u{2764}\u{FE0F}",
  "Mana Potion": "\u{1F4A7}",
  "Cooked Fish": "\u{1F373}",
  "Cooked Beef": "\u{1F356}",
  "Cooked Pork": "\u{1F969}",
  "Burnt Food": "\u{1F4A8}",
  "Bird Nest": "\u{1FAA8}",
  "Uncut Gem": "\u{1F48E}",
  "Golden Fish": "\u{1F420}",
};

const ITEM_LABEL = {
  fish: "Fish",
  ore: "Ore",
  logs: "Logs",
};
const SELL_PRICE = SELL_PRICE_BY_ITEM;
const COMBAT_TOOLS = new Set(["sword", "bow", "staff"]);
const SKILLING_TOOLS = new Set(["axe", "pickaxe", "fishing"]);

export function initializeUI(options = {}) {
  const { onToolSelect, onEmote, onBlacksmithUpgrade, onStoreSell, onStoreSellItem, onStoreColor, onStoreBuyItem, onCombatStyle, onAttack, onBankTransfer, onPrayerToggle, onBuyPotion, onUseItem, onVolumeChange, onMusicChange, onEquipFromBag, onUnequipSlot, onCraftEquipment, onStarEnhance, onStarTimingStop, onTradeOfferItem, onTradeRemoveItem, onTradeAccept, onTradeCancel, onDropItem } = options;
  const buttons = Array.from(document.querySelectorAll(".ui-tab-btn"));
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));
  const title = document.getElementById("ui-panel-title");
  if (!buttons.length || !panels.length || !title) return null;

  /* ── Global tooltip — single element on document.body to avoid overflow/backdrop-filter clipping ── */
  let _globalTip = document.getElementById("ui-global-tip");
  if (!_globalTip) {
    _globalTip = document.createElement("div");
    _globalTip.id = "ui-global-tip";
    _globalTip.className = "ui-slot-tooltip";
    document.body.appendChild(_globalTip);
  }
  const _slotSelector = ".ui-bag-slot, .ui-bank-slot, .ui-store-slot, .ui-trade-slot, .ui-worn-slot, .ui-worn-skin-slot";
  document.addEventListener("pointerover", (e) => {
    const slot = e.target.closest(_slotSelector);
    if (!slot) return;
    const localTip = slot.querySelector(".ui-slot-tooltip");
    const text = localTip ? localTip.textContent : slot.dataset.tip;
    if (!text) return;
    _globalTip.textContent = text;
    _globalTip.classList.add("is-visible");
    const r = slot.getBoundingClientRect();
    _globalTip.style.left = (r.left + r.width / 2) + "px";
    _globalTip.style.transform = "translateX(-50%)";
    _globalTip.style.top = "";
    _globalTip.style.bottom = (window.innerHeight - r.top + 6) + "px";
  });
  document.addEventListener("pointerout", (e) => {
    const slot = e.target.closest(_slotSelector);
    if (!slot) return;
    _globalTip.classList.remove("is-visible");
  });
  function _wireSlotTooltip(slotEl) {}

  /* ── Right-click context menu for bag items ── */
  let _ctxMenu = document.getElementById("ui-ctx-menu");
  if (!_ctxMenu) {
    _ctxMenu = document.createElement("div");
    _ctxMenu.id = "ui-ctx-menu";
    _ctxMenu.style.cssText = "display:none;position:fixed;z-index:10000;background:rgba(10,10,20,0.95);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:3px 0;min-width:90px;font-family:var(--ui-font-body);font-size:13px;pointer-events:auto;box-shadow:0 4px 16px rgba(0,0,0,0.5);-webkit-user-select:none;user-select:none;";
    document.body.appendChild(_ctxMenu);
  }
  function _hideCtxMenu() { _ctxMenu.style.display = "none"; _ctxMenu.innerHTML = ""; }
  document.addEventListener("pointerdown", (e) => {
    if (!_ctxMenu.contains(e.target)) _hideCtxMenu();
  });
  function _ctxBtn(label, fn) {
    const b = document.createElement("div");
    b.textContent = label;
    b.style.cssText = "padding:5px 14px;cursor:pointer;color:#f0f0f0;white-space:nowrap;";
    b.addEventListener("pointerenter", () => b.style.background = "rgba(255,255,255,0.12)");
    b.addEventListener("pointerleave", () => b.style.background = "none");
    b.addEventListener("click", () => { _hideCtxMenu(); fn(); });
    return b;
  }
  function _showCtxMenu(mx, my, itemType, slotIndex, isEquipment) {
    _ctxMenu.innerHTML = "";
    if (isEquipment) {
      _ctxMenu.appendChild(_ctxBtn("Equip", () => { if (typeof onEquipFromBag === "function") onEquipFromBag(slotIndex); }));
      _ctxMenu.appendChild(_ctxBtn("Enhance \u2605", () => {
        /* equip first, then open enhance */
        if (typeof onEquipFromBag === "function") onEquipFromBag(slotIndex);
        /* short delay so equip completes before opening enhance */
        setTimeout(() => {
          const base = baseItemId(itemType);
          const eqInfo = EQUIPMENT_ITEMS[base];
          if (!eqInfo) return;
          const slot = eqInfo.slot;
          const data = _wornSlotData[slot];
          if (data && data.itemId) openStarEnhance(slot, data.itemId, data.stars || 0);
        }, 50);
      }));
    }
    _ctxMenu.appendChild(_ctxBtn("Drop", () => { if (typeof onDropItem === "function") onDropItem(slotIndex); }));
    _ctxMenu.style.left = mx + "px";
    _ctxMenu.style.top = my + "px";
    _ctxMenu.style.display = "block";
    /* clamp to viewport */
    requestAnimationFrame(() => {
      const r = _ctxMenu.getBoundingClientRect();
      if (r.right > window.innerWidth) _ctxMenu.style.left = (window.innerWidth - r.width - 4) + "px";
      if (r.bottom > window.innerHeight) _ctxMenu.style.top = (window.innerHeight - r.height - 4) + "px";
    });
  }

  /* Shared fixed tooltip element — reused for all equipment hovers */
  const _eqTip = document.createElement("div");
  _eqTip.className = "ui-eq-tooltip";
  document.body.appendChild(_eqTip);

  function _showEqTooltip(hostEl, item, action, sellPrice, stars) {
    _eqTip.innerHTML = "";
    const name = document.createElement("div");
    name.className = "ui-eq-tooltip-name";
    name.textContent = item.label;
    name.style.color = item.color;
    _eqTip.appendChild(name);
    if (stars != null && stars > 0) {
      const starsEl = document.createElement("div");
      starsEl.className = "ui-eq-tooltip-stars";
      starsEl.textContent = "\u2605".repeat(stars) + "\u2606".repeat(Math.max(0, 10 - stars));
      _eqTip.appendChild(starsEl);
    }
    const div1 = document.createElement("div");
    div1.className = "ui-eq-tooltip-divider";
    _eqTip.appendChild(div1);
    for (const [label, val] of [["Attack", item.atk], ["Defense", item.def]]) {
      const row = document.createElement("div");
      row.className = "ui-eq-tooltip-stat";
      const lbl = document.createElement("span");
      lbl.className = "ui-eq-tooltip-stat-label";
      lbl.textContent = label;
      row.appendChild(lbl);
      const v = document.createElement("span");
      v.className = "ui-eq-tooltip-stat-val " + (val > 0 ? "pos" : "zero");
      v.textContent = val > 0 ? `+${val}` : "0";
      row.appendChild(v);
      _eqTip.appendChild(row);
    }
    const req = document.createElement("div");
    req.className = "ui-eq-tooltip-req";
    req.textContent = `Requires Lv ${item.level}`;
    _eqTip.appendChild(req);
    if (sellPrice) {
      const sell = document.createElement("div");
      sell.className = "ui-eq-tooltip-sell";
      sell.textContent = `Sell: ${sellPrice}c`;
      _eqTip.appendChild(sell);
    }
    if (action) {
      const act = document.createElement("div");
      act.className = "ui-eq-tooltip-action";
      act.textContent = action;
      _eqTip.appendChild(act);
    }
    // Position above the host element
    const rect = hostEl.getBoundingClientRect();
    _eqTip.style.display = "block";
    const tipRect = _eqTip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    let top = rect.top - tipRect.height - 6;
    if (top < 4) top = rect.bottom + 6; // flip below if no room above
    if (left < 4) left = 4;
    if (left + tipRect.width > window.innerWidth - 4) left = window.innerWidth - tipRect.width - 4;
    _eqTip.style.left = left + "px";
    _eqTip.style.top = top + "px";
  }

  function _hideEqTooltip() {
    _eqTip.style.display = "none";
  }

  function _attachEqTooltip(hostEl, item, action, sellPrice, stars) {
    hostEl.onmouseenter = () => _showEqTooltip(hostEl, item, action, sellPrice, stars);
    hostEl.onmouseleave = _hideEqTooltip;
  }

  const toolButtons = Array.from(document.querySelectorAll(".ui-tool-btn"));
  const uiRoot = document.getElementById("ui-root");
  const mobileToggle = document.getElementById("ui-mobile-toggle");
  const equippedToolEl = document.getElementById("ui-equipped-tool");
  const statusEl = document.getElementById("ui-status-line");
  const invFishEl = document.getElementById("ui-inv-fish");
  const invOreEl = document.getElementById("ui-inv-ore");
  const invLogsEl = document.getElementById("ui-inv-logs");
  const bagCapacityEl = document.getElementById("ui-bag-capacity");
  const inventoryGridEl = document.getElementById("ui-inventory-grid");
  const coinsEl = document.getElementById("ui-coins-value");
  const fishLevelEl = document.getElementById("ui-skill-fishing");
  const miningLevelEl = document.getElementById("ui-skill-mining");
  const woodcutLevelEl = document.getElementById("ui-skill-woodcutting");
  const meleeLevelEl = document.getElementById("ui-skill-melee");
  const bowLevelEl = document.getElementById("ui-skill-bow");
  const mageLevelEl = document.getElementById("ui-skill-mage");
  const cookingLevelEl = document.getElementById("ui-skill-cooking");
  const fishBarEl = document.getElementById("ui-skill-bar-fishing");
  const miningBarEl = document.getElementById("ui-skill-bar-mining");
  const woodcutBarEl = document.getElementById("ui-skill-bar-woodcutting");
  const meleeBarEl = document.getElementById("ui-skill-bar-melee");
  const bowBarEl = document.getElementById("ui-skill-bar-bow");
  const mageBarEl = document.getElementById("ui-skill-bar-mage");
  const cookingBarEl = document.getElementById("ui-skill-bar-cooking");
  const friendsOnlineEl = document.getElementById("ui-friends-online");
  const friendsCountEl = document.getElementById("ui-friends-count");
  const smithButtons = Array.from(document.querySelectorAll("[data-smith-upgrade]"));
  const smithLevelEls = Array.from(document.querySelectorAll("[data-smith-level]"));
  const smithCostEls = Array.from(document.querySelectorAll("[data-smith-cost]"));
  const storeSellButton = document.getElementById("ui-store-sell-btn");
  const dyeButtons = Array.from(document.querySelectorAll("[data-store-color]"));
  const dyeCostEls = Array.from(document.querySelectorAll("[data-store-cost]"));
  const bankOverlay = document.getElementById("ui-bank-overlay");
  const bankCloseBtn = document.getElementById("ui-bank-close");
  const bankVaultGrid = document.getElementById("ui-bank-vault-grid");
  const bankInvGrid = document.getElementById("ui-bank-inv-grid");
  const bankQtyButtons = Array.from(document.querySelectorAll(".ui-bank-qty-btn"));

  const smithOverlay = document.getElementById("ui-smith-overlay");
  const smithCloseBtn = document.getElementById("ui-smith-close");

  const storeOverlay = document.getElementById("ui-store-overlay");
  const storeCloseBtn = document.getElementById("ui-store-close");
  const storeStockGrid = document.getElementById("ui-store-stock-grid");
  const storeInvGrid = document.getElementById("ui-store-inv-grid");
  const storeCoinsEl = document.getElementById("ui-store-coins");
  const storeSellAllBtn = document.getElementById("ui-store-sell-all");

  const combatStyleButtons = Array.from(document.querySelectorAll("[data-combat-style]"));
  const attackButton = document.getElementById("ui-attack-btn");
  const hpBarFill = document.getElementById("ui-hp-bar-fill");
  const hpBarText = document.getElementById("ui-hp-bar-text");
  const potionButtons = Array.from(document.querySelectorAll("[data-buy-potion]"));

  const labelByTab = {
    inventory: "Inventory",
    bank: "Bank",
    blacksmith: "Blacksmith",
    store: "Store",
    skills: "Skills",
    combat: "Combat",
    prayer: "Prayer",
    worn: "Worn Equipment",
    emotes: "Emotes",
  };

  const mobileQuery = window.matchMedia("(max-width: 760px)");
  let activeTab = "inventory";
  let panelCollapsed = false;
  function setPanelCollapsed(collapsed) {
    panelCollapsed = !!collapsed;
    if (uiRoot) uiRoot.classList.toggle("panel-collapsed", panelCollapsed);
    /* Clear button highlights when collapsed so no tab looks "active" */
    if (panelCollapsed) {
      for (const button of buttons) button.classList.remove("is-active");
    } else {
      for (const button of buttons) button.classList.toggle("is-active", button.dataset.tab === activeTab);
    }
  }

  function setMobileMenuOpen(open) {
    if (!uiRoot) return;
    const shouldOpen = mobileQuery.matches ? !!open : true;
    uiRoot.classList.toggle("mobile-open", shouldOpen);
    if (mobileToggle) {
      mobileToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      mobileToggle.textContent = shouldOpen ? "Close" : "Menu";
    }
  }

  function refreshMobileLayout() {
    setPanelCollapsed(false);
    if (!mobileQuery.matches) {
      setMobileMenuOpen(true);
      return;
    }
    setMobileMenuOpen(false);
  }

  function setActive(tab) {
    activeTab = tab;
    for (const button of buttons) {
      button.classList.toggle("is-active", button.dataset.tab === tab);
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.tabPanel !== tab;
    }
    title.textContent = labelByTab[tab] || "Panel";
  }

  /* F-key bindings — same key closes panel, different key switches & opens */
  const _fkeyTabs = { F1: "inventory", F2: "worn", F3: "prayer", F4: "combat", F5: "skills", F6: "emotes" };
  window.addEventListener("keydown", (e) => {
    const tab = _fkeyTabs[e.key];
    if (tab) {
      e.preventDefault(); /* always block browser F-key actions (F5 refresh etc) */
      if (e.repeat) return; /* but only toggle on first press, not held repeats */
      if (activeTab === tab && !panelCollapsed) {
        setPanelCollapsed(true);
      } else {
        setActive(tab);
        setPanelCollapsed(false);
      }
      e.stopImmediatePropagation();
      return;
    }
    if (e.key === "Escape" && !e.repeat) {
      setPanelCollapsed(true);
    }
  });

  function setActiveTool(tool) {
    for (const button of toolButtons) {
      button.classList.toggle("is-active", button.dataset.tool === tool);
    }
    if (equippedToolEl) equippedToolEl.textContent = `Equipped: ${TOOL_LABEL[tool] || "Unknown"}`;
  }

  function renderInventoryGrid(slots, capacity) {
    if (!inventoryGridEl) return;
    inventoryGridEl.innerHTML = "";
    const slotCount = Math.max(capacity || 0, slots.length || 0);
    for (let i = 0; i < slotCount; i++) {
      const itemType = slots[i] || null;
      const slot = document.createElement("div");
      slot.className = itemType ? "ui-bag-slot" : "ui-bag-slot is-empty";
      if (itemType && isNote(itemType)) {
        /* ── Noted item: paper background + item icon + qty ── */
        const n = parseNote(itemType);
        slot.classList.add("is-note");
        const paper = document.createElement("span");
        paper.className = "ui-note-paper";
        paper.textContent = "\uD83D\uDCC4";
        slot.append(paper);
        const icon = document.createElement("span");
        icon.className = "ui-bag-slot-icon ui-note-icon";
        icon.textContent = ITEM_ICON[n.baseItem] || "?";
        slot.append(icon);
        const badge = document.createElement("span");
        badge.className = "ui-note-qty";
        badge.textContent = String(n.qty);
        slot.append(badge);
        const perPrice = SELL_PRICE[n.baseItem] || 0;
        const tip = document.createElement("div");
        tip.className = "ui-slot-tooltip";
        tip.textContent = `Noted ${ITEM_LABEL[n.baseItem] || n.baseItem} x${n.qty}\nSell: ${perPrice * n.qty}c`;
        slot.append(tip);
      } else if (itemType) {
        const eqData = EQUIPMENT_ITEMS[baseItemId(itemType)];
        const displayName = eqData ? eqData.label : (ITEM_LABEL[itemType] || itemType);
        const sellVal = SELL_PRICE[baseItemId(itemType)];
        const iconChar = eqData ? eqData.icon : (ITEM_ICON[itemType] || "?");
        const icon = document.createElement("span");
        icon.className = "ui-bag-slot-icon";
        icon.textContent = iconChar;
        slot.append(icon);
        /* rarity tint for all items */
        if (!eqData) {
          const ir = ITEM_RARITY[itemType];
          if (ir?.tint) slot.style.background = ir.tint;
        }
        /* styled tooltip with rarity */
        const tip = document.createElement("div");
        tip.className = "ui-slot-tooltip";
        const ir = ITEM_RARITY[itemType];
        let tipText = displayName;
        if (ir) tipText += `\n${ir.rarity[0].toUpperCase() + ir.rarity.slice(1)}`;
        if (sellVal) tipText += `\nSell: ${sellVal}c`;
        if (itemType === "Health Potion") tipText += "\nClick to use (+40 HP)";
        else if (itemType === "Mana Potion") tipText += "\nClick to use";
        else if (itemType === "logs") tipText += "\nClick to place Campfire (3 logs)";
        tip.innerHTML = "";
        const tipName = document.createElement("div");
        tipName.textContent = displayName;
        tip.append(tipName);
        if (ir) {
          const rarLine = document.createElement("div");
          rarLine.textContent = ir.rarity[0].toUpperCase() + ir.rarity.slice(1);
          rarLine.style.color = ir.color;
          rarLine.style.fontWeight = "600";
          tip.append(rarLine);
        }
        if (sellVal) { const s = document.createElement("div"); s.textContent = `Sell: ${sellVal}c`; tip.append(s); }
        if (itemType === "Health Potion") { const s = document.createElement("div"); s.textContent = "Click to use (+40 HP)"; tip.append(s); }
        else if (itemType === "Mana Potion") { const s = document.createElement("div"); s.textContent = "Click to use"; tip.append(s); }
        else if (itemType === "logs") { const s = document.createElement("div"); s.textContent = "Click to place Campfire (3 logs)"; tip.append(s); }
        slot.append(tip);
        if (itemType === "Health Potion" || itemType === "Mana Potion" || itemType === "logs") {
          slot.classList.add("is-usable");
          slot.addEventListener("click", () => {
            if (typeof onUseItem === "function") onUseItem(itemType, i);
          });
        } else if (EQUIPMENT_ITEMS[baseItemId(itemType)]) {
          const eqInfo = EQUIPMENT_ITEMS[baseItemId(itemType)];
          const iStars = _itemStars[itemType] || 0;
          slot.classList.add("is-equipment");
          /* rarity tint */
          const tierData = eqInfo.tier ? EQUIPMENT_TIERS[eqInfo.tier] : null;
          if (tierData?.tint) slot.style.background = tierData.tint;
          tip.remove();
          if (iStars > 0) {
            const badge = document.createElement("span");
            badge.className = "ui-bag-star-badge";
            badge.textContent = `\u2605${iStars}`;
            slot.append(badge);
          }
          _attachEqTooltip(slot, eqInfo, "Click to equip", sellVal, iStars);
          slot.addEventListener("click", () => {
            if (typeof onEquipFromBag === "function") onEquipFromBag(i);
          });
        }
      } else {
        const empty = document.createElement("span");
        empty.className = "ui-bag-slot-empty";
        slot.append(empty);
      }
      /* Right-click context menu */
      if (itemType) {
        const isEq = !!EQUIPMENT_ITEMS[baseItemId(itemType)];
        slot.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          _showCtxMenu(e.clientX, e.clientY, itemType, i, isEq);
        });
      }
      _wireSlotTooltip(slot);
      inventoryGridEl.append(slot);
    }
  }

  let _itemStars = {}; // itemId → star count for bag tooltip display
  function setInventory(payload) {
    const counts = payload?.counts ?? payload ?? {};
    const slots = Array.isArray(payload?.slots) ? payload.slots : [];
    const capacity = Number.isFinite(payload?.capacity) ? payload.capacity : slots.length;
    const used = Number.isFinite(payload?.used) ? payload.used : slots.filter((slot) => !!slot).length;
    if (payload?.itemStars) _itemStars = payload.itemStars;

    if (invFishEl) invFishEl.textContent = String(counts.fish ?? 0);
    if (invOreEl) invOreEl.textContent = String(counts.ore ?? 0);
    if (invLogsEl) invLogsEl.textContent = String(counts.logs ?? 0);
    if (bagCapacityEl && capacity > 0) bagCapacityEl.textContent = `${used}/${capacity}`;
    renderInventoryGrid(slots, capacity);
  }

  let _currentCoins = 0;
  function setCoins(amount) {
    _currentCoins = Math.max(0, Math.floor(Number(amount) || 0));
    if (coinsEl) coinsEl.textContent = String(_currentCoins);
    // Update star overlay coin display if open
    const starCoinsEl = document.getElementById("ui-star-coins");
    if (starCoinsEl) starCoinsEl.textContent = `${_currentCoins}c`;
  }

  function setSkills(skills) {
    if (fishLevelEl) fishLevelEl.textContent = String(skills.fishing ?? 1);
    if (miningLevelEl) miningLevelEl.textContent = String(skills.mining ?? 1);
    if (woodcutLevelEl) woodcutLevelEl.textContent = String(skills.woodcutting ?? 1);
    if (meleeLevelEl) meleeLevelEl.textContent = String(skills.melee ?? 1);
    if (bowLevelEl) bowLevelEl.textContent = String(skills.bow ?? 1);
    if (mageLevelEl) mageLevelEl.textContent = String(skills.mage ?? 1);
    if (cookingLevelEl) cookingLevelEl.textContent = String(skills.cooking ?? 1);

    const progress = skills._progress || {};
    if (fishBarEl) fishBarEl.style.width = (progress.fishing ?? 0) + "%";
    if (miningBarEl) miningBarEl.style.width = (progress.mining ?? 0) + "%";
    if (woodcutBarEl) woodcutBarEl.style.width = (progress.woodcutting ?? 0) + "%";
    if (meleeBarEl) meleeBarEl.style.width = (progress.melee ?? 0) + "%";
    if (bowBarEl) bowBarEl.style.width = (progress.bow ?? 0) + "%";
    if (mageBarEl) mageBarEl.style.width = (progress.mage ?? 0) + "%";
    if (cookingBarEl) cookingBarEl.style.width = (progress.cooking ?? 0) + "%";
  }

  function setStatus(text, tone = "info") {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }

  function setFriendsState(payload = {}) {
    const connected = !!payload.connected;
    const peers = Math.max(0, Math.floor(Number(payload.peers) || 0));
    if (friendsOnlineEl) friendsOnlineEl.textContent = connected ? "Online" : "Offline";
    if (friendsCountEl) friendsCountEl.textContent = `Players online: ${connected ? peers + 1 : 1}`;
  }

  function setBlacksmith(payload = {}) {
    const coins = Math.max(0, Math.floor(Number(payload.coins) || 0));
    const tools = payload.tools || {};

    for (const levelEl of smithLevelEls) {
      const tool = levelEl.dataset.smithLevel;
      const state = tools[tool] || {};
      levelEl.textContent = String(state.level ?? 0);
    }
    for (const costEl of smithCostEls) {
      const tool = costEl.dataset.smithCost;
      const state = tools[tool] || {};
      costEl.textContent = state.maxed ? "MAX" : String(state.cost ?? 0);
    }
    for (const button of smithButtons) {
      const tool = button.dataset.smithUpgrade;
      const state = tools[tool] || {};
      const affordable = !state.maxed && coins >= (state.cost ?? 0);
      button.disabled = !!state.maxed;
      button.classList.toggle("is-unaffordable", !state.maxed && !affordable);
      button.title = state.maxed
        ? "Max level"
        : affordable
          ? `Buy upgrade for ${state.cost} coins`
          : `Need ${state.cost ?? 0} coins`;
    }
  }

  let _smithOpen = false;
  function openBlacksmith(payload = {}) {
    setBlacksmith(payload);
    _smithOpen = true;
    if (smithOverlay) smithOverlay.hidden = false;
  }
  function closeBlacksmith() {
    _smithOpen = false;
    if (smithOverlay) smithOverlay.hidden = true;
  }
  function isBlacksmithOpen() { return _smithOpen; }
  if (smithCloseBtn) smithCloseBtn.addEventListener("click", closeBlacksmith);
  if (smithOverlay) smithOverlay.addEventListener("click", (e) => {
    if (e.target === smithOverlay) closeBlacksmith();
  });

  function setStore(payload = {}) {
    const coins = Math.max(0, Math.floor(Number(payload.coins) || 0));
    const colors = payload.colors || {};
    const selected = payload.selectedColorId || "";
    for (const costEl of dyeCostEls) {
      const id = costEl.dataset.storeCost;
      const state = colors[id] || {};
      costEl.textContent = state.unlocked ? "Owned" : `${state.cost ?? 0}c`;
    }
    for (const button of dyeButtons) {
      const id = button.dataset.storeColor;
      const state = colors[id] || {};
      const affordable = !!state.unlocked || coins >= (state.cost ?? 0);
      button.classList.toggle("is-active", id === selected);
      button.classList.toggle("is-unaffordable", !state.unlocked && !affordable);
      button.title = state.unlocked
        ? "Equip color"
        : affordable
          ? `Buy for ${state.cost} coins`
          : `Need ${state.cost ?? 0} coins`;
    }
  }

  function setHp(hp, maxHp) {
    if (hpBarFill) {
      const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
      hpBarFill.style.width = pct + "%";
      hpBarFill.style.background = pct > 50 ? "#4ade80" : pct > 25 ? "#facc15" : "#ef4444";
    }
    if (hpBarText) hpBarText.textContent = `HP ${Math.max(0, hp)}/${maxHp}`;
  }

  /* potion buy buttons */
  for (const btn of potionButtons) {
    btn.addEventListener("click", () => {
      const id = btn.dataset.buyPotion;
      if (typeof onBuyPotion === "function") onBuyPotion(id);
    });
  }

  let _bankOpen = false;
  let _bankQty = "1";
  let _bankNoteMode = false;
  const bankNoteBtn = document.getElementById("ui-bank-note-btn");

  /* Quantity toggle */
  for (const btn of bankQtyButtons) {
    btn.addEventListener("click", () => {
      _bankQty = btn.dataset.bankQty;
      for (const b of bankQtyButtons) b.classList.toggle("is-active", b === btn);
    });
  }
  if (bankNoteBtn) bankNoteBtn.addEventListener("click", () => {
    _bankNoteMode = !_bankNoteMode;
    bankNoteBtn.classList.toggle("is-active", _bankNoteMode);
  });

  function _renderBankSlot(container, itemType, count, onClick) {
    const slot = document.createElement("div");
    slot.className = itemType ? "ui-bank-slot" : "ui-bank-slot is-empty";
    if (itemType && count > 0) {
      const eqB = EQUIPMENT_ITEMS[baseItemId(itemType)];
      const displayName = eqB ? eqB.label : (ITEM_LABEL[itemType] || itemType);
      const icon = document.createElement("span");
      icon.className = "ui-bank-slot-icon";
      icon.textContent = eqB ? eqB.icon : (ITEM_ICON[itemType] || "?");
      slot.append(icon);
      const tip = document.createElement("div");
      tip.className = "ui-slot-tooltip";
      tip.textContent = `${displayName}\nx${count}`;
      slot.append(tip);
      if (count > 1) {
        const badge = document.createElement("span");
        badge.className = "ui-bank-slot-count";
        badge.textContent = String(count);
        slot.append(badge);
      }
      if (eqB?.tier) {
        const td = EQUIPMENT_TIERS[eqB.tier];
        if (td?.tint) slot.style.background = td.tint;
      } else {
        const ir = ITEM_RARITY[itemType];
        if (ir?.tint) slot.style.background = ir.tint;
      }
      slot.addEventListener("click", onClick);
    } else {
      const empty = document.createElement("span");
      empty.className = "ui-bank-slot-empty";
      slot.append(empty);
    }
    container.append(slot);
  }

  function setBank(payload = {}) {
    if (!bankVaultGrid || !bankInvGrid) return;
    const bank = payload.bank || {};
    const slots = Array.isArray(payload.slots) ? payload.slots : [];
    const capacity = Math.max(0, Math.floor(Number(payload.capacity) || 0));

    /* Vault grid — one slot per item type that has count > 0 */
    bankVaultGrid.innerHTML = "";
    const bankItems = Object.keys(bank).filter(k => bank[k] > 0);
    for (const key of bankItems) {
      _renderBankSlot(bankVaultGrid, key, bank[key], () => {
        if (typeof onBankTransfer === "function") onBankTransfer("withdraw", key, _bankQty, _bankNoteMode);
      });
    }
    if (bankItems.length === 0) {
      const hint = document.createElement("div");
      hint.style.cssText = "grid-column:1/-1;text-align:center;color:var(--ui-ink-3);font-size:12px;padding:8px 0";
      hint.textContent = "Bank is empty";
      bankVaultGrid.append(hint);
    }

    /* Inventory grid — show actual bag slots */
    bankInvGrid.innerHTML = "";
    for (let i = 0; i < capacity; i++) {
      const itemType = slots[i] || null;
      if (itemType && isNote(itemType)) {
        /* Render noted item slot with paper bg + icon */
        const n = parseNote(itemType);
        const slot = document.createElement("div");
        slot.className = "ui-bank-slot is-note";
        const paper = document.createElement("span");
        paper.className = "ui-note-paper";
        paper.textContent = "\uD83D\uDCC4";
        slot.append(paper);
        const icon = document.createElement("span");
        icon.className = "ui-bank-slot-icon ui-note-icon";
        icon.textContent = ITEM_ICON[n.baseItem] || "?";
        slot.append(icon);
        const badge = document.createElement("span");
        badge.className = "ui-note-qty";
        badge.textContent = String(n.qty);
        slot.append(badge);
        const tip = document.createElement("div");
        tip.className = "ui-slot-tooltip";
        tip.textContent = `Noted ${ITEM_LABEL[n.baseItem] || n.baseItem} x${n.qty}\nClick to deposit`;
        slot.append(tip);
        slot.addEventListener("click", () => {
          if (typeof onBankTransfer === "function") onBankTransfer("deposit", itemType, "all");
        });
        bankInvGrid.append(slot);
      } else {
        _renderBankSlot(bankInvGrid, itemType, 1, () => {
          if (itemType && typeof onBankTransfer === "function") onBankTransfer("deposit", itemType, _bankQty);
        });
      }
    }
  }

  function openBank(payload = {}) {
    setBank(payload);
    _bankOpen = true;
    if (bankOverlay) bankOverlay.hidden = false;
  }

  function closeBank() {
    _bankOpen = false;
    if (bankOverlay) bankOverlay.hidden = true;
  }

  function isBankOpen() { return _bankOpen; }

  function openStore(payload = {}) {
    setStore(payload);
    setPanelCollapsed(false);
    setActive("store");
    if (mobileQuery.matches) setMobileMenuOpen(true);
  }

  for (const button of buttons) {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      if (tab === activeTab && !panelCollapsed) {
        /* Same tab while open — close it */
        setPanelCollapsed(true);
        return;
      }
      /* Different tab, or same tab while closed — switch and open */
      setActive(tab);
      setPanelCollapsed(false);
    });
  }

  for (const button of toolButtons) {
    button.addEventListener("click", () => {
      const tool = button.dataset.tool;
      setActiveTool(tool);
      if (typeof onToolSelect === "function") onToolSelect(tool);
      if (mobileQuery.matches) setMobileMenuOpen(false);
    });
  }

  for (const button of smithButtons) {
    button.addEventListener("click", () => {
      const tool = button.dataset.smithUpgrade;
      if (typeof onBlacksmithUpgrade === "function") onBlacksmithUpgrade(tool);
    });
  }

  for (const button of dyeButtons) {
    button.addEventListener("click", () => {
      const id = button.dataset.storeColor;
      if (typeof onStoreColor === "function") onStoreColor(id);
    });
  }
  if (storeSellButton) {
    storeSellButton.addEventListener("click", () => {
      if (typeof onStoreSell === "function") onStoreSell();
    });
  }

  /* ── Store overlay ── */
  let _storeOpen = false;

  function _renderStoreSlot(container, icon, label, price, priceClass, onClick) {
    const slot = document.createElement("div");
    slot.className = "ui-store-slot";
    const ic = document.createElement("span");
    ic.className = "ui-store-slot-icon";
    ic.textContent = icon;
    slot.append(ic);
    if (price != null) {
      const pr = document.createElement("span");
      pr.className = "ui-store-slot-price" + (priceClass ? " " + priceClass : "");
      pr.textContent = price;
      slot.append(pr);
    }
    const tip = document.createElement("div");
    tip.className = "ui-slot-tooltip";
    tip.textContent = label;
    slot.append(tip);
    if (onClick) slot.addEventListener("click", onClick);
    else slot.classList.add("is-empty");
    container.append(slot);
    return slot;
  }

  function setStoreOverlay(payload = {}) {
    if (!storeStockGrid || !storeInvGrid) return;
    const slots = Array.isArray(payload.slots) ? payload.slots : [];
    const capacity = payload.capacity || 28;
    const coins = payload.coins || 0;
    const shopItems = payload.shopItems || [];

    if (storeCoinsEl) storeCoinsEl.textContent = `${coins}c`;

    /* Shop stock — items the store sells */
    storeStockGrid.innerHTML = "";
    for (const item of shopItems) {
      if (item.type === "color") {
        /* Color swatch slot */
        const slot = document.createElement("div");
        slot.className = "ui-store-slot";
        if (item.selected) slot.classList.add("is-selected");
        if (item.owned) slot.classList.add("is-owned");
        const swatch = document.createElement("span");
        swatch.className = "ui-store-swatch";
        const _patternGrads = {
          fire: "linear-gradient(135deg, #ff4500, #ff8c00, #ffd700)",
          ice: "linear-gradient(135deg, #87ceeb, #b0e0e6, #e0ffff)",
          galaxy: "linear-gradient(135deg, #2e1065, #7c3aed, #c084fc)",
          toxic: "linear-gradient(135deg, #22c55e, #84cc16, #facc15)",
          lava: "linear-gradient(135deg, #b91c1c, #ef4444, #f97316)",
          ocean: "linear-gradient(135deg, #0369a1, #38bdf8, #67e8f9)",
          rainbow: "linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6)",
          gold: "linear-gradient(135deg, #b8860b, #ffd700, #daa520)",
          stained: "linear-gradient(135deg, #dc2626, #2563eb, #16a34a, #eab308)",
        };
        swatch.style.background = _patternGrads[item.swatch] || item.swatch;
        slot.append(swatch);
        const pr = document.createElement("span");
        pr.className = "ui-store-slot-price";
        pr.textContent = item.owned ? (item.selected ? "✓" : "Equip") : `${item.cost}c`;
        slot.append(pr);
        const tip = document.createElement("div");
        tip.className = "ui-slot-tooltip";
        tip.textContent = item.label + (item.owned ? "\nClick to equip" : `\nBuy: ${item.cost}c`);
        slot.append(tip);
        slot.addEventListener("click", () => {
          if (typeof onStoreBuyItem === "function") onStoreBuyItem(item.id);
        });
        storeStockGrid.append(slot);
      } else if (item.type === "equipment") {
        const tipLines = [item.label, `Lvl ${item.level}  Atk +${item.atk}  Def +${item.def}`, `Buy: ${item.cost}c`];
        const slot = _renderStoreSlot(storeStockGrid, item.icon, tipLines.join("\n"), `${item.cost}c`, "", () => {
          if (typeof onStoreBuyItem === "function") onStoreBuyItem(item.id);
        });
        const td = EQUIPMENT_TIERS[item.tier];
        if (td?.tint) slot.style.background = td.tint;
      } else {
        _renderStoreSlot(storeStockGrid, item.icon, `${item.label}\nBuy: ${item.cost}c`, `${item.cost}c`, "", () => {
          if (typeof onStoreBuyItem === "function") onStoreBuyItem(item.id);
        });
      }
    }

    /* Inventory — click to sell */
    storeInvGrid.innerHTML = "";
    for (let i = 0; i < capacity; i++) {
      const itemType = slots[i] || null;
      if (itemType && isNote(itemType)) {
        const n = parseNote(itemType);
        const perPrice = SELL_PRICE[n.baseItem] || 0;
        const totalPrice = perPrice * n.qty;
        const storeSlot = _renderStoreSlot(storeInvGrid, ITEM_ICON[n.baseItem] || "?", `Noted ${ITEM_LABEL[n.baseItem] || n.baseItem} x${n.qty}\nSell: ${totalPrice}c`, `${totalPrice}c`, "is-sell", () => {
          if (typeof onStoreSellItem === "function") onStoreSellItem(i);
        });
        storeSlot.classList.add("is-note");
      } else if (itemType) {
        const eqData = EQUIPMENT_ITEMS[baseItemId(itemType)];
        const displayName = eqData ? eqData.label : (ITEM_LABEL[itemType] || itemType);
        const iconChar = eqData ? eqData.icon : (ITEM_ICON[itemType] || "?");
        const sellPrice = SELL_PRICE[baseItemId(itemType)];
        const priceText = sellPrice ? `${sellPrice}c` : "0c";
        const storeSlot = _renderStoreSlot(storeInvGrid, iconChar, `${displayName}\nSell: ${priceText}`, priceText, "is-sell", () => {
          if (typeof onStoreSellItem === "function") onStoreSellItem(i);
        });
        if (eqData?.tier) {
          const td = EQUIPMENT_TIERS[eqData.tier];
          if (td?.tint) storeSlot.style.background = td.tint;
        }
      } else {
        const slot = document.createElement("div");
        slot.className = "ui-store-slot is-empty";
        storeInvGrid.append(slot);
      }
    }
  }

  function openStoreOverlay(payload = {}) {
    setStoreOverlay(payload);
    _storeOpen = true;
    if (storeOverlay) storeOverlay.hidden = false;
  }

  function closeStoreOverlay() {
    _storeOpen = false;
    if (storeOverlay) storeOverlay.hidden = true;
  }

  function isStoreOpen() { return _storeOpen; }

  if (storeCloseBtn) storeCloseBtn.addEventListener("click", closeStoreOverlay);
  if (storeOverlay) storeOverlay.addEventListener("click", (e) => {
    if (e.target === storeOverlay) closeStoreOverlay();
  });
  if (storeSellAllBtn) storeSellAllBtn.addEventListener("click", () => {
    if (typeof onStoreSell === "function") onStoreSell();
  });

  /* Bank overlay close handlers */
  if (bankCloseBtn) bankCloseBtn.addEventListener("click", closeBank);
  if (bankOverlay) bankOverlay.addEventListener("click", (e) => {
    if (e.target === bankOverlay) closeBank();
  });

  for (const button of combatStyleButtons) {
    button.addEventListener("click", () => {
      if (!button.dataset.combatStyle) return;
      const style = button.dataset.combatStyle;
      for (const b of combatStyleButtons) b.classList.toggle("is-active", b === button);
      if (typeof onCombatStyle === "function") onCombatStyle(style);
    });
  }
  if (attackButton) {
    attackButton.addEventListener("click", () => {
      if (typeof onAttack === "function") onAttack();
    });
  }

  const prayerButtons = Array.from(document.querySelectorAll(".ui-prayer-btn"));
  for (const button of prayerButtons) {
    button.addEventListener("click", () => {
      const id = button.dataset.prayer;
      if (!id) return;
      const wasActive = button.classList.contains("is-active");
      if (typeof onPrayerToggle === "function") onPrayerToggle(id, !wasActive);
    });
  }

  function setPrayerActive(id, active) {
    for (const b of prayerButtons) {
      if (b.dataset.prayer === id) b.classList.toggle("is-active", active);
    }
  }

  const emoteButtons = Array.from(document.querySelectorAll(".ui-emote-btn"));
  for (const button of emoteButtons) {
    button.addEventListener("click", () => {
      const emote = button.dataset.emote;
      if (typeof onEmote === "function") onEmote(emote);
      if (mobileQuery.matches) setMobileMenuOpen(false);
    });
  }

  if (mobileToggle) {
    mobileToggle.addEventListener("click", () => {
      const open = !uiRoot?.classList.contains("mobile-open");
      if (open) setPanelCollapsed(false);
      setMobileMenuOpen(open);
    });
  }
  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", refreshMobileLayout);
  } else if (typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(refreshMobileLayout);
  }

  refreshMobileLayout();
  setPanelCollapsed(false);
  setActive("inventory");
  setActiveTool("fishing");
  setFriendsState({ connected: false, peers: 0 });

  /* ── Settings overlay ── */
  const settingsBtn = document.getElementById("ui-settings-btn");
  const settingsOverlay = document.getElementById("ui-settings-overlay");
  const settingsClose = document.getElementById("ui-settings-close");
  if (settingsBtn && settingsOverlay) {
    settingsBtn.addEventListener("click", () => {
      settingsOverlay.hidden = !settingsOverlay.hidden;
    });
    if (settingsClose) settingsClose.addEventListener("click", () => { settingsOverlay.hidden = true; });
  }

  /* ── Hotkey binding system ── */
  const HOTKEY_STORAGE_KEY = "skilling_hotkeys";
  const hotkeyRows = Array.from(document.querySelectorAll(".ui-hotkey-row"));
  const hotkeys = JSON.parse(localStorage.getItem(HOTKEY_STORAGE_KEY) || "{}");
  let pendingHotkeyRow = null;

  function renderHotkeys() {
    for (const row of hotkeyRows) {
      const tab = row.dataset.hotkeyTab;
      const display = row.querySelector(".ui-hotkey-display");
      if (display) display.textContent = hotkeys[tab] || "—";
      /* show key hint under dock button */
      const dockBtn = document.querySelector(`.ui-tab-btn[data-tab="${tab}"]`);
      if (dockBtn) {
        let hint = dockBtn.querySelector(".ui-tab-hotkey");
        if (!hint) { hint = document.createElement("span"); hint.className = "ui-tab-hotkey"; dockBtn.appendChild(hint); }
        hint.textContent = hotkeys[tab] || "";
      }
    }
  }

  for (const row of hotkeyRows) {
    const setBtn = row.querySelector(".ui-hotkey-set-btn");
    if (setBtn) setBtn.addEventListener("click", () => {
      if (pendingHotkeyRow) pendingHotkeyRow.classList.remove("is-listening");
      pendingHotkeyRow = row;
      row.classList.add("is-listening");
      setBtn.textContent = "Press…";
    });
  }

  window.addEventListener("keydown", (e) => {
    /* close overlays on Escape */
    if (_storeOpen && e.key === "Escape") { closeStoreOverlay(); e.preventDefault(); return; }
    if (_bankOpen && e.key === "Escape") { closeBank(); e.preventDefault(); return; }
    if (_smithOpen && e.key === "Escape") { closeBlacksmith(); e.preventDefault(); return; }
    /* cancel hotkey listen on Escape */
    if (pendingHotkeyRow && e.key === "Escape") {
      pendingHotkeyRow.classList.remove("is-listening");
      pendingHotkeyRow.querySelector(".ui-hotkey-set-btn").textContent = "Set";
      pendingHotkeyRow = null;
      return;
    }
    /* assign hotkey */
    if (pendingHotkeyRow) {
      if (["Shift","Control","Alt","Meta"].includes(e.key)) return;
      const tab = pendingHotkeyRow.dataset.hotkeyTab;
      hotkeys[tab] = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(hotkeys));
      pendingHotkeyRow.classList.remove("is-listening");
      pendingHotkeyRow.querySelector(".ui-hotkey-set-btn").textContent = "Set";
      pendingHotkeyRow = null;
      renderHotkeys();
      e.preventDefault();
      return;
    }
    /* activate tab via hotkey (skip if typing in input or key repeat) */
    if (e.repeat) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const pressed = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    for (const [tab, key] of Object.entries(hotkeys)) {
      if (key === pressed) {
        if (activeTab === tab && !panelCollapsed) {
          setPanelCollapsed(true);
        } else {
          setActive(tab);
          setPanelCollapsed(false);
        }
        e.preventDefault();
        return;
      }
    }
  });

  renderHotkeys();

  /* ── Volume slider ── */
  const volumeSlider = document.getElementById("setting-volume");
  const volumeMuteBtn = document.getElementById("setting-volume-mute");
  let _muted = false, _premuteVol = 0.5;
  if (volumeSlider) {
    volumeSlider.addEventListener("input", () => {
      const v = parseInt(volumeSlider.value) / 100;
      _muted = false;
      if (volumeMuteBtn) volumeMuteBtn.textContent = v === 0 ? "\u{1F507}" : "\u{1F50A}";
      if (typeof onVolumeChange === "function") onVolumeChange(v);
    });
  }
  if (volumeMuteBtn) {
    volumeMuteBtn.addEventListener("click", () => {
      if (_muted) {
        _muted = false;
        if (volumeSlider) volumeSlider.value = String(Math.round(_premuteVol * 100));
        volumeMuteBtn.textContent = "\u{1F50A}";
        if (typeof onVolumeChange === "function") onVolumeChange(_premuteVol);
      } else {
        _muted = true;
        _premuteVol = volumeSlider ? parseInt(volumeSlider.value) / 100 : 0.5;
        if (volumeSlider) volumeSlider.value = "0";
        volumeMuteBtn.textContent = "\u{1F507}";
        if (typeof onVolumeChange === "function") onVolumeChange(0);
      }
    });
  }

  function setVolumeSlider(v) {
    if (volumeSlider) volumeSlider.value = String(Math.round(v * 100));
    if (volumeMuteBtn) volumeMuteBtn.textContent = v === 0 ? "\u{1F507}" : "\u{1F50A}";
  }

  /* ── Music slider ── */
  const musicSlider = document.getElementById("setting-music");
  const musicMuteBtn = document.getElementById("setting-music-mute");
  let _musicMuted = false, _premuteMusicVol = 0.35;
  if (musicSlider) {
    musicSlider.addEventListener("input", () => {
      const v = parseInt(musicSlider.value) / 100;
      _musicMuted = false;
      if (musicMuteBtn) musicMuteBtn.textContent = v === 0 ? "\u{1F507}" : "\u{1F3B5}";
      if (typeof onMusicChange === "function") onMusicChange(v);
    });
  }
  if (musicMuteBtn) {
    musicMuteBtn.addEventListener("click", () => {
      if (_musicMuted) {
        _musicMuted = false;
        if (musicSlider) musicSlider.value = String(Math.round(_premuteMusicVol * 100));
        musicMuteBtn.textContent = "\u{1F3B5}";
        if (typeof onMusicChange === "function") onMusicChange(_premuteMusicVol);
      } else {
        _musicMuted = true;
        _premuteMusicVol = musicSlider ? parseInt(musicSlider.value) / 100 : 0.35;
        if (musicSlider) musicSlider.value = "0";
        musicMuteBtn.textContent = "\u{1F507}";
        if (typeof onMusicChange === "function") onMusicChange(0);
      }
    });
  }

  function setMusicSlider(v) {
    if (musicSlider) musicSlider.value = String(Math.round(v * 100));
    if (musicMuteBtn) musicMuteBtn.textContent = v === 0 ? "\u{1F507}" : "\u{1F3B5}";
  }

  /* ── Worn Equipment ── */
  const wornSlotEls = Array.from(document.querySelectorAll("[data-worn-slot]"));
  const wornAtkEl = document.getElementById("ui-worn-atk");
  const wornDefEl = document.getElementById("ui-worn-def");

  let _wornSlotData = {}; // { slotName: { itemId, stars } }
  for (const slotEl of wornSlotEls) {
    /* click = unequip */
    slotEl.addEventListener("click", () => {
      const slot = slotEl.dataset.wornSlot;
      const data = _wornSlotData[slot];
      if (data && data.itemId && typeof onUnequipSlot === "function") {
        onUnequipSlot(slot);
      }
    });
    /* right-click = context menu with Enhance */
    slotEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const slot = slotEl.dataset.wornSlot;
      const data = _wornSlotData[slot];
      if (!data || !data.itemId) return;
      _ctxMenu.innerHTML = "";
      _ctxMenu.appendChild(_ctxBtn("Enhance \u2605", () => openStarEnhance(slot, data.itemId, data.stars || 0)));
      _ctxMenu.appendChild(_ctxBtn("Unequip", () => { if (typeof onUnequipSlot === "function") onUnequipSlot(slot); }));
      _ctxMenu.style.left = e.clientX + "px";
      _ctxMenu.style.top = e.clientY + "px";
      _ctxMenu.style.display = "block";
    });
  }

  function setWorn(payload = {}) {
    const slots = payload.slots || {};
    const starsMap = payload.stars || {};
    let totalAtk = 0, totalDef = 0;
    for (const slotEl of wornSlotEls) {
      const slotName = slotEl.dataset.wornSlot;
      const itemId = slots[slotName] || null;
      const stars = starsMap[slotName] || 0;
      const item = itemId ? EQUIPMENT_ITEMS[baseItemId(itemId)] : null;
      _wornSlotData[slotName] = { itemId, stars };
      /* clear existing content except label */
      const label = slotEl.querySelector(".ui-worn-label");
      slotEl.innerHTML = "";
      if (label) slotEl.appendChild(label);

      if (item) {
        const bonuses = _starCalcBonuses(itemId, stars);
        slotEl.classList.add("is-equipped");
        const tierData = item.tier ? EQUIPMENT_TIERS[item.tier] : null;
        slotEl.style.setProperty("--eq-color", item.color + "88");
        if (tierData?.tint) slotEl.style.background = tierData.tint;
        const icon = document.createElement("span");
        icon.className = "ui-worn-slot-icon";
        icon.textContent = item.icon;
        slotEl.appendChild(icon);
        const name = document.createElement("span");
        name.className = "ui-worn-slot-name";
        name.textContent = item.label + (stars > 0 ? ` \u2605${stars}` : "");
        name.style.color = item.color;
        slotEl.appendChild(name);
        /* tooltip shows enhanced stats */
        const tipItem = { ...item, atk: bonuses.atk, def: bonuses.def };
        _attachEqTooltip(slotEl, tipItem, "Click to enhance / manage", null, stars);
        totalAtk += bonuses.atk;
        totalDef += bonuses.def;
      } else {
        slotEl.classList.remove("is-equipped");
        slotEl.style.removeProperty("--eq-color");
        slotEl.style.removeProperty("background");
        slotEl.onmouseenter = null;
        slotEl.onmouseleave = null;
      }
    }
    if (wornAtkEl) wornAtkEl.textContent = String(totalAtk);
    if (wornDefEl) wornDefEl.textContent = String(totalDef);
  }

  /* ── Worn tab: Skin selector ── */
  const wornSkinSlot = document.getElementById("ui-worn-skin-slot");
  const _patternGrads = {
    fire: "linear-gradient(135deg, #ff4500, #ff8c00, #ffd700)",
    ice: "linear-gradient(135deg, #87ceeb, #b0e0e6, #e0ffff)",
    galaxy: "linear-gradient(135deg, #2e1065, #7c3aed, #c084fc)",
    toxic: "linear-gradient(135deg, #22c55e, #84cc16, #facc15)",
    lava: "linear-gradient(135deg, #b91c1c, #ef4444, #f97316)",
    ocean: "linear-gradient(135deg, #0369a1, #38bdf8, #67e8f9)",
    rainbow: "linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6)",
    gold: "linear-gradient(135deg, #b8860b, #ffd700, #daa520)",
    stained: "linear-gradient(135deg, #dc2626, #2563eb, #16a34a, #eab308)",
  };

  const wornSkinGrid = document.getElementById("ui-worn-skin-grid");

  function setWornSkins(payload = {}) {
    if (!wornSkinSlot) return;
    wornSkinSlot.innerHTML = "";
    const selected = payload.selected || "lime";
    const unlocked = new Set(payload.unlocked || ["lime"]);
    const skin = SLIME_COLOR_SHOP.find(s => s.id === selected);
    if (!skin) return;
    /* Equipped skin slot */
    wornSkinSlot.className = "ui-worn-skin-slot is-equipped";
    const swatch = document.createElement("span");
    swatch.className = "ui-worn-skin-swatch-item";
    swatch.style.background = _patternGrads[skin.color] || skin.color;
    wornSkinSlot.append(swatch);
    const label = document.createElement("span");
    label.className = "ui-worn-skin-label";
    label.textContent = skin.label;
    wornSkinSlot.append(label);
    const tip = document.createElement("div");
    tip.className = "ui-slot-tooltip";
    tip.textContent = selected !== "lime" ? `${skin.label} Skin\nClick to unequip` : `${skin.label} Skin (Default)`;
    wornSkinSlot.append(tip);
    if (selected !== "lime") {
      wornSkinSlot.style.cursor = "pointer";
      wornSkinSlot.onclick = () => { if (typeof onStoreColor === "function") onStoreColor("lime"); };
    } else {
      wornSkinSlot.style.cursor = "default";
      wornSkinSlot.onclick = null;
    }
    /* Grid of all unlocked skins */
    if (!wornSkinGrid) return;
    wornSkinGrid.innerHTML = "";
    for (const s of SLIME_COLOR_SHOP) {
      if (!unlocked.has(s.id)) continue;
      if (s.id === selected) continue; // skip currently equipped
      const btn = document.createElement("div");
      btn.className = "ui-worn-skin-btn";
      const sw = document.createElement("span");
      sw.className = "ui-worn-skin-swatch";
      sw.style.background = _patternGrads[s.color] || s.color;
      btn.append(sw);
      const lbl = document.createElement("span");
      lbl.textContent = s.label;
      btn.append(lbl);
      btn.addEventListener("click", () => {
        if (typeof onStoreColor === "function") onStoreColor(s.id);
      });
      wornSkinGrid.append(btn);
    }
  }

  /* ── Blacksmith Equipment Crafting ── */
  const smithCraftListEl = document.getElementById("ui-smith-craft-list");

  const _craftCategories = [
    { id: "sword", label: "\u2694\uFE0F Swords", slots: ["sword"] },
    { id: "bow", label: "\uD83C\uDFF9 Bows", slots: ["bow"] },
    { id: "staff", label: "\uD83E\uDE84 Staffs", slots: ["staff"] },
    { id: "armor", label: "\uD83D\uDEE1\uFE0F Armor", slots: ["body", "shield"] },
    { id: "acc", label: "\uD83D\uDC8D Accessories", slots: ["cape", "ring", "amulet"] },
  ];
  let _craftActiveCategory = "sword";

  function setBlacksmithCrafting(payload = {}) {
    if (!smithCraftListEl) return;
    smithCraftListEl.innerHTML = "";
    const bagCounts = payload.bagCounts || {};
    const combatLevel = payload.combatLevel || 1;

    /* Category tabs */
    const tabBar = document.createElement("div");
    tabBar.className = "ui-craft-tabs";
    for (const cat of _craftCategories) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "ui-craft-tab" + (cat.id === _craftActiveCategory ? " is-active" : "");
      tab.textContent = cat.label;
      tab.addEventListener("click", () => {
        _craftActiveCategory = cat.id;
        setBlacksmithCrafting(payload);
      });
      tabBar.appendChild(tab);
    }
    smithCraftListEl.appendChild(tabBar);

    /* Filtered recipes */
    const activeCat = _craftCategories.find(c => c.id === _craftActiveCategory);
    const activeSlots = activeCat ? activeCat.slots : [];
    const recipes = Object.entries(EQUIPMENT_RECIPES).filter(([id]) => {
      const item = EQUIPMENT_ITEMS[baseItemId(id)];
      return item && activeSlots.includes(item.slot);
    });

    for (const [itemId, recipe] of recipes) {
      const item = EQUIPMENT_ITEMS[baseItemId(itemId)];
      if (!item) continue;
      const tierData = item.tier ? EQUIPMENT_TIERS[item.tier] : null;
      const row = document.createElement("div");
      row.className = "ui-smith-row";
      if (tierData?.tint) row.style.background = tierData.tint;
      const meta = document.createElement("div");
      meta.className = "ui-smith-meta";
      const nameEl = document.createElement("strong");
      nameEl.textContent = item.icon + " " + item.label;
      nameEl.style.color = item.color;
      meta.appendChild(nameEl);
      /* Stats preview */
      const statsEl = document.createElement("span");
      statsEl.className = "ui-smith-stats";
      const statParts = [];
      if (item.atk > 0) statParts.push(`+${item.atk} Atk`);
      if (item.def > 0) statParts.push(`+${item.def} Def`);
      statsEl.textContent = statParts.join("  ");
      meta.appendChild(statsEl);
      const matLines = Object.entries(recipe.materials).map(([k, v]) => {
        const have = bagCounts[k] || 0;
        const color = have >= v ? "#5cff8a" : "#ff6b6b";
        return `<span style="color:${color}">${ITEM_LABEL[k] || k}: ${have}/${v}</span>`;
      }).join(" ");
      const info = document.createElement("span");
      info.innerHTML = `Lv ${recipe.level} | ${matLines}`;
      meta.appendChild(info);
      row.appendChild(meta);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ui-smith-buy-btn";
      btn.textContent = "Craft";
      const canCraft = combatLevel >= recipe.level && Object.entries(recipe.materials).every(([k, v]) => (bagCounts[k] || 0) >= v);
      if (!canCraft) btn.classList.add("is-unaffordable");
      btn.addEventListener("click", () => {
        if (typeof onCraftEquipment === "function") onCraftEquipment(itemId);
      });
      row.appendChild(btn);
      smithCraftListEl.appendChild(row);
    }
    if (recipes.length === 0) {
      const hint = document.createElement("div");
      hint.style.cssText = "text-align:center;color:var(--ui-ink-3);font-size:12px;padding:12px 0";
      hint.textContent = "No recipes in this category";
      smithCraftListEl.appendChild(hint);
    }
  }

  /* ── Star Enhancement Overlay ── */
  const starOverlay = document.getElementById("ui-star-overlay");
  const starClose = document.getElementById("ui-star-close");
  const starItemIcon = document.getElementById("ui-star-item-icon");
  const starItemName = document.getElementById("ui-star-item-name");
  const starStarsEl = document.getElementById("ui-star-stars");
  const starAtkEl = document.getElementById("ui-star-atk");
  const starDefEl = document.getElementById("ui-star-def");
  const starCostEl = document.getElementById("ui-star-cost");
  const starChanceEl = document.getElementById("ui-star-chance");
  const starDestroyEl = document.getElementById("ui-star-destroy");
  const starZone = document.getElementById("ui-star-zone");
  const starCursor = document.getElementById("ui-star-cursor");
  const starEnhanceBtn = document.getElementById("ui-star-enhance-btn");
  const starStopBtn = document.getElementById("ui-star-stop-btn");
  const starResultEl = document.getElementById("ui-star-result");

  let _starSlot = null;
  let _starItemId = null;
  let _starLevel = 0;
  let _starTimingAnim = null;
  let _starTimingPos = 0; // 0-100
  let _starTimingBonus = 0;
  let _starPhase = "idle"; // idle | timing | done

  function _starCalcBonuses(itemId, stars) {
    const item = EQUIPMENT_ITEMS[baseItemId(itemId)];
    if (!item) return { atk: 0, def: 0 };
    let bonusAtk = 0, bonusDef = 0;
    for (let i = 0; i < stars; i++) {
      bonusAtk += STAR_ATK_PER[i] || 0;
      bonusDef += STAR_DEF_PER[i] || 0;
    }
    return { atk: item.atk + bonusAtk, def: item.def + bonusDef };
  }

  function _renderStarOverlay() {
    const item = EQUIPMENT_ITEMS[baseItemId(_starItemId)];
    if (!item) return;
    if (starItemIcon) starItemIcon.textContent = item.icon;
    if (starItemName) { starItemName.textContent = item.label; starItemName.style.color = item.color; }
    // Stars display
    if (starStarsEl) {
      let html = "";
      for (let i = 0; i < STAR_MAX; i++) {
        if (i > 0 && i % 5 === 0) html += " ";
        html += i < _starLevel
          ? `<span class="ui-star-star-on">\u2605</span>`
          : `<span class="ui-star-star-off">\u2606</span>`;
      }
      starStarsEl.innerHTML = html;
    }
    const bonuses = _starCalcBonuses(_starItemId, _starLevel);
    if (starAtkEl) starAtkEl.textContent = `+${bonuses.atk}`;
    if (starDefEl) starDefEl.textContent = `+${bonuses.def}`;
    const isMax = _starLevel >= STAR_MAX;
    const cost = isMax ? 0 : STAR_COSTS[_starLevel];
    const canAfford = _currentCoins >= cost;
    if (starCostEl) {
      starCostEl.textContent = isMax ? "MAX" : `${cost}c`;
      starCostEl.style.color = isMax ? "" : (canAfford ? "#ffe680" : "#ff6b6b");
    }
    const starCoinsEl = document.getElementById("ui-star-coins");
    if (starCoinsEl) starCoinsEl.textContent = `${_currentCoins}c`;
    if (starEnhanceBtn) starEnhanceBtn.disabled = isMax || !canAfford;
    if (starChanceEl) starChanceEl.textContent = isMax ? "-" : `${STAR_SUCCESS[_starLevel]}%`;
    if (starDestroyEl) starDestroyEl.textContent = isMax ? "-" : `${STAR_DESTROY[_starLevel]}%`;
    const starDowngradeEl = document.getElementById("ui-star-downgrade");
    if (starDowngradeEl) {
      const dg = isMax ? 0 : (STAR_DOWNGRADE[_starLevel] || 0);
      starDowngradeEl.textContent = dg > 0 ? `${dg}%` : "-";
    }
    // Green zone size shrinks with level
    if (starZone) {
      const zoneWidth = isMax ? 0 : Math.max(8, 40 - _starLevel * 3);
      const zoneLeft = 50 - zoneWidth / 2;
      starZone.style.left = zoneLeft + "%";
      starZone.style.width = zoneWidth + "%";
    }
  }

  function openStarEnhance(slot, itemId, stars) {
    _starSlot = slot;
    _starItemId = itemId;
    _starLevel = stars || 0;
    _starPhase = "idle";
    _starTimingBonus = 0;
    if (starResultEl) { starResultEl.textContent = ""; starResultEl.className = "ui-star-result"; }
    if (starStopBtn) starStopBtn.hidden = true;
    if (starEnhanceBtn) starEnhanceBtn.hidden = false;
    if (starCursor) starCursor.style.left = "0%";
    _stopTimingAnim();
    _renderStarOverlay();
    if (starOverlay) starOverlay.hidden = false;
  }

  function closeStarEnhance() {
    _stopTimingAnim();
    _starPhase = "idle";
    if (starOverlay) starOverlay.hidden = true;
  }

  function _stopTimingAnim() {
    if (_starTimingAnim) { cancelAnimationFrame(_starTimingAnim); _starTimingAnim = null; }
  }

  function _startTimingBar() {
    _starPhase = "timing";
    _starTimingPos = 0;
    _starTimingBonus = 0;
    if (starEnhanceBtn) starEnhanceBtn.hidden = true;
    if (starStopBtn) starStopBtn.hidden = false;
    if (starResultEl) { starResultEl.textContent = ""; starResultEl.className = "ui-star-result"; }
    let dir = 1;
    const speed = 1.2 + _starLevel * 0.3; // faster at higher stars
    function tick() {
      _starTimingPos += dir * speed;
      if (_starTimingPos >= 100) { _starTimingPos = 100; dir = -1; }
      if (_starTimingPos <= 0) { _starTimingPos = 0; dir = 1; }
      if (starCursor) starCursor.style.left = _starTimingPos + "%";
      _starTimingAnim = requestAnimationFrame(tick);
    }
    _starTimingAnim = requestAnimationFrame(tick);
  }

  function _stopTimingBar() {
    _stopTimingAnim();
    if (typeof onStarTimingStop === "function") onStarTimingStop();
    // Check if cursor is in the green zone
    const isMax = _starLevel >= STAR_MAX;
    const zoneWidth = isMax ? 0 : Math.max(8, 40 - _starLevel * 3);
    const zoneLeft = 50 - zoneWidth / 2;
    const zoneRight = zoneLeft + zoneWidth;
    const inZone = _starTimingPos >= zoneLeft && _starTimingPos <= zoneRight;
    // Bonus scales by how centered — max at dead center
    if (inZone) {
      const center = 50;
      const dist = Math.abs(_starTimingPos - center);
      const maxDist = zoneWidth / 2;
      _starTimingBonus = Math.round(STAR_TIMING_BONUS * (1 - dist / maxDist));
    } else {
      _starTimingBonus = 0;
    }
    _starPhase = "done";
    if (starStopBtn) starStopBtn.hidden = true;
    // Fire enhance callback
    if (typeof onStarEnhance === "function") {
      onStarEnhance(_starSlot, _starTimingBonus);
    }
  }

  /* ── Star VFX helpers ── */
  function _starSpawnParticles(count, colors, container) {
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "ui-star-particle";
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const dist = 40 + Math.random() * 80;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 4 + Math.random() * 6;
      p.style.cssText = `left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;background:${color};--dx:${dx}px;--dy:${dy}px;`;
      document.body.appendChild(p);
      p.addEventListener("animationend", () => p.remove());
    }
  }

  function _starFlash(color, duration) {
    const flash = document.createElement("div");
    flash.className = "ui-star-flash";
    flash.style.background = color;
    flash.style.animationDuration = duration + "ms";
    const modal = starOverlay?.querySelector(".ui-star-modal");
    if (modal) { modal.appendChild(flash); flash.addEventListener("animationend", () => flash.remove()); }
  }

  function showStarResult(result, newStars) {
    _starLevel = newStars;
    _renderStarOverlay();
    const modal = starOverlay?.querySelector(".ui-star-modal");
    if (starResultEl) {
      if (result === "success") {
        starResultEl.textContent = `\u2605 Enhanced to ${newStars} stars!`;
        starResultEl.className = "ui-star-result success";
        /* golden sparkle burst + flash */
        if (modal) {
          _starSpawnParticles(18, ["#ffe040", "#ffcc00", "#fff8a0", "#ffaa00", "#ffffff"], modal);
          _starFlash("rgba(255,224,64,0.25)", 400);
          modal.classList.remove("star-shake-success");
          void modal.offsetWidth;
          modal.classList.add("star-shake-success");
        }
        /* pulse the new star */
        if (starStarsEl) {
          const starEls = starStarsEl.querySelectorAll(".ui-star-star-on");
          const last = starEls[starEls.length - 1];
          if (last) { last.classList.add("star-pop"); last.addEventListener("animationend", () => last.classList.remove("star-pop"), { once: true }); }
        }
      } else if (result === "fail") {
        starResultEl.textContent = "Enhancement failed...";
        starResultEl.className = "ui-star-result fail";
        if (modal) {
          modal.classList.remove("star-shake-fail");
          void modal.offsetWidth;
          modal.classList.add("star-shake-fail");
        }
      } else if (result === "destroy") {
        starResultEl.textContent = "DESTROYED! Item lost!";
        starResultEl.className = "ui-star-result destroy";
        if (modal) {
          _starSpawnParticles(30, ["#ff4444", "#ff6b6b", "#ff2222", "#ff8844", "#ffaa44"], modal);
          _starFlash("rgba(255,50,50,0.35)", 600);
          modal.classList.remove("star-shake-destroy");
          void modal.offsetWidth;
          modal.classList.add("star-shake-destroy");
        }
      } else if (result === "downgrade") {
        starResultEl.textContent = `Downgraded to ${newStars} stars...`;
        starResultEl.className = "ui-star-result downgrade";
        if (modal) {
          _starSpawnParticles(10, ["#ffaa44", "#ff8800", "#ff6633"], modal);
          _starFlash("rgba(255,140,50,0.2)", 350);
          modal.classList.remove("star-shake-destroy");
          void modal.offsetWidth;
          modal.classList.add("star-shake-destroy");
        }
      } else if (result === "maxed") {
        starResultEl.textContent = "\u2605 Already at max stars!";
        starResultEl.className = "ui-star-result maxed";
      } else if (result === "broke") {
        starResultEl.textContent = "Not enough coins!";
        starResultEl.className = "ui-star-result fail";
        if (modal) {
          modal.classList.remove("star-shake-fail");
          void modal.offsetWidth;
          modal.classList.add("star-shake-fail");
        }
      }
    }
    if (starEnhanceBtn) starEnhanceBtn.hidden = false;
    if (result === "destroy") {
      setTimeout(() => closeStarEnhance(), 1500);
    }
  }

  const starUnequipBtn = document.getElementById("ui-star-unequip-btn");
  if (starUnequipBtn) starUnequipBtn.addEventListener("click", () => {
    if (_starSlot && typeof onUnequipSlot === "function") {
      onUnequipSlot(_starSlot);
      closeStarEnhance();
    }
  });
  if (starClose) starClose.addEventListener("click", closeStarEnhance);
  if (starOverlay) starOverlay.addEventListener("click", (e) => { if (e.target === starOverlay) closeStarEnhance(); });
  if (starEnhanceBtn) starEnhanceBtn.addEventListener("click", () => {
    if (_starLevel >= STAR_MAX) return;
    const cost = STAR_COSTS[_starLevel] || 0;
    if (_currentCoins < cost) {
      if (starResultEl) { starResultEl.textContent = "Not enough coins!"; starResultEl.className = "ui-star-result fail"; }
      return;
    }
    _startTimingBar();
  });
  if (starStopBtn) starStopBtn.addEventListener("click", _stopTimingBar);

  /* ── Trade UI ── */
  const tradeOverlay = document.getElementById("ui-trade-overlay");
  const tradeCloseBtn = document.getElementById("ui-trade-close");
  const tradePartnerName = document.getElementById("ui-trade-partner-name");
  const tradeMyOfferGrid = document.getElementById("ui-trade-my-offer");
  const tradeTheirOfferGrid = document.getElementById("ui-trade-their-offer");
  const tradeInvGrid = document.getElementById("ui-trade-inv-grid");
  const tradeAcceptBtn = document.getElementById("ui-trade-accept");
  const tradeDeclineBtn = document.getElementById("ui-trade-decline");
  const tradeStatusEl = document.getElementById("ui-trade-status");
  const tradeRequestEl = document.getElementById("ui-trade-request");
  const tradeRequestText = document.getElementById("ui-trade-request-text");
  const tradeRequestAccept = document.getElementById("ui-trade-request-accept");
  const tradeRequestDecline = document.getElementById("ui-trade-request-decline");

  let _tradeOpen = false;
  let _tradeAccepted = false;

  function _renderTradeSlot(container, itemId, onClick) {
    const slot = document.createElement("div");
    if (!itemId) {
      slot.className = "ui-trade-slot is-empty";
      container.append(slot);
      return;
    }
    slot.className = "ui-trade-slot";
    if (isNote(itemId)) {
      const n = parseNote(itemId);
      slot.classList.add("is-note");
      const paper = document.createElement("span");
      paper.className = "ui-note-paper";
      paper.textContent = "\uD83D\uDCC4";
      slot.append(paper);
      const icon = document.createElement("span");
      icon.className = "ui-bag-slot-icon ui-note-icon";
      icon.textContent = ITEM_ICON[n.baseItem] || "?";
      slot.append(icon);
      const badge = document.createElement("span");
      badge.className = "ui-note-qty";
      badge.textContent = String(n.qty);
      slot.append(badge);
      const tip = document.createElement("div");
      tip.className = "ui-slot-tooltip";
      tip.textContent = `Noted ${ITEM_LABEL[n.baseItem] || n.baseItem} x${n.qty}`;
      slot.append(tip);
    } else {
      const eqData = EQUIPMENT_ITEMS[baseItemId(itemId)];
      const displayName = eqData ? eqData.label : (ITEM_LABEL[itemId] || ITEM_LABEL[baseItemId(itemId)] || itemId);
      const icon = document.createElement("span");
      icon.className = "ui-bag-slot-icon";
      icon.textContent = eqData ? eqData.icon : (ITEM_ICON[itemId] || ITEM_ICON[baseItemId(itemId)] || "?");
      slot.append(icon);
      if (eqData?.tier) {
        const td = EQUIPMENT_TIERS[eqData.tier];
        if (td?.tint) slot.style.background = td.tint;
      }
      const tip = document.createElement("div");
      tip.className = "ui-slot-tooltip";
      let tipText = displayName;
      if (eqData) tipText += `\n+${eqData.atk} Atk  +${eqData.def} Def`;
      slot.append(tip);
      tip.textContent = tipText;
    }
    if (onClick) slot.addEventListener("click", onClick);
    container.append(slot);
  }

  function setTrade(payload = {}) {
    if (!tradeMyOfferGrid || !tradeTheirOfferGrid || !tradeInvGrid) return;
    const myOffer = payload.myOffer || [];
    const theirOffer = payload.theirOffer || [];
    const slots = payload.slots || [];
    const capacity = payload.capacity || 28;
    const partnerName = payload.partnerName || "Player";
    const partnerAccepted = !!payload.partnerAccepted;
    _tradeAccepted = !!payload.myAccepted;

    if (tradePartnerName) tradePartnerName.textContent = partnerName;

    tradeMyOfferGrid.innerHTML = "";
    for (let i = 0; i < 12; i++) {
      _renderTradeSlot(tradeMyOfferGrid, myOffer[i] || null, myOffer[i] ? () => {
        if (typeof onTradeRemoveItem === "function") onTradeRemoveItem(i);
      } : null);
    }

    tradeTheirOfferGrid.innerHTML = "";
    for (let i = 0; i < 12; i++) {
      _renderTradeSlot(tradeTheirOfferGrid, theirOffer[i] || null, null);
    }

    tradeInvGrid.innerHTML = "";
    for (let i = 0; i < capacity; i++) {
      const itemType = slots[i] || null;
      _renderTradeSlot(tradeInvGrid, itemType, itemType ? () => {
        if (typeof onTradeOfferItem === "function") onTradeOfferItem(i);
      } : null);
    }

    if (tradeAcceptBtn) {
      tradeAcceptBtn.classList.toggle("is-accepted", _tradeAccepted);
      tradeAcceptBtn.textContent = _tradeAccepted ? "Accepted \u2713" : "Accept";
    }
    if (tradeStatusEl) {
      if (partnerAccepted && _tradeAccepted) tradeStatusEl.textContent = "Trade completing...";
      else if (partnerAccepted) tradeStatusEl.textContent = "Partner has accepted.";
      else if (_tradeAccepted) tradeStatusEl.textContent = "Waiting for partner...";
      else tradeStatusEl.textContent = "";
    }
  }

  function openTrade(payload = {}) {
    setTrade(payload);
    _tradeOpen = true;
    _tradeAccepted = false;
    if (tradeOverlay) tradeOverlay.hidden = false;
  }

  function closeTrade() {
    _tradeOpen = false;
    _tradeAccepted = false;
    if (tradeOverlay) tradeOverlay.hidden = true;
  }

  function isTradeOpen() { return _tradeOpen; }

  function showTradeRequest(name, onAccept, onDecline) {
    if (!tradeRequestEl) return;
    if (tradeRequestText) tradeRequestText.textContent = `${name} wants to trade!`;
    tradeRequestEl.hidden = false;
    const _accept = () => { tradeRequestEl.hidden = true; cleanup(); onAccept(); };
    const _decline = () => { tradeRequestEl.hidden = true; cleanup(); onDecline(); };
    function cleanup() {
      tradeRequestAccept?.removeEventListener("click", _accept);
      tradeRequestDecline?.removeEventListener("click", _decline);
    }
    tradeRequestAccept?.addEventListener("click", _accept);
    tradeRequestDecline?.addEventListener("click", _decline);
    // Auto-decline after 15s
    setTimeout(() => {
      if (!tradeRequestEl.hidden) { tradeRequestEl.hidden = true; cleanup(); onDecline(); }
    }, 15000);
  }

  function hideTradeRequest() {
    if (tradeRequestEl) tradeRequestEl.hidden = true;
  }

  if (tradeCloseBtn) tradeCloseBtn.addEventListener("click", () => {
    if (typeof onTradeCancel === "function") onTradeCancel();
    closeTrade();
  });
  if (tradeDeclineBtn) tradeDeclineBtn.addEventListener("click", () => {
    if (typeof onTradeCancel === "function") onTradeCancel();
    closeTrade();
  });
  if (tradeAcceptBtn) tradeAcceptBtn.addEventListener("click", () => {
    if (!_tradeAccepted && typeof onTradeAccept === "function") onTradeAccept();
  });
  if (tradeOverlay) tradeOverlay.addEventListener("click", (e) => {
    if (e.target === tradeOverlay) {
      if (typeof onTradeCancel === "function") onTradeCancel();
      closeTrade();
    }
  });

  return {
    setActiveTool,
    setActive,
    setInventory,
    setCoins,
    setSkills,
    setStatus,
    setFriendsState,
    setBlacksmith,
    openBlacksmith,
    closeBlacksmith,
    isBlacksmithOpen,
    setStore,
    openStore,
    setStoreOverlay,
    openStoreOverlay,
    closeStoreOverlay,
    isStoreOpen,
    setBank,
    openBank,
    closeBank,
    isBankOpen,
    setPrayerActive,
    setHp,
    setVolumeSlider,
    setMusicSlider,
    setWorn,
    setWornSkins,
    setBlacksmithCrafting,
    openStarEnhance,
    closeStarEnhance,
    showStarResult,
    setTrade,
    openTrade,
    closeTrade,
    isTradeOpen,
    showTradeRequest,
    hideTradeRequest,
  };
}

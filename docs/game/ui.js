import { EQUIPMENT_ITEMS, EQUIPMENT_RECIPES, EQUIPMENT_TIERS, SELL_PRICE_BY_ITEM, SLIME_COLOR_SHOP, STAR_MAX, STAR_COSTS, STAR_SUCCESS, STAR_DESTROY, STAR_DOWNGRADE, STAR_ATK_PER, STAR_DEF_PER, STAR_TIMING_BONUS } from "./config.js";

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
  const { onToolSelect, onEmote, onBlacksmithUpgrade, onStoreSell, onStoreSellItem, onStoreColor, onStoreBuyItem, onCombatStyle, onAttack, onBankTransfer, onPrayerToggle, onBuyPotion, onUseItem, onVolumeChange, onMusicChange, onEquipFromBag, onUnequipSlot, onCraftEquipment, onStarEnhance, onStarTimingStop } = options;
  const buttons = Array.from(document.querySelectorAll(".ui-tab-btn"));
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));
  const title = document.getElementById("ui-panel-title");
  if (!buttons.length || !panels.length || !title) return null;

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
      if (itemType) {
        const eqData = EQUIPMENT_ITEMS[itemType];
        const displayName = eqData ? eqData.label : (ITEM_LABEL[itemType] || itemType);
        const sellVal = SELL_PRICE[itemType];
        const iconChar = eqData ? eqData.icon : (ITEM_ICON[itemType] || "?");
        const icon = document.createElement("span");
        icon.className = "ui-bag-slot-icon";
        icon.textContent = iconChar;
        slot.append(icon);
        /* styled tooltip */
        const tip = document.createElement("div");
        tip.className = "ui-slot-tooltip";
        let tipText = displayName;
        if (sellVal) tipText += `\nSell: ${sellVal}c`;
        if (itemType === "Health Potion") tipText += "\nClick to use (+40 HP)";
        else if (itemType === "Mana Potion") tipText += "\nClick to use";
        else if (itemType === "logs") tipText += "\nClick to place Campfire (3 logs)";
        tip.textContent = tipText;
        slot.append(tip);
        if (itemType === "Health Potion" || itemType === "Mana Potion" || itemType === "logs") {
          slot.classList.add("is-usable");
          slot.addEventListener("click", () => {
            if (typeof onUseItem === "function") onUseItem(itemType, i);
          });
        } else if (EQUIPMENT_ITEMS[itemType]) {
          const eqInfo = EQUIPMENT_ITEMS[itemType];
          const iStars = _itemStars[itemType] || 0;
          slot.classList.add("is-equipment");
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

  function openBlacksmith(payload = {}) {
    setBlacksmith(payload);
    setPanelCollapsed(false);
    setActive("blacksmith");
    if (mobileQuery.matches) setMobileMenuOpen(true);
  }

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

  /* Quantity toggle */
  for (const btn of bankQtyButtons) {
    btn.addEventListener("click", () => {
      _bankQty = btn.dataset.bankQty;
      for (const b of bankQtyButtons) b.classList.toggle("is-active", b === btn);
    });
  }

  function _renderBankSlot(container, itemType, count, onClick) {
    const slot = document.createElement("div");
    slot.className = itemType ? "ui-bank-slot" : "ui-bank-slot is-empty";
    if (itemType && count > 0) {
      const eqB = EQUIPMENT_ITEMS[itemType];
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
        if (typeof onBankTransfer === "function") onBankTransfer("withdraw", key, _bankQty);
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
      _renderBankSlot(bankInvGrid, itemType, 1, () => {
        if (itemType && typeof onBankTransfer === "function") onBankTransfer("deposit", itemType, _bankQty);
      });
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
      if (tab === activeTab) {
        setPanelCollapsed(!panelCollapsed);
        return;
      }
      setPanelCollapsed(false);
      setActive(tab);
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
      _renderStoreSlot(storeStockGrid, item.icon, `${item.label}\nBuy: ${item.cost}c`, `${item.cost}c`, "", () => {
        if (typeof onStoreBuyItem === "function") onStoreBuyItem(item.id);
      });
    }
    if (shopItems.length === 0) {
      const hint = document.createElement("div");
      hint.style.cssText = "grid-column:1/-1;text-align:center;color:var(--ui-ink-3);font-size:12px;padding:8px 0";
      hint.textContent = "Nothing in stock";
      storeStockGrid.append(hint);
    }

    /* Inventory — click to sell */
    storeInvGrid.innerHTML = "";
    for (let i = 0; i < capacity; i++) {
      const itemType = slots[i] || null;
      if (itemType) {
        const eqData = EQUIPMENT_ITEMS[itemType];
        const displayName = eqData ? eqData.label : (ITEM_LABEL[itemType] || itemType);
        const iconChar = eqData ? eqData.icon : (ITEM_ICON[itemType] || "?");
        const sellPrice = SELL_PRICE[itemType];
        const priceText = sellPrice ? `${sellPrice}c` : "0c";
        _renderStoreSlot(storeInvGrid, iconChar, `${displayName}\nSell: ${priceText}`, priceText, "is-sell", () => {
          if (typeof onStoreSellItem === "function") onStoreSellItem(i);
        });
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
    /* close bank overlay on Escape */
    if (_bankOpen && e.key === "Escape") { closeBank(); e.preventDefault(); return; }
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
    /* activate tab via hotkey (skip if typing in input) */
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const pressed = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    for (const [tab, key] of Object.entries(hotkeys)) {
      if (key === pressed) {
        setPanelCollapsed(false);
        setActive(tab);
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
    slotEl.addEventListener("click", () => {
      const slot = slotEl.dataset.wornSlot;
      const data = _wornSlotData[slot];
      if (data && data.itemId) {
        openStarEnhance(slot, data.itemId, data.stars || 0);
      }
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
      const item = itemId ? EQUIPMENT_ITEMS[itemId] : null;
      _wornSlotData[slotName] = { itemId, stars };
      /* clear existing content except label */
      const label = slotEl.querySelector(".ui-worn-label");
      slotEl.innerHTML = "";
      if (label) slotEl.appendChild(label);

      if (item) {
        const bonuses = _starCalcBonuses(itemId, stars);
        slotEl.classList.add("is-equipped");
        slotEl.style.setProperty("--eq-color", item.color + "88");
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
        slotEl.onmouseenter = null;
        slotEl.onmouseleave = null;
      }
    }
    if (wornAtkEl) wornAtkEl.textContent = String(totalAtk);
    if (wornDefEl) wornDefEl.textContent = String(totalDef);
  }

  /* ── Worn tab: Skin selector ── */
  const wornSkinGrid = document.getElementById("ui-worn-skin-grid");

  function setWornSkins(payload = {}) {
    if (!wornSkinGrid) return;
    wornSkinGrid.innerHTML = "";
    const unlocked = new Set(payload.unlocked || ["lime"]);
    const selected = payload.selected || "lime";
    for (const skin of SLIME_COLOR_SHOP) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ui-worn-skin-btn";
      const owned = unlocked.has(skin.id);
      if (!owned) btn.classList.add("is-locked");
      if (skin.id === selected) btn.classList.add("is-active");
      const swatch = document.createElement("span");
      swatch.className = "ui-worn-skin-swatch";
      if (skin.pattern) {
        swatch.classList.add("ui-dye-pattern");
        // reuse the inline gradient from store buttons
        const storeBtn = document.querySelector(`.ui-dye-btn[data-store-color="${skin.id}"] .ui-dye-swatch`);
        if (storeBtn) swatch.style.background = getComputedStyle(storeBtn).background;
        else swatch.style.background = skin.color;
      } else {
        swatch.style.background = skin.color;
      }
      btn.appendChild(swatch);
      const label = document.createElement("span");
      label.textContent = skin.label;
      btn.appendChild(label);
      if (owned) {
        btn.addEventListener("click", () => {
          if (typeof options.onStoreColor === "function") options.onStoreColor(skin.id);
        });
      }
      btn.title = owned ? (skin.id === selected ? "Equipped" : "Click to equip") : `Locked (${skin.cost}c at Store)`;
      wornSkinGrid.appendChild(btn);
    }
  }

  /* ── Blacksmith Equipment Crafting ── */
  const smithCraftListEl = document.getElementById("ui-smith-craft-list");

  function setBlacksmithCrafting(payload = {}) {
    if (!smithCraftListEl) return;
    smithCraftListEl.innerHTML = "";
    const bagCounts = payload.bagCounts || {};
    const combatLevel = payload.combatLevel || 1;
    const recipes = Object.entries(EQUIPMENT_RECIPES);
    for (const [itemId, recipe] of recipes) {
      const item = EQUIPMENT_ITEMS[itemId];
      if (!item) continue;
      const row = document.createElement("div");
      row.className = "ui-smith-row";
      const meta = document.createElement("div");
      meta.className = "ui-smith-meta";
      const nameEl = document.createElement("strong");
      nameEl.textContent = item.icon + " " + item.label;
      nameEl.style.color = item.color;
      meta.appendChild(nameEl);
      const matLines = Object.entries(recipe.materials).map(([k, v]) => {
        const have = bagCounts[k] || 0;
        return `${ITEM_LABEL[k] || k}: ${have}/${v}`;
      }).join(", ");
      const info = document.createElement("span");
      info.textContent = `Lv ${recipe.level} | ${matLines}`;
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
    const item = EQUIPMENT_ITEMS[itemId];
    if (!item) return { atk: 0, def: 0 };
    let bonusAtk = 0, bonusDef = 0;
    for (let i = 0; i < stars; i++) {
      bonusAtk += STAR_ATK_PER[i] || 0;
      bonusDef += STAR_DEF_PER[i] || 0;
    }
    return { atk: item.atk + bonusAtk, def: item.def + bonusDef };
  }

  function _renderStarOverlay() {
    const item = EQUIPMENT_ITEMS[_starItemId];
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
  };
}

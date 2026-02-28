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
};

const ITEM_LABEL = {
  fish: "Fish",
  ore: "Ore",
  logs: "Logs",
};
const SELL_PRICE = {
  fish: 4, ore: 7, logs: 5, "Raw Beef": 8, "Raw Pork": 6,
  "Wool": 5, "Horse Hide": 10, "Llama Wool": 7, "Bone": 3, "Striped Hide": 12,
};
const COMBAT_TOOLS = new Set(["sword", "bow", "staff"]);
const SKILLING_TOOLS = new Set(["axe", "pickaxe", "fishing"]);

export function initializeUI(options = {}) {
  const { onToolSelect, onEmote, onBlacksmithUpgrade, onStoreSell, onStoreColor, onCombatStyle, onAttack, onBankTransfer, onPrayerToggle, onBuyPotion, onUseItem } = options;
  const buttons = Array.from(document.querySelectorAll(".ui-tab-btn"));
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));
  const title = document.getElementById("ui-panel-title");
  if (!buttons.length || !panels.length || !title) return null;

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
  const fishBarEl = document.getElementById("ui-skill-bar-fishing");
  const miningBarEl = document.getElementById("ui-skill-bar-mining");
  const woodcutBarEl = document.getElementById("ui-skill-bar-woodcutting");
  const meleeBarEl = document.getElementById("ui-skill-bar-melee");
  const bowBarEl = document.getElementById("ui-skill-bar-bow");
  const mageBarEl = document.getElementById("ui-skill-bar-mage");
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
        const displayName = ITEM_LABEL[itemType] || itemType;
        const sellVal = SELL_PRICE[itemType];
        slot.title = sellVal ? `${displayName} (${sellVal}c)` : displayName;
        const icon = document.createElement("span");
        icon.className = "ui-bag-slot-icon";
        icon.textContent = ITEM_ICON[itemType] || "?";
        slot.append(icon);
        if (itemType === "Health Potion" || itemType === "Mana Potion") {
          slot.classList.add("is-usable");
          slot.addEventListener("click", () => {
            if (typeof onUseItem === "function") onUseItem(itemType, i);
          });
        }
      } else {
        slot.title = "Empty";
        const empty = document.createElement("span");
        empty.className = "ui-bag-slot-empty";
        slot.append(empty);
      }
      inventoryGridEl.append(slot);
    }
  }

  function setInventory(payload) {
    const counts = payload?.counts ?? payload ?? {};
    const slots = Array.isArray(payload?.slots) ? payload.slots : [];
    const capacity = Number.isFinite(payload?.capacity) ? payload.capacity : slots.length;
    const used = Number.isFinite(payload?.used) ? payload.used : slots.filter((slot) => !!slot).length;

    if (invFishEl) invFishEl.textContent = String(counts.fish ?? 0);
    if (invOreEl) invOreEl.textContent = String(counts.ore ?? 0);
    if (invLogsEl) invLogsEl.textContent = String(counts.logs ?? 0);
    if (bagCapacityEl && capacity > 0) bagCapacityEl.textContent = `${used}/${capacity}`;
    renderInventoryGrid(slots, capacity);
  }

  function setCoins(amount) {
    if (!coinsEl) return;
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    coinsEl.textContent = String(value);
  }

  function setSkills(skills) {
    if (fishLevelEl) fishLevelEl.textContent = String(skills.fishing ?? 1);
    if (miningLevelEl) miningLevelEl.textContent = String(skills.mining ?? 1);
    if (woodcutLevelEl) woodcutLevelEl.textContent = String(skills.woodcutting ?? 1);
    if (meleeLevelEl) meleeLevelEl.textContent = String(skills.melee ?? 1);
    if (bowLevelEl) bowLevelEl.textContent = String(skills.bow ?? 1);
    if (mageLevelEl) mageLevelEl.textContent = String(skills.mage ?? 1);

    const progress = skills._progress || {};
    if (fishBarEl) fishBarEl.style.width = (progress.fishing ?? 0) + "%";
    if (miningBarEl) miningBarEl.style.width = (progress.mining ?? 0) + "%";
    if (woodcutBarEl) woodcutBarEl.style.width = (progress.woodcutting ?? 0) + "%";
    if (meleeBarEl) meleeBarEl.style.width = (progress.melee ?? 0) + "%";
    if (bowBarEl) bowBarEl.style.width = (progress.bow ?? 0) + "%";
    if (mageBarEl) mageBarEl.style.width = (progress.mage ?? 0) + "%";
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
      slot.title = `${ITEM_LABEL[itemType] || itemType} (${count})`;
      const icon = document.createElement("span");
      icon.className = "ui-bank-slot-icon";
      icon.textContent = ITEM_ICON[itemType] || "?";
      slot.append(icon);
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
    setBank,
    openBank,
    closeBank,
    isBankOpen,
    setPrayerActive,
    setHp,
  };
}

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
};

const ITEM_LABEL = {
  fish: "Fish",
  ore: "Ore",
  logs: "Logs",
};
const COMBAT_TOOLS = new Set(["sword", "bow", "staff"]);
const SKILLING_TOOLS = new Set(["axe", "pickaxe", "fishing"]);

export function initializeUI(options = {}) {
  const { onToolSelect, onEmote, onBlacksmithUpgrade, onStoreSell, onStoreColor, onCombatStyle, onAttack, onBankTransfer } = options;
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
  const bankBagEls = Array.from(document.querySelectorAll("[data-bank-bag]"));
  const bankVaultEls = Array.from(document.querySelectorAll("[data-bank-vault]"));
  const bankActionButtons = Array.from(document.querySelectorAll("[data-bank-action]"));

  const combatStyleButtons = Array.from(document.querySelectorAll("[data-combat-style]"));
  const combatFlipButton = document.getElementById("ui-combat-flip-btn");
  const combatStylesPanel = document.getElementById("ui-combat-styles");
  const combatToolsPanel = document.getElementById("ui-combat-tools");
  const attackButton = document.getElementById("ui-attack-btn");

  const labelByTab = {
    inventory: "Inventory",
    bank: "Bank",
    blacksmith: "Blacksmith",
    store: "Store",
    skills: "Skills",
    combat: "Combat",
    emotes: "Emotes",
    friends: "Friends",
    settings: "Settings",
  };

  const mobileQuery = window.matchMedia("(max-width: 760px)");
  let activeTab = "inventory";
  let panelCollapsed = false;
  let combatPanelMode = "combat";

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

  function setCombatPanelMode(mode) {
    combatPanelMode = mode === "skilling" ? "skilling" : "combat";
    if (combatStylesPanel) combatStylesPanel.hidden = combatPanelMode !== "combat";
    if (combatToolsPanel) combatToolsPanel.hidden = combatPanelMode !== "skilling";
    if (combatFlipButton) {
      combatFlipButton.dataset.mode = combatPanelMode;
      combatFlipButton.textContent = combatPanelMode === "combat" ? "Skilling" : "Combat";
    }
  }

  function setActiveTool(tool) {
    for (const button of toolButtons) {
      button.classList.toggle("is-active", button.dataset.tool === tool);
    }
    if (equippedToolEl) equippedToolEl.textContent = `Equipped: ${TOOL_LABEL[tool] || "Unknown"}`;
    if (SKILLING_TOOLS.has(tool)) setCombatPanelMode("skilling");
    else if (COMBAT_TOOLS.has(tool)) setCombatPanelMode("combat");
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
        slot.title = ITEM_LABEL[itemType] || "Item";
        const icon = document.createElement("span");
        icon.className = "ui-bag-slot-icon";
        icon.textContent = ITEM_ICON[itemType] || "?";
        slot.append(icon);
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

  function setBank(payload = {}) {
    const bag = payload.bag || {};
    const bank = payload.bank || {};
    const capacity = Math.max(0, Math.floor(Number(payload.capacity) || 0));
    const used = Math.max(0, Math.floor(Number(payload.used) || 0));
    const freeSlots = Math.max(0, capacity - used);

    for (const el of bankBagEls) {
      const key = el.dataset.bankBag;
      el.textContent = String(Math.max(0, Math.floor(Number(bag[key]) || 0)));
    }
    for (const el of bankVaultEls) {
      const key = el.dataset.bankVault;
      el.textContent = String(Math.max(0, Math.floor(Number(bank[key]) || 0)));
    }

    for (const button of bankActionButtons) {
      const dir = button.dataset.bankAction;
      const key = button.dataset.bankItem;
      const qtyRaw = button.dataset.bankQty;
      const source = dir === "deposit" ? (bag[key] || 0) : (bank[key] || 0);
      let qty = qtyRaw === "all" ? source : Math.max(0, Math.floor(Number(qtyRaw) || 0));
      if (dir === "withdraw") qty = Math.min(qty, freeSlots);
      button.disabled = qty <= 0;
      button.title = qty <= 0 ? "Unavailable" : `${dir === "deposit" ? "Deposit" : "Withdraw"} ${qty} ${key}`;
    }
  }

  function openBank(payload = {}) {
    setBank(payload);
    setPanelCollapsed(false);
    setActive("bank");
    if (mobileQuery.matches) setMobileMenuOpen(true);
  }

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
  for (const button of bankActionButtons) {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      const dir = button.dataset.bankAction;
      const item = button.dataset.bankItem;
      const qty = button.dataset.bankQty;
      if (typeof onBankTransfer === "function") onBankTransfer(dir, item, qty);
    });
  }

  for (const button of combatStyleButtons) {
    button.addEventListener("click", () => {
      if (!button.dataset.combatStyle) return;
      const style = button.dataset.combatStyle;
      for (const b of combatStyleButtons) b.classList.toggle("is-active", b === button);
      if (typeof onCombatStyle === "function") onCombatStyle(style);
    });
  }
  if (combatFlipButton) {
    combatFlipButton.addEventListener("click", () => {
      setCombatPanelMode(combatPanelMode === "combat" ? "skilling" : "combat");
    });
  }
  if (attackButton) {
    attackButton.addEventListener("click", () => {
      if (typeof onAttack === "function") onAttack();
    });
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
  setCombatPanelMode("combat");
  setActiveTool("fishing");
  setFriendsState({ connected: false, peers: 0 });

  return {
    setActiveTool,
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
  };
}

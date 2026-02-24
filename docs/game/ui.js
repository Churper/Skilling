const TOOL_LABEL = {
  axe: "Axe",
  pickaxe: "Pickaxe",
  fishing: "Fishing Pole",
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

export function initializeUI(options = {}) {
  const { onToolSelect, onEmote, onBlacksmithUpgrade, onStoreSell, onStoreColor } = options;
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
  const smithButtons = Array.from(document.querySelectorAll("[data-smith-upgrade]"));
  const smithLevelEls = Array.from(document.querySelectorAll("[data-smith-level]"));
  const smithCostEls = Array.from(document.querySelectorAll("[data-smith-cost]"));
  const storeSellButton = document.getElementById("ui-store-sell-btn");
  const dyeButtons = Array.from(document.querySelectorAll("[data-store-color]"));
  const dyeCostEls = Array.from(document.querySelectorAll("[data-store-cost]"));

  const labelByTab = {
    inventory: "Inventory",
    tools: "Tools",
    blacksmith: "Blacksmith",
    store: "Store",
    skills: "Skills",
    emotes: "Emotes",
    friends: "Friends",
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
  }

  function setStatus(text, tone = "info") {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
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

  return {
    setActiveTool,
    setInventory,
    setCoins,
    setSkills,
    setStatus,
    setBlacksmith,
    openBlacksmith,
    setStore,
    openStore,
  };
}

export function initializeUI() {
  const buttons = Array.from(document.querySelectorAll(".ui-tab-btn"));
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));
  const title = document.getElementById("ui-panel-title");
  if (!buttons.length || !panels.length || !title) return;

  const labelByTab = {
    inventory: "Inventory",
    skills: "Skills",
    friends: "Friends",
  };

  function setActive(tab) {
    for (const button of buttons) {
      button.classList.toggle("is-active", button.dataset.tab === tab);
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.tabPanel !== tab;
    }
    title.textContent = labelByTab[tab] || "Panel";
  }

  for (const button of buttons) {
    button.addEventListener("click", () => setActive(button.dataset.tab));
  }

  setActive("inventory");
}

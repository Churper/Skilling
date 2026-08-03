/* Shared, dependency-free search for every localized guide page. */
(() => {
  "use strict";

  const COPY = {
    en: {
      label: "Search the guide",
      placeholder: "Search bosses, items, skills, questions…",
      clear: "Clear search",
      result: "result",
      results: "results",
      empty: "No guide entries match that search.",
    },
    es: {
      label: "Buscar en la guía",
      placeholder: "Buscar jefes, objetos, habilidades, preguntas…",
      clear: "Borrar búsqueda",
      result: "resultado",
      results: "resultados",
      empty: "No hay entradas de la guía que coincidan con la búsqueda.",
    },
    ja: {
      label: "ガイドを検索",
      placeholder: "ボス、アイテム、スキル、質問を検索…",
      clear: "検索をクリア",
      result: "件",
      results: "件",
      empty: "一致するガイド項目はありません。",
    },
    zh: {
      label: "搜索指南",
      placeholder: "搜索 Boss、物品、技能或问题…",
      clear: "清除搜索",
      result: "条结果",
      results: "条结果",
      empty: "没有找到匹配的指南内容。",
    },
  };

  const lang = (document.documentElement.lang || "en").toLowerCase().split("-")[0];
  const copy = COPY[lang] || COPY.en;
  const tabs = document.getElementById("tabs");
  if (!tabs) return;

  const region = document.createElement("section");
  region.className = "guide-search";
  region.setAttribute("aria-label", copy.label);
  region.innerHTML = `
    <div class="guide-search-box">
      <span class="guide-search-icon" aria-hidden="true">⌕</span>
      <input class="guide-search-input" type="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      <span class="guide-search-shortcut" aria-hidden="true">/</span>
      <button class="guide-search-clear" type="button" hidden>×</button>
    </div>
    <div class="guide-search-panel" hidden>
      <div class="guide-search-summary" aria-live="polite"></div>
      <div class="guide-search-results"></div>
    </div>`;
  tabs.insertAdjacentElement("afterend", region);

  const input = region.querySelector(".guide-search-input");
  const clear = region.querySelector(".guide-search-clear");
  const panel = region.querySelector(".guide-search-panel");
  const summary = region.querySelector(".guide-search-summary");
  const results = region.querySelector(".guide-search-results");
  input.placeholder = copy.placeholder;
  input.setAttribute("aria-label", copy.label);
  input.setAttribute("aria-controls", "guide-search-results");
  results.id = "guide-search-results";
  clear.setAttribute("aria-label", copy.clear);
  clear.title = copy.clear;

  const normalize = value => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
  const clean = value => String(value || "").replace(/\s+/g, " ").trim();
  const atomicSelector = ".faq-card,.boss-card,.food-item,.skill-row,.tier-item,.tip,.warn";
  const candidateSelector = `.sec-head,${atomicSelector},.card,p`;
  const entries = [];

  document.querySelectorAll(".tab-content:not(#tab-submit)").forEach(tab => {
    const tabName = tab.id.replace(/^tab-/, "");
    const tabButton = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    const section = clean(tabButton?.textContent) || tabName;
    tab.querySelectorAll(candidateSelector).forEach(element => {
      if (element.matches(".card") && element.querySelector(atomicSelector)) return;
      if (element.matches("p")) {
        if (element.closest(atomicSelector)) return;
        if (element.closest(".sec-head")) return;
        const card = element.closest(".card");
        if (card && !card.querySelector(atomicSelector)) return;
      }
      const text = clean(element.textContent);
      if (text.length < 3) return;
      let title = clean(element.querySelector(".faq-q,.boss-name,.food-name,.skill-name,.tier-name,h2,h3,strong")?.textContent);
      if (!title) title = text.split(/[.!?。！？]/, 1)[0].slice(0, 90);
      entries.push({ element, tabName, section, title, text, search: normalize(`${section} ${title} ${text}`) });
    });
  });

  function snippetFor(entry, terms) {
    const normalizedText = normalize(entry.text);
    const positions = terms.map(term => normalizedText.indexOf(term)).filter(pos => pos >= 0);
    const hit = positions.length ? Math.min(...positions) : 0;
    const start = Math.max(0, hit - 58);
    const end = Math.min(entry.text.length, start + 170);
    return `${start ? "…" : ""}${entry.text.slice(start, end).trim()}${end < entry.text.length ? "…" : ""}`;
  }

  function score(entry, terms) {
    const title = normalize(entry.title);
    const section = normalize(entry.section);
    return terms.reduce((total, term) => total
      + (title.startsWith(term) ? 12 : title.includes(term) ? 7 : 0)
      + (section.includes(term) ? 4 : 0), 0);
  }

  function reveal(entry) {
    if (typeof window._switchTab === "function") window._switchTab(entry.tabName);
    const collapse = entry.element.closest(".skill-collapse");
    if (collapse) {
      collapse.classList.add("is-open");
      document.querySelector(`.skill-row[data-skill="${collapse.id}"]`)?.classList.add("is-open");
    }
    setTimeout(() => {
      entry.element.scrollIntoView({ behavior: "smooth", block: "center" });
      entry.element.classList.remove("guide-search-hit");
      void entry.element.offsetWidth;
      entry.element.classList.add("guide-search-hit");
      setTimeout(() => entry.element.classList.remove("guide-search-hit"), 1900);
    }, 60);
  }

  function render() {
    const raw = input.value.trim();
    const terms = normalize(raw).split(/\s+/).filter(Boolean);
    clear.hidden = !raw;
    panel.hidden = !raw;
    results.replaceChildren();
    if (!raw) return;

    const allMatches = entries
      .filter(entry => terms.every(term => entry.search.includes(term)))
      .map((entry, order) => ({ entry, order, rank: score(entry, terms) }))
      .sort((a, b) => b.rank - a.rank || a.order - b.order);
    const matches = allMatches.slice(0, 40);
    summary.textContent = lang === "ja" || lang === "zh"
      ? `${allMatches.length}${allMatches.length === 1 ? copy.result : copy.results}`
      : `${allMatches.length} ${allMatches.length === 1 ? copy.result : copy.results}`;

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "guide-search-empty";
      empty.textContent = copy.empty;
      results.appendChild(empty);
      return;
    }

    matches.forEach(({ entry }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "guide-search-result";
      const section = document.createElement("span");
      section.className = "guide-search-section";
      section.textContent = entry.section;
      const title = document.createElement("span");
      title.className = "guide-search-title";
      title.textContent = entry.title;
      const snippet = document.createElement("span");
      snippet.className = "guide-search-snippet";
      snippet.textContent = snippetFor(entry, terms);
      const arrow = document.createElement("span");
      arrow.className = "guide-search-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      button.append(section, title, snippet, arrow);
      button.addEventListener("click", () => reveal(entry));
      results.appendChild(button);
    });
  }

  input.addEventListener("input", render);
  input.addEventListener("keydown", event => {
    event.stopPropagation();
    if (event.key === "Escape" && input.value) {
      event.preventDefault();
      input.value = "";
      render();
    } else if (event.key === "Enter") {
      const first = results.querySelector(".guide-search-result");
      if (first) {
        event.preventDefault();
        first.click();
      }
    }
  });
  clear.addEventListener("click", () => {
    input.value = "";
    render();
    input.focus();
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    event.preventDefault();
    input.focus();
  });
})();

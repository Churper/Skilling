/* Header / footer injection — keeps every HTML file tiny. */
import { api } from "./api.js";

const NAV_ITEMS = [
  { href: "#home",     label: "Home" },
  { href: "#server",   label: "Server" },
  { href: "#hiscores", label: "Hiscores" },
  { href: "#gainers",  label: "Gainers" },
  { href: "#records",  label: "Records" },
  { href: "#players",  label: "Players" },
];

let _searchDebounce = null;
let _docClickWired = false;

export function mountHeader(currentPage) {
  const host = document.getElementById("st-header");
  if (!host) return;
  host.innerHTML = `
    <div class="st-header-inner">
      <a class="st-logo" href="#home">
        <span class="st-logo-mark">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 3c1.6 0 3 1 3 2.5 0 .8-.3 1.4-.6 2 .8.4 1.5 1 2.1 1.7 1.6 1.9 2.5 4.4 2.5 6.6 0 3.4-3.1 6.2-7 6.2s-7-2.8-7-6.2c0-2.2.9-4.7 2.5-6.6.6-.7 1.3-1.3 2.1-1.7-.3-.6-.6-1.2-.6-2C9 4 10.4 3 12 3zm-2 11a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4zm5 .5a1 1 0 100-2 1 1 0 000 2z"/>
          </svg>
        </span>
        <span class="st-logo-text">Sli<span class="metrics-part">metrics</span></span>
      </a>
      <nav class="st-nav" aria-label="Primary">
        ${NAV_ITEMS.map(n => `<a href="${n.href}" class="st-nav-link${
          currentPage === n.href.slice(1) ? " is-active" : ""
        }">${n.label}</a>`).join("")}
      </nav>
      <div class="st-search" id="st-search-wrap">
        <span class="st-search-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
        <input id="st-search-input" type="search" placeholder="Search a slime…" autocomplete="off" spellcheck="false" />
        <div id="st-search-results" class="st-search-results" hidden></div>
      </div>
    </div>
  `;
  _wireSearch();
}

function _wireSearch() {
  const input = document.getElementById("st-search-input");
  const results = document.getElementById("st-search-results");
  if (!input || !results) return;
  let activeIdx = -1;
  let items = [];
  function close() { results.hidden = true; activeIdx = -1; }
  function go(name) {
    if (!name) return;
    location.hash = `#player?name=${encodeURIComponent(name)}`;
  }
  function render(rows) {
    items = rows || [];
    if (!items.length) { results.innerHTML = `<div class="st-search-empty">No matches</div>`; results.hidden = false; return; }
    results.innerHTML = items.map((r, i) =>
      `<a class="st-search-row" data-i="${i}" href="#player?name=${encodeURIComponent(r.name)}">
        ${r.is_sapling ? "🌱 " : ""}<span>${escapeHtml(r.name)}</span>
      </a>`).join("");
    results.hidden = false;
    activeIdx = -1;
  }
  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearTimeout(_searchDebounce);
    if (q.length < 1) { close(); return; }
    _searchDebounce = setTimeout(async () => {
      const rows = await api.search(q, 8).catch(() => []);
      render(rows);
    }, 150);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { close(); input.blur(); return; }
    if (!items.length) {
      if (e.key === "Enter" && input.value.trim()) go(input.value.trim());
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = Math.min(items.length - 1, activeIdx + 1);
      _markActive(activeIdx);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = Math.max(-1, activeIdx - 1);
      _markActive(activeIdx);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0) go(items[activeIdx].name);
      else if (input.value.trim()) go(input.value.trim());
    }
  });
  /* Close-on-outside-click: wire the document listener ONCE for the app's
     lifetime. mountHeader()/_wireSearch() run on every route, so adding the
     listener here each time leaked one document listener per navigation. The
     handler re-queries the live DOM so it keeps working across re-renders. */
  if (!_docClickWired) {
    document.addEventListener("click", (e) => {
      const r = document.getElementById("st-search-results");
      const inp = document.getElementById("st-search-input");
      if (r && !r.hidden && !r.contains(e.target) && e.target !== inp) {
        r.hidden = true;
      }
    });
    _docClickWired = true;
  }
}
function _markActive(i) {
  const rows = document.querySelectorAll(".st-search-row");
  rows.forEach(r => r.classList.remove("is-active"));
  if (i >= 0 && rows[i]) rows[i].classList.add("is-active");
}

export function mountFooter() {
  const host = document.getElementById("st-footer");
  if (!host) return;
  const nav = document.querySelector("meta[name='generation-start']")?.content;
  const tStart = nav ? Number(nav) : 0;
  const elapsed = tStart ? ((performance.now() - tStart) / 1000).toFixed(2) + "s" : "";
  host.innerHTML = `
    <div class="st-footer-inner">
      <div class="st-footer-meta">
        ${elapsed ? `<span>page generated in <b class="num">${elapsed}</b></span><span>·</span>` : ""}
        <span id="st-footer-stats" class="num">…</span>
      </div>
      <nav class="st-footer-nav">
        <a href="#faq">FAQ</a>
        <span>·</span>
        <a href="https://slimeville.online/privacy.html">Privacy</a>
        <span>·</span>
        <a href="https://slimeville.online/" target="_blank">▶ Play Slimeville</a>
      </nav>
    </div>
  `;
  /* Lazy total-stats fetch (cached, cheap). */
  api.home().then(d => {
    const el = document.getElementById("st-footer-stats");
    if (el && d?.players != null) {
      el.textContent = `${d.players.toLocaleString("en-US")} players · ${(d.data_points || 0).toLocaleString("en-US")} datapoints`;
    }
  }).catch(() => {});
}

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
export { escapeHtml };

/* Build one tic-tac-toe filter row: a label cell + a shared-edge button
   matrix. `items` are {id, label, icon?|iconHtml?}; `attr` is the data
   attribute the page wires (e.g. "data-skill"). Pass {row:true} for a few
   evenly-stretched buttons on a single line (account/window/period). */
export function filterRow(label, items, activeId, attr, opts = {}) {
  const cells = items.map(it => {
    const ico = it.iconHtml != null
      ? it.iconHtml
      : (it.icon ? `<span class="st-cell-ico">${escapeHtml(it.icon)}</span>` : "");
    return `<button class="st-cell${it.id === activeId ? " is-active" : ""}" ${attr}="${escapeHtml(it.id)}">${ico}<span>${escapeHtml(it.label)}</span></button>`;
  }).join("");
  return `<div class="st-filter-row">
    <div class="st-filter-label">${escapeHtml(label)}</div>
    <div class="st-filter-cells${opts.row ? " is-row" : ""}">${cells}</div>
  </div>`;
}

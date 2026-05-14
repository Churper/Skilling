/* ── Slimetrics router ────────────────────────────────────────────────
   Hash-based routing so URLs work from any path level (no trailing-slash
   trap, no `.html` in URLs). Single page shell, page modules each export
   a `render(host, params)` function.

   URL format:
     #home
     #player?name=Burga5
     #hiscores?skill=fishing&type=sapling&page=2
     #gainers?period=1w&skill=mining&type=all
     #records?skill=overall&type=all
     #players
     #faq                                                                  */

import { mountHeader, mountFooter } from "./lib/nav.js";
import { renderHome }       from "./pages/home.js";
import { renderPlayer }     from "./pages/player.js";
import { renderHiscores }   from "./pages/hiscores.js";
import { renderGainers }    from "./pages/gainers.js";
import { renderRecords }    from "./pages/records.js";
import { renderPlayers }    from "./pages/players.js";
import { renderFAQ }        from "./pages/faq.js";
import { renderServer }     from "./pages/server.js";

const ROUTES = {
  home:     renderHome,
  server:   renderServer,
  player:   renderPlayer,
  hiscores: renderHiscores,
  gainers:  renderGainers,
  records:  renderRecords,
  players:  renderPlayers,
  faq:      renderFAQ,
};

const $host = document.getElementById("page-content");

function parseHash() {
  const raw = (location.hash || "#home").slice(1);
  const [route, query] = raw.split("?");
  const params = {};
  if (query) {
    for (const kv of query.split("&")) {
      const [k, v] = kv.split("=");
      if (k) params[k] = decodeURIComponent(v || "");
    }
  }
  return { route: route || "home", params };
}

function route() {
  const { route: name, params } = parseHash();
  mountHeader(name);
  mountFooter();
  const fn = ROUTES[name] || renderHome;
  $host.innerHTML = `<div class="st-loading">Loading…</div>`;
  /* Pages are async — let them clear the loading state when ready. */
  Promise.resolve().then(() => fn($host, params)).catch(err => {
    console.warn("[slimetrics] route failed:", err);
    $host.innerHTML = `<div class="st-error">Failed to render: ${String(err.message || err)}</div>`;
  });
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();

/* Helper for code that wants to navigate programmatically. */
window.goPlayer = function (name) {
  if (!name) return;
  location.hash = `#player?name=${encodeURIComponent(name)}`;
};

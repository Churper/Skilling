/* Slimetrics API — thin wrappers over Supabase RPCs.
   Uses fetch directly; no @supabase/supabase-js needed (saves ~50KB).
   All RPCs are unauthenticated reads, so we only need URL + anon key. */

import { RPC_ORIGIN, SUPABASE_ANON_KEY } from "./config.js";

/* RPC_ORIGIN defaults to the Supabase URL; point it at the edge-cache Worker
   (see slimetrics-cache-worker/) to serve repeat reads from Cloudflare. */
const REST_URL = RPC_ORIGIN + "/rest/v1/rpc/";
const HEADERS = {
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": "Bearer " + SUPABASE_ANON_KEY,
  "Content-Type": "application/json",
};

/* In-flight de-dup + memory cache, MIRRORED to sessionStorage so a hard
   refresh or a new same-tab navigation doesn't refetch the same data (every
   refetch is a direct DB hit, and these payloads are identical for all users).
   sessionStorage is per-tab and clears on tab close, so it never serves data
   older than the entry's own TTL. All storage access is guarded so private
   mode / quota / disabled storage degrade gracefully to memory-only. */
const _cache = new Map();   // key → { ts, data, expiry }
const _inflight = new Map();
const _SS_PREFIX = "st:rpc:";

function _ssGet(key) {
  try {
    const raw = sessionStorage.getItem(_SS_PREFIX + key);
    if (!raw) return null;
    const ent = JSON.parse(raw);
    return ent && ent.expiry > Date.now() ? ent : null;
  } catch { return null; }
}
function _ssSet(key, ent) {
  try { sessionStorage.setItem(_SS_PREFIX + key, JSON.stringify(ent)); } catch {}
}

async function rpc(name, args = {}, { ttlMs = 60_000 } = {}) {
  const key = name + "|" + JSON.stringify(args);
  const now = Date.now();
  let hit = _cache.get(key);
  if ((!hit || hit.expiry <= now) && ttlMs > 0) {
    const ss = _ssGet(key);            // survives reload / new same-tab nav
    if (ss) { _cache.set(key, ss); hit = ss; }
  }
  if (hit && hit.expiry > now) return hit.data;
  if (_inflight.has(key)) return _inflight.get(key);
  const p = (async () => {
    try {
      const res = await fetch(REST_URL + name, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error(`${name} ${res.status}`);
      const data = await res.json();
      if (ttlMs > 0) {
        const ent = { ts: now, data, expiry: now + ttlMs };
        _cache.set(key, ent);
        _ssSet(key, ent);
      }
      return data;
    } finally {
      _inflight.delete(key);
    }
  })();
  _inflight.set(key, p);
  return p;
}

export function bustCache() {
  _cache.clear();
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(_SS_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {}
}

export const api = {
  home:         ()                                   => rpc("slimetrics_home", {}, { ttlMs: 180_000 }),
  search:       (q, limit = 12)                      => rpc("slimetrics_player_search", { p_query: q, p_limit: limit }, { ttlMs: 15_000 }),
  overview:     (name)                               => rpc("slimetrics_player_overview", { p_name: name }, { ttlMs: 30_000 }),
  gains:        (name, period)                       => rpc("slimetrics_player_gains", { p_name: name, p_period: period }, { ttlMs: 30_000 }),
  chart:        (name, skill, period)                => rpc("slimetrics_player_chart", { p_name: name, p_skill: skill, p_period: period }, { ttlMs: 60_000 }),
  heatmap:      (name)                               => rpc("slimetrics_player_heatmap", { p_name: name }, { ttlMs: 60_000 }),
  /* Leaderboards derive from the ~3h snapshot cadence, so a few minutes of
     cache is invisible to users and cuts repeat DB hits hard. */
  hiscores:     (skill, type, offset = 0, limit = 50)=> rpc("slimetrics_hiscores", { p_skill: skill, p_type: type, p_offset: offset, p_limit: limit }, { ttlMs: 300_000 }),
  gainers:      (period, skill, type, limit = 50)    => rpc("slimetrics_gainers", { p_period: period, p_skill: skill, p_type: type, p_limit: limit }, { ttlMs: 300_000 }),
  records:      (skill, type, limit = 50)            => rpc("slimetrics_records", { p_skill: skill, p_type: type, p_limit: limit }, { ttlMs: 600_000 }),
  highlights:   (limit = 12)                         => rpc("slimetrics_recent_highlights", { p_limit: limit }, { ttlMs: 30_000 }),
  newUsers:     (limit = 8)                          => rpc("slimetrics_new_users", { p_limit: limit }, { ttlMs: 60_000 }),
  requestUpdate:(name)                               => rpc("slimetrics_request_update", { p_name: name }, { ttlMs: 0 }),
  /* ── Server tab ── */
  serverOverview: ()                                 => rpc("slimetrics_server_overview", {}, { ttlMs: 60_000 }),
  serverChart:    (period)                           => rpc("slimetrics_server_chart", { p_period: period }, { ttlMs: 60_000 }),
  serverHeatmap:  ()                                 => rpc("slimetrics_server_heatmap", {}, { ttlMs: 5 * 60_000 }),
  recentBosses:   (limit = 10)                       => rpc("slimetrics_recent_bosses", { p_limit: limit }, { ttlMs: 60_000 }),
  recentIslands:  (limit = 10)                       => rpc("slimetrics_recent_islands", { p_limit: limit }, { ttlMs: 60_000 }),
  welcomeBanner:  (limit = 5)                        => rpc("slimetrics_welcome_banner", { p_limit: limit }, { ttlMs: 60_000 }),
  signupChart:    ()                                 => rpc("slimetrics_signup_chart", {}, { ttlMs: 5 * 60_000 }),
};

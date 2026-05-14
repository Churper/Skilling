/* Slimetrics API — thin wrappers over Supabase RPCs.
   Uses fetch directly; no @supabase/supabase-js needed (saves ~50KB).
   All RPCs are unauthenticated reads, so we only need URL + anon key. */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const REST_URL = SUPABASE_URL + "/rest/v1/rpc/";
const HEADERS = {
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": "Bearer " + SUPABASE_ANON_KEY,
  "Content-Type": "application/json",
};

/* In-flight de-dup + 60s memory cache so a page refresh doesn't refetch
   the same data immediately. */
const _cache = new Map();   // key → { ts, data, expiry }
const _inflight = new Map();

async function rpc(name, args = {}, { ttlMs = 60_000 } = {}) {
  const key = name + "|" + JSON.stringify(args);
  const now = Date.now();
  const hit = _cache.get(key);
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
      if (ttlMs > 0) _cache.set(key, { ts: now, data, expiry: now + ttlMs });
      return data;
    } finally {
      _inflight.delete(key);
    }
  })();
  _inflight.set(key, p);
  return p;
}

export function bustCache() { _cache.clear(); }

export const api = {
  home:         ()                                   => rpc("slimetrics_home", {}, { ttlMs: 60_000 }),
  search:       (q, limit = 12)                      => rpc("slimetrics_player_search", { p_query: q, p_limit: limit }, { ttlMs: 15_000 }),
  overview:     (name)                               => rpc("slimetrics_player_overview", { p_name: name }, { ttlMs: 30_000 }),
  gains:        (name, period)                       => rpc("slimetrics_player_gains", { p_name: name, p_period: period }, { ttlMs: 30_000 }),
  chart:        (name, skill, period)                => rpc("slimetrics_player_chart", { p_name: name, p_skill: skill, p_period: period }, { ttlMs: 60_000 }),
  heatmap:      (name)                               => rpc("slimetrics_player_heatmap", { p_name: name }, { ttlMs: 60_000 }),
  hiscores:     (skill, type, offset = 0, limit = 50)=> rpc("slimetrics_hiscores", { p_skill: skill, p_type: type, p_offset: offset, p_limit: limit }, { ttlMs: 60_000 }),
  gainers:      (period, skill, type, limit = 50)    => rpc("slimetrics_gainers", { p_period: period, p_skill: skill, p_type: type, p_limit: limit }, { ttlMs: 60_000 }),
  records:      (skill, type, limit = 50)            => rpc("slimetrics_records", { p_skill: skill, p_type: type, p_limit: limit }, { ttlMs: 60_000 }),
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

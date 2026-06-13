/* Slimetrics — shared config. Reuses the game's Supabase project. */
export const SUPABASE_URL = "https://qzanopebxsibszwtbbnc.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_qfny9k_SNDIK1dqn6TMcYw_vEt2KwlF";

/* Origin the read RPCs are fetched from. Defaults to Supabase directly.
   To enable edge caching, deploy slimetrics-cache-worker/ and set this to the
   Worker URL, e.g. "https://slimetrics-cache.<account>.workers.dev". The Worker
   proxies /rest/v1/rpc/* to SUPABASE_URL and caches public reads at the edge.
   Setting this back to SUPABASE_URL restores direct (uncached) calls. */
export const RPC_ORIGIN = "https://slimetrics-cache.churpostudios.workers.dev";
export const SAPLING_CUTOFF_MS = Date.parse("2026-03-23T01:20:00Z");

export const PERIODS = [
  { id: "1d", label: "Day" },
  { id: "1w", label: "Week" },
  { id: "1m", label: "Month" },
  { id: "1y", label: "Year" },
  { id: "all", label: "All" },
];
export const ACCOUNT_TYPES = [
  { id: "all", label: "All" },
  { id: "legacy", label: "Legacy" },
  { id: "sapling", label: "Saplings" },
];

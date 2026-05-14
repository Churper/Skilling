/* Slimetrics — shared config. Reuses the game's Supabase project. */
export const SUPABASE_URL = "https://qzanopebxsibszwtbbnc.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_qfny9k_SNDIK1dqn6TMcYw_vEt2KwlF";
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

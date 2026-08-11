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
/* Account-mode markers. The ids are the server's mode names, NOT display text:
   'automator' is the internal name of the realm the owner named Nimbus, and the
   tab id has to stay 'automator' because that is the p_type the RPCs accept.
   Glyphs are owner-picked and final (2026-08-10) and match the in-game ones in
   docs/game/systems/accountMode.js — the same account must not wear a different
   emblem on the two surfaces. A mode absent from this map renders unmarked,
   which is the correct fail-quiet: the server only ever sends a badge for a
   mode whose policy row is visible, so an unknown value here means the site is
   older than the mode, not that something should be guessed at. */
export const MODE_BADGES = {
  ironslime: { glyph: "🌴", label: "Ironslime", cls: "ironslime" },
  automator: { glyph: "☁️", label: "Nimbus",    cls: "nimbus" },
};

/* Five entries now, so the Account filter is rendered WITHOUT filterRow's
   `{ row: true }`: that option forces one equal-width column per item and never
   wraps, which on a phone would cut "Ironslime" down to an ellipsis. The
   default auto-fill grid wraps to a second line instead and keeps the shared
   divider slices intact. */
export const ACCOUNT_TYPES = [
  { id: "all", label: "All" },
  { id: "legacy", label: "Legacy" },
  { id: "sapling", label: "Saplings" },
  { id: "ironslime", label: "Ironslime", icon: MODE_BADGES.ironslime.glyph },
  { id: "automator", label: "Nimbus", icon: MODE_BADGES.automator.glyph },
];

/* The one marker a row gets, mode first. A mode badge OUTRANKS the sapling
   sprout rather than sitting beside it: ironslime is fresh-accounts-only, so
   nearly every ironslime is also a sapling, and showing both would put two
   glyphs in front of most names on that tab. Same one-slot precedence the game
   uses on nametags. */
export function accountMark(row) {
  const m = MODE_BADGES[row?.mode_badge];
  if (m) return `<span class="st-mode ${m.cls}" title="${m.label}">${m.glyph}</span>`;
  return row?.is_sapling ? `<span class="st-sap">🌱</span>` : "";
}

/* Plain-glyph form for places that render their own spacing. */
export function accountGlyph(row) {
  const m = MODE_BADGES[row?.mode_badge];
  if (m) return m.glyph;
  return row?.is_sapling ? "🌱" : "";
}

/* What the profile page calls this account, in words. */
export function accountKind(row) {
  return MODE_BADGES[row?.mode_badge]?.label || (row?.is_sapling ? "Sapling" : "Legacy");
}

/* Number / date / XP formatters. Keep this file dependency-free. */

export function nf(n) {
  if (n == null || !isFinite(n)) return "—";
  return Number(n).toLocaleString("en-US");
}

export function nfShort(n) {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a < 1000) return String(Math.round(n));
  if (a < 1e6) return (n / 1e3).toFixed(a < 1e4 ? 1 : 0) + "k";
  if (a < 1e9) return (n / 1e6).toFixed(a < 1e7 ? 1 : 0) + "M";
  return (n / 1e9).toFixed(2) + "B";
}

export function nfSigned(n) {
  if (n == null || !isFinite(n) || n === 0) return "0";
  return (n > 0 ? "+" : "") + nf(n);
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const t = typeof iso === "number" ? iso : Date.parse(iso);
  if (!t) return "—";
  const dt = Date.now() - t;
  const m = Math.floor(dt / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d < 30) return d + "d ago";
  const mo = Math.floor(d / 30);
  if (mo < 12) return mo + "mo ago";
  return Math.floor(mo / 12) + "y ago";
}

export function dateLabel(iso) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function dateLabelShort(iso) {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

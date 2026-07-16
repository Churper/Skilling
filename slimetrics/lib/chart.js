/* Tiny SVG chart helpers — no external lib.
   Each function returns an SVG string you set via innerHTML. */

import { nfShort, dateLabelShort, nf } from "./format.js";

/* ── Donut hover tooltip — delegated, wired once on first import ──────── */
(function _initDonutTooltip() {
  if (typeof document === "undefined" || document._stDonutTipWired) return;
  document._stDonutTipWired = true;
  let tip = null;
  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "donut-tip";
    tip.style.display = "none";
    document.body.appendChild(tip);
    return tip;
  }
  document.addEventListener("mouseover", (ev) => {
    const t = ev.target.closest?.(".donut-slice");
    if (!t) return;
    const el = ensureTip();
    const label = t.dataset.label || "";
    const color = t.dataset.color || "#50e878";
    const xp = Number(t.dataset.xp || 0);
    const pct = t.dataset.pct || "0";
    const lvl = t.dataset.lvl;
    el.innerHTML = `
      <div class="dt-row"><span class="dt-swatch" style="background:${color}"></span><span class="dt-label">${label}</span></div>
      ${lvl != null ? `<div class="dt-pct" style="color:var(--fg)">Lvl ${lvl}</div>` : ""}
      <div class="dt-xp">${nf(xp)} XP</div>
      <div class="dt-pct">${pct}% of total</div>`;
    el.style.display = "block";
  });
  document.addEventListener("mousemove", (ev) => {
    const t = ev.target.closest?.(".donut-slice");
    if (!t || !tip) return;
    tip.style.left = ev.clientX + window.scrollX + "px";
    tip.style.top = ev.clientY + window.scrollY + "px";
  });
  document.addEventListener("mouseout", (ev) => {
    if (!ev.target.closest?.(".donut-slice")) return;
    if (tip) tip.style.display = "none";
  });
})();

const NS = "http://www.w3.org/2000/svg";

function _path(points) {
  if (!points.length) return "";
  return points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
}

/**
 * Line chart with axes.
 * @param {Array<{t: string|Date, v: number}>} data
 */
export function lineChart(data, { width = 600, height = 240, color = "#50e878", label = "" } = {}) {
  if (!data?.length) return _emptyState(width, height, "No data yet — graphs fill in after a few snapshots.");
  const pad = { l: 60, r: 20, t: 22, b: 32 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const ts = data.map(d => +new Date(d.t));
  const vs = data.map(d => +d.v);
  const t0 = ts[0], t1 = ts[ts.length - 1];
  let vmin = Math.min(...vs), vmax = Math.max(...vs);
  /* When all points share the same value (e.g. single snapshot), pad the
     range so we don't get five identical y-axis labels. */
  if (vmax - vmin < 1) {
    const padV = Math.max(1, Math.abs(vmax) * 0.05);
    vmin = vmax - padV;
    vmax = vmax + padV;
  }
  const tSpan = Math.max(1, t1 - t0);
  const vSpan = Math.max(1, vmax - vmin);
  const points = data.map((d, i) => [
    pad.l + ((+new Date(d.t) - t0) / tSpan) * w,
    pad.t + h - ((+d.v - vmin) / vSpan) * h,
  ]);

  /* Y-axis ticks: 4 evenly spaced. */
  const yTicks = [];
  for (let i = 0; i <= 4; i++) {
    const v = vmin + (vmax - vmin) * (i / 4);
    yTicks.push({ y: pad.t + h - (i / 4) * h, label: nfShort(v) });
  }
  /* If all tick labels collapsed to the same string, fall back to a single
     centered label so we don't repeat "98M 98M 98M 98M 98M". */
  const collapsed = yTicks.every(t => t.label === yTicks[0].label);
  if (collapsed) {
    yTicks.length = 1;
    yTicks[0] = { y: pad.t + h / 2, label: nfShort(vs[0]) };
  }
  /* X-axis ticks: ~5 dates evenly spaced. */
  const xTicks = [];
  const NX = Math.min(5, data.length);
  for (let i = 0; i < NX; i++) {
    const idx = Math.round((data.length - 1) * (i / (NX - 1 || 1)));
    xTicks.push({ x: pad.l + ((ts[idx] - t0) / tSpan) * w, label: dateLabelShort(data[idx].t) });
  }

  /* Area fill under line. */
  const areaPath = _path(points) + ` L ${points[points.length - 1][0].toFixed(1)},${pad.t + h} L ${points[0][0].toFixed(1)},${pad.t + h} Z`;

  return `
<svg viewBox="0 0 ${width} ${height}" xmlns="${NS}" class="st-chart" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="st-grad-${cssEscape(color)}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${yTicks.map(t => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${t.y.toFixed(1)}" y2="${t.y.toFixed(1)}" class="st-chart-grid"/>`).join("")}
  ${yTicks.map(t => `<text x="${pad.l - 8}" y="${(t.y + 4).toFixed(1)}" text-anchor="end" class="st-chart-axis">${escape(t.label)}</text>`).join("")}
  ${xTicks.map(t => `<text x="${t.x.toFixed(1)}" y="${(height - 10).toFixed(1)}" text-anchor="middle" class="st-chart-axis">${escape(t.label)}</text>`).join("")}
  <path d="${areaPath}" fill="url(#st-grad-${cssEscape(color)})"/>
  <path d="${_path(points)}" fill="none" stroke="${color}" stroke-width="2"/>
  ${points.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${data.length > 60 ? 0 : 2.2}" fill="${color}"/>`).join("")}
</svg>`;
}

function cssEscape(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, "_"); }
function escape(s) { return String(s ?? "").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

function _emptyState(w, h, msg) {
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="${NS}" class="st-chart st-chart-empty">
    <text x="${w / 2}" y="${h / 2}" text-anchor="middle" class="st-chart-empty-text">${escape(msg)}</text>
  </svg>`;
}

/**
 * Donut chart of skill XP distribution.
 * @param {Array<{label: string, value: number, color: string}>} segments
 * @param {{centerLabel: string, centerSub: string}} opts
 */
export function donutChart(segments, { size = 220, centerLabel = "", centerSub = "" } = {}) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  if (total <= 0) return _emptyState(size, size, "No XP yet");
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - 8;
  const inner = r * 0.6;
  let acc = 0;
  const arcs = segments.filter(s => s.value > 0).map(s => {
    const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += s.value;
    const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    const x2 = cx + Math.cos(a1) * inner, y2 = cy + Math.sin(a1) * inner;
    const x3 = cx + Math.cos(a0) * inner, y3 = cy + Math.sin(a0) * inner;
    /* SVG DROPS an elliptical arc whose endpoints coincide, so a slice that
       sweeps a full turn renders the whole donut INVISIBLE. This bites at 100%
       (one skill with all the XP) and also just under it, because the endpoints
       only have to round to the same rendered coordinate — at 120M total, one
       skill under ~900 XP is enough. Test the rounded coords, not the angle.
       A major arc that lands back on its start is a ring: emit two half arcs
       per edge, with evenodd punching the centre hole. (A tiny sliver also has
       coincident ends but sweeps < PI, and correctly stays invisible.) */
    const isFull = x0.toFixed(2) === x1.toFixed(2) &&
                   y0.toFixed(2) === y1.toFixed(2) &&
                   (a1 - a0) > Math.PI;
    const d = isFull
      ? `M ${(cx - r).toFixed(2)} ${cy.toFixed(2)} a ${r} ${r} 0 1 1 ${(r * 2).toFixed(2)} 0 a ${r} ${r} 0 1 1 ${(-r * 2).toFixed(2)} 0 Z ` +
        `M ${(cx - inner).toFixed(2)} ${cy.toFixed(2)} a ${inner} ${inner} 0 1 0 ${(inner * 2).toFixed(2)} 0 a ${inner} ${inner} 0 1 0 ${(-inner * 2).toFixed(2)} 0 Z`
      : `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)} A ${inner} ${inner} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;
    const pct = ((s.value / total) * 100).toFixed(1);
    const lvl = (s.level != null) ? ` data-lvl="${s.level}"` : "";
    return `<path class="donut-slice" d="${d}" fill="${s.color}" fill-rule="evenodd" data-label="${escape(s.label)}" data-color="${escape(s.color)}" data-xp="${s.value}" data-pct="${pct}"${lvl}><title>${escape(s.label)}: ${s.value.toLocaleString("en-US")} XP (${pct}%)</title></path>`;
  });
  return `
<svg viewBox="0 0 ${size} ${size}" xmlns="${NS}" class="st-donut" role="img" aria-label="Skill XP distribution">
  ${arcs.join("")}
  <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="st-donut-label">${escape(centerLabel)}</text>
  <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="st-donut-sub">${escape(centerSub)}</text>
</svg>`;
}

/**
 * GitHub-style activity heatmap (53 weeks × 7 days).
 * @param {Array<{d: string, g: number}>} days  - sorted ascending
 */
export function heatmap(days, { weeks = 53, cellSize = 14, gap = 3, cellW, cellH } = {}) {
  /* Optional cellW/cellH override the square cellSize for rectangular cells. */
  const _cw = cellW != null ? cellW : cellSize;
  const _ch = cellH != null ? cellH : cellSize;
  const startDate = new Date(); startDate.setDate(startDate.getDate() - weeks * 7);
  /* Map by ISO date for lookup. */
  const byDay = new Map();
  let maxG = 0;
  for (const d of days || []) { const k = String(d.d).slice(0, 10); byDay.set(k, d.g || 0); if (d.g > maxG) maxG = d.g; }
  const monthLabels = [];
  let lastMonth = -1;
  const cells = [];
  for (let w = 0; w < weeks; w++) {
    for (let day = 0; day < 7; day++) {
      const dt = new Date(startDate);
      dt.setDate(dt.getDate() + w * 7 + day);
      const k = dt.toISOString().slice(0, 10);
      const g = byDay.get(k) || 0;
      const intensity = maxG > 0 ? Math.min(1, g / maxG) : 0;
      const lvl = g === 0 ? 0 : Math.min(4, 1 + Math.floor(intensity * 4));
      const x = w * (_cw + gap);
      const y = day * (_ch + gap) + 16;
      cells.push(`<rect x="${x}" y="${y}" width="${_cw}" height="${_ch}" rx="2" class="st-heat-cell st-heat-l${lvl}"><title>${dt.toLocaleDateString("en-US")}: ${g.toLocaleString("en-US")} XP</title></rect>`);
      if (day === 0 && dt.getMonth() !== lastMonth) {
        lastMonth = dt.getMonth();
        monthLabels.push(`<text x="${x}" y="12" class="st-heat-month">${dt.toLocaleString("en-US",{month:"short"})}</text>`);
      }
    }
  }
  const w = weeks * (_cw + gap);
  const h = 7 * (_ch + gap) + 18;
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="${NS}" class="st-heat" role="img" aria-label="Activity heatmap">
    ${monthLabels.join("")}
    ${cells.join("")}
  </svg>`;
}

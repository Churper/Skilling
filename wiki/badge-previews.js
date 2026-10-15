/* The shared style ladder and the Lv 2000 two-tone stitch trim. */
export const NAMETAG_STYLE_DEFAULT = "default";
export const NAMETAG_STYLE_OPTIONS = Object.freeze([
  { id: "default", label: "Default", unlockLevel: 0 },
  { id: "framed", label: "Framed", unlockLevel: 500 },
  { id: "bottomDash", label: "Bottom Dash", unlockLevel: 750 },
  { id: "doubleDash", label: "Double Dash", unlockLevel: 1000 },
  { id: "diagonal", label: "Diagonal", unlockLevel: 1500 },
  { id: "stitched", label: "Stitched", unlockLevel: 2000 },
]);
export const NAMETAG_STYLE_BY_ID = Object.freeze(Object.fromEntries(NAMETAG_STYLE_OPTIONS.map(style => [style.id, style])));
export const NAMETAG_STYLE_RENDER_PRESETS = Object.freeze({
  framed: { pattern: "clean", fontScale: 1, padX: 8, padY: 2, radius: 8, borderAlpha: 0.86, glowAlpha: 0.18, lineAlpha: 0, lineWidth: 1, dashLen: 5, dashGap: 4, railInset: 2, railEdge: 8, diagGap: 5, diagSpace: 5, centerAlpha: 0.12, edgeAlpha: 0.16 },
  bottomDash: { pattern: "singleRail", fontScale: 1, padX: 8, padY: 2, radius: 8, borderAlpha: 0.9, glowAlpha: 0.2, lineAlpha: 1, lineWidth: 1, dashLen: 4, dashGap: 4, railInset: 2, railEdge: 8, diagGap: 5, diagSpace: 5, centerAlpha: 0.52, edgeAlpha: 0.28 },
  doubleDash: { pattern: "doubleRail", fontScale: 1, padX: 7, padY: 2, radius: 8, borderAlpha: 0.94, glowAlpha: 0.26, lineAlpha: 0.86, lineWidth: 1, dashLen: 4, dashGap: 5, railInset: 2, railEdge: 8, diagGap: 5, diagSpace: 5, centerAlpha: 0.82, edgeAlpha: 0.46 },
  diagonal: { pattern: "diagonal", fontScale: 1, padX: 7, padY: 2, radius: 8, borderAlpha: 0.96, glowAlpha: 0.32, lineAlpha: 0.42, lineWidth: 1, dashLen: 5, dashGap: 4, railInset: 2, railEdge: 8, diagGap: 4, diagSpace: 4, centerAlpha: 0.72, edgeAlpha: 0.2 },
  stitched: { pattern: "stitch", fontScale: 1, padX: 9, padY: 2, radius: 8, borderAlpha: 0.96, glowAlpha: 0, lineAlpha: 0, lineWidth: 1, dashLen: 3, dashGap: 3, railInset: 2, railEdge: 8, diagGap: 4, diagSpace: 4, centerAlpha: 0, edgeAlpha: 0.12 },
});

function fitStitchLoop(svg) {
  const length = svg.firstElementChild?.getTotalLength();
  if (!(length > 0)) return;
  // Whole pairs keep the closing gap equal to the others, at any tag width.
  const pathLength = String(Math.max(12, Math.round(length / 12) * 12));
  for (const rect of svg.children) if (rect.getAttribute("pathLength") !== pathLength) rect.setAttribute("pathLength", pathLength);
}

/* The tiny wrapper owns observation through its DOM lifecycle. One observer
   per document refits after names, fonts or inventory cells resize, and stops
   watching as soon as a tag or inventory/menu subtree is removed. */
function registerStitchElement(doc) {
  const view = doc.defaultView;
  if (view.customElements.get("nameplate-stitch")) return;
  const observer = new view.ResizeObserver(entries => { for (const { target } of entries) fitStitchLoop(target); });
  view.customElements.define("nameplate-stitch", class extends view.HTMLElement {
    connectedCallback() { if (this.firstElementChild) observer.observe(this.firstElementChild); }
    disconnectedCallback() { if (this.firstElementChild) observer.unobserve(this.firstElementChild); }
  });
}

/* No per-frame work: callers update only when the style or icon changes.
   The second rectangle fills alternating dash positions around the same loop. */
export function setNameplateStitch(element, enabled) {
  if (!element) return;
  const existing = element.querySelector(".nameplate-stitch");
  if (!enabled) { existing?.remove(); return; }
  if (existing) return;
  const doc = element.ownerDocument;
  registerStitchElement(doc);
  const trim = doc.createElement("nameplate-stitch");
  trim.className = "nameplate-stitch";
  trim.setAttribute("aria-hidden", "true");
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (let i = 0; i < 2; i++) svg.appendChild(doc.createElementNS("http://www.w3.org/2000/svg", "rect"));
  trim.appendChild(svg);
  element.appendChild(trim);
}

export function nameplateLevelText(level, style = {}) {
  const badge = style.icon ? `${style.icon} ` : "";
  return `Lv ${level}${style.nameplateStyle === "stitched" ? " " : " · "}${badge}`;
}

function _clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function getOrCreateNameTag(key) {
  let tag = nameTags.get(key);
  if (tag) return tag;
  const el = document.createElement("div");
  /* Local player gets subtle baseline emphasis; badge state now controls extra size. */
  el.className = key === "local" ? "nametag is-local" : "nametag";
  const levelSpan = document.createElement("span");
  levelSpan.className = "nametag-level";
  const lvlText = document.createTextNode("");
  const nameSpan = document.createElement("span");
  nameSpan.className = "nametag-name";
  levelSpan.appendChild(lvlText);
  levelSpan.appendChild(nameSpan);
  el.appendChild(levelSpan);
  /* Clan line — emblem icon + [TAG] under the name. Hidden until clan
     info shows up. Emblem is icon-only (no colored backdrop) so the icon
     itself is the distinguishing feature. */
  const clanRow = document.createElement("span");
  clanRow.className = "nametag-clan";
  clanRow.style.display = "none";
  const clanEmblemSlot = document.createElement("span");
  clanEmblemSlot.className = "nametag-clan-emblem";
  const clanTagSpan = document.createElement("span");
  clanTagSpan.className = "nametag-clan-tag";
  clanRow.appendChild(clanEmblemSlot);
  clanRow.appendChild(clanTagSpan);
  el.appendChild(clanRow);
  getBubbleLayer().appendChild(el);
  tag = {
    el, nameSpan, levelSpan, lvlText, name: "", level: "", sx: -1, sy: -1, _probeKey: key,
    clanRow, clanEmblemSlot, clanTagSpan,
    clanTagShown: "", clanEmblemKey: "",
  };
  nameTags.set(key, tag);
  return tag;
}
function _sanitizeNameplateStyle(styleId) {
  const id = String(styleId || "").trim();
  return NAMETAG_STYLE_BY_ID[id] ? id : NAMETAG_STYLE_DEFAULT;
}
function _nametagStyleClass(styleId) {
  const id = _sanitizeNameplateStyle(styleId);
  if (id === NAMETAG_STYLE_DEFAULT) return "";
  return `nametag-style-${id.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}`;
}
function _nametagHexToRgb(hex) {
  const clean = String(hex || "#ffffff").replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map(ch => ch + ch).join("") : clean;
  const n = /^[0-9a-f]{6}$/i.test(full) ? parseInt(full, 16) : NaN;
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [255, 255, 255];
}
function _nametagRgba(color, alpha) {
  const [r, g, b] = _nametagHexToRgb(color);
  return `rgba(${r},${g},${b},${_clamp(Number(alpha) || 0, 0, 1).toFixed(3)})`;
}
function _nametagGlowRgba(color, alpha) { const [r, g, b] = _nametagHexToRgb(color); const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; return _nametagRgba(color, (Number(alpha) || 0) * _clamp(1.08 - lum * 0.55, 0.42, 1)); }
function _nametagPatternChannels(pattern, alpha, color) {
  const on = _nametagRgba(color, alpha);
  const off = "transparent";
  return {
    top: pattern === "doubleRail" ? on : off,
    bottom: (pattern === "singleRail" || pattern === "doubleRail") ? on : off,
    diagonal: pattern === "diagonal" ? on : off,
  };
}
function _clearNametagRenderPreset(tag) {
  const level = tag?.levelSpan;
  if (!level) return;
  setNameplateStitch(level, false);
  for (const name of [
    "--nt-border-color", "--nt-rail-top-color", "--nt-rail-bottom-color", "--nt-diag-color",
    "--nt-glow-color", "--nt-name-glow-color", "--nt-inner-color", "--nt-pad-x", "--nt-pad-y",
    "--nt-radius", "--nt-font-scale", "--nt-line-width", "--nt-dash-len", "--nt-dash-gap",
    "--nt-rail-top", "--nt-rail-bottom", "--nt-rail-edge", "--nt-diag-gap", "--nt-diag-space",
    "--nt-diag-angle", "--nt-center-alpha", "--nt-edge-alpha", "--nt-edge-mid-alpha",
    "--nt-gloss-alpha", "--nt-glow-size", "--nt-name-glow"
  ]) level.style.removeProperty(name);
  delete tag.el.dataset.nameplatePattern;
}
function _applyNametagRenderPreset(tag, styleId, color) {
  const preset = NAMETAG_STYLE_RENDER_PRESETS[_sanitizeNameplateStyle(styleId)];
  if (!tag?.levelSpan || !preset) {
    _clearNametagRenderPreset(tag);
    return;
  }
  const level = tag.levelSpan;
  setNameplateStitch(level, styleId === "stitched");
  const channels = _nametagPatternChannels(preset.pattern, preset.lineAlpha, color);
  tag.el.dataset.nameplatePattern = preset.pattern;
  level.style.setProperty("--nt-border-color", _nametagRgba(color, preset.borderAlpha));
  level.style.setProperty("--nt-rail-top-color", channels.top);
  level.style.setProperty("--nt-rail-bottom-color", channels.bottom);
  level.style.setProperty("--nt-diag-color", channels.diagonal);
  level.style.setProperty("--nt-glow-color", _nametagGlowRgba(color, preset.glowAlpha));
  level.style.setProperty("--nt-inner-color", _nametagRgba("#ffffff", Math.min(0.16, preset.borderAlpha * 0.16)));
  level.style.setProperty("--nt-pad-x", `${preset.padX}px`);
  level.style.setProperty("--nt-pad-y", `${preset.padY}px`);
  level.style.setProperty("--nt-radius", `${preset.radius}px`);
  level.style.setProperty("--nt-font-scale", preset.fontScale);
  level.style.setProperty("--nt-line-width", `${preset.lineWidth}px`);
  level.style.setProperty("--nt-dash-len", `${preset.dashLen}px`);
  level.style.setProperty("--nt-dash-gap", `${preset.dashGap}px`);
  level.style.setProperty("--nt-rail-top", `${preset.railInset}px`);
  level.style.setProperty("--nt-rail-bottom", `${preset.railInset}px`);
  level.style.setProperty("--nt-rail-edge", `${preset.railEdge}px`);
  level.style.setProperty("--nt-diag-gap", `${preset.diagGap}px`);
  level.style.setProperty("--nt-diag-space", `${preset.diagSpace}px`);
  level.style.setProperty("--nt-diag-angle", "135deg");
  level.style.setProperty("--nt-center-alpha", preset.centerAlpha);
  level.style.setProperty("--nt-edge-alpha", preset.edgeAlpha);
  level.style.setProperty("--nt-edge-mid-alpha", Math.max(0, preset.edgeAlpha * 0.58));
  level.style.setProperty("--nt-gloss-alpha", Math.min(0.1, preset.borderAlpha * 0.08));
  level.style.setProperty("--nt-glow-size", `${Math.round(5 + preset.glowAlpha * 18)}px`);
  level.style.setProperty("--nt-name-glow", `${Math.round(4 + preset.glowAlpha * 9)}px`);
}
function _applyNametagBadgeStyle(tag, style = {}) {
  if (!tag?.el) return;
  const key = style.key || "";
  const color = style.color || "";
  const badged = !!style.icon && key !== "seedling" && key !== "pvp_marked" && key !== "pvp_peaceful" && !key.startsWith("mode_"); /* 🩸/🕊️/🌱 + mode emblems use the sapling's SMALL slot; the sized path is for skill nameplates and recolours the whole tag (v2192 sent modes down it: green/white names, palm crowding the dove) */
  tag._badged = badged; /* cached so _setNametagScreenPos can branch without classList reads */
  if (tag.el.classList.contains("is-badged") !== badged) {
    tag.el.classList.toggle("is-badged", badged);
    tag._measureDirty = true; /* is-badged changes font-size/padding */
  }
  const styleId = badged ? _sanitizeNameplateStyle(style.nameplateStyle) : "";
  const styleClass = styleId ? _nametagStyleClass(styleId) : "";
  if (tag.nameplateStyleClass !== styleClass) {
    if (tag.nameplateStyleClass) tag.el.classList.remove(tag.nameplateStyleClass);
    if (styleClass) tag.el.classList.add(styleClass);
    tag.nameplateStyleClass = styleClass;
    tag._measureDirty = true;
    if (styleId) tag.el.dataset.nameplateStyle = styleId;
    else delete tag.el.dataset.nameplateStyle;
  }
  if (tag.badgeStyleKey === key && tag.badgeStyleColor === color && tag.badgeStyleStyleId === styleId) return;
  tag.badgeStyleKey = key;
  tag.badgeStyleColor = color;
  tag.badgeStyleStyleId = styleId;
  if (color) tag.el.style.setProperty("--nametag-accent", color);
  else tag.el.style.removeProperty("--nametag-accent");
  _applyNametagRenderPreset(tag, styleId, color || "#ffe999");
}

const nameTags=new Map();
function getBubbleLayer(){return document.createDocumentFragment();}
for(const [index,preview]of [...document.querySelectorAll('[data-badge-preview]')].entries()){
  const style={icon:preview.dataset.badgeIcon,color:preview.dataset.badgeColor,key:preview.dataset.badgeKey,nameplateStyle:preview.dataset.badgeStyle};
  const tag=getOrCreateNameTag('wiki-preview-'+index);
  _applyNametagBadgeStyle(tag,style);
  tag.lvlText.textContent=nameplateLevelText(1000,style);
  tag.nameSpan.textContent='Slime0000';
  tag.el.setAttribute('aria-hidden','true');
  preview.replaceChildren(tag.el);
}

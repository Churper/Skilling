(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const embedded = params.get('embed') === '1';
  const resourceLabel = embedded ? (params.get('resource') || '').trim() : '';
  let scopeRoute = (params.get('scope') || '').trim();
  if (embedded) document.documentElement.classList.add('map-embed');
  const host = document.querySelector('[data-world-map]');
  if (!host) return;
  const canvas = host.querySelector('canvas'), context = canvas.getContext('2d');
  const status = host.querySelector('[data-map-status]'), results = host.querySelector('[data-map-results]');
  const search = host.querySelector('[data-map-search]'), selection = host.querySelector('.map-selection');
  const position = host.querySelector('.map-position');
  const colors = { npcs: '#f0ce78', services: '#b7e5d1', islands: '#8ec6d8', resources: '#9fc56e', combat: '#e79282' };
  let data, selected, visible = [], query = '', width = 0, height = 0, zoom = 1, centerX = 0, centerZ = 0, drawPending = false;
  const layers = new Set([...host.querySelectorAll('[data-map-layer]:checked')].map(c => c.dataset.mapLayer));
  if (resourceLabel) layers.add('resources');
  let oceanColor = '#14252d';
  const image = new Image(); image.addEventListener('load', () => {
    const sample = document.createElement('canvas'); sample.width = sample.height = 1;
    const sampleContext = sample.getContext('2d', { willReadFrequently: true });
    sampleContext.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
    const pixel = sampleContext.getImageData(0, 0, 1, 1).data;
    if (pixel[3]) oceanColor = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
    requestDraw();
  });
  const islandImages = new Map();
  const statueImage = new Image();
  statueImage.addEventListener('load', requestDraw);
  statueImage.src = 'art/map-slime-statue.png';
  const isStatue = marker => marker.layer === 'services' && marker.label === 'Slime Statue (Teleport)';
  const normalize = value => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const inArticleScope = marker => (!scopeRoute || marker.url === scopeRoute) && (!resourceLabel || normalize(marker.label) === normalize(resourceLabel));
  const screen = m => [width / 2 + (centerX - m.x) * zoom, height / 2 + (centerZ - m.z) * zoom];
  const worldPoint = (x, y) => ({ x: centerX - (x - width / 2) / zoom, z: centerZ - (y - height / 2) / zoom });
  function requestDraw() { if (!drawPending) { drawPending = true; requestAnimationFrame(draw); } }
  function size() {
    const rect = canvas.getBoundingClientRect(), ratio = Math.min(devicePixelRatio || 1, 2);
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0); requestDraw();
  }
  function reset() {
    if (!data) return;
    const atlas = data.atlas;
    centerX = atlas.maxX - atlas.width / (2 * atlas.scale); centerZ = atlas.maxZ - atlas.height / (2 * atlas.scale);
    zoom = Math.min(width * atlas.scale / atlas.width, height * atlas.scale / atlas.height) * .95;
    requestDraw();
  }
  function wholeWorld() {
    if (!data) return;
    const atlas = data.atlas;
    let minX = atlas.maxX - atlas.width / atlas.scale, maxX = atlas.maxX;
    let minZ = atlas.maxZ - atlas.height / atlas.scale, maxZ = atlas.maxZ;
    for (const island of data.islands || []) {
      minX = Math.min(minX, island.x - island.worldSize / 2); maxX = Math.max(maxX, island.x + island.worldSize / 2);
      minZ = Math.min(minZ, island.z - island.worldSize / 2); maxZ = Math.max(maxZ, island.z + island.worldSize / 2);
    }
    centerX = (minX + maxX) / 2; centerZ = (minZ + maxZ) / 2;
    zoom = Math.min(width / (maxX - minX), height / (maxZ - minZ)) * .92;
    requestDraw();
  }
  function draw() {
    drawPending = false;
    context.fillStyle = oceanColor; context.fillRect(0, 0, width, height);
    if (!data) return;
    const atlas = data.atlas, [left, top] = screen({ x: atlas.maxX, z: atlas.maxZ });
    if (image.complete && image.naturalWidth) context.drawImage(image, left, top, atlas.width * zoom / atlas.scale, atlas.height * zoom / atlas.scale);
    for (const island of data.islands || []) {
      const size = island.worldSize * zoom;
      const [x, y] = screen({ x: island.x + island.worldSize / 2, z: island.z + island.worldSize / 2 });
      if (x > width || y > height || x + size < 0 || y + size < 0) continue;
      let bitmap = islandImages.get(island.route);
      if (!bitmap) {
        bitmap = new Image(); islandImages.set(island.route, bitmap);
        bitmap.addEventListener('load', requestDraw);
        bitmap.src = island.image || island.route;
      }
      if (bitmap.complete && bitmap.naturalWidth) context.drawImage(bitmap, x, y, size, size);
    }
    const paint = (m, active = false) => {
      const [x, y] = screen(m);
      if (x < -15 || y < -15 || x > width + 15 || y > height + 15) return;
      const statue = isStatue(m);
      const radius = statue ? active ? 13 : zoom < .1 ? 7 : zoom < .75 ? 9 : 11 : active ? 8 : zoom < .1 ? m.layer === 'npcs' ? 2.5 : 1.5 : m.layer === 'islands' ? 4 : 3.5;
      if (statue && statueImage.complete && statueImage.naturalWidth) {
        // Actual minimap sprite: radius24 inside a64px canvas, including its padding.
        const size = radius * 64 / 24;
        context.drawImage(statueImage, x - size / 2, y - size / 2, size, size);
        if (active) {
          context.beginPath(); context.arc(x, y, radius + 3, 0, Math.PI * 2);
          context.lineWidth = 2; context.strokeStyle = '#fff7d2'; context.stroke();
        }
      } else {
        context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = colors[m.layer] || '#eee'; context.fill();
        context.lineWidth = active ? 2.5 : 1; context.strokeStyle = active ? '#fff7d2' : '#14231c'; context.stroke();
      }
      if (active || (!embedded && ((m.layer === 'npcs' && zoom > .75) || (m.layer === 'islands' && zoom > .065 && zoom < .3)))) {
        context.font = active ? 'bold 12px system-ui' : '11px system-ui';
        const textWidth = context.measureText(m.label).width;
        const offset = statue ? radius + 6 : 11;
        const labelX = x + offset + textWidth > width - 5 ? Math.max(5, x - textWidth - offset) : x + offset;
        context.strokeStyle = '#12211e'; context.lineWidth = 3; context.strokeText(m.label, labelX, y + 4);
        context.fillStyle = '#f2eac9'; context.fillText(m.label, labelX, y + 4);
      }
    };
    const show = m => m !== selected;
    for (const m of visible) if (show(m) && !isStatue(m)) paint(m);
    for (const m of visible) if (show(m) && isStatue(m)) paint(m);
    if (selected && visible.includes(selected)) paint(selected, true);
    position.textContent = `Center: ${centerX.toFixed(0)}, ${centerZ.toFixed(0)} · East ← · North ↑`;
  }
  function zoomBy(factor, px = width / 2, py = height / 2) {
    const anchor = worldPoint(px, py);
    zoom = Math.max(.008, Math.min(12, zoom * factor));
    centerX = anchor.x + (px - width / 2) / zoom; centerZ = anchor.z + (py - height / 2) / zoom;
    requestDraw();
  }
  function select(m, focus = true) {
    selected = m;
    layers.add(m.layer);
    const checkbox = host.querySelector(`[data-map-layer="${m.layer}"]`);
    if (checkbox) checkbox.checked = true;
    if (focus) {
      centerX = m.x; centerZ = m.z;
      const island = m.layer === 'islands' && data.islands?.find(i => i.x === m.x && i.z === m.z);
      zoom = embedded ? 2 : island ? Math.min(width, height) * .8 / island.worldSize : 1.4;
    }
    selection.replaceChildren();
    const title = document.createElement('strong'); title.textContent = m.label;
    const detail = document.createElement('small'); detail.textContent = `${m.detail || m.layer} · ${m.x}, ${m.z}`;
    const article = document.createElement('a'); article.href = m.url; article.textContent = 'Read article →';
    if (embedded) article.target = '_top';
    selection.append(title, detail, article); selection.hidden = false;
    if (!embedded) {
      const url = new URL(location.href); url.searchParams.set('marker', m.id); history.replaceState(null, '', url);
      for (const row of results.querySelectorAll('[data-marker-id]')) row.classList.toggle('is-selected', row.dataset.markerId === m.id);
    }
    update();
  }
  function update() {
    if (!data) return;
    query = normalize(search.value.trim());
    visible = data.markers.filter(m => inArticleScope(m) && layers.has(m.layer) && (!query || normalize(`${m.label} ${m.detail || ''}`).includes(query)));
    const groups = new Map();
    // Search every layer, then enable a hidden layer when its result is chosen.
    const candidates = query ? data.markers.filter(m => inArticleScope(m) && normalize(`${m.label} ${m.detail || ''}`).includes(query)) : visible;
    for (const m of candidates) {
      const key = `${m.url}|${m.layer}`;
      if (!groups.has(key)) groups.set(key, { marker: m, count: 0 });
      groups.get(key).count++;
    }
    const entries = [...groups.values()].sort((a, b) => a.marker.label.localeCompare(b.marker.label));
    status.textContent = `${candidates.length.toLocaleString()} markers · ${entries.length.toLocaleString()} places${query ? ' · Search includes all layers.' : ''}${entries.length > 60 ? ' · First 60 shown. Search to narrow.' : ''}`;
    results.replaceChildren();
    for (const { marker: m, count } of entries.slice(0, 60)) {
      const row = document.createElement('div'); row.className = 'map-result'; row.dataset.markerId = m.id;
      if (selected?.id === m.id) row.classList.add('is-selected');
      const button = document.createElement('button'); button.type = 'button';
      const dot = document.createElement(isStatue(m) ? 'img' : 'span');
      if (isStatue(m)) { dot.src = 'art/map-slime-statue.png'; dot.alt = ''; dot.width = dot.height = 24; dot.style.cssText = 'vertical-align:middle;margin-right:4px'; }
      else { dot.className = 'map-dot-key'; dot.style.setProperty('--pin-color', colors[m.layer]); dot.setAttribute('aria-hidden', 'true'); }
      button.append(dot, document.createTextNode(m.label)); button.addEventListener('click', () => select(m));
      const detail = document.createElement('small'); detail.textContent = `${m.detail || m.layer}${count > 1 ? ` · ${count} locations` : ''}`;
      const article = document.createElement('a'); article.href = m.url; article.textContent = 'Article'; if (embedded) article.target = '_top';
      row.append(button, detail, article); results.append(row);
    }
    requestDraw();
  }
  search.addEventListener('input', update);
  for (const checkbox of host.querySelectorAll('[data-map-layer]')) checkbox.addEventListener('change', () => { checkbox.checked ? layers.add(checkbox.dataset.mapLayer) : layers.delete(checkbox.dataset.mapLayer); update(); });
  for (const button of host.querySelectorAll('[data-map-zoom]')) button.addEventListener('click', () => zoomBy(Number(button.dataset.mapZoom) > 0 ? 1.5 : 1 / 1.5));
  host.querySelector('[data-map-reset]').addEventListener('click', reset);
  host.querySelector('[data-map-world]')?.addEventListener('click', wholeWorld);
  canvas.addEventListener('wheel', event => { event.preventDefault(); const r = canvas.getBoundingClientRect(); zoomBy(Math.exp(-event.deltaY * .0015), event.clientX - r.left, event.clientY - r.top); }, { passive: false });
  const pointers = new Map(); let start, moved = false, pinchDistance = 0;
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { x: e.clientX, y: e.clientY }; moved = false;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDistance = Math.hypot(a.x - b.x, a.y - b.y); moved = true; }
  });
  canvas.addEventListener('pointermove', e => {
    const previous = pointers.get(e.pointerId); if (!previous) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y), r = canvas.getBoundingClientRect();
      if (pinchDistance > 0) zoomBy(distance / pinchDistance, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinchDistance = distance; moved = true;
    } else {
      centerX += (e.clientX - previous.x) / zoom; centerZ += (e.clientY - previous.y) / zoom;
      moved ||= Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4; requestDraw();
    }
  });
  const release = e => {
    if (!pointers.has(e.pointerId)) return;
    if (!moved && data) {
      const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      let nearest, best = 14;
      for (const m of visible) { const [x, y] = screen(m), d = Math.hypot(px - x, py - y); if (d < best) { best = d; nearest = m; } }
      if (nearest) select(nearest, false);
    }
    pointers.delete(e.pointerId); pinchDistance = 0;
  };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); moved = true; });
  canvas.addEventListener('keydown', e => {
    const step = 70 / zoom;
    if (e.key === 'ArrowLeft') centerX += step; else if (e.key === 'ArrowRight') centerX -= step;
    else if (e.key === 'ArrowUp') centerZ += step; else if (e.key === 'ArrowDown') centerZ -= step;
    else if (e.key === '+' || e.key === '=') zoomBy(1.5); else if (e.key === '-') zoomBy(1 / 1.5); else if (e.key === 'Home') reset(); else return;
    e.preventDefault(); requestDraw();
  });
  new ResizeObserver(size).observe(canvas); size();
  fetch('world-data.json', { cache: 'no-cache' }).then(response => { if (!response.ok) throw new Error(`Map data ${response.status}`); return response.json(); }).then(value => {
    data = value; image.src = data.atlas.image || 'map-mainland.png'; reset();
    const initial = data.markers.find(m => m.id === params.get('marker'));
    // Older article embeds already carry a marker, so they inherit the same
    // exact article scope even before their generated HTML is refreshed.
    if (embedded && !scopeRoute && initial) scopeRoute = initial.url;
    if (initial) { layers.add(initial.layer); const checkbox = host.querySelector(`[data-map-layer="${initial.layer}"]`); if (checkbox) checkbox.checked = true; select(initial); }
    update();
  }).catch(error => { status.textContent = 'The map could not load. Reload the page to try again.'; console.error(error); });
})();

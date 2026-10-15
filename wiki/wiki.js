/* Shared progressive enhancement. Articles, tables and links work without JS. */
(() => {
  'use strict';
  const root = document.body.dataset.wikiRoot || '';
  const embedded = new URLSearchParams(location.search).has('embed') || window.self !== window.top;
  function keepEmbed(link) {
    if (!embedded) return;
    const target = new URL(link.href, location.href);
    if (target.origin === location.origin && (target.pathname.endsWith('.html') || target.pathname.endsWith('/')) && link.target !== '_top') { target.searchParams.set('embed', ''); link.href = target.href; }
  }
  const normal = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const input = document.querySelector('#wiki-search');
  const results = document.querySelector('#search-results');
  const resultLinks = results.querySelector('.search-links');
  const status = results.querySelector('.search-status');
  let catalog;
  let pending;
  let serial = 0;
  function closeSearch() { results.hidden = true; input.setAttribute('aria-expanded', 'false'); }
  async function search() {
    const request = ++serial;
    const query = normal(input.value);
    if (!query) { closeSearch(); return; }
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    try {
      if (!catalog) {
        status.textContent = 'Searching the encyclopedia…';
        pending ||= fetch(`${root}search.json`, { cache: 'no-cache' }).then(response => {
          if (!response.ok) throw new Error('Search index unavailable');
          return response.json();
        });
        catalog = await pending;
      }
      if (request !== serial) return;
      const terms = query.split(/\s+/);
      const matches = catalog.map(entry => {
        const title = normal(entry.title);
        const aliases = (entry.aliases || []).map(normal);
        const haystack = `${title} ${aliases.join(' ')} ${normal(entry.terms)} ${normal(entry.kind)}`;
        if (!terms.every(term => haystack.includes(term))) return null;
        const score = (title === query || aliases.includes(query) ? 100 : title.startsWith(query) ? 50 : title.includes(query) ? 30 : 0) + (entry.kind === 'Skill' ? 5 : entry.kind === 'Category' ? 3 : 0);
        return { entry, score };
      }).filter(Boolean).sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
      status.textContent = matches.length ? `${matches.length.toLocaleString()} results${matches.length > 16 ? ' · showing the first 16; refine your search for more' : ''}` : 'No matches. Try an item, boss or category name.';
      resultLinks.replaceChildren();
      for (const { entry } of matches.slice(0, 16)) {
        const link = document.createElement('a');
        link.href = root + entry.url;
        keepEmbed(link);
        if (entry.color) link.style.setProperty('--item-color', entry.color);
        const art = document.createElement(entry.icon ? 'img' : 'span');
        if (entry.icon) { art.src = root + entry.icon; art.alt = ''; art.width = 36; art.height = 36; art.className = 'item-icon'; }
        else { art.className = `search-placeholder${entry.symbol ? ' search-skill-symbol' : ''}`; art.textContent = entry.symbol || (entry.kind === 'Category' ? '▦' : '◇'); art.setAttribute('aria-hidden', 'true'); }
        const copy = document.createElement('span');
        const title = document.createElement('span');
        title.className = 'search-title'; title.textContent = entry.title;
        const kind = document.createElement('small'); kind.textContent = entry.kind;
        copy.append(title, kind); link.append(art, copy); resultLinks.append(link);
      }
    } catch {
      if (request !== serial) return;
      pending = null;
      status.textContent = 'Search could not load. Browse the category directory or try again.';
      resultLinks.replaceChildren();
      const link = document.createElement('a'); link.href = `${root}categories/index.html`; link.textContent = 'Browse all categories'; resultLinks.append(link);
    }
  }
  let timer;
  input.addEventListener('input', () => { clearTimeout(timer); serial++; timer = setTimeout(search, 100); });
  input.addEventListener('focus', () => { if (input.value) search(); });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable]')) { event.preventDefault(); input.focus(); }
    if (event.key === 'Escape') { closeSearch(); if (results.contains(event.target)) input.focus(); }
    if (results.hidden || !(event.target === input || results.contains(event.target))) return;
    const links = [...resultLinks.querySelectorAll('a')];
    if (!links.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const index = links.indexOf(event.target);
      links[(index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus();
    }
    if (event.key === 'Enter' && event.target === input) { event.preventDefault(); links[0].click(); }
  });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.site-search')) closeSearch(); });
  document.querySelector('.menu-toggle').addEventListener('click', event => {
    const expanded = event.currentTarget.getAttribute('aria-expanded') !== 'true';
    event.currentTarget.setAttribute('aria-expanded', String(expanded));
    document.querySelector('#wiki-navigation').classList.toggle('open', expanded);
  });
  document.querySelectorAll('[data-table-section]').forEach(section => {
    const tbody = section.querySelector('tbody');
    const rows = [...tbody.rows];
    const filter = section.querySelector('[data-table-filter]');
    const counter = section.querySelector('[data-row-count]');
    const empty = section.querySelector('.empty-table');
    const searchable = new Map(rows.map(row => [row, normal(row.textContent)]));
    filter?.addEventListener('input', () => {
      const terms = normal(filter.value).split(/\s+/).filter(Boolean);
      let count = 0;
      for (const row of rows) { row.hidden = !terms.every(term => searchable.get(row).includes(term)); if (!row.hidden) count++; }
      counter.textContent = `${count.toLocaleString()} of ${rows.length.toLocaleString()} entries`;
      empty.hidden = count > 0;
    });
    section.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click', () => {
      const column = Number(button.dataset.sort);
      const heading = button.closest('th');
      const ascending = heading.getAttribute('aria-sort') !== 'ascending';
      section.querySelectorAll('thead th').forEach(th => th.setAttribute('aria-sort', 'none'));
      heading.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
      const value = row => row.cells[column].dataset.sortValue ?? row.cells[column].textContent.trim();
      const number = row => { const raw = value(row); return raw === '' ? null : Number(raw.replace(/[, +%]/g, '')); };
      const sorted = [...rows].sort((a, b) => {
        if (button.hasAttribute('data-numeric')) {
          const x = number(a), y = number(b);
          const missingX = x == null || !Number.isFinite(x), missingY = y == null || !Number.isFinite(y);
          if (missingX || missingY) return Number(missingX) - Number(missingY);
          return (x - y) * (ascending ? 1 : -1);
        }
        return value(a).localeCompare(value(b), undefined, { numeric: true }) * (ascending ? 1 : -1);
      });
      tbody.append(...sorted);
    }));
  });
  document.querySelector('[data-copy-link]').addEventListener('click', async () => {
    const status = document.querySelector('.copy-status');
    try { await navigator.clipboard.writeText(location.href); status.textContent = 'Link copied'; }
    catch { status.textContent = 'Copy the address from your browser.'; }
  });
  // Keep the game iframe presentation when following links between wiki pages.
  if (embedded) {
    document.body.classList.add('embedded');
    document.querySelectorAll('a[href]').forEach(keepEmbed);
  }
})();

/* Connect the handbook to the encyclopedia without changing its deep links. */
(() => {
  'use strict';
  const english = (document.documentElement.lang || 'en').startsWith('en');
  const banner = document.createElement('nav');
  banner.className = 'wiki-handbook-nav';
  banner.setAttribute('aria-label', 'Slimeville Wiki');
  banner.innerHTML = '<a class="wiki-home-link" href="wiki/index.html">Slimeville Wiki <span>↗</span></a><a href="wiki/categories/items.html">All items</a><a href="wiki/bosses/index.html">Bosses</a><a href="wiki/categories/mastery-capes.html">Mastery capes</a><a href="wiki/categories/frenzy-items.html">Frenzy items</a><a href="wiki/categories/index.html">Categories</a>';
  if (!english) {
    const note = document.createElement('span'); note.className = 'wiki-language-note'; note.textContent = 'Encyclopedia: English'; banner.append(note);
  }
  const tabs = document.getElementById('tabs');
  tabs?.before(banner);
  const embedded = new URLSearchParams(location.search).has('embed');
  const href = route => `wiki/${route}${embedded ? '?embed' : ''}`;
  if (embedded) banner.querySelectorAll('a').forEach(link => { link.href += '?embed'; });
  if (!english) return;
  fetch('wiki/links.json').then(response => {
    if (!response.ok) throw new Error('Wiki link index unavailable');
    return response.json();
  }).then(index => {
    const links = { ...index.items, ...index.bosses, 'Washing Machine': 'topics/washing-machine.html', 'mastery capes': 'categories/mastery-capes.html', 'frenzy items': 'categories/frenzy-items.html' };
    const labels = Object.keys(links).filter(label => label.length >= 4 && !label.includes('_')).sort((a, b) => b.length - a.length);
    const expression = new RegExp(`(?<![\\p{L}\\p{N}_])(${labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode(node) {
      if (!node.parentElement.closest('.tab-content') || node.parentElement.closest('a,button,input,textarea,script,style,h1,h2,h3,.sec-icon')) return NodeFilter.FILTER_REJECT;
      return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    } });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const content = node.textContent;
      const matches = [...content.matchAll(expression)];
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const match of matches) {
        fragment.append(content.slice(offset, match.index));
        const link = document.createElement('a'); link.className = 'wiki-inline-link'; link.href = href(links[match[0]]); link.textContent = match[0]; fragment.append(link);
        offset = match.index + match[0].length;
      }
      fragment.append(content.slice(offset)); node.replaceWith(fragment);
    }
    for (const [id, route, label] of [['sec-skill-capes', 'categories/mastery-capes.html', 'Compare all mastery capes →'], ['sec-washing', 'topics/washing-machine.html', 'Washing Machine article & frenzy item table →']]) {
      const section = document.getElementById(id);
      if (!section) continue;
      const link = document.createElement('a'); link.className = 'wiki-topic-link'; link.href = href(route); link.textContent = label; section.after(link);
    }
  }).catch(() => { /* The static handbook and wiki navigation remain usable. */ });
})();

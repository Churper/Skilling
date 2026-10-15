const rarities=[{"id":"common","label":"Common","color":"#b0b0b0"},{"id":"uncommon","label":"Uncommon","color":"#4ade80"},{"id":"rare","label":"Rare","color":"#60a5fa"},{"id":"epic","label":"Epic","color":"#c084fc"},{"id":"legendary","label":"Legendary","color":"#fbbf24"},{"id":"mythic","label":"Mythic","color":"#ed5bb5"}];
const format=new Intl.NumberFormat('en-US');
function choose(id){const index=rarities.findIndex(r=>r.id===id);if(index<0)return;const rarity=rarities[index];
for(const select of document.querySelectorAll('[data-equipment-rarity]')){select.value=id;select.style.color=rarity.color;select.style.borderColor=rarity.color;}
for(const cell of document.querySelectorAll('[data-equipment-rarity-values]')){const value=JSON.parse(cell.dataset.equipmentRarityValues)[index],stat=cell.dataset.equipmentRarityStat;cell.textContent=stat==='atk'||stat==='def'?'+'+format.format(value):stat==='sell'?format.format(value):value;const parent=cell.closest('td,th');if(parent&&typeof value==='number')parent.dataset.sortValue=String(value);}
for(const text of document.querySelectorAll('[data-equipment-rarity-current]')){text.textContent=rarity.label;text.style.color=rarity.color;}
for(const marker of document.querySelectorAll('[data-rarity-comparison-row]')){const row=marker.closest('tr'),selected=marker.dataset.rarityComparisonRow===id;row.classList.toggle('selected-rarity',selected);if(selected){row.setAttribute('aria-current','true');row.style.setProperty('--selected-rarity-color',rarity.color);}else row.removeAttribute('aria-current');}
}
document.addEventListener('change',event=>{if(!event.target.matches('[data-equipment-rarity]'))return;choose(event.target.value);const url=new URL(location.href);url.searchParams.set('rarity',event.target.value);history.replaceState(null,'',url);});
choose(new URL(location.href).searchParams.get('rarity')||'common');

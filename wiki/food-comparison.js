
for (const comparison of document.querySelectorAll('[data-food-comparison]')) {
  const hp = comparison.querySelector('[data-food-hp]');
  const sort = comparison.querySelector('[data-food-sort]');
  const table = comparison.querySelector('table');
  function applySort(value = sort.value) {
    if (!value) return;
    const [column, direction] = value.split(':');
    const button = table.querySelector('[data-sort="' + column + '"]');
    button.closest('th').setAttribute('aria-sort', direction === 'ascending' ? 'descending' : 'ascending');
    button.click();
  }
  function updateHealing() {
    const parsedHp = Number(hp.value);
    const maxHp = Number.isFinite(parsedHp) ? Math.max(1, Math.min(1e9, Math.floor(parsedHp || 100))) : 100;
    for (const cell of comparison.querySelectorAll('[data-food-heal]')) {
      const amount = Number(cell.dataset.base) + Math.floor(maxHp * Number(cell.dataset.percent));
      cell.textContent = amount > 0 ? amount.toLocaleString('en-US') + ' HP' : 'Not edible';
      cell.closest('td').dataset.sortValue = String(amount);
    }
    const active = table.querySelector('thead th[aria-sort="ascending"],thead th[aria-sort="descending"]');
    applySort(active ? active.querySelector('[data-sort]').dataset.sort + ':' + active.getAttribute('aria-sort') : sort.value);
  }
  table.querySelector('thead').addEventListener('click', event => {
    const button = event.target.closest('[data-sort]');
    if (!button) return;
    const value = button.dataset.sort + ':' + button.closest('th').getAttribute('aria-sort');
    sort.value = [...sort.options].some(option => option.value === value) ? value : '';
  });
  sort.addEventListener('change', () => applySort());
  hp.addEventListener('input', updateHealing);
  updateHealing();
}

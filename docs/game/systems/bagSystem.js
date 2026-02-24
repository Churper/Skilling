function createCountMap(keys) {
  const map = {};
  for (const key of keys) map[key] = 0;
  return map;
}

export function createBagSystem({ capacity, itemKeys }) {
  const slots = Array(capacity).fill(null);
  const counts = createCountMap(itemKeys);
  const bankStorage = createCountMap(itemKeys);

  function recount() {
    for (const key of itemKeys) counts[key] = 0;
    for (const slot of slots) {
      if (slot && Object.prototype.hasOwnProperty.call(counts, slot)) counts[slot] += 1;
    }
  }

  function usedCount() {
    let used = 0;
    for (const slot of slots) {
      if (slot) used += 1;
    }
    return used;
  }

  function isFull() {
    return usedCount() >= capacity;
  }

  function addItem(itemKey) {
    const slotIndex = slots.indexOf(null);
    if (slotIndex < 0) return false;
    slots[slotIndex] = itemKey;
    recount();
    return true;
  }

  function clearToBank() {
    let moved = 0;
    for (let i = 0; i < slots.length; i++) {
      const item = slots[i];
      if (!item || !Object.prototype.hasOwnProperty.call(bankStorage, item)) continue;
      bankStorage[item] += 1;
      slots[i] = null;
      moved += 1;
    }
    recount();
    return moved;
  }

  function sellAll(priceByItem) {
    let sold = 0;
    let coinsGained = 0;
    for (let i = 0; i < slots.length; i++) {
      const item = slots[i];
      if (!item) continue;
      sold += 1;
      coinsGained += priceByItem[item] ?? 0;
      slots[i] = null;
    }
    recount();
    return { sold, coinsGained };
  }

  function consumeMatching(predicate) {
    const removed = createCountMap(itemKeys);
    let total = 0;
    for (let i = 0; i < slots.length; i++) {
      const item = slots[i];
      if (!item || !predicate(item)) continue;
      removed[item] = (removed[item] || 0) + 1;
      slots[i] = null;
      total += 1;
    }
    recount();
    return { removed, total };
  }

  return {
    capacity,
    slots,
    counts,
    bankStorage,
    recount,
    usedCount,
    isFull,
    addItem,
    clearToBank,
    sellAll,
    consumeMatching,
  };
}

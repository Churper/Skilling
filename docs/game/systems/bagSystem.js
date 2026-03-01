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

  function depositItemToBank(itemKey, maxItems = 1) {
    if (!Object.prototype.hasOwnProperty.call(bankStorage, itemKey)) return 0;
    const cap = Math.max(0, Math.floor(maxItems));
    if (cap <= 0) return 0;
    let moved = 0;
    for (let i = 0; i < slots.length && moved < cap; i++) {
      if (slots[i] !== itemKey) continue;
      slots[i] = null;
      bankStorage[itemKey] += 1;
      moved += 1;
    }
    recount();
    return moved;
  }

  function withdrawFromBank(maxItems = capacity) {
    const cap = Math.max(0, Math.floor(maxItems));
    if (cap <= 0) return 0;
    let moved = 0;

    for (const itemKey of itemKeys) {
      while (bankStorage[itemKey] > 0 && moved < cap) {
        const slotIndex = slots.indexOf(null);
        if (slotIndex < 0) {
          recount();
          return moved;
        }
        slots[slotIndex] = itemKey;
        bankStorage[itemKey] -= 1;
        moved += 1;
      }
      if (moved >= cap) break;
    }

    recount();
    return moved;
  }

  function withdrawItemFromBank(itemKey, maxItems = 1) {
    if (!Object.prototype.hasOwnProperty.call(bankStorage, itemKey)) return 0;
    const cap = Math.max(0, Math.floor(maxItems));
    if (cap <= 0) return 0;
    let moved = 0;
    while (bankStorage[itemKey] > 0 && moved < cap) {
      const slotIndex = slots.indexOf(null);
      if (slotIndex < 0) break;
      slots[slotIndex] = itemKey;
      bankStorage[itemKey] -= 1;
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
      const baseId = item.includes("#") ? item.split("#")[0] : item;
      coinsGained += priceByItem[baseId] ?? priceByItem[item] ?? 0;
      slots[i] = null;
    }
    recount();
    return { sold, coinsGained };
  }

  function removeItems(itemKey, qty = 1) {
    let removed = 0;
    for (let i = 0; i < slots.length && removed < qty; i++) {
      if (slots[i] === itemKey) { slots[i] = null; removed++; }
    }
    recount();
    return removed;
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

  function serialize() {
    return { slots: [...slots], bank: { ...bankStorage } };
  }

  function deserialize(data) {
    if (data.slots) {
      for (let i = 0; i < capacity; i++) slots[i] = data.slots[i] || null;
    }
    if (data.bank) {
      for (const key of itemKeys) bankStorage[key] = data.bank[key] || 0;
    }
    recount();
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
    depositItemToBank,
    withdrawFromBank,
    withdrawItemFromBank,
    sellAll,
    removeItems,
    consumeMatching,
    serialize,
    deserialize,
  };
}

export function createConstructionProgress({ target }) {
  const stock = {
    logs: 0,
    ore: 0,
  };

  function getProgress01() {
    const logsRatio = Math.min(1, stock.logs / target.logs);
    const oreRatio = Math.min(1, stock.ore / target.ore);
    return (logsRatio + oreRatio) * 0.5;
  }

  function getMissing() {
    return {
      logs: Math.max(0, target.logs - stock.logs),
      ore: Math.max(0, target.ore - stock.ore),
    };
  }

  function deposit(materials = {}) {
    const prev = { ...stock };
    stock.logs = Math.min(target.logs, stock.logs + (materials.logs || 0));
    stock.ore = Math.min(target.ore, stock.ore + (materials.ore || 0));
    return {
      logsAdded: stock.logs - prev.logs,
      oreAdded: stock.ore - prev.ore,
    };
  }

  function isComplete() {
    return stock.logs >= target.logs && stock.ore >= target.ore;
  }

  function getStock() {
    return stock;
  }

  return {
    getProgress01,
    getMissing,
    deposit,
    isComplete,
    getStock,
  };
}

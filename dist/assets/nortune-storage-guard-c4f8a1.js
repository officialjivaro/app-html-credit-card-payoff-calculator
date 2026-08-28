(() => {
  const createMemoryStorage = () => {
    const entries = new Map();
    return {
      get length() { return entries.size; },
      clear() { entries.clear(); },
      getItem(key) { const normalized = String(key); return entries.has(normalized) ? entries.get(normalized) : null; },
      key(index) { return [...entries.keys()][Number(index)] ?? null; },
      removeItem(key) { entries.delete(String(key)); },
      setItem(key, value) { entries.set(String(key), String(value)); }
    };
  };
  const install = (name) => {
    const token = `__nortune_storage_probe_${Date.now()}_${Math.random()}`;
    try { const storage = window[name]; storage.setItem(token, token); storage.removeItem(token); return true; }
    catch { try { Object.defineProperty(window, name, { configurable: true, enumerable: true, value: createMemoryStorage() }); } catch {} return false; }
  };
  window.__NORTUNE_STORAGE_STATUS__ = Object.freeze({ localStorage: install('localStorage'), sessionStorage: install('sessionStorage') });
})();

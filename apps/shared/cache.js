(function () {
  const STORAGE_PREFIX = 'starkson_hr_';
  const DEFAULT_TTL_MS = 5 * 60 * 1000;

  function getStorage(storageType) {
    try {
      if (storageType === 'local') return window.localStorage;
      return window.sessionStorage;
    } catch (error) {
      return null;
    }
  }

  function getCacheKey(key) {
    return `${STORAGE_PREFIX}${String(key || '').trim()}`;
  }

  function safeParse(value) {
    try {
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function readCached(key, ttlMs = DEFAULT_TTL_MS, storageType = 'session') {
    const storage = getStorage(storageType);
    if (!storage) return null;

    const raw = storage.getItem(getCacheKey(key));
    if (!raw) return null;

    const payload = safeParse(raw);
    if (!payload || payload.value === undefined) {
      storage.removeItem(getCacheKey(key));
      return null;
    }

    const age = Date.now() - Number(payload.savedAt || 0);
    if (Number.isFinite(ttlMs) && ttlMs >= 0 && age > ttlMs) {
      storage.removeItem(getCacheKey(key));
      return null;
    }

    return payload.value;
  }

  function writeCache(key, value, storageType = 'session') {
    const storage = getStorage(storageType);
    if (!storage) return value;

    const payload = {
      savedAt: Date.now(),
      value
    };

    try {
      storage.setItem(getCacheKey(key), JSON.stringify(payload));
    } catch (error) {
      // Ignore storage issues in restricted/private browsing.
    }

    return value;
  }

  function clearCache(key, storageType = 'session') {
    const storage = getStorage(storageType);
    if (!storage) return;

    storage.removeItem(getCacheKey(key));
  }

  function getSyncState(key, storageType = 'session') {
    const storage = getStorage(storageType);
    if (!storage) return null;
    const raw = storage.getItem(`${getCacheKey(key)}_sync`);
    return safeParse(raw);
  }

  function setSyncState(key, state, storageType = 'session') {
    const storage = getStorage(storageType);
    if (!storage) return state;

    try {
      storage.setItem(`${getCacheKey(key)}_sync`, JSON.stringify({
        savedAt: Date.now(),
        state
      }));
    } catch (error) {
      // Ignore storage issues in restricted/private browsing.
    }

    return state;
  }

  window.HR_PORTAL_CACHE = {
    DEFAULT_TTL_MS,
    getCacheKey,
    readCached,
    writeCache,
    clearCache,
    getSyncState,
    setSyncState
  };
})();

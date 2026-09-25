(function () {
  function normalizeState(status, message) {
    return {
      status: status || 'idle',
      message: message || '',
      updatedAt: Date.now()
    };
  }

  function getStoreState(key, storageType = 'session') {
    if (!window.HR_PORTAL_CACHE || typeof window.HR_PORTAL_CACHE.getSyncState !== 'function') {
      return normalizeState('idle', '');
    }

    const existing = window.HR_PORTAL_CACHE.getSyncState(key, storageType);
    if (!existing || !existing.state) {
      return normalizeState('idle', '');
    }

    return {
      status: existing.state.status || 'idle',
      message: existing.state.message || '',
      updatedAt: existing.savedAt || Date.now()
    };
  }

  function setStoreState(key, status, message, storageType = 'session') {
    const state = normalizeState(status, message);
    if (window.HR_PORTAL_CACHE && typeof window.HR_PORTAL_CACHE.setSyncState === 'function') {
      window.HR_PORTAL_CACHE.setSyncState(key, state, storageType);
    }
    return state;
  }

  function queueMutation(key, mutation) {
    const storageKey = `${String(key || 'sync').trim()}_queue`;
    const storage = window.sessionStorage;
    if (!storage) return [];

    try {
      const current = JSON.parse(storage.getItem(storageKey) || '[]');
      const next = Array.isArray(current) ? current : [];
      next.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        mutation,
        createdAt: Date.now()
      });
      storage.setItem(storageKey, JSON.stringify(next));
      return next;
    } catch (error) {
      return [];
    }
  }

  function readQueue(key) {
    const storageKey = `${String(key || 'sync').trim()}_queue`;
    const storage = window.sessionStorage;
    if (!storage) return [];

    try {
      const value = JSON.parse(storage.getItem(storageKey) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function clearQueue(key) {
    const storageKey = `${String(key || 'sync').trim()}_queue`;
    const storage = window.sessionStorage;
    if (!storage) return [];
    storage.removeItem(storageKey);
    return [];
  }

  function markPending(key, message, mutation) {
    const state = setStoreState(key, 'pending', message || 'Syncing...');
    if (mutation) queueMutation(key, mutation);
    return state;
  }

  function markSynced(key, message) {
    return setStoreState(key, 'synced', message || 'Updated successfully.');
  }

  function markFailed(key, message) {
    return setStoreState(key, 'failed', message || 'Sync failed.');
  }

  function beginOptimisticUpdate(recordKey, recordId, payload, message) {
    const queue = queueMutation(recordKey, {
      type: 'optimistic-update',
      recordId,
      payload,
      createdAt: Date.now()
    });
    markPending(recordKey, message || 'Saving changes...', { type: 'optimistic-update', recordId, payload });
    return queue;
  }

  function resolveOptimisticUpdate(recordKey, message) {
    markSynced(recordKey, message || 'Changes saved.');
    return getStoreState(recordKey);
  }

  function rejectOptimisticUpdate(recordKey, message) {
    markFailed(recordKey, message || 'Changes could not be saved.');
  }

  function renderSyncStatus(recordKey, elementId = 'syncStatusBadge', storageType = 'session') {
    const target = typeof elementId === 'string' ? document.getElementById(elementId) : elementId;
    if (!target) return getStoreState(recordKey, storageType);

    const state = getStoreState(recordKey, storageType);
    const statusMap = {
      pending: { label: 'Syncing', color: '#a16207', bg: '#fff7d6' },
      synced: { label: 'Synced', color: '#0f7a5d', bg: '#dff7eb' },
      failed: { label: 'Sync failed', color: '#b42318', bg: '#fee4e2' },
      idle: { label: 'Ready', color: '#51606c', bg: '#eef2f6' }
    };
    const choice = statusMap[state.status] || statusMap.idle;

    target.classList.add('hr-sync-badge');
    target.dataset.status = state.status || 'idle';
    target.textContent = state.message || choice.label;
    target.style.color = choice.color;
    target.style.background = choice.bg;
    target.style.borderColor = choice.color;
    return state;
  }

  window.HR_PORTAL_SYNC = {
    normalizeState,
    getStoreState,
    setStoreState,
    queueMutation,
    readQueue,
    clearQueue,
    markPending,
    markSynced,
    markFailed,
    beginOptimisticUpdate,
    resolveOptimisticUpdate,
    rejectOptimisticUpdate,
    renderSyncStatus
  };
})();

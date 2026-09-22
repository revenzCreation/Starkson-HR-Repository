function getApiUrl() {
  const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet2;
  if (!apiUrl) throw new Error('The MRF connection is not configured.');
  return apiUrl;
}

export async function loadAllRecords() {
  const result = await window.HR_PORTAL_SHEETS.request(getApiUrl());
  return (result.records || []).map(record => ({
    ...record,
    headcount: Number(record.originalHeadcount ?? record.headcount ?? 0),
    assignedHeadcount: Number(record.assignedHeadcount ?? 0)
  }));
}

export async function saveRecord(rec) {
  const result = await window.HR_PORTAL_SHEETS.request(getApiUrl(), {
    method: 'POST',
    body: JSON.stringify({ action: 'save', record: { ...rec, id: rec.id || '' } })
  });
  return result.record;
}

export async function deleteRecord(id) {
  await window.HR_PORTAL_SHEETS.request(getApiUrl(), {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id })
  });
}

export function subscribeToSyncEvents(onChange) {
  const relayUrl = window.HR_PORTAL_SHEETS?.connections?.syncRelay;
  if (!relayUrl || typeof EventSource === 'undefined') return () => {};

  const source = new EventSource(`${relayUrl.replace(/\/$/, '')}/events`);
  let refreshTimer = 0;
  const refresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => onChange(), 150);
  };
  source.addEventListener('mrf.changed', refresh);

  return () => {
    window.clearTimeout(refreshTimer);
    source.close();
  };
}
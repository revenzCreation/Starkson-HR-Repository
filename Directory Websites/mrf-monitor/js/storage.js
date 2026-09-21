function getApiUrl() {
  const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet2;
  if (!apiUrl) throw new Error('The MRF connection is not configured.');
  return apiUrl;
}

export async function loadAllRecords() {
  const result = await window.HR_PORTAL_SHEETS.request(getApiUrl());
  return result.records || [];
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
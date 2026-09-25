function getApiUrl() {
  const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet2;
  if (!apiUrl) throw new Error('The MRF connection is not configured.');
  return apiUrl;
}

export async function loadAllRecords() {
  const result = await window.HR_PORTAL_SHEETS.request(getApiUrl());
  return normalizeRecords(result.records);
}

export async function loadApplicantRecords() {
  const result = await window.HR_PORTAL_SHEETS.request(`${getApiUrl()}?action=applicant-list`);
  return result.records || [];
}

export async function saveRecord(rec) {
  const result = await window.HR_PORTAL_SHEETS.request(getApiUrl(), {
    method: 'POST',
    body: JSON.stringify({ action: 'save', record: { ...rec, id: rec.id || '' } })
  });
  return normalizeRecord(result.record);
}

export async function deleteRecord(id) {
  await window.HR_PORTAL_SHEETS.request(getApiUrl(), {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id })
  });
}

function normalizeRecord(record) {
  if (!record) return record;
  return {
    ...record,
    headcount: Number(record.headcount || record.originalHeadcount || 0)
  };
}

function normalizeRecords(records) {
  const unique = new Map();
  (Array.isArray(records) ? records : []).forEach(record => {
    const normalized = normalizeRecord(record);
    const key = normalized.mrfNumber || normalized.id;
    if (key) unique.set(String(key), normalized);
  });
  return [...unique.values()];
}
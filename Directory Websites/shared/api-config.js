(function () {
  const CONNECTIONS = {
    companySheet1: 'https://script.google.com/macros/s/AKfycbzMtnoAr3Y8Y8JNsWcUw_Lyv1-lEU_9-QlVExhpqBhHUjseiUz97wyxD6fCnvsRSmrT/exec',
    companySheet2: 'https://script.google.com/macros/s/AKfycbxJhTnJg-G4Y2e_n_XSVD4C1yI2zMbhE7t__GtqHRqboU3dMjYHA6OH6Fkp80V2-Hjm7w/exec'
  };

  window.HR_PORTAL_SHEETS = window.HR_PORTAL_SHEETS || {};
  window.HR_PORTAL_SHEETS.connections = CONNECTIONS;
  window.HR_PORTAL_SHEETS.request = async function request(url, options = {}) {
    const requestUrl = !options.method || options.method.toUpperCase() === 'GET'
      ? `${url}${url.includes('?') ? '&' : '?'}_ts=${Date.now()}`
      : url;
    const response = await fetch(requestUrl, {
      ...options,
      cache: 'no-store',
      credentials: 'omit',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        Accept: 'application/json',
        ...(options.headers || {})
      }
    });

    const rawText = await response.text();
    let result = {};
    try {
      result = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
      throw new Error(`Invalid response from the HR data service (${response.status}).`);
    }

    if (!response.ok || !result || result.ok === false) {
      throw new Error(result?.error || `HR data service request failed (${response.status}).`);
    }

    return result;
  };
})();

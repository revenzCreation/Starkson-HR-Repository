(function () {
  const STORAGE_KEY = 'starkson_hr_session';

  function safeParse(value) {
    try {
      return value ? JSON.parse(value) : null;
    } catch (error) {
      return null;
    }
  }

  function getSheet1Url() {
    const apiUrl = window.HR_PORTAL_SHEETS?.connections?.companySheet1;
    if (!apiUrl) {
      throw new Error('The HR login service is not configured.');
    }
    return apiUrl;
  }

  function setSession(account) {
    const payload = {
      authenticated: true,
      user: account && account.username ? account.username : 'hr',
      name: account && account.fullName ? account.fullName : 'HR Staff',
      role: account && account.role ? account.role : 'hr',
      at: Date.now()
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Ignore storage issues in restricted/private browsing.
    }
    return payload;
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore storage issues in restricted/private browsing.
    }
  }

  function getSession() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return safeParse(raw);
  }

  function requireProtectedRoute() {
    const session = getSession();
    if (session && session.authenticated) {
      return true;
    }
    clearSession();
    return false;
  }

  async function login(username, password) {
    const trimmedUser = String(username || '').trim();
    const trimmedPass = String(password || '').trim();

    if (!trimmedUser || !trimmedPass) {
      return { ok: false, error: 'Username and password are required.' };
    }

    try {
      const apiUrl = getSheet1Url();
      const result = await window.HR_PORTAL_SHEETS.request(
        `${apiUrl}?action=hr-login&username=${encodeURIComponent(trimmedUser)}&password=${encodeURIComponent(trimmedPass)}`
      );

      if (!result || !result.ok || !result.account) {
        return { ok: false, error: result?.error || 'Invalid HR username or password.' };
      }

      const session = setSession(result.account);
      return { ok: true, session, account: result.account };
    } catch (error) {
      return {
        ok: false,
        error: error.message || 'Unable to verify HR credentials right now.'
      };
    }
  }

  async function recoverAccount(id, username, password) {
    const accountId = String(id || '').trim();
    const trimmedUser = String(username || '').trim();
    const trimmedPass = String(password || '').trim();

    if (!/^\d{5}$/.test(accountId)) {
      return { ok: false, error: 'Enter the exact five-digit account ID.' };
    }
    if (!trimmedUser || trimmedPass.length < 8) {
      return { ok: false, error: 'Choose a username and a password of at least 8 characters.' };
    }

    try {
      const result = await window.HR_PORTAL_SHEETS.request(getSheet1Url(), {
        method: 'POST',
        body: JSON.stringify({
          action: 'hr-account-recover',
          id: accountId,
          username: trimmedUser,
          password: trimmedPass
        })
      });
      return result && result.ok
        ? { ok: true, account: result.account }
        : { ok: false, error: result?.error || 'Unable to update the HR account.' };
    } catch (error) {
      return { ok: false, error: error.message || 'Unable to update the HR account right now.' };
    }
  }

  function logout() {
    clearSession();
    return true;
  }

  window.HR_PORTAL_AUTH = {
    STORAGE_KEY,
    setSession,
    clearSession,
    getSession,
    requireProtectedRoute,
    login,
    recoverAccount,
    logout
  };
})();

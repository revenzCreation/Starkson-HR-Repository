/* ==========================================================================
   Starkson 201 Files — Login Controller
   Validates HR Staff credentials before granting directory access.
   ========================================================================== */

(() => {
  'use strict';

  const form = document.getElementById('loginForm');
  const status = document.getElementById('loginStatus');
  const card = document.querySelector('.login-card');
  const userIn = document.getElementById('user');
  const passIn = document.getElementById('password');
  const nextTarget = new URLSearchParams(window.location.search).get('next') || 'tools.html';
  const submitButton = form ? form.querySelector('button[type="submit"]') : null;
  const recoveryToggle = document.getElementById('recoveryToggle');
  const recoveryForm = document.getElementById('recoveryForm');
  const recoveryStatus = document.getElementById('recoveryStatus');

  const MAX_ATTEMPTS = 5;
  const LOCKOUT_SECS = 30;
  let attempts = 0;
  let lockedUntil = 0;

  if (!form || !window.HR_PORTAL_AUTH) return;

  recoveryToggle?.addEventListener('click', () => {
    const isHidden = recoveryForm?.hidden;
    if (!recoveryForm) return;
    recoveryForm.hidden = !isHidden;
    recoveryToggle.setAttribute('aria-expanded', String(isHidden));
  });

  recoveryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!recoveryStatus) return;
    recoveryStatus.style.color = 'var(--muted)';
    recoveryStatus.textContent = 'Verifying account ID...';
    const result = await window.HR_PORTAL_AUTH.recoverAccount(
      document.getElementById('recoveryId')?.value,
      document.getElementById('recoveryUser')?.value,
      document.getElementById('recoveryPassword')?.value
    );
    recoveryStatus.style.color = result.ok ? 'var(--status-sage-bright, #34d399)' : 'var(--brand-red-bright, #ff8a77)';
    recoveryStatus.textContent = result.ok
      ? 'Account updated. You can now sign in with the new credentials.'
      : result.error;
    if (result.ok) {
      userIn.value = document.getElementById('recoveryUser').value.trim();
      document.getElementById('recoveryPassword').value = '';
      document.getElementById('recoveryForm').reset();
      userIn.focus();
    }
  });

  function setLoadingState(isLoading) {
    if (!submitButton) return;
    submitButton.disabled = isLoading;
    submitButton.setAttribute('aria-busy', String(isLoading));
    submitButton.classList.toggle('is-loading', isLoading);

    if (isLoading) {
      submitButton.dataset.defaultLabel = submitButton.textContent;
      submitButton.innerHTML = '<span>Signing in...</span><span aria-hidden="true">…</span>';
      return;
    }

    const fallbackLabel = submitButton.dataset.defaultLabel || 'Sign in to HR Portal';
    submitButton.innerHTML = `<span>${fallbackLabel}</span><span aria-hidden="true">→</span>`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const now = Date.now();
    if (now < lockedUntil) {
      const remaining = Math.ceil((lockedUntil - now) / 1000);
      showError(`Too many attempts. Try again in ${remaining}s.`);
      return;
    }

    setLoadingState(true);

    const user = (userIn?.value ?? '').trim();
    const pass = (passIn?.value ?? '');
    const result = await window.HR_PORTAL_AUTH.login(user, pass);

    if (result.ok) {
      if (status) {
        status.style.color = 'var(--status-sage-bright, #34d399)';
        status.textContent = 'Authenticated — opening the directory…';
      }

      setTimeout(() => {
        window.location.replace(`../../${nextTarget}`);
      }, 420);
      return;
    }

    setLoadingState(false);
    attempts += 1;
    shakeCard();

    if (attempts >= MAX_ATTEMPTS) {
      lockedUntil = Date.now() + LOCKOUT_SECS * 1000;
      showError(`Access denied. Too many failed attempts — locked for ${LOCKOUT_SECS}s.`);
      disableForm(true);
      setTimeout(() => {
        disableForm(false);
        attempts = 0;
      }, LOCKOUT_SECS * 1000);
    } else {
      const left = MAX_ATTEMPTS - attempts;
      showError(result.error || `Invalid username or password. ${left} attempt${left === 1 ? '' : 's'} remaining.`);
    }

    userIn?.focus();
  });

  function showError(msg) {
    if (!status) return;
    status.style.color = 'var(--brand-red-bright, #ff8a77)';
    status.textContent = msg;
  }

  function shakeCard() {
    if (!card) return;
    card.classList.remove('login-shake');
    void card.offsetWidth;
    card.classList.add('login-shake');
  }

  function disableForm(locked) {
    const btn = form.querySelector('button[type="submit"]');
    if (userIn) userIn.disabled = locked;
    if (passIn) passIn.disabled = locked;
    if (btn) btn.disabled = locked;
    if (!locked && btn) {
      btn.classList.remove('is-loading');
      btn.innerHTML = '<span>Sign in to HR Portal</span><span aria-hidden="true">→</span>';
    }
  }
})();

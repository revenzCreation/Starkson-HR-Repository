/* ==========================================================================
   Starkson 201 Files — Login Controller
   Validates HR Staff credentials before granting directory access.
   ========================================================================== */

(() => {
  'use strict';

  const form     = document.getElementById('loginForm');
  const status   = document.getElementById('loginStatus');
  const card     = document.querySelector('.login-card');
  const userIn   = document.getElementById('user');
  const passIn   = document.getElementById('password');

  /* ---- Credentials (client-side gate) ---------------------------------- */
  const VALID_USER = 'hradmin';
  const VALID_PASS = 'starkson2026';

  /* ---- Rate-limit state ------------------------------------------------ */
  const MAX_ATTEMPTS  = 5;
  const LOCKOUT_SECS  = 30;
  let   attempts      = 0;
  let   lockedUntil   = 0;

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    /* -- Check lockout --------------------------------------------------- */
    const now = Date.now();
    if (now < lockedUntil) {
      const remaining = Math.ceil((lockedUntil - now) / 1000);
      showError(`Too many attempts. Try again in ${remaining}s.`);
      return;
    }

    const user = (userIn?.value ?? '').trim();
    const pass = (passIn?.value ?? '');

    /* -- Validate -------------------------------------------------------- */
    if (user === VALID_USER && pass === VALID_PASS) {
      /* Authorized — store session flag and proceed */
      try { sessionStorage.setItem('201auth', '1'); } catch (_) { /* private mode */ }

      if (status) {
        status.style.color = 'var(--status-sage-bright, #34d399)';
        status.textContent = 'Authenticated — opening the directory\u2026';
      }

      /* Brief pause so the user sees the success message */
      setTimeout(() => { window.location.replace('index.html'); }, 420);
    } else {
      /* Unauthorized */
      attempts++;
      shakeCard();

      if (attempts >= MAX_ATTEMPTS) {
        lockedUntil = Date.now() + LOCKOUT_SECS * 1000;
        showError(`Access denied. Too many failed attempts \u2014 locked for ${LOCKOUT_SECS}s.`);
        disableForm(true);
        setTimeout(() => { disableForm(false); attempts = 0; }, LOCKOUT_SECS * 1000);
      } else {
        const left = MAX_ATTEMPTS - attempts;
        showError(`Invalid username or password. ${left} attempt${left === 1 ? '' : 's'} remaining.`);
      }

      userIn?.focus();
    }
  });

  /* ---- Helpers --------------------------------------------------------- */

  function showError(msg) {
    if (!status) return;
    status.style.color = 'var(--brand-red-bright, #ff8a77)';
    status.textContent = msg;
  }

  function shakeCard() {
    if (!card) return;
    card.classList.remove('login-shake');
    /* Force reflow so re-adding the class restarts the animation */
    void card.offsetWidth;
    card.classList.add('login-shake');
  }

  function disableForm(locked) {
    const btn = form.querySelector('button[type="submit"]');
    if (userIn)  userIn.disabled  = locked;
    if (passIn)  passIn.disabled  = locked;
    if (btn)     btn.disabled     = locked;
  }
})();

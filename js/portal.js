/* ==========================================================================
   Starkson HR Portal — root surface interactions
   Progressive enhancement only: the pages work fully without this script.
   ========================================================================== */

(() => {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const NAV_BREAKPOINT = 800;

  /* ------------------------------------------------------------------ *
   * Pointer spotlight — rAF throttled so we write one style per frame   *
   * instead of one per pointermove event.                               *
   * ------------------------------------------------------------------ */
  const SPOTLIGHT_ENABLED_CLASS = "has-spotlight";
  let spotlightFrame = 0;
  let pointerX = 0;
  let pointerY = 0;

  function paintSpotlight() {
    spotlightFrame = 0;
    root.style.setProperty("--pointer-x", `${pointerX}px`);
    root.style.setProperty("--pointer-y", `${pointerY}px`);
  }

  function handlePointerMove(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!spotlightFrame) spotlightFrame = requestAnimationFrame(paintSpotlight);
  }

  function stopSpotlight() {
    window.removeEventListener("pointermove", handlePointerMove);
    if (spotlightFrame) {
      cancelAnimationFrame(spotlightFrame);
      spotlightFrame = 0;
    }
    root.classList.remove(SPOTLIGHT_ENABLED_CLASS);
    root.style.removeProperty("--pointer-x");
    root.style.removeProperty("--pointer-y");
  }

  function syncSpotlight() {
    const shouldRun = finePointer.matches && !reduceMotion.matches;
    if (!shouldRun) {
      stopSpotlight();
      return;
    }
    root.classList.add(SPOTLIGHT_ENABLED_CLASS);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
  }

  syncSpotlight();
  reduceMotion.addEventListener("change", syncSpotlight);
  finePointer.addEventListener("change", syncSpotlight);

  /* ------------------------------------------------------------------ *
   * Card tilt — pointer-tracked, skipped entirely for reduced motion.   *
   * ------------------------------------------------------------------ */
  const TILT_STRENGTH = 1.6;
  const tiltCards = Array.from(document.querySelectorAll(".tool-card"));

  function resetTilt(card) {
    card.style.removeProperty("--tilt-x");
    card.style.removeProperty("--tilt-y");
    card.style.removeProperty("--glare-x");
    card.style.removeProperty("--glare-y");
  }

  function attachTilt(card) {
    let frame = 0;
    let nextX = 0;
    let nextY = 0;

    const paint = () => {
      frame = 0;
      card.style.setProperty("--tilt-x", `${(nextY * -TILT_STRENGTH).toFixed(2)}deg`);
      card.style.setProperty("--tilt-y", `${(nextX * TILT_STRENGTH).toFixed(2)}deg`);
      card.style.setProperty("--glare-x", `${((nextX + 1) / 2) * 100}%`);
      card.style.setProperty("--glare-y", `${((nextY + 1) / 2) * 100}%`);
    };

    const onMove = (event) => {
      const bounds = card.getBoundingClientRect();
      nextX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      nextY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    const onLeave = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      resetTilt(card);
    };

    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", onLeave);
    card.addEventListener("blur", onLeave, true);
  }

  function syncTilt() {
    tiltCards.forEach((card) => {
      if (reduceMotion.matches) {
        resetTilt(card);
      } else {
        attachTilt(card);
      }
    });
  }

  if (tiltCards.length && finePointer.matches) syncTilt();
  reduceMotion.addEventListener("change", syncTilt);

  /* ------------------------------------------------------------------ *
   * Mobile navigation drawer                                           *
   * ------------------------------------------------------------------ */
  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.getElementById("primary-nav");
  const navLinks = nav ? Array.from(nav.querySelectorAll("a")) : [];

  if (navToggle && nav) {
    const isOpen = () => navToggle.getAttribute("aria-expanded") === "true";

    function openNav() {
      navToggle.setAttribute("aria-expanded", "true");
      root.classList.add("nav-open");
    }

    function closeNav({ restoreFocus = false } = {}) {
      if (!isOpen()) return;
      navToggle.setAttribute("aria-expanded", "false");
      root.classList.remove("nav-open");
      if (restoreFocus) navToggle.focus();
    }

    navToggle.addEventListener("click", () => {
      if (isOpen()) closeNav({ restoreFocus: true });
      else openNav();
    });

    navLinks.forEach((link) => link.addEventListener("click", () => closeNav()));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) closeNav({ restoreFocus: true });
    });

    document.addEventListener("pointerdown", (event) => {
      if (!isOpen()) return;
      if (nav.contains(event.target) || navToggle.contains(event.target)) return;
      closeNav();
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > NAV_BREAKPOINT) closeNav();
    });
  }

  /* ------------------------------------------------------------------ *
   * HR Login Button                                                      *
   * ------------------------------------------------------------------ */
  const hrLoginButton = document.querySelector("[data-hr-login-toggle]");
  if (hrLoginButton) {
    hrLoginButton.addEventListener("click", () => {
      window.location.href = "Directory Websites/201-files/index.html";
    });
  }

  /* ------------------------------------------------------------------ *
   * Live Philippine Standard Time (PST/PHT, UTC+8) Clock & Office Status*
   * ------------------------------------------------------------------ */
  const clockEls = document.querySelectorAll("[data-pht-clock]");
  const officeStatusEls = document.querySelectorAll("[data-office-status]");

  function updatePHTClock() {
    // Format in Asia/Manila timezone
    const now = new Date();
    try {
      const timeStr = now.toLocaleTimeString("en-US", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
      clockEls.forEach((el) => {
        el.textContent = `${timeStr} PHT`;
      });

      // Calculate office hours (Mon-Fri 8:00 to 17:00 Manila time)
      if (officeStatusEls.length) {
        const manilaParts = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Manila",
          weekday: "short",
          hour: "numeric",
          hour12: false
        }).formatToParts(now);

        const weekday = manilaParts.find(p => p.type === "weekday")?.value || "";
        const hour = parseInt(manilaParts.find(p => p.type === "hour")?.value || "0", 10);
        const isWorkDay = !["Sat", "Sun"].includes(weekday);
        const isOpen = isWorkDay && hour >= 8 && hour < 17;

        officeStatusEls.forEach((el) => {
          if (isOpen) {
            el.innerHTML = `<span class="hr-pulse-dot hr-pulse-dot--live"></span> HR Office Open (until 5:00 PM)`;
            el.classList.add("is-open");
            el.classList.remove("is-closed");
          } else {
            el.innerHTML = `<span class="hr-pulse-dot" style="background:var(--status-amber);"></span> HR Office Closed (Resumes 8:00 AM)`;
            el.classList.add("is-closed");
            el.classList.remove("is-open");
          }
        });
      }
    } catch (e) {
      // Fallback
    }
  }

  if (clockEls.length || officeStatusEls.length) {
    updatePHTClock();
    setInterval(updatePHTClock, 1000);
  }

  /* ------------------------------------------------------------------ *
   * Animated Number Rollup for Statistics                              *
   * ------------------------------------------------------------------ */
  const counterEls = document.querySelectorAll("[data-counter-target]");
  if (counterEls.length && "IntersectionObserver" in window) {
    const counterObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const targetEl = entry.target;
          const targetNum = parseFloat(targetEl.getAttribute("data-counter-target") || "0");
          const duration = 1200; // ms
          const startTime = performance.now();

          function tick(currentTime) {
            const progress = Math.min((currentTime - startTime) / duration, 1);
            // Ease out cubic
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentVal = Math.round(easeProgress * targetNum);
            targetEl.textContent = currentVal.toLocaleString();
            if (progress < 1) {
              requestAnimationFrame(tick);
            } else {
              targetEl.textContent = targetNum.toLocaleString();
            }
          }

          requestAnimationFrame(tick);
          observer.unobserve(targetEl);
        });
      },
      { threshold: 0.2 }
    );

    counterEls.forEach((el) => counterObserver.observe(el));
  }

  /* ------------------------------------------------------------------ *
   * FAQ Accordion Controller                                           *
   * ------------------------------------------------------------------ */
  const accordionTriggers = document.querySelectorAll("[data-accordion-trigger]");
  accordionTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const item = trigger.closest(".hr-accordion__item");
      if (!item) return;
      const isOpen = item.getAttribute("data-open") === "true";
      // Close sibling items if desired
      const parent = item.closest(".hr-accordion");
      if (parent) {
        parent.querySelectorAll(".hr-accordion__item").forEach((sib) => {
          if (sib !== item) sib.setAttribute("data-open", "false");
        });
      }
      item.setAttribute("data-open", isOpen ? "false" : "true");
    });
  });

  /* ------------------------------------------------------------------ *
   * Tool Search & Category Filter (for tools.html)                     *
   * ------------------------------------------------------------------ */
  const toolCards = document.querySelectorAll("[data-tool-item]");
  const searchInput = document.querySelector("[data-tool-search]");
  const filterBtns = document.querySelectorAll("[data-filter-category]");

  if (toolCards.length && (searchInput || filterBtns.length)) {
    let currentCat = "all";
    let searchQuery = "";

    function filterTools() {
      toolCards.forEach((card) => {
        const cat = (card.getAttribute("data-category") || "").toLowerCase();
        const text = (card.textContent || "").toLowerCase();

        const catMatches = currentCat === "all" || cat.includes(currentCat);
        const searchMatches = !searchQuery || text.includes(searchQuery);

        if (catMatches && searchMatches) {
          card.style.display = "";
          card.style.opacity = "1";
          card.style.transform = "";
        } else {
          card.style.display = "none";
        }
      });
    }

    filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentCat = (btn.getAttribute("data-filter-category") || "all").toLowerCase();
        filterTools();
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        filterTools();
      });
    }
  }
})();

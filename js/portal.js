(() => {
  const root = document.documentElement;
  const supportsFinePointer = window.matchMedia('(pointer: fine)').matches;

  if (supportsFinePointer) {
    window.addEventListener('pointermove', (event) => {
      root.style.setProperty('--pointer-x', `${event.clientX}px`);
      root.style.setProperty('--pointer-y', `${event.clientY}px`);
    }, { passive: true });
  }

  document.querySelectorAll('.tool-card').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      if (!supportsFinePointer) return;
      const bounds = card.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      card.style.setProperty('--tilt-x', `${(y * -1.5).toFixed(2)}deg`);
      card.style.setProperty('--tilt-y', `${(x * 1.5).toFixed(2)}deg`);
    });

    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--tilt-x');
      card.style.removeProperty('--tilt-y');
    });
  });
})();
// Layout bridge only. The phonetic engine remains isolated from the system.
(() => {
  if (window.parent === window) return;
  const content = document.querySelector('.wrap');
  if (!content) return;
  let lastHeight = 0;
  let pending = false;
  const report = () => {
    pending = false;
    if (!content.getClientRects().length) return;
    // Measure content, not the iframe viewport: this also allows shrinking.
    const height = Math.ceil(content.getBoundingClientRect().height) + 4;
    if (height < 100 || height === lastHeight) return;
    lastHeight = height;
    window.parent.postMessage({ type: 'jd-phonetics-height', height }, '*');
  };
  const schedule = () => {
    if (!pending) { pending = true; requestAnimationFrame(report); }
  };
  new ResizeObserver(schedule).observe(content);
  window.addEventListener('load', schedule);
  window.addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
  schedule();
})();

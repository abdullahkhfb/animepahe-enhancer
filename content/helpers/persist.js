/**
 * Keeps an element we injected into the site's page alive.
 *
 * `ensure` must be cheap and idempotent: it re-adds the element only when it is missing.
 * It runs once straight away, then again (at most once per frame) whenever the page's DOM
 * changes, so the site re-rendering its menu, or building it late, never drops our items.
 */
export function keepMounted(ensure) {
  let queued = false;
  const run = () => {
    queued = false;
    try {
      ensure();
    } catch (err) {
      console.error("[animepahe-enhancer] keepMounted:", err);
    }
  };
  run();
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(run);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}

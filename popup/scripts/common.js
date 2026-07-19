// ── Shared popup utilities ───────────────────────────────────────────────
// Anything used by more than one tab module lives here so each tab file
// only has to hold logic that's actually specific to it (DRY).

/**
 * Wires up the top-level tab bar. Each button's `data-tab` must match a
 * key in `panels`.
 * @param {Object<string, HTMLElement>} panels
 */
export function setupTabs(panels) {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabButtons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("active", active);
        b.setAttribute("aria-selected", String(active));
      });
      for (const [key, panel] of Object.entries(panels)) {
        panel.hidden = key !== target;
      }
    });
  });
}

/**
 * Generic expand/collapse behavior shared by feature cards and advanced
 * setting groups: clicking `header` toggles `expandedClass` on `container`
 * and shows/hides `body`.
 *
 * @param {{container: HTMLElement, header: HTMLElement, body: HTMLElement, expandedClass: string, startExpanded?: boolean}} opts
 */
export function makeCollapsible({
  container,
  header,
  body,
  expandedClass,
  startExpanded = false,
}) {
  const apply = (open) => {
    container.classList.toggle(expandedClass, open);
    // Generic hook so shared CSS (chevron rotation, etc.) doesn't need to
    // know each tab's specific class name.
    container.classList.toggle("collapsible-open", open);
    body.hidden = !open;
    header.setAttribute("aria-expanded", String(open));
  };

  apply(startExpanded);

  header.addEventListener("click", () => {
    apply(!container.classList.contains(expandedClass));
  });
}

/**
 * Runs `actionFn`, showing a brief "busy" then "done" label on `btn`
 * before restoring its original text. Used for every destructive/async
 * button across tabs (clear cache, clear list, etc.).
 *
 * @param {HTMLElement} btn
 * @param {() => Promise<void>} actionFn
 * @param {{busyText?: string, doneText?: string, resetDelayMs?: number}} [opts]
 */
export async function animateButton(
  btn,
  actionFn,
  { busyText = "Clearing...", doneText = "Cleared!", resetDelayMs = 1500 } = {},
) {
  const originalText = btn.textContent;
  btn.textContent = busyText;
  btn.style.pointerEvents = "none";

  await actionFn();

  setTimeout(() => {
    btn.textContent = doneText;
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.pointerEvents = "auto";
    }, resetDelayMs);
  }, 400);
}

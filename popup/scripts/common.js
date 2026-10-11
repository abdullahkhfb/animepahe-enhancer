// ── Shared popup utilities ───────────────────────────────────────────────
// Anything used by more than one tab module lives here so each tab file
// only has to hold logic that's actually specific to it (DRY).

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

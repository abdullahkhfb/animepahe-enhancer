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

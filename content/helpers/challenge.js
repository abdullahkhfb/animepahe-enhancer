/** Cloudflare interstitials are served on the page's own URL, so detect them by content. */

const TITLE_RE =
  /^\s*(just a moment|attention required|checking your browser|one moment|verify(ing)? you are human|ddos protection)/i;

const SELECTORS = [
  "#challenge-form",
  "#challenge-running",
  "#challenge-stage",
  "#cf-challenge-running",
  ".cf-browser-verification",
  "#cf-error-details",
].join(",");

export function isChallengePage() {
  if (TITLE_RE.test(document.title || "")) return true;
  try {
    return !!document.querySelector(SELECTORS);
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function whenSiteReady({ challengeTimeoutMs = 5 * 60_000, settleMs = 800 } = {}) {
  const t0 = Date.now();
  while (isChallengePage()) {
    if (Date.now() - t0 > challengeTimeoutMs) return false;
    await sleep(500);
  }
  if (document.readyState !== "complete") {
    await new Promise((r) => window.addEventListener("load", r, { once: true }));
  }
  if (settleMs > 0) await sleep(settleMs);
  // The challenge can also appear a moment after load.
  return !isChallengePage();
}

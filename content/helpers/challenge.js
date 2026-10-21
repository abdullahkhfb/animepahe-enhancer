/** Cloudflare interstitials ("Just a moment...", "Attention Required!") are
 *  served on the same URL as the real page, so the content script loads on
 *  them too. Features must stay completely idle there: their requests would
 *  only get the challenge HTML back, and retrying them hammers the site while
 *  the page is trying to verify you. */

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

/** Resolves true once the real animepahe page is showing and has finished
 *  loading (plus a short settle so the site's own requests go first), or
 *  false if a challenge never cleared. Usually the challenge ends with a
 *  full reload, in which case this simply never resolves on the old page and
 *  the content script starts fresh on the new one. */
export async function whenSiteReady({ challengeTimeoutMs = 5 * 60_000 } = {}) {
  const t0 = Date.now();
  while (isChallengePage()) {
    if (Date.now() - t0 > challengeTimeoutMs) return false;
    await sleep(500);
  }
  if (document.readyState !== "complete") {
    await new Promise((r) => window.addEventListener("load", r, { once: true }));
  }
  await sleep(800);
  // The challenge can also appear a moment after load.
  return !isChallengePage();
}

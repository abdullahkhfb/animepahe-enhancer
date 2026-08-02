/** Shared bottom-right status toast used by DUB Detector, Intro/Outro
 *  Skip, and Binge Watch — one pill instead of each feature stacking
 *  its own copy on top of the others. */

import { injectStylesheet } from "./styles.js";

const PILL_ID = "ape-pill";
let hideTimer = null;

function getOrCreatePill() {
  injectStylesheet("ape-main-styles", "content/main.css");
  let pill = document.getElementById(PILL_ID);
  if (!pill) {
    pill = document.createElement("div");
    pill.id = PILL_ID;
    pill.className = "ape-pill";
    document.body.appendChild(pill);
  }
  return pill;
}

/**
 * @param {string} text
 * @param {number} [autohideMs] 0 = stays visible until the next call.
 * @param {boolean} [live] true while updating in place (e.g. a percentage)
 *   many times a second — skips resetting the auto-hide timer.
 */
export function showPill(text, autohideMs = 0, live = false) {
  const pill = getOrCreatePill();
  if (!live) clearTimeout(hideTimer);
  pill.textContent = text;
  pill.style.opacity = "1";
  if (autohideMs > 0) {
    hideTimer = setTimeout(() => {
      pill.style.opacity = "0";
    }, autohideMs);
  }
  return pill;
}

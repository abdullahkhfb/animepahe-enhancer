/** Shared bottom-right status toast used by DUB Detector, Intro/Outro
 *  Skip, and Binge Watch — one pill instead of each feature stacking
 *  its own copy on top of the others.
 *
 *  showPill()   — plain-text toast (used by every feature).
 *  showStatus() — structured toast with a state icon: a progress ring,
 *                 a pink check, or an amber dot (used by DUB Detector). */

import { injectStylesheet } from "./styles.js";
import { checkIcon } from "./icons.js";

const PILL_ID = "ape-pill";
let hideTimer = null;
let parts = null; // live references for in-place updates of a rich toast

function getOrCreatePill() {
  injectStylesheet("ape-main-styles", "content/main.css");
  let pill = document.getElementById(PILL_ID);
  if (!pill) {
    pill = document.createElement("div");
    pill.id = PILL_ID;
    pill.className = "ape-pill";
    pill.setAttribute("role", "status");
    pill.setAttribute("aria-live", "polite");
    document.body.appendChild(pill);
  }
  return pill;
}

function scheduleHide(pill, autohideMs) {
  if (autohideMs > 0) {
    hideTimer = setTimeout(() => {
      pill.style.opacity = "0";
    }, autohideMs);
  }
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
  pill.classList.remove("ape-pill--rich");
  delete pill.dataset.state;
  parts = null;
  pill.textContent = text;
  pill.style.opacity = "1";
  scheduleHide(pill, autohideMs);
  return pill;
}

/**
 * @param {object} o
 * @param {"progress"|"success"|"empty"} [o.state]
 * @param {string} o.text
 * @param {number|null} [o.percent] 0-100; null/undefined = indeterminate ring
 * @param {number} [o.autohideMs]
 * @param {boolean} [o.live] update in place without resetting the hide timer
 */
export function showStatus({ state = "progress", text, percent = null, autohideMs = 0, live = false }) {
  const pill = getOrCreatePill();
  if (!live) clearTimeout(hideTimer);

  const reusable =
    live && parts && parts.state === state && pill.contains(parts.label);

  if (!reusable) {
    pill.textContent = "";
    pill.classList.add("ape-pill--rich");
    pill.dataset.state = state;

    const icon = document.createElement("span");
    if (state === "success") {
      icon.className = "ape-pill-ok";
      icon.appendChild(checkIcon(10));
    } else if (state === "empty") {
      icon.className = "ape-pill-dot";
    } else {
      icon.className = "ape-pill-ring";
    }
    const label = document.createElement("span");
    label.className = "ape-pill-label";
    const pct = document.createElement("em");
    pct.className = "ape-pill-pct";
    pill.append(icon, label, pct);
    parts = { state, icon, label, pct };
  }

  parts.label.textContent = text;
  const hasPct = state === "progress" && typeof percent === "number";
  parts.pct.textContent = hasPct ? `${percent}%` : "";
  parts.pct.hidden = !hasPct;
  if (state === "progress") {
    parts.icon.classList.toggle("is-indeterminate", !hasPct);
    if (hasPct) parts.icon.style.setProperty("--ape-p", String(percent));
  }

  pill.style.opacity = "1";
  scheduleHide(pill, autohideMs);
  return pill;
}

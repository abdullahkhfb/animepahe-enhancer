import { injectStylesheet } from "./styles.js";
import {
  bingeIcon,
  checkIcon,
  closeIcon,
  countdownRing,
  skipIcon,
  waitIcon,
} from "./icons.js";

const GLYPHS = {
  skip: skipIcon,
  binge: bingeIcon,
  wait: waitIcon,
  check: (size) => checkIcon(size),
  close: (size) => closeIcon(size),
};

const PILL_ID = "ape-pill";
let hideTimer = null;
let parts = null;

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

function resetPill(pill) {
  pill.className = "ape-pill";
  pill.style.pointerEvents = "";
  delete pill.dataset.state;
  parts = null;
}

function scheduleHide(pill, autohideMs) {
  if (autohideMs > 0) {
    hideTimer = setTimeout(() => {
      pill.style.opacity = "0";
    }, autohideMs);
  }
}

export function showPill(text, autohideMs = 0, live = false) {
  const pill = getOrCreatePill();
  if (!live) clearTimeout(hideTimer);
  resetPill(pill);
  pill.textContent = text;
  pill.style.opacity = "1";
  scheduleHide(pill, autohideMs);
  return pill;
}

export function showStatus({ state = "progress", text, percent = null, autohideMs = 0, live = false }) {
  const pill = getOrCreatePill();
  if (!live) clearTimeout(hideTimer);

  const reusable =
    live && parts && parts.state === state && pill.contains(parts.label);

  if (!reusable) {
    resetPill(pill);
    pill.textContent = "";
    pill.classList.add("ape-pill-rich");
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

/**
 * Action pill: leading icon chip, label, optional muted detail and action.
 * @param {object} o
 * @param {"skip"|"binge"|"wait"|"check"|"close"|"spinner"|"dot"} [o.icon]
 * @param {string} o.text
 * @param {string} [o.detail]
 * @param {{secondsLeft: number, total: number}} [o.countdown] replaces the icon with a ring
 * @param {{label: string, onClick: () => void}} [o.action]
 */
export function showAction({
  icon,
  text,
  detail = "",
  countdown = null,
  action = null,
  autohideMs = 0,
  live = false,
}) {
  const pill = getOrCreatePill();
  if (!live) clearTimeout(hideTimer);
  resetPill(pill);
  pill.textContent = "";
  pill.classList.add("ape-pill-action");

  let lead;
  if (countdown) {
    lead = document.createElement("span");
    lead.className = "ape-pill-count";
    const num = document.createElement("b");
    num.textContent = String(countdown.secondsLeft);
    lead.append(countdownRing(countdown.secondsLeft, countdown.total), num);
  } else if (icon === "spinner") {
    lead = document.createElement("span");
    lead.className = "ape-pill-spin";
    lead.appendChild(document.createElement("i"));
  } else if (icon === "dot") {
    lead = document.createElement("span");
    lead.className = "ape-pill-dot";
  } else {
    lead = document.createElement("span");
    lead.className = "ape-pill-chip";
    lead.appendChild(GLYPHS[icon](12));
  }

  const label = document.createElement("span");
  label.textContent = text;
  pill.append(lead, label);

  if (detail) {
    const d = document.createElement("span");
    d.className = "ape-pill-detail";
    d.textContent = detail;
    pill.appendChild(d);
  }

  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ape-pill-act";
    btn.textContent = action.label;
    btn.addEventListener("click", action.onClick);
    pill.appendChild(btn);
    pill.style.pointerEvents = "auto";
  }

  pill.style.opacity = "1";
  scheduleHide(pill, autohideMs);
  return pill;
}

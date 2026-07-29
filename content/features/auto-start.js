import { PAGE, getPageType } from "../helpers/router.js";

const PILL_ID = "ape-as-pill";

export class AutoStart {
  constructor(_storage, _settings = {}) {
    this._attempts = 0;
    this._maxAttempts = 24;
    this._timer = null;
    this._currentUrl = "";
  }

  async init(_initialPageType) {
    this._injectStyles();
    this._handleRoute();

    let currentUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        this._handleRoute();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  _handleRoute() {
    clearTimeout(this._timer);
    this._hidePill();

    if (getPageType() !== PAGE.PLAYER) return;

    this._currentUrl = location.href;
    this._attempts = 0;
    this._queue(80);
  }

  _queue(delay = 450) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._tryStart(), delay);
  }

  _tryStart() {
    if (location.href !== this._currentUrl) return;
    if (getPageType() !== PAGE.PLAYER) return;

    const targets = this._findLoadTargets();
    if (targets.length > 0) {
      for (const target of targets) {
        this._clickElement(target);
      }
      this._showPill("Auto Start: loading player", 1800);
    }

    this._attempts += 1;
    if (this._attempts < this._maxAttempts && !this._hasStartedLoading()) {
      this._queue(this._attempts < 5 ? 350 : 600);
    }
  }

  _findLoadTargets() {
    const exact = this._findExactAnimepaheLoadGate();
    if (exact.length > 0) return exact;

    const candidates = [
      ...document.querySelectorAll(
        [
          ".click-to-load",
          ".click-to-load .reload",
          ".reload",
          "button",
          "a",
          '[role="button"]',
          ".btn",
          ".play",
          ".play-button",
          ".load",
          ".player",
        ].join(","),
      ),
    ];

    return (
      candidates.find((el) => {
        if (!this._isVisible(el)) return false;
        if (this._isDangerousLink(el)) return false;
        const text = this._labelFor(el);
        return /click\s*to\s*load|load\s*(?:player|video|episode)?\b|click\s*to\s*play|\bplay\s*(?:video|episode)?\b|\bstart\s*(?:video|player)?\b/i.test(
          text,
        );
      }) || null
    );

    return fallback ? this._expandClickableTargets(fallback) : [];
  }

  _findExactAnimepaheLoadGate() {
    const gate = document.querySelector(".click-to-load");
    if (!gate || !this._isVisible(gate)) return [];

    const reload = gate.querySelector(".reload");
    return this._uniqueElements([
      reload,
      gate,
    ]).filter((el) => el && this._isVisible(el));
  }

  _expandClickableTargets(el) {
    return this._uniqueElements([
      el,
      el.closest(".click-to-load"),
    ]).filter(Boolean);
  }

  _uniqueElements(elements) {
    return elements.filter(
      (el, index) => el && elements.indexOf(el) === index,
    );
  }

  _labelFor(el) {
    return [
      el.textContent,
      el.getAttribute("title"),
      el.getAttribute("aria-label"),
      el.getAttribute("data-title"),
      el.id,
      el.className,
    ]
      .filter(Boolean)
      .join(" ");
  }

  _isDangerousLink(el) {
    const link = el.closest("a[href]");
    if (!link) return false;

    const href = link.getAttribute("href") || "";
    if (href.startsWith("#") || href.startsWith("javascript:")) return false;

    try {
      const url = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);

      if (url.origin !== current.origin) return true;
      if (/^\/play\//.test(url.pathname)) {
        const normalizedNext = url.pathname.replace(/\/+$/, "");
        const normalizedCurrent = current.pathname.replace(/\/+$/, "");
        return normalizedNext !== normalizedCurrent;
      }
    } catch {
      return true;
    }

    return false;
  }

  _hasStartedLoading() {
    if (document.querySelector(".click-to-load")) return false;
    return !!document.querySelector(
      'iframe[src*="kwik.cx"], iframe[src*="kwik.pw"], iframe[src*="kwik.si"]',
    );
  }

  _isVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
      rect.width > 8 &&
      rect.height > 8 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      Number(style.opacity || 1) > 0.01
    );
  }

  _clickElement(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    };

    try {
      el.dispatchEvent(new PointerEvent("pointerdown", opts));
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new PointerEvent("pointerup", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));
    } catch {
      try {
        el.click();
      } catch {}
    }
  }

  _injectStyles() {
    if (document.getElementById("ape-as-styles")) return;
    const s = document.createElement("style");
    s.id = "ape-as-styles";
    s.textContent = `
      #${PILL_ID} {
        position: fixed;
        bottom: 78px;
        right: 14px;
        z-index: 2147483647;
        background: rgba(8, 8, 22, 0.92);
        color: #e8e8f8;
        font: 700 11px/1.5 system-ui, sans-serif;
        padding: 6px 14px;
        border-radius: 20px;
        pointer-events: none;
        transition: opacity 0.45s;
        max-width: 360px;
        text-align: right;
        border: 1px solid rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(6px);
        opacity: 0;
      }
    `;
    document.head.appendChild(s);
  }

  _showPill(text, autohideMs = 0) {
    let pill = document.getElementById(PILL_ID);
    if (!pill) {
      pill = document.createElement("div");
      pill.id = PILL_ID;
      document.body.appendChild(pill);
    }
    clearTimeout(this._pillTimer);
    pill.textContent = text;
    pill.style.opacity = "1";
    if (autohideMs > 0) {
      this._pillTimer = setTimeout(
        () => (pill.style.opacity = "0"),
        autohideMs,
      );
    }
  }

  _hidePill() {
    const pill = document.getElementById(PILL_ID);
    if (pill) pill.style.opacity = "0";
  }
}

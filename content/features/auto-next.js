import { PAGE, getPageType } from "../helpers/router.js";

const MSG = {
  VIDEO_ENDED: "AP_AN_VIDEO_ENDED",
};

const PILL_ID = "ape-an-pill";

export class AutoNext {
  constructor(_storage, _settings = {}) {
    this._hasNavigated = false;
    this._boundOnMessage = this._onMessage.bind(this);
  }

  async init(_initialPageType) {
    this._injectStyles();
    window.addEventListener("message", this._boundOnMessage);

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
    this._hasNavigated = false;
    if (getPageType() !== PAGE.PLAYER) {
      this._hidePill();
    }
  }

  _onMessage(event) {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== MSG.VIDEO_ENDED) return;
    if (getPageType() !== PAGE.PLAYER) return;
    if (!this._isPlayerIframeSource(event.source)) return;

    this._goToNextEpisode();
  }

  _goToNextEpisode() {
    if (this._hasNavigated) return;

    const link = this._findNextEpisodeLink();
    if (!link) {
      this._showPill("Auto Next: next episode not found", 5000);
      return;
    }

    this._hasNavigated = true;
    this._showPill("Auto Next: opening next episode...");
    window.location.assign(link.href);
  }

  _findNextEpisodeLink() {
    const anchors = [
      ...document.querySelectorAll('a[href*="/play/"]'),
    ];

    const current = this._normalizeUrl(window.location.href);
    const matchers = [
      (a) => /play\s+next\s+episode/i.test(a.getAttribute("title") || ""),
      (a) => /next\s+episode/i.test(a.getAttribute("aria-label") || ""),
      (a) => /next\s+episode|play\s+next/i.test(a.textContent || ""),
      (a) => {
        const img = a.querySelector("img");
        return /next\s+episode|play\s+next/i.test(
          img?.getAttribute("alt") || "",
        );
      },
    ];

    return (
      anchors.find((a) => {
        const href = this._normalizeUrl(a.href);
        return href && href !== current && matchers.some((matches) => matches(a));
      }) || null
    );
  }

  _isPlayerIframeSource(source) {
    if (!source) return false;
    return this._getPlayerIframes().some((iframe) => {
      try {
        return iframe.contentWindow === source;
      } catch {
        return false;
      }
    });
  }

  _getPlayerIframes() {
    return [
      ...document.querySelectorAll(
        'iframe[src*="kwik.cx"], iframe[src*="kwik.pw"], iframe[src*="kwik.si"]',
      ),
    ];
  }

  _normalizeUrl(rawUrl) {
    try {
      const url = new URL(rawUrl, window.location.href);
      url.hash = "";
      if (url.pathname.length > 1) {
        url.pathname = url.pathname.replace(/\/+$/, "");
      }
      return url.href;
    } catch {
      return "";
    }
  }

  _injectStyles() {
    if (document.getElementById("ape-an-styles")) return;
    const s = document.createElement("style");
    s.id = "ape-an-styles";
    s.textContent = `
      #${PILL_ID} {
        position: fixed;
        bottom: 46px;
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

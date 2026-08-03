/**
 * binge-watch.js — off by default. Auto-plays the next episode when the
 * current one ends: iframe-player.js posts AP_BW_ENDED on "ended", we
 * find the next episode via the release API DUB Detector also uses, then
 * navigate after a short cancelable countdown.
 */

import { PAGE, getPageType, getPageSessions } from "../helpers/router.js";
import { throttler } from "../helpers/throttler.js";
import { injectStylesheet } from "../helpers/styles.js";
import { showPill } from "../helpers/pill.js";

const MSG = { ENDED: "AP_BW_ENDED" };

// animepahe doesn't embed the kwik iframe on page load — it renders a
// "Click to load" placeholder (div.click-to-load) and only injects the
// real <iframe> once that's clicked. Since this class only runs at all
// when Binge Watch is switched on, we auto-click that placeholder on
// every player page we land on — however we got there (a scripted
// Binge Watch navigation, or just a normal click on an episode) — so
// the whole point of the feature (no clicking required) actually holds.
const CLICK_TO_LOAD_SELECTOR = ".click-to-load";
const CLICK_TO_LOAD_WAIT_MS = 8000;

export class BingeWatch {
  /** @param {import("../helpers/storage.js").storage} storage */
  constructor(storage, settings = {}) {
    this._storage = storage;
    this._countdownMs = settings.bingeWatchCountdownMs ?? 5000;
    this._cancelled = false;
    this._navigateTimer = null;
    this._boundOnMessage = this._onMessage.bind(this);
  }

  async init(_initialPageType) {
    injectStylesheet("ape-bw-styles", "content/features/binge-watch.css");
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

  /** Clicks animepahe's own embed placeholder so the kwik iframe loads
   *  without the user having to click it themselves. */
  _maybeAutoLoadEmbed() {
    const tryClick = () => {
      const el = document.querySelector(CLICK_TO_LOAD_SELECTOR);
      if (!el) return false;
      el.click();
      return true;
    };

    if (tryClick()) return;

    // The placeholder is usually already in the initial HTML, but give
    // it a moment in case the page is still assembling the player.
    const observer = new MutationObserver(() => {
      if (tryClick()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), CLICK_TO_LOAD_WAIT_MS);
  }

  _handleRoute() {
    // Reset per-episode state whenever we land on a (new) player page.
    if (getPageType() === PAGE.PLAYER) {
      this._cancelled = false;
      clearTimeout(this._navigateTimer);
      this._maybeAutoLoadEmbed();
    }
  }

  _onMessage(event) {
    if (event.data?.type !== MSG.ENDED) return;
    if (getPageType() !== PAGE.PLAYER) return;
    this._onEpisodeEnded();
  }

  async _onEpisodeEnded() {
    const sessions = getPageSessions();
    if (!sessions?.animeSession || !sessions?.epSession) return;

    showPill("🔁 Binge Watch: finding next episode…");

    const nextEpSession = await this._findNextEpisodeSession(
      sessions.animeSession,
      sessions.epSession,
    );

    if (!nextEpSession) {
      showPill("🔁 Binge Watch: no next episode found", 4000);
      return;
    }

    const nextUrl = `${location.origin}/play/${sessions.animeSession}/${nextEpSession}`;
    this._showCountdownPill(nextUrl);
  }

  _showCountdownPill(nextUrl) {
    this._cancelled = false;

    if (this._countdownMs <= 0) {
      showPill("🔁 Binge Watch: playing next episode…", 2000);
      location.href = nextUrl;
      return;
    }

    let secondsLeft = Math.ceil(this._countdownMs / 1000);

    const pill = showPill(this._countdownText(secondsLeft), 0, true);
    pill.classList.add("ape-bw-pill");
    pill.style.pointerEvents = "auto";
    pill.title = "Click to cancel";

    const onClick = () => {
      this._cancelled = true;
      clearInterval(tickInterval);
      clearTimeout(this._navigateTimer);
      pill.classList.remove("ape-bw-pill");
      pill.style.pointerEvents = "none";
      showPill("🔁 Binge Watch: cancelled", 2500);
      pill.removeEventListener("click", onClick);
    };
    pill.addEventListener("click", onClick);

    const tickInterval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0 || this._cancelled) {
        clearInterval(tickInterval);
        return;
      }
      showPill(this._countdownText(secondsLeft), 0, true);
    }, 1000);

    this._navigateTimer = setTimeout(() => {
      clearInterval(tickInterval);
      if (this._cancelled) return;
      pill.style.pointerEvents = "none";
      location.href = nextUrl;
    }, this._countdownMs);
  }

  _countdownText(secondsLeft) {
    return `▶ Binge Watch: next episode in ${secondsLeft}s (click to cancel)`;
  }

  /** Returns the session id of the episode after `currentEpSession`, or
   *  null if it's the last one / not found. */
  async _findNextEpisodeSession(animeSession, currentEpSession) {
    try {
      let page = 1;
      // Release list is paginated; walk forward until found or exhausted.
      while (page <= 20) {
        const data = await throttler.fetch(
          `/api?m=release&id=${animeSession}&sort=episode_asc&page=${page}`,
          true,
        );
        const eps = Array.isArray(data?.data)
          ? data.data
          : Object.values(data?.data || {});
        const totalPages = data?.last_page ?? page;
        const idx = eps.findIndex(
          (ep) => (ep.session || ep.anime_session) === currentEpSession,
        );

        if (idx !== -1) {
          if (idx + 1 < eps.length) {
            const next = eps[idx + 1];
            return next.session || next.anime_session || null;
          }
          // Current episode is the last one on this page — if this page
          // is also the last overall page, there's no next episode.
          if (page >= totalPages) return null;
          page++;
          continue;
        }

        if (page >= totalPages) break;
        page++;
      }
      return null;
    } catch (err) {
      console.error("[BingeWatch] Failed to resolve next episode:", err);
      return null;
    }
  }
}

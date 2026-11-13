import { PAGE, getPageType, getPageSessions } from "../../helpers/router.js";
import { throttler } from "../../helpers/throttler.js";
import { showAction } from "../../helpers/pill.js";

const MSG = { ENDED: "AP_BW_ENDED" };

const CLICK_TO_LOAD_SELECTOR = ".click-to-load";
const CLICK_TO_LOAD_WAIT_MS = 8000;

export class BingeWatch {
  constructor(storage, settings = {}) {
    this._storage = storage;
    this._countdownMs = settings.bingeWatchCountdownMs ?? 5000;
    this._cancelled = false;
    this._navigateTimer = null;
    this._boundOnMessage = this._onMessage.bind(this);
  }

  async init(_initialPageType) {
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

  _maybeAutoLoadEmbed() {
    const tryClick = () => {
      const el = document.querySelector(CLICK_TO_LOAD_SELECTOR);
      if (!el) return false;
      el.click();
      return true;
    };

    if (tryClick()) return;

    const observer = new MutationObserver(() => {
      if (tryClick()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), CLICK_TO_LOAD_WAIT_MS);
  }

  _handleRoute() {
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

    showAction({ icon: "spinner", text: "Finding next episode" });

    const nextEpSession = await this._findNextEpisodeSession(
      sessions.animeSession,
      sessions.epSession,
    );

    if (!nextEpSession) {
      showAction({
        icon: "binge",
        text: "Last episode reached",
        autohideMs: 4000,
      });
      return;
    }

    const nextUrl = `${location.origin}/play/${sessions.animeSession}/${nextEpSession}`;
    this._showCountdownPill(nextUrl);
  }

  _showCountdownPill(nextUrl) {
    this._cancelled = false;

    if (this._countdownMs <= 0) {
      showAction({
        icon: "binge",
        text: "Playing next episode",
        autohideMs: 2000,
      });
      location.href = nextUrl;
      return;
    }

    const total = Math.ceil(this._countdownMs / 1000);
    let secondsLeft = total;

    const render = () =>
      showAction({
        countdown: { secondsLeft, total },
        text: `Next episode in ${secondsLeft}s`,
        action: { label: "Cancel", onClick: cancel },
        live: true,
      });

    const cancel = () => {
      this._cancelled = true;
      clearInterval(tickInterval);
      clearTimeout(this._navigateTimer);
      showAction({
        icon: "close",
        text: "Binge Watch cancelled",
        autohideMs: 2500,
      });
    };

    render();

    const tickInterval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0 || this._cancelled) {
        clearInterval(tickInterval);
        return;
      }
      render();
    }, 1000);

    this._navigateTimer = setTimeout(() => {
      clearInterval(tickInterval);
      if (!this._cancelled) location.href = nextUrl;
    }, this._countdownMs);
  }

  async _findNextEpisodeSession(animeSession, currentEpSession) {
    try {
      let page = 1;
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

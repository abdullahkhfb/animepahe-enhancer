/**
 * intro-skip.js
 *
 * Adds Intro & Outro skipping to the animepahe player using the
 * open-anime-timestamps dataset
 * (https://github.com/Ellivers/open-anime-timestamps).
 *
 * Pipeline:
 *   1. Detect the player page (PAGE.PLAYER).
 *   2. Extract animeSession + animeTitle + epNumber from the DOM.
 *   3. Resolve anidb ID via AniList -> relations.yuna.moe.
 *   4. Look up intro/outro timestamps in the cached dataset.
 *   5. Send skip ranges to the kwik player iframe.
 *
 * The iframe (iframe-player.js) handles the actual skip button rendering
 * ON TOP of the video, range polling, and seeking. The parent only
 * orchestrates the lookup and sends ranges.
 *
 * Communication with iframe-player.js uses postMessage with these types:
 *   Parent  -> Iframe : AP_IS_SET_RANGES    { ranges, autoSkip, pollMs, buttonAutoHideMs }
 *   Parent  -> Iframe : AP_IS_SEEK          { time }   (reserved for future use)
 *   Iframe  -> Parent : AP_IS_READY         (iframe wants the ranges)
 */

import { PAGE, getPageType, getPageSessions } from "../helpers/router.js";
import {
  getTimestampsForEpisode,
  resolveIdsForAnime,
} from "../helpers/timestamps-db.js";

const MSG = {
  SET_RANGES: "AP_IS_SET_RANGES",
  SEEK: "AP_IS_SEEK",
  READY: "AP_IS_READY",
};

const PILL_ID = "ape-is-pill";

export class IntroSkip {
  /**
   * @param {import("../helpers/storage.js").storage} storage
   * @param {object} settings
   */
  constructor(storage, settings = {}) {
    this._storage = storage;
    this._settings = settings;

    this._idCacheTtlMs =
      (settings.introSkipIdCacheHours ?? 168) * 60 * 60 * 1_000;
    this._autoSkip = (settings.introSkipAutoSkip ?? 0) === 1;
    this._pollMs = settings.introSkipPollMs ?? 250;
    this._buttonAutoHideMs = settings.introSkipButtonAutoHideMs ?? 8000;
    this._showHighlights = settings.introSkipShowHighlights !== false;

    this._currentRangeKey = null;
    this._lastPayload = null;

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

  _injectStyles() {
    if (document.getElementById("ape-is-styles")) return;
    const s = document.createElement("style");
    s.id = "ape-is-styles";
    s.textContent = `
      #${PILL_ID} {
        position: fixed;
        bottom: 14px;
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
        font-variant-numeric: tabular-nums;
      }
    `;
    document.head.appendChild(s);
  }

  async _handleRoute() {
    const pageType = getPageType();
    if (pageType !== PAGE.PLAYER) {
      this._clearRanges();
      return;
    }
    await this._initPlayer();
  }

  _clearRanges() {
    this._currentRangeKey = null;
    this._lastPayload = null;
    const iframes = this._getPlayerIframes();
    for (const f of iframes) {
      f.contentWindow?.postMessage(
        {
          type: MSG.SET_RANGES,
          ranges: { intro: null, outro: null, recap: null },
          autoSkip: this._autoSkip,
          pollMs: this._pollMs,
          buttonAutoHideMs: this._buttonAutoHideMs,
          showHighlights: this._showHighlights,
        },
        "*",
      );
    }
  }

  _getPlayerIframes() {
    return [
      ...document.querySelectorAll(
        'iframe[src*="kwik.cx"], iframe[src*="kwik.pw"], iframe[src*="kwik.si"]',
      ),
    ];
  }

  async _initPlayer() {
    const sessions = getPageSessions();
    if (!sessions) return;

    const meta = this._extractPlayerMeta();
    if (!meta.animeSession || !meta.animeTitle || meta.epNumber === "?") {
      // Title/episode might still be loading — retry shortly.
      setTimeout(() => this._initPlayer(), 800);
      return;
    }

    const rangeKey = `${meta.animeSession}:${meta.epSession}`;
    if (rangeKey === this._currentRangeKey) return;
    this._currentRangeKey = rangeKey;

    this._showPill("⏭ Resolving anime…");

    let ids = null;
    try {
      ids = await resolveIdsForAnime(
        meta.animeSession,
        meta.animeTitle,
        this._idCacheTtlMs,
      );
    } catch (err) {
      console.warn("[IntroSkip] Failed to resolve IDs:", err);
    }

    const anidbId = ids?.anidbId ?? null;
    const extraIds = {
      anilistId: ids?.anilistId ?? null,
      idMal: ids?.idMal ?? null,
    };

    // If we have no AniList/MAL ID at all, the AnimeSkip fallback can't
    // help either — bail out early with a "not found" message.
    if (!anidbId && !extraIds.anilistId && !extraIds.idMal) {
      this._showPill("⏭ Intro/Outro: not found in database", 4000);
      this._clearRanges();
      return;
    }

    this._showPill("⏭ Looking up timestamps…");

    let timestamps;
    try {
      timestamps = await getTimestampsForEpisode(
        anidbId,
        meta.epNumber,
        this._settings,
        (msg) => this._showPill(`⏭ ${msg}`),
        extraIds,
      );
    } catch (err) {
      console.error("[IntroSkip] Failed to load timestamps:", err);
      this._showPill("⏭ Intro/Outro: DB fetch failed", 5000);
      this._clearRanges();
      return;
    }

    const hasIntro = timestamps.intro && timestamps.intro.start != null;
    const hasOutro = timestamps.outro && timestamps.outro.start != null;

    if (!hasIntro && !hasOutro) {
      this._showPill("⏭ Intro/Outro: no data for this episode", 4000);
      this._clearRanges();
      return;
    }

    const sourceLabel =
      timestamps.source === "animeskip" ? "AnimeSkip" : "database";
    this._showPill(
      `⏭ Intro/Outro (${sourceLabel}): ${hasIntro ? "OP ✓" : "OP —"} · ${
        hasOutro ? "ED ✓" : "ED —"
      }`,
      3500,
    );

    this._sendRangesToIframe(timestamps);
  }

  _sendRangesToIframe(timestamps) {
    const payload = {
      type: MSG.SET_RANGES,
      ranges: {
        intro: timestamps.intro,
        outro: timestamps.outro,
        recap: timestamps.recap,
      },
      autoSkip: this._autoSkip,
      pollMs: this._pollMs,
      buttonAutoHideMs: this._buttonAutoHideMs,
      showHighlights: this._showHighlights,
    };

    this._lastPayload = payload;

    const iframes = this._getPlayerIframes();
    for (const f of iframes) {
      try {
        f.contentWindow?.postMessage(payload, "*");
      } catch {}
    }

    // The iframe may have already sent AP_IS_READY before we got here.
    // Re-send on a short delay to make sure the iframe has its video ready.
    setTimeout(() => {
      for (const f of this._getPlayerIframes()) {
        try {
          f.contentWindow?.postMessage(payload, "*");
        } catch {}
      }
    }, 1500);
  }

  _onMessage(event) {
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === MSG.READY) {
      // Iframe is asking for ranges — re-send the last payload we computed.
      if (this._lastPayload) {
        for (const f of this._getPlayerIframes()) {
          try {
            f.contentWindow?.postMessage(this._lastPayload, "*");
          } catch {}
        }
      } else if (this._currentRangeKey) {
        // We have a range key but no payload yet (still resolving).
        // Re-trigger the pipeline.
        this._initPlayer();
      }
      return;
    }
  }

  _extractPlayerMeta() {
    const sessions = window.location.pathname.match(
      /^\/play\/([^/]+)\/([^/]+)/,
    );
    if (!sessions) return {};
    const [, animeSession, epSession] = sessions;

    const h1 = document.querySelector(".theatre-info h1");
    const linkEl = h1?.querySelector("a");
    const animeTitle = linkEl
      ? linkEl.textContent.trim()
      : document.title || "Unknown Anime";

    let epNumber = "?";
    const titleMatch = document.title.match(
      /[Ee]p(?:isode)?\s*(\d+(?:\.\d+)?)/,
    );
    if (titleMatch) epNumber = titleMatch[1];

    if (epNumber === "?") {
      const epTitleEl =
        document.querySelector(".dropdown-menu .dropdown-item.active") ||
        document.querySelector(".episode-title") ||
        document.querySelector(".theatre-info .episode") ||
        document.querySelector(".theatre-info [class*='ep']") ||
        document.querySelector(".theatre-episodes .active") ||
        document.querySelector(".episode-list .active");

      if (epTitleEl) {
        const epMatch = epTitleEl.textContent.match(/(\d+(?:\.\d+)?)/);
        if (epMatch) epNumber = epMatch[1];
      }
    }

    if (epNumber === "?") {
      const heading = h1 ? h1.textContent.trim() : "";
      const afterName = heading
        .slice(animeTitle.length)
        .replace(/^[\s\-–—:]+/, "");
      const epMatch = afterName.match(/(\d+(?:\.\d+)?)/);
      if (epMatch) epNumber = epMatch[1];
    }

    return {
      animeSession,
      epSession,
      animeTitle,
      epNumber,
      playUrl: window.location.href,
    };
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
}

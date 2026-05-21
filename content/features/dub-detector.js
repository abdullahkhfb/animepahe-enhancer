import { PAGE, getPageSessions, getPageType } from "../helpers/router.js";
import {
  readCache,
  writeCache,
  epCacheKey,
  homeCacheKey,
} from "../helpers/cache.js";

const HOME_BATCH_SIZE = 3;
const PILL_ID = "ape-dub-pill";

export class DubDetector {
  constructor(storage) {
    this._storage = storage;
    this._episodeListObserver = null;
    this._homeObserver = null;
    this._homeBusy = false;
  }

  async init(initialPageType) {
    this._handleRoute();

    let currentUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        this._handleRoute();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  async _handleRoute() {
    const pageType = getPageType();
    switch (pageType) {
      case PAGE.EPISODE_LIST:
        await this._initEpisodeList();
        break;
      case PAGE.PLAYER:
        await this._initPlayer();
        break;
      case PAGE.HOME:
        await this._initHome();
        break;
      default:
        break;
    }
  }

  _getThumbnailTarget(anchor) {
    let img = anchor.querySelector("img");
    if (img) return anchor;

    let p = anchor.parentElement;
    for (let d = 0; p && d < 4; d++) {
      img = p.querySelector("img");
      if (img) break;
      p = p.parentElement;
    }

    if (img) return img.closest("a") || img.parentElement;
    return anchor;
  }

  async _initEpisodeList() {
    const sessions = getPageSessions();
    if (!sessions) return;

    this._showPill("🎙 DUB: Scanning…");
    await this._scanEpisodeList(sessions.animeSession);

    if (!this._episodeListObserver) {
      let debounceTimer = null;
      this._episodeListObserver = new MutationObserver(() => {
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          const currentSessions = getPageSessions();
          if (currentSessions)
            this._scanEpisodeList(currentSessions.animeSession);
        }, 500);
      });
      this._episodeListObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  async _scanEpisodeList(animeSession) {
    const cards = [
      ...document.querySelectorAll(
        ".episode-list-wrapper a, .episode-grid a, a[href*='/play/']",
      ),
    ];
    if (!cards.length) return;

    const episodes = [];
    const seenSessions = new Set();

    for (const a of cards) {
      if (a.closest("#ape-cw-section")) continue;

      const href = a.getAttribute("href") || "";
      const m = href.match(/\/play\/[^/]+\/([^/?#]+)/);
      if (!m) continue;

      const epSession = m[1];
      const target = this._getThumbnailTarget(a);

      if (target.dataset.apeDubDone) continue;
      target.dataset.apeDubDone = "1";

      if (!seenSessions.has(epSession)) {
        seenSessions.add(epSession);
        episodes.push({ el: target, epSession });
      }
    }

    if (!episodes.length) return;

    episodes.reverse();
    const dubCount = await this._binarySearchAndBadge(animeSession, episodes);
    this._showPill(
      dubCount > 0
        ? `🎙 DUB: ${dubCount} episode${dubCount === 1 ? "" : "s"} dubbed ✓`
        : "🎙 DUB: no dub found",
      4500,
    );
  }

  async _binarySearchAndBadge(animeSession, episodes) {
    const isDubbed = (ep) => this._isEpisodeDubbed(animeSession, ep.epSession);
    if (!(await isDubbed(episodes[0]))) return 0;

    let boundary;
    if (await isDubbed(episodes[episodes.length - 1])) {
      boundary = episodes.length - 1;
    } else {
      let lo = 0,
        hi = episodes.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (await isDubbed(episodes[mid])) lo = mid;
        else hi = mid;
      }
      boundary = lo;
    }

    for (let i = 0; i <= boundary; i++) {
      this._addEpBadge(episodes[i].el);
    }
    return boundary + 1;
  }

  async _initPlayer() {
    const sessions = getPageSessions();
    if (!sessions) return;

    const oldBadge = document.querySelector(".ape-dub-inline");
    if (oldBadge) oldBadge.remove();

    this._showPill("🎙 DUB: Checking…");
    const dubbed = await this._isEpisodeDubbed(
      sessions.animeSession,
      sessions.epSession,
    );

    if (dubbed) {
      this._addPlayerBadge();
      this._showPill("🎙 DUB: Dubbed ✓", 5000);
    } else {
      this._showPill("🎙 DUB: Sub only", 4000);
    }
  }

  _addPlayerBadge() {
    const h1 = document.querySelector("h1");
    if (!h1 || h1.querySelector(".ape-dub-inline")) return;
    const badge = document.createElement("span");
    badge.className = "ape-dub-inline";
    badge.textContent = "DUB";
    badge.style.cssText =
      "background:#e8710a;color:#fff;font:700 11px system-ui,sans-serif;padding:3px 9px;border-radius:3px;margin-left:10px;vertical-align:middle;display:inline-block;box-shadow:0 1px 5px rgba(0,0,0,.5);letter-spacing:.5px;";
    h1.appendChild(badge);
  }

  async _initHome() {
    const scanHomeCards = async () => {
      if (this._homeBusy) return;
      this._homeBusy = true;

      const cards = [
        ...document.querySelectorAll('a[href*="/anime/"], a[href*="/play/"]'),
      ].filter(
        (a) =>
          !a.closest("#ape-cw-section") &&
          !a.closest(
            ".ui-autocomplete, .search-results, header, .top-header, form",
          ),
      );
      if (!cards.length) {
        this._homeBusy = false;
        return;
      }

      const work = [];
      const seenSessions = new Set();

      for (const a of cards) {
        const href = a.getAttribute("href") || "";
        const m = href.match(/(?:\/anime\/|\/play\/)([^/?#]+)/);
        if (!m) continue;

        const animeSession = m[1];
        const target = this._getThumbnailTarget(a);

        if (target.dataset.apeDubDone) continue;
        target.dataset.apeDubDone = "1";

        if (!seenSessions.has(animeSession)) {
          seenSessions.add(animeSession);
          work.push({ anchor: target, animeSession });
        }
      }

      if (work.length > 0) {
        this._showPill("🎙 DUB: scanning home…");
        for (let i = 0; i < work.length; i += HOME_BATCH_SIZE) {
          const batch = work.slice(i, i + HOME_BATCH_SIZE);
          await Promise.all(batch.map((item) => this._scanHomeCard(item)));
        }
        this._showPill("🎙 DUB: scan complete ✓", 4000);
      }
      this._homeBusy = false;
    };

    await scanHomeCards();
    if (!this._homeObserver) {
      let debounce = null;
      this._homeObserver = new MutationObserver(() => {
        if (!this._homeBusy) {
          clearTimeout(debounce);
          debounce = setTimeout(scanHomeCards, 600);
        }
      });
      this._homeObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  async _scanHomeCard({ anchor, animeSession }) {
    const cached = await readCache(homeCacheKey(animeSession));
    if (cached) {
      this._addHomeBadge(anchor, cached.dubs, cached.total);
      return;
    }

    this._setSpinner(anchor, true);

    try {
      const stats = await this._fetchAnimeStats(animeSession);
      if (stats) {
        await writeCache(homeCacheKey(animeSession), stats);
        this._addHomeBadge(anchor, stats.dubs, stats.total);
      }
    } catch {
    } finally {
      this._setSpinner(anchor, false);
    }
  }

  async _fetchAnimeStats(animeSession) {
    const res = await fetch(
      `/api?m=release&id=${animeSession}&sort=episode_asc&page=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const total = data.total ?? data.data?.length ?? 0;
    if (!total) return null;

    const eps = Array.isArray(data.data)
      ? data.data
      : Object.values(data.data || {});
    if (!eps.length) return { dubs: 0, total };

    const dubs = await this._findDubCountBinary(animeSession, eps);
    return { dubs, total };
  }

  async _findDubCountBinary(animeSession, eps) {
    if (!eps.length) return 0;
    const sess = (ep) => ep.session || ep.anime_session;

    const firstDubbed = await this._isEpisodeDubbed(animeSession, sess(eps[0]));
    if (!firstDubbed) return 0;

    const lastDubbed = await this._isEpisodeDubbed(
      animeSession,
      sess(eps[eps.length - 1]),
    );
    if (lastDubbed) return eps.length;

    let lo = 0,
      hi = eps.length - 1,
      best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (await this._isEpisodeDubbed(animeSession, sess(eps[mid]))) {
        best = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best + 1;
  }

  _addEpBadge(el) {
    if (el.querySelector(".ape-dub-badge")) return;
    const badge = document.createElement("span");
    badge.className = "ape-dub-badge ape-dub-badge-ep";
    badge.textContent = "DUB";
    if (getComputedStyle(el).position === "static")
      el.style.setProperty("position", "relative", "important");
    el.appendChild(badge);
  }

  _addHomeBadge(el, dubs, total) {
    if (!dubs || el.querySelector(".ape-dub-badge-home")) return;
    const badge = document.createElement("span");
    badge.className = "ape-dub-badge ape-dub-badge-home";
    badge.textContent = `${dubs}/${total}`;
    if (getComputedStyle(el).position === "static")
      el.style.setProperty("position", "relative", "important");
    el.appendChild(badge);
  }

  _setSpinner(el, on) {
    if (on) {
      if (el.querySelector(".ape-dub-spin")) return;
      const s = document.createElement("span");
      s.className = "ape-dub-spin";
      if (getComputedStyle(el).position === "static")
        el.style.setProperty("position", "relative", "important");
      el.appendChild(s);
    } else {
      el.querySelector(".ape-dub-spin")?.remove();
    }
  }

  _getOrCreatePill() {
    let pill = document.getElementById(PILL_ID);
    if (!pill) {
      pill = document.createElement("div");
      pill.id = PILL_ID;
      Object.assign(pill.style, {
        position: "fixed",
        bottom: "14px",
        right: "14px",
        zIndex: "2147483647",
        background: "rgba(8, 8, 22, 0.92)",
        color: "#e8e8f8",
        font: "700 11px/1.5 system-ui, sans-serif",
        padding: "6px 14px",
        borderRadius: "20px",
        pointerEvents: "none",
        transition: "opacity 0.45s",
        maxWidth: "300px",
        textAlign: "right",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(6px)",
        opacity: "0",
      });
      document.body.appendChild(pill);
    }
    return pill;
  }

  _showPill(text, autohideMs = 0) {
    const pill = this._getOrCreatePill();
    clearTimeout(this._pillTimer);
    pill.textContent = text;
    pill.style.opacity = "1";
    if (autohideMs > 0)
      this._pillTimer = setTimeout(
        () => (pill.style.opacity = "0"),
        autohideMs,
      );
  }

  async _apiFetch(url, wantJson = true) {
    await new Promise((r) => setTimeout(r, 150));
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: wantJson ? "application/json" : "text/html,*/*",
        "X-Requested-With": "XMLHttpRequest",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return wantJson ? res.json() : res.text();
  }

  async _isEpisodeDubbed(animeSession, epSession) {
    const cached = await readCache(epCacheKey(epSession));
    if (cached !== null) return cached;

    let dubbed = false;
    try {
      dubbed = await this._checkDubViaApi(animeSession, epSession);
    } catch {}
    if (!dubbed) {
      try {
        dubbed = await this._checkDubViaHtml(animeSession, epSession);
      } catch {}
    }

    await writeCache(epCacheKey(epSession), dubbed);
    return dubbed;
  }

  async _checkDubViaApi(animeSession, epSession) {
    const data = await this._apiFetch(
      `/api?m=links&id=${animeSession}&session=${epSession}&p=kwik`,
    );
    const s = JSON.stringify(data).toLowerCase();
    return (
      s.includes('"eng"') || s.includes('"english"') || s.includes('"dub"')
    );
  }

  async _checkDubViaHtml(animeSession, epSession) {
    const html = await this._apiFetch(
      `/play/${animeSession}/${epSession}`,
      false,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    const area =
      doc.getElementById("pickDownload") || doc.getElementById("scrollArea");
    if (area) {
      const txt = area.textContent;
      if (/\bEng\b/i.test(txt) || /english/i.test(txt) || /\bdub\b/i.test(txt))
        return true;
    }

    for (const s of doc.querySelectorAll("script:not([src])")) {
      const t = s.textContent || "";
      if (t.includes("audio") && /['"](eng|english|dub)['"]/i.test(t))
        return true;
    }

    const idx = html.toLowerCase().indexOf('"audio"');
    if (
      idx !== -1 &&
      /eng|english|dub/.test(html.slice(idx, idx + 32).toLowerCase())
    )
      return true;

    return false;
  }
}

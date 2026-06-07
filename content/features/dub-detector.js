import { PAGE, getPageSessions, getPageType } from "../helpers/router.js";
import {
  readCache,
  writeCache,
  epCacheKey,
  homeCacheKey,
} from "../helpers/cache.js";
import { throttler } from "../helpers/throttler.js";

const PILL_ID = "ape-dub-pill";

const AUDIO_DUB_VALUES = new Set(["eng", "english", "dub", "dubbed"]);

function _jsonSignalsDub(node) {
  if (node === null || node === undefined) return false;
  if (Array.isArray(node)) return node.some(_jsonSignalsDub);
  if (typeof node === "object") {
    for (const [key, val] of Object.entries(node)) {
      const lk = key.toLowerCase();
      if (lk === "audio") {
        if (
          typeof val === "string" &&
          AUDIO_DUB_VALUES.has(val.trim().toLowerCase())
        )
          return true;
        if (Array.isArray(val) && val.some(_audioArraySignalsDub)) return true;
      }
      if ((lk === "dub" || lk === "dubbed") && val != null) return true;
      if (typeof val === "object" && val !== null && _jsonSignalsDub(val))
        return true;
    }
    return false;
  }
  return false;
}

function _audioArraySignalsDub(track) {
  if (!track || typeof track !== "object") return false;
  for (const [k, v] of Object.entries(track)) {
    const lk = k.toLowerCase();
    if (
      (lk === "lang" || lk === "language" || lk === "code") &&
      typeof v === "string"
    ) {
      const lv = v.trim().toLowerCase();
      if (AUDIO_DUB_VALUES.has(lv) || lv === "en") return true;
    }
    if (
      lk === "label" &&
      typeof v === "string" &&
      /\benglish\b|\bdub\b/i.test(v)
    )
      return true;
  }
  return false;
}

function _htmlSignalsDub(html, doc) {
  for (const el of doc.querySelectorAll(
    "[data-audio],[data-lang],[data-dub]",
  )) {
    const v = (el.dataset.audio || el.dataset.lang || el.dataset.dub || "")
      .trim()
      .toLowerCase();
    if (AUDIO_DUB_VALUES.has(v) || v === "en") return true;
  }

  const area =
    doc.getElementById("pickDownload") || doc.getElementById("scrollArea");
  if (area) {
    const txt = area.textContent;
    if (/\bDub\b(?!\s*(?:bed|bing|subtitle|sub\b))/i.test(txt)) return true;
    if (
      /\b(?:English|Eng)\b(?!\s*(?:sub|subtitle|subtitles|subbed|dub\s+sub))/i.test(
        txt,
      )
    )
      return true;
  }

  const audioFieldRe =
    /['"']?(?:audio|lang|language|dubbed)['"']?\s*:\s*['"](?:eng|en|english|dub|dubbed)['"]/i;
  const audioProximityRe =
    /['"']?audio['"']?\s*:[^;{}]{0,80}['"](?:eng|en|english|dub|dubbed)['"]/i;

  for (const s of doc.querySelectorAll("script:not([src])")) {
    const t = s.textContent || "";
    if (audioFieldRe.test(t) || audioProximityRe.test(t)) return true;
  }

  {
    const lhtml = html.toLowerCase();
    const needles = ['"audio":', "'audio':"];
    for (const needle of needles) {
      let pos = 0;
      while ((pos = lhtml.indexOf(needle, pos)) !== -1) {
        const snippet = lhtml.slice(pos, pos + 60);
        if (/["'](eng|en|english|dub|dubbed)["']/.test(snippet)) return true;
        pos += needle.length;
      }
    }
  }

  return false;
}

export class DubDetector {
  constructor(storage) {
    this._storage = storage;
    this._episodeListObserver = null;
    this._homeObserver = null;
    this._homeBusy = false;

    this._scanStart = 0;
    this._reqCompleted = 0;
    this._etaInterval = null;
    this._pillBaseText = "";
    this._activeSearches = new Map();
    this._searchIdCounter = 0;
    this._maxTotalReqs = 0;
    this._parallelProbes = 12;

    this._inFlight = new Map();
  }

  async init(_initialPageType) {
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

  _startEta(baseText) {
    this._stopEta();
    this._scanStart = Date.now();
    this._reqCompleted = 0;
    this._maxTotalReqs = 0;
    this._pillBaseText = baseText;
    this._tickEta();
    this._etaInterval = setInterval(() => this._tickEta(), 50);
  }

  _stopEta() {
    if (this._etaInterval) {
      clearInterval(this._etaInterval);
      this._etaInterval = null;
    }
  }

  _tickEta() {
    let searchPending = 0;
    for (const size of this._activeSearches.values()) {
      if (size > 1) {
        const depth = Math.ceil(
          Math.log(size) / Math.log(this._parallelProbes),
        );
        searchPending += depth * (this._parallelProbes - 1);
      }
    }

    const pending = throttler.pendingCount + searchPending;
    const currentTotal = this._reqCompleted + pending;
    if (currentTotal > this._maxTotalReqs) this._maxTotalReqs = currentTotal;

    let pctStr = "";
    if (this._maxTotalReqs > 0) {
      let pct = Math.floor((this._reqCompleted / this._maxTotalReqs) * 100);
      pct = Math.max(
        0,
        Math.min(pending === 0 && this._reqCompleted > 0 ? 100 : 99, pct),
      );
      pctStr = `  ·  ${pct}%`;
    }

    this._showPill(`${this._pillBaseText}${pctStr}`, 0, true);
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
          const s = getPageSessions();
          if (s) this._scanEpisodeList(s.animeSession);
        }, 100);
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
    this._startEta("🎙 DUB: Scanning");

    const dubCount = await this._binarySearchAndBadge(animeSession, episodes);

    this._stopEta();
    this._showPill(
      dubCount > 0
        ? `🎙 DUB: ${dubCount} episode${dubCount === 1 ? "" : "s"} dubbed ✓`
        : "🎙 DUB: no dub found",
      4500,
    );
  }

  async _binarySearchAndBadge(animeSession, episodes) {
    const boundaryCount = await this._findBoundaryConcurrent(
      animeSession,
      episodes,
      (ep) => ep.epSession,
    );
    for (let i = 0; i < boundaryCount; i++) this._addEpBadge(episodes[i].el);
    return boundaryCount;
  }

  async _initPlayer() {
    const sessions = getPageSessions();
    if (!sessions) return;

    document.querySelector(".ape-dub-inline")?.remove();
    this._startEta("🎙 DUB: Checking");
    const dubbed = await this._isEpisodeDubbed(
      sessions.animeSession,
      sessions.epSession,
    );
    this._stopEta();

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
      "background:#e8710a;color:#fff;font:700 11px system-ui,sans-serif;" +
      "padding:3px 9px;border-radius:3px;margin-left:10px;vertical-align:middle;" +
      "display:inline-block;box-shadow:0 1px 5px rgba(0,0,0,.5);letter-spacing:.5px;";
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
        this._startEta("🎙 DUB: Scanning home");
        await Promise.all(work.map((item) => this._scanHomeCard(item)));
        this._stopEta();
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
          debounce = setTimeout(scanHomeCards, 100);
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
      // Network failure — leave card without badge; do not cache.
    } finally {
      this._setSpinner(anchor, false);
    }
  }

  async _fetchAnimeStats(animeSession) {
    let data;
    try {
      data = await this._apiFetch(
        `/api?m=release&id=${animeSession}&sort=episode_asc&page=1`,
        true,
      );
    } catch {
      return null;
    }

    const total = data.total ?? data.data?.length ?? 0;
    if (!total) return null;

    const eps = Array.isArray(data.data)
      ? data.data
      : Object.values(data.data || {});
    if (!eps.length) return { dubs: 0, total };

    const dubs = await this._findDubCountBinary(animeSession, eps);
    return { dubs, total };
  }

  async _findBoundaryConcurrent(animeSession, eps, sessionExtractor) {
    if (!eps.length) return 0;

    const check = (idx) =>
      this._isEpisodeDubbed(animeSession, sessionExtractor(eps[idx]));

    if (eps.length === 1) return (await check(0)) ? 1 : 0;
    const [firstDubbed, lastDubbed] = await Promise.all([
      check(0),
      check(eps.length - 1),
    ]);
    if (!firstDubbed) return 0;
    if (lastDubbed) return eps.length;

    const searchId = ++this._searchIdCounter;
    let left = 0;
    let right = eps.length - 1;

    while (right - left > 1) {
      this._activeSearches.set(searchId, right - left);
      this._tickEta();

      const step = (right - left) / this._parallelProbes;
      const probeIndices = [];

      for (let i = 1; i < this._parallelProbes; i++) {
        const mid = Math.floor(left + step * i);
        if (mid > left && mid < right && !probeIndices.includes(mid))
          probeIndices.push(mid);
      }

      if (probeIndices.length === 0) {
        const mid = Math.floor((left + right) / 2);
        if (mid > left && mid < right) probeIndices.push(mid);
        else break; // adjacent — boundary is between left and right
      }

      const results = await Promise.all(probeIndices.map(check));

      let lastTrueIdx = -1;
      for (let i = 0; i < results.length; i++) {
        if (results[i]) lastTrueIdx = i;
        else break;
      }

      if (lastTrueIdx === -1) {
        right = probeIndices[0];
      } else if (lastTrueIdx === probeIndices.length - 1) {
        left = probeIndices[lastTrueIdx];
      } else {
        left = probeIndices[lastTrueIdx];
        right = probeIndices[lastTrueIdx + 1];
      }
    }

    this._activeSearches.delete(searchId);
    this._tickEta();
    return left + 1;
  }

  async _findDubCountBinary(animeSession, eps) {
    return this._findBoundaryConcurrent(
      animeSession,
      eps,
      (ep) => ep.session || ep.anime_session,
    );
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
    badge.textContent = `🎙 ${dubs}/${total}`;
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
        background: "rgba(8,8,22,0.92)",
        color: "#e8e8f8",
        font: "700 11px/1.5 system-ui,sans-serif",
        padding: "6px 14px",
        borderRadius: "20px",
        pointerEvents: "none",
        transition: "opacity 0.45s",
        maxWidth: "360px",
        textAlign: "right",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(6px)",
        opacity: "0",
        fontVariantNumeric: "tabular-nums",
      });
      document.body.appendChild(pill);
    }
    return pill;
  }

  _showPill(text, autohideMs = 0, live = false) {
    const pill = this._getOrCreatePill();
    if (!live) clearTimeout(this._pillTimer);
    pill.textContent = text;
    pill.style.opacity = "1";
    if (autohideMs > 0)
      this._pillTimer = setTimeout(
        () => (pill.style.opacity = "0"),
        autohideMs,
      );
  }

  async _apiFetch(url, wantJson = true) {
    const result = await throttler.fetch(url, wantJson);
    this._reqCompleted++;
    this._tickEta();
    return result;
  }

  async _isEpisodeDubbed(animeSession, epSession) {
    const cached = await readCache(epCacheKey(epSession));
    if (cached !== null) return cached;

    if (this._inFlight.has(epSession)) {
      return this._inFlight.get(epSession);
    }

    const promise = this._fetchDubStatus(animeSession, epSession);
    this._inFlight.set(epSession, promise);

    try {
      return await promise;
    } finally {
      this._inFlight.delete(epSession);
    }
  }

  async _fetchDubStatus(animeSession, epSession) {
    let dubbed = null;
    let apiError = null;

    try {
      dubbed = await this._checkDubViaApi(animeSession, epSession);
    } catch (err) {
      apiError = err;
      if (err?.rateLimited) return false;
    }

    if (dubbed === null) {
      try {
        dubbed = await this._checkDubViaHtml(animeSession, epSession);
      } catch {
        return false;
      }
    }

    await writeCache(epCacheKey(epSession), dubbed);
    return dubbed;
  }

  async _checkDubViaApi(animeSession, epSession) {
    const data = await this._apiFetch(
      `/api?m=links&id=${animeSession}&session=${epSession}&p=kwik`,
    );
    return _jsonSignalsDub(data);
  }

  async _checkDubViaHtml(animeSession, epSession) {
    const html = await this._apiFetch(
      `/play/${animeSession}/${epSession}`,
      false,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    return _htmlSignalsDub(html, doc);
  }
}

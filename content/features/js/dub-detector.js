import { PAGE, getPageSessions, getPageType } from "../../helpers/router.js";
import {
  readCache,
  writeCache,
  epCacheKey,
  homeCacheKey,
} from "../../helpers/cache.js";
import { throttler } from "../../helpers/throttler.js";
import { injectStylesheet } from "../../helpers/styles.js";
import { showStatus } from "../../helpers/pill.js";
import { micIcon } from "../../helpers/icons.js";

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
  constructor(storage, settings = {}) {
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
    this._batchDelay = settings.dubBatchDelay ?? 2000;
    this._homeBatchSize = settings.dubHomeBatchSize ?? 2;
    // Sub-feature: also scan homepage cards, not just episode lists.
    this._homeScanEnabled = settings.dubHomeScanEnabled !== false;
    this._cacheTtlMs = (settings.cacheTtlHours ?? 24) * 60 * 60 * 1_000;
    this._itemsScanned = 0;
    this._totalItems = 0;

    this._inFlight = new Map();
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async _batchProcess(items, fn, batchSize = 2, batchDelayMs = 2000) {
    const chunks = items.reduce((acc, item, index) => {
      const chunkIndex = Math.floor(index / batchSize);
      if (!acc[chunkIndex]) acc[chunkIndex] = [];
      acc[chunkIndex].push(item);
      return acc;
    }, []);

    await chunks.reduce(async (chain, batch, index) => {
      await chain;

      const results = await Promise.all(batch.map((item) => fn(item)));

      const allCached = results.every((r) => r?.cached);
      const anyNoDub = results.some((r) => !r?.hasDub);

      const skipDelay = allCached || anyNoDub;

      if (index < chunks.length - 1 && !skipDelay) {
        await this._delay(batchDelayMs);
      }
    }, Promise.resolve());
  }

  async init(_initialPageType) {
    injectStylesheet("ape-dub-styles", "content/features/css/dub-detector.css");
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
        if (this._homeScanEnabled) await this._initHome();
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

  _startEta(baseText, totalItems = 0) {
    this._stopEta();
    this._scanStart = Date.now();
    this._reqCompleted = 0;
    this._maxTotalReqs = 0;
    this._itemsScanned = 0;
    this._totalItems = totalItems;
    this._pillBaseText = baseText;

    this._tickEta();

    if (totalItems === 0) {
      this._etaInterval = setInterval(() => this._tickEta(), 50);
    }
  }

  _stopEta() {
    if (this._etaInterval) {
      clearInterval(this._etaInterval);
      this._etaInterval = null;
    }
  }

  _itemCompleted() {
    this._itemsScanned++;
    this._tickEta();
  }

  _tickEta() {
    if (this._totalItems > 0) {
      let pct = Math.floor((this._itemsScanned / this._totalItems) * 100);
      pct = Math.max(
        0,
        Math.min(this._itemsScanned === this._totalItems ? 100 : 99, pct),
      );
      showStatus({ state: "progress", text: this._pillBaseText, percent: pct, live: true });
      return;
    }

    let searchPending = 0;
    for (const size of this._activeSearches.values()) {
      // The search is a sequential gallop-then-binary-search, so a bracket
      // of `size` remaining episodes takes roughly 2*log2(size) more
      // one-at-a-time requests to resolve (gallop out, then narrow).
      if (size > 1) {
        searchPending += 2 * Math.ceil(Math.log2(size));
      }
    }

    const pending = throttler.pendingCount + searchPending;
    const currentTotal = this._reqCompleted + pending;
    if (currentTotal > this._maxTotalReqs) this._maxTotalReqs = currentTotal;

    let pct = null;
    if (this._maxTotalReqs > 0) {
      pct = Math.floor((this._reqCompleted / this._maxTotalReqs) * 100);
      pct = Math.max(
        0,
        Math.min(pending === 0 && this._reqCompleted > 0 ? 100 : 99, pct),
      );
    }

    showStatus({ state: "progress", text: this._pillBaseText, percent: pct, live: true });
  }

  async _initEpisodeList() {
    const sessions = getPageSessions();
    if (!sessions) return;

    // No status pill yet: the episode list is filled in by the site after
    // load (and may never arrive if the site is rate-limiting). The pill
    // appears only once there are episodes to scan.
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
      if (
        !seenSessions.has(epSession) &&
        !document.querySelector(`[data-ape-ep="${CSS.escape(epSession)}"]`)
      ) {
        seenSessions.add(epSession);
        episodes.push({ el: target, epSession });
      }
    }

    if (!episodes.length) return;

    episodes.reverse();
    this._startEta("Scanning dubs");

    let dubCount;
    try {
      dubCount = await this._binarySearchAndBadge(animeSession, episodes);
    } catch (err) {
      this._stopEta();
      if (!err?.rateLimited) throw err;
      // Nothing was badged. Un-mark the cards so a later pass retries them.
      for (const { el } of episodes) delete el.dataset.apeDubDone;
      showStatus({
        state: "empty",
        text: "Dub scan paused (rate limited)",
        autohideMs: 5000,
      });
      clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => {
        const s = getPageSessions();
        if (s) this._scanEpisodeList(s.animeSession);
      }, 90_000);
      return;
    }

    this._stopEta();
    // This pass only saw the cards that were new since the last one (the
    // site re-renders the list, so a later pass can see just a few). Report
    // the totals for every badged episode on the page instead, otherwise the
    // summary flips from "10 of 10" to "1 of 1".
    const totals = this._countPageBadges();
    const pageDubs = totals.total ? totals.dubs : dubCount;
    const pageTotal = totals.total || episodes.length;
    this._renderSummary(pageDubs, pageTotal);
    showStatus(
      pageDubs > 0
        ? {
            state: "success",
            text: `${pageDubs} episode${pageDubs === 1 ? "" : "s"} dubbed`,
            autohideMs: 4500,
          }
        : { state: "empty", text: "No dub found", autohideMs: 4500 },
    );
  }

  /** Dub / total counts across every episode badge currently on the page. */
  _countPageBadges() {
    // One episode can have several links (thumbnail, title, ...), so count
    // each episode session once, however many badges it ended up with.
    const seen = new Map();
    document
      .querySelectorAll(".ape-dub-badge-ep, .ape-sub-badge-ep")
      .forEach((b, i) => {
        const key = b.dataset.apeEp || `#${i}`;
        const isDub = b.classList.contains("ape-dub-badge-ep");
        seen.set(key, seen.get(key) || isDub);
      });
    let dubs = 0;
    for (const v of seen.values()) if (v) dubs++;
    return { dubs, total: seen.size };
  }

  async _binarySearchAndBadge(animeSession, episodes) {
    const boundaryCount = await this._findBoundaryConcurrent(
      animeSession,
      episodes,
      (ep) => ep.epSession,
    );

    for (let i = 0; i < boundaryCount; i++) {
      this._addEpBadge(episodes[i].el, episodes[i].epSession);
    }

    for (let i = boundaryCount; i < episodes.length; i++) {
      this._addSubEpBadge(episodes[i].el, episodes[i].epSession);
    }

    return boundaryCount;
  }

  async _initPlayer() {
    const sessions = getPageSessions();
    if (!sessions) return;

    document.querySelector(".ape-dub-inline")?.remove();
    document.querySelector(".ape-sub-inline")?.remove();

    this._startEta("Checking dub");
    const dubbed = await this._isEpisodeDubbed(
      sessions.animeSession,
      sessions.epSession,
    );
    this._stopEta();

    if (dubbed) {
      this._addPlayerBadge();
      showStatus({ state: "success", text: "Dub available", autohideMs: 5000 });
    } else {
      this._addSubPlayerBadge();
      showStatus({ state: "empty", text: "Sub only", autohideMs: 4000 });
    }
  }

  _addPlayerBadge() {
    const h1 = document.querySelector("h1");
    if (!h1 || h1.querySelector(".ape-dub-inline")) return;
    const badge = document.createElement("span");
    badge.className = "ape-dub-inline";
    badge.append(micIcon(11), document.createTextNode("DUB"));
    h1.appendChild(badge);
  }

  _addSubPlayerBadge() {
    const h1 = document.querySelector("h1");
    if (
      !h1 ||
      h1.querySelector(".ape-sub-inline") ||
      h1.querySelector(".ape-dub-inline")
    )
      return;
    const badge = document.createElement("span");
    badge.className = "ape-sub-inline";
    badge.textContent = "SUB ONLY";
    h1.appendChild(badge);
  }

  async _initHome() {
    const scanHomeCards = async () => {
      if (this._homeBusy) return;
      const wait = (this._homeCooldownUntil ?? 0) - Date.now();
      if (wait > 0) {
        clearTimeout(this._homeRetryTimer);
        this._homeRetryTimer = setTimeout(scanHomeCards, wait + 500);
        return;
      }
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
        this._startEta("Scanning home cards", work.length);
        await this._batchProcess(
          work,
          (item) => this._scanHomeCard(item),
          this._homeBatchSize,
          this._batchDelay,
        );
        this._stopEta();
        showStatus({ state: "success", text: "Home scan complete", autohideMs: 4000 });
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
    const cached = await readCache(homeCacheKey(animeSession), this._cacheTtlMs);
    if (cached) {
      this._addHomeBadge(anchor, cached.dubs, cached.total);
      this._itemCompleted();
      return { cached: true, hasDub: cached.dubs > 0 };
    }

    this._setSpinner(anchor, true);
    let hasDub = false;
    try {
      const stats = await this._fetchAnimeStats(animeSession);
      if (stats) {
        await writeCache(homeCacheKey(animeSession), stats);
        this._addHomeBadge(anchor, stats.dubs, stats.total);
        hasDub = stats.dubs > 0;
      }
    } catch (err) {
      if (err?.rateLimited) {
        delete anchor.dataset.apeDubDone;
        // Back off for a while instead of rescanning on the next DOM change.
        this._homeCooldownUntil = Date.now() + 90_000;
      }
    } finally {
      this._setSpinner(anchor, false);
    }

    this._itemCompleted();
    return { cached: false, hasDub };
  }

  async _fetchAnimeStats(animeSession) {
    let data;
    try {
      data = await this._apiFetch(
        `/api?m=release&id=${animeSession}&sort=episode_asc&page=1`,
        true,
      );
    } catch (err) {
      if (err?.rateLimited) throw err;
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

    const reqsBeforeInitial = this._reqCompleted;
    const [firstDubbed, lastDubbed] = await Promise.all([
      check(0),
      check(eps.length - 1),
    ]);
    const initialWasCached = this._reqCompleted === reqsBeforeInitial;

    if (!firstDubbed) return 0;
    if (lastDubbed) return eps.length;

    if (!initialWasCached) {
      await this._delay(this._batchDelay);
    }

    // Dubs are almost always a contiguous run starting at the oldest
    // episode, with only the most recent handful still sub-only, so gallop
    // backward from the newest episode -- one request at a time, never in
    // parallel -- to find that cutoff quickly without bursting the API.
    const searchId = ++this._searchIdCounter;
    let notDubbedIdx = eps.length - 1;
    let dubbedIdx = 0;
    let step = 1;
    this._activeSearches.set(searchId, notDubbedIdx - dubbedIdx);
    this._tickEta();

    let cursor = notDubbedIdx - step;
    while (cursor > dubbedIdx) {
      if (await check(cursor)) {
        dubbedIdx = cursor;
        break;
      }
      notDubbedIdx = cursor;
      step *= 2;
      cursor = notDubbedIdx - step;
      this._activeSearches.set(searchId, notDubbedIdx - dubbedIdx);
      this._tickEta();
    }

    // Binary search narrows the now-small remaining bracket to the exact
    // split, still one request at a time.
    let left = dubbedIdx;
    let right = notDubbedIdx;
    while (right - left > 1) {
      const mid = Math.floor((left + right) / 2);
      if (await check(mid)) left = mid;
      else right = mid;
      this._activeSearches.set(searchId, right - left);
      this._tickEta();
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

  _ensureRelative(el) {
    if (getComputedStyle(el).position === "static")
      el.style.setProperty("position", "relative", "important");
  }

  _addEpBadge(el, epSession = "") {
    if (el.querySelector(".ape-dub-badge")) return;
    const badge = document.createElement("span");
    badge.className = "ape-dub-badge ape-dub-badge-ep";
    badge.dataset.apeEp = epSession;
    badge.append(micIcon(11), document.createTextNode("DUB"));
    this._ensureRelative(el);
    el.appendChild(badge);
  }

  _addSubEpBadge(el, epSession = "") {
    if (el.querySelector(".ape-dub-badge")) return;
    const badge = document.createElement("span");
    badge.className = "ape-dub-badge ape-sub-badge-ep";
    badge.dataset.apeEp = epSession;
    badge.textContent = "SUB ONLY";
    this._ensureRelative(el);
    el.appendChild(badge);
  }

  _addHomeBadge(el, dubs, total) {
    if (el.querySelector(".ape-dub-badge-home")) return;
    const badge = document.createElement("span");
    badge.className = "ape-dub-badge ape-dub-badge-home";

    if (dubs > 0) {
      badge.title = `${dubs} of ${total} episodes dubbed`;
      const meter = document.createElement("span");
      meter.className = "ape-dub-meter";
      const fill = document.createElement("b");
      fill.style.setProperty(
        "width",
        `${Math.min(100, Math.round((dubs / Math.max(1, total)) * 100))}%`,
        "important",
      );
      meter.appendChild(fill);
      badge.append(micIcon(11), document.createTextNode(`${dubs}/${total}`), meter);
    } else {
      badge.textContent = "SUB ONLY";
      badge.classList.add("ape-sub-badge-home");
    }

    this._ensureRelative(el);
    el.appendChild(badge);
  }

  _setSpinner(el, on) {
    if (on) {
      if (el.querySelector(".ape-dub-spin")) return;
      const chip = document.createElement("span");
      chip.className = "ape-dub-spin";
      const ring = document.createElement("i");
      ring.className = "ape-dub-ring";
      chip.append(ring, document.createTextNode("SCANNING"));
      this._ensureRelative(el);
      el.appendChild(chip);
    } else {
      el.querySelector(".ape-dub-spin")?.remove();
    }
  }

  /** "6 of 9 dubbed" + segmented bar, appended to the "Episodes (N)" heading. */
  _renderSummary(dubCount, total) {
    document.querySelectorAll(".ape-dub-summary").forEach((n) => n.remove());
    if (!total) return;
    const host = this._findEpisodesHeading();
    if (!host) return;

    const summary = document.createElement("span");
    summary.className = "ape-dub-summary";
    summary.title = `${dubCount} of ${total} episodes on this page have an English dub`;

    const bar = document.createElement("span");
    bar.className = "ape-dub-seg";
    bar.setAttribute("aria-hidden", "true");
    const segs = Math.min(total, 30);
    const on = Math.round((dubCount / total) * segs);
    for (let i = 0; i < segs; i++) {
      const seg = document.createElement("i");
      if (i < on) seg.className = "on";
      bar.appendChild(seg);
    }

    summary.append(micIcon(13), document.createTextNode(`${dubCount} of ${total} dubbed`), bar);
    host.appendChild(summary);
  }

  _findEpisodesHeading() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (/^\s*Episodes\s*\(\d+\)\s*$/i.test(node.nodeValue)) {
        const el = node.parentElement;
        if (el && !el.closest("#ape-cw-section")) return el;
      }
    }
    return null;
  }

  async _apiFetch(url, wantJson = true) {
    const result = await throttler.fetch(url, wantJson);
    this._reqCompleted++;
    this._tickEta();
    return result;
  }

  async _isEpisodeDubbed(animeSession, epSession) {
    const cached = await readCache(epCacheKey(epSession), this._cacheTtlMs);
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
      // Rate limited / Cloudflare challenge: we know nothing about this
      // episode. Never report it as "not dubbed" — let the scan abort and
      // retry later.
      if (err?.rateLimited) throw err;
    }

    if (dubbed === null) {
      try {
        dubbed = await this._checkDubViaHtml(animeSession, epSession);
      } catch (err) {
        if (err?.rateLimited) throw err;
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

/* ═══════════════════════════════════════════════════════════════════════════
   Animepahe Enhancer — Main Content Script  v1.0.0
   Runs on: animepahe.pw (and all official mirrors)
   Features:
     • Continue Watching  — records progress, shows resume section on home
     • DUB Detector       — tags dubbed episodes with colour-coded badges
   Author:  https://github.com/abdullahkhfb
   License: MIT
   ═══════════════════════════════════════════════════════════════════════════ */

(async function () {
  "use strict";

  // ─── Guard: don't run inside iframes on the animepahe domain ──────────────
  if (window.self !== window.top) return;

  // ══════════════════════════════════════════════════════════════════════════
  //  STORAGE HELPERS  (chrome.storage.local, Promise-wrapped)
  // ══════════════════════════════════════════════════════════════════════════

  function stGet(key) {
    return new Promise((res) =>
      chrome.storage.local.get([key], (r) => res(r[key] ?? null)),
    );
  }

  function stSet(key, val) {
    return new Promise((res) => chrome.storage.local.set({ [key]: val }, res));
  }

  function stRemove(key) {
    return new Promise((res) => chrome.storage.local.remove(key, res));
  }

  function stGetAll() {
    return new Promise((res) => chrome.storage.local.get(null, res));
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SETTINGS
  // ══════════════════════════════════════════════════════════════════════════

  const DEFAULT_SETTINGS = { dubEnabled: true, cwEnabled: true };

  async function loadSettings() {
    const saved = await stGet("ape_settings");
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
  }

  const settings = await loadSettings();

  // ══════════════════════════════════════════════════════════════════════════
  //  SHARED UTILITIES
  // ══════════════════════════════════════════════════════════════════════════

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** HTML-escape a string for safe injection */
  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }

  /** Convert a possibly-relative href to an absolute URL */
  function toAbsolute(href) {
    if (!href) return "";
    if (/^https?:\/\//i.test(href)) return href;
    return window.location.origin + (href.startsWith("/") ? "" : "/") + href;
  }

  /**
   * Calls cb(element) as soon as selector is found in the DOM,
   * with optional fallback selector and max-wait timeout.
   */
  function waitForElement(selector, cb, opts = {}) {
    const { fallbackSelector = "", maxWait = 8000 } = opts;
    const immediate = document.querySelector(selector);
    if (immediate) {
      cb(immediate);
      return;
    }

    let fired = false;
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        fired = true;
        obs.disconnect();
        cb(el);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => {
      obs.disconnect();
      if (fired) return;
      const fallback =
        fallbackSelector && document.querySelector(fallbackSelector);
      if (fallback) cb(fallback);
    }, maxWait);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  STATUS PILL  (fixed overlay, bottom-right)
  // ══════════════════════════════════════════════════════════════════════════

  const pill = (() => {
    const el = document.createElement("div");
    el.id = "ape-pill";
    Object.assign(el.style, {
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
    document.body.appendChild(el);

    let _timer;
    return {
      show(text, autohideMs = 0) {
        clearTimeout(_timer);
        el.textContent = text;
        el.style.opacity = "1";
        if (autohideMs > 0)
          _timer = setTimeout(() => (el.style.opacity = "0"), autohideMs);
      },
      hide() {
        clearTimeout(_timer);
        el.style.opacity = "0";
      },
    };
  })();

  // ══════════════════════════════════════════════════════════════════════════
  //  FEATURE: DUB DETECTOR
  // ══════════════════════════════════════════════════════════════════════════

  if (settings.dubEnabled) {
    initDubDetector().catch(console.error);
  }

  async function initDubDetector() {
    const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
    const BATCH_SIZE = 3;
    const log = (...a) => console.debug("[APE·DUB]", ...a);
    const warn = (...a) => console.warn("[APE·DUB]", ...a);

    // ── Styles ───────────────────────────────────────────────────────────────
    if (!document.getElementById("ape-dub-styles")) {
      const style = document.createElement("style");
      style.id = "ape-dub-styles";
      style.textContent = `
        @keyframes ape-dub-spin { to { transform: rotate(360deg); } }

        .ape-dub-badge,
        .ape-dub-badge-home {
          position:      absolute !important;
          top:           5px     !important;
          right:         5px     !important;
          left:          auto    !important;
          z-index:       9999    !important;
          color:         #fff    !important;
          font:          700 10px/1 system-ui, sans-serif !important;
          padding:       3px 7px !important;
          border-radius: 3px     !important;
          letter-spacing:.5px   !important;
          pointer-events:none   !important;
          box-shadow:    0 1px 5px rgba(0,0,0,.65) !important;
          display:       inline-block !important;
          text-indent:   0 !important;
          white-space:   nowrap !important;
        }
        .ape-dub-badge      { background: #e8710a !important; }
        .ape-dub-badge-home { background: #d92558 !important; }

        .ape-dub-spin {
          position:      absolute !important;
          top:           7px !important;
          right:         7px !important;
          z-index:       9999 !important;
          width:         10px !important;
          height:        10px !important;
          border-radius: 50%  !important;
          pointer-events:none !important;
          border:        2px solid rgba(255,255,255,.25) !important;
          border-top-color: #fff !important;
          animation:     ape-dub-spin .7s linear infinite !important;
        }
      `;
      document.head.appendChild(style);
    }

    // ── Cache helpers ────────────────────────────────────────────────────────

    async function cacheGet(key) {
      try {
        const raw = await stGet(key);
        if (!raw || typeof raw !== "string" || !raw.includes("|"))
          return undefined;
        const sep = raw.indexOf("|");
        const ts = parseInt(raw.slice(0, sep), 10);
        if (Date.now() - ts > CACHE_TTL) {
          stRemove(key);
          return undefined;
        }
        return JSON.parse(raw.slice(sep + 1));
      } catch {
        return undefined;
      }
    }

    async function cacheSet(key, val) {
      await stSet(key, `${Date.now()}|${JSON.stringify(val)}`);
    }

    // Garbage-collect stale DUB cache entries after 3 s
    setTimeout(async () => {
      try {
        const all = await stGetAll();
        const now = Date.now();
        let n = 0;
        for (const [k, v] of Object.entries(all)) {
          if (!k.startsWith("d2_") && !k.startsWith("h2_")) continue;
          const ts =
            typeof v === "string" && v.includes("|")
              ? parseInt(v.slice(0, v.indexOf("|")), 10)
              : 0;
          if (!ts || now - ts > CACHE_TTL) {
            stRemove(k);
            n++;
          }
        }
        if (n) log(`GC removed ${n} stale entries`);
      } catch {}
    }, 3000);

    // ── Network helpers ──────────────────────────────────────────────────────

    async function apiFetch(url, wantJson = true) {
      await sleep(150); // gentle throttle
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

    // ── Dub-detection methods ────────────────────────────────────────────────

    /** Method A: lightweight JSON API check */
    async function checkViaLinksAPI(animeSession, epSession) {
      const data = await apiFetch(
        `/api?m=links&id=${animeSession}&session=${epSession}&p=kwik`,
      );
      const s = JSON.stringify(data).toLowerCase();
      return (
        s.includes('"eng"') || s.includes('"english"') || s.includes('"dub"')
      );
    }

    /** Method B: parse the play-page HTML as fallback */
    async function checkViaPlayPage(animeSession, epSession) {
      const html = await apiFetch(`/play/${animeSession}/${epSession}`, false);
      const doc = new DOMParser().parseFromString(html, "text/html");

      // Check known UI containers
      const area =
        doc.getElementById("pickDownload") || doc.getElementById("scrollArea");
      if (area) {
        const txt = area.textContent;
        if (
          /\bEng\b/i.test(txt) ||
          /english/i.test(txt) ||
          /\bdub\b/i.test(txt)
        )
          return true;
      }

      // Check inline scripts for audio flags
      for (const s of doc.querySelectorAll("script:not([src])")) {
        const t = s.textContent || "";
        if (t.includes("audio") && /['"](eng|english|dub)['"]/i.test(t))
          return true;
      }

      // Raw string scan
      const idx = html.toLowerCase().indexOf('"audio"');
      if (
        idx !== -1 &&
        /eng|english|dub/.test(html.slice(idx, idx + 32).toLowerCase())
      )
        return true;

      return false;
    }

    /** Orchestrator — tries API first, falls back to HTML parse */
    async function isEpisodeDubbed(animeSession, epSession) {
      const cKey = `d2_${epSession}`;
      const hit = await cacheGet(cKey);
      if (hit !== undefined) return hit;

      let dubbed = false;
      try {
        dubbed = await checkViaLinksAPI(animeSession, epSession);
      } catch (e) {
        warn("API check failed:", e.message);
      }

      if (!dubbed) {
        try {
          dubbed = await checkViaPlayPage(animeSession, epSession);
        } catch (e) {
          warn("Play-page check failed:", e.message);
        }
      }

      await cacheSet(cKey, dubbed);
      return dubbed;
    }

    /**
     * Binary-search through eps[] (oldest first) to find how many
     * episodes from the start are dubbed. Assumes dubbed eps form a
     * leading contiguous block (which is always the case on AnimePahe).
     */
    async function findDubCountBinary(animeSession, eps) {
      if (!eps.length) return 0;
      const sess = (ep) => ep.session || ep.anime_session;

      const firstDubbed = await isEpisodeDubbed(animeSession, sess(eps[0]));
      if (!firstDubbed) return 0;

      const lastDubbed = await isEpisodeDubbed(
        animeSession,
        sess(eps[eps.length - 1]),
      );
      if (lastDubbed) return eps.length;

      let lo = 0,
        hi = eps.length - 1,
        best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (await isEpisodeDubbed(animeSession, sess(eps[mid]))) {
          best = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      return best + 1;
    }

    // ── DOM helpers ──────────────────────────────────────────────────────────

    function ensureRelative(el) {
      if (getComputedStyle(el).position === "static")
        el.style.setProperty("position", "relative", "important");
    }

    function addEpBadge(anchor) {
      if (anchor.querySelector(".ape-dub-badge")) return;
      const b = document.createElement("span");
      b.className = "ape-dub-badge";
      b.textContent = "DUB";
      anchor.appendChild(b);
    }

    function addHomeBadge(anchor, text) {
      if (anchor.querySelector(".ape-dub-badge-home")) return;
      const b = document.createElement("span");
      b.className = "ape-dub-badge-home";
      b.textContent = text;
      anchor.appendChild(b);
    }

    function setSpinner(anchor, on) {
      if (on) {
        if (anchor.querySelector(".ape-dub-spin")) return;
        const s = document.createElement("span");
        s.className = "ape-dub-spin";
        anchor.appendChild(s);
      } else {
        anchor.querySelector(".ape-dub-spin")?.remove();
      }
    }

    // ── Routing ──────────────────────────────────────────────────────────────

    const path = location.pathname;

    // ── /anime/{session} — Episode list page ─────────────────────────────────
    const animeMatch = path.match(/^\/anime\/([^/?#]+)/);
    if (animeMatch) {
      const animeSession = animeMatch[1];
      let busy = false;

      async function scanEpisodes() {
        if (busy) return;
        busy = true;

        // Collect unscanned episode anchors (reversed = oldest first)
        let anchors = [
          ...document.querySelectorAll(`a[href*="/play/${animeSession}/"]`),
        ];
        if (!anchors.length) {
          anchors = [...document.querySelectorAll('a[href*="/play/"]')].filter(
            (a) => /\/play\/[^/]+\/[^/]+/.test(a.getAttribute("href") || ""),
          );
        }
        anchors.reverse();

        const work = anchors.reduce((acc, a) => {
          if (a.dataset.apeDubDone) return acc;
          const m = (a.getAttribute("href") || "").match(
            /\/play\/[^/]+\/([^/?#]+)/,
          );
          if (m) {
            a.dataset.apeDubDone = "1";
            acc.push({ anchor: a, epSession: m[1] });
          }
          return acc;
        }, []);

        if (!work.length) {
          busy = false;
          return;
        }

        pill.show("🎙 DUB: scanning…");

        // Binary-search the visible episode cards
        let topDubIdx = -1;

        const first = await isEpisodeDubbed(animeSession, work[0].epSession);
        if (first) {
          const last = await isEpisodeDubbed(
            animeSession,
            work[work.length - 1].epSession,
          );
          if (last) {
            topDubIdx = work.length - 1;
          } else {
            let lo = 0,
              hi = work.length - 1;
            while (lo <= hi) {
              const mid = (lo + hi) >> 1;
              if (await isEpisodeDubbed(animeSession, work[mid].epSession)) {
                topDubIdx = mid;
                lo = mid + 1;
              } else hi = mid - 1;
            }
          }
        }

        let dubbed = 0;
        for (let i = 0; i <= topDubIdx; i++) {
          ensureRelative(work[i].anchor);
          addEpBadge(work[i].anchor);
          dubbed++;
        }

        pill.show(
          dubbed > 0
            ? `🎙 DUB: ${dubbed} episode${dubbed !== 1 ? "s" : ""} dubbed ✓`
            : "🎙 DUB: no dub found",
          4500,
        );
        busy = false;
      }

      await scanEpisodes();

      new MutationObserver(() => {
        if (!busy) {
          clearTimeout(window._apeDubT);
          window._apeDubT = setTimeout(scanEpisodes, 500);
        }
      }).observe(document.body, { childList: true, subtree: true });

      return; // anime page handled — skip home logic
    }

    // ── /play/{animeSession}/{epSession} — Player page ────────────────────────
    const playMatch = path.match(/^\/play\/([^/?#]+)\/([^/?#]+)/);
    if (playMatch) {
      const [, animeSession, epSession] = playMatch;
      pill.show("🎙 DUB: checking…");

      const dubbed = await isEpisodeDubbed(animeSession, epSession);

      if (dubbed) {
        const h1 = document.querySelector("h1");
        if (h1) {
          const badge = document.createElement("span");
          badge.textContent = "DUB";
          badge.style.cssText =
            "background:#e8710a;color:#fff;font:700 11px system-ui,sans-serif;" +
            "padding:3px 9px;border-radius:3px;margin-left:10px;" +
            "vertical-align:middle;display:inline-block;" +
            "box-shadow:0 1px 5px rgba(0,0,0,.5);letter-spacing:.5px;";
          h1.appendChild(badge);
        }
        pill.show("🎙 DUB: Dubbed ✓", 5000);
      } else {
        pill.show("🎙 DUB: Sub only", 4000);
      }

      return; // play page handled
    }

    // ── Home page — Latest Releases grid ─────────────────────────────────────
    if (/^\/?$|^\/home/.test(path)) {
      let busy = false;

      async function scanHomeCards() {
        if (busy) return;
        busy = true;

        const work = [];
        for (const a of document.querySelectorAll(
          'a[href*="/anime/"], a[href*="/play/"]',
        )) {
          if (a.closest("#ape-cw-section")) continue;

          if (a.dataset.apeDubDone) continue;
          const href = a.getAttribute("href") || "";
          const m = href.match(/(?:\/anime\/|\/play\/)([^/?#]+)/);
          if (!m) continue;
          a.dataset.apeDubDone = "1";

          // Walk up to find the image container
          let target = a;
          let img = a.querySelector("img");
          if (!img) {
            let p = a.parentElement,
              d = 0;
            while (p && d < 4) {
              img = p.querySelector("img");
              if (img) break;
              p = p.parentElement;
              d++;
            }
          }
          if (!img) continue;
          target = img.closest("a") || img.parentElement;
          ensureRelative(target);
          work.push({ anchor: target, animeSession: m[1] });
        }

        if (!work.length) {
          busy = false;
          return;
        }

        pill.show("🎙 DUB: scanning home…");

        for (let i = 0; i < work.length; i += BATCH_SIZE) {
          await Promise.all(
            work
              .slice(i, i + BATCH_SIZE)
              .map(async ({ anchor, animeSession }) => {
                setSpinner(anchor, true);

                const hKey = `h2_${animeSession}`;
                let stats = await cacheGet(hKey);

                if (stats === undefined) {
                  try {
                    const rel = await apiFetch(
                      `/api?m=release&id=${animeSession}&sort=episode_asc&page=1`,
                    );
                    const eps = Array.isArray(rel.data)
                      ? rel.data
                      : Object.values(rel.data || {});
                    const total = rel.total || eps.length;
                    const dubs = await findDubCountBinary(animeSession, eps);
                    stats = { dubs, total };
                    await cacheSet(hKey, stats);
                  } catch (e) {
                    warn("Home card error:", animeSession, e.message);
                    setSpinner(anchor, false);
                    return;
                  }
                }

                setSpinner(anchor, false);
                if (stats?.dubs > 0)
                  addHomeBadge(anchor, `${stats.dubs}/${stats.total}`);
              }),
          );
        }

        pill.show("🎙 DUB: scan complete ✓", 4000);
        busy = false;
      }

      await scanHomeCards();

      new MutationObserver(() => {
        if (!busy) {
          clearTimeout(window._apeHomeT);
          window._apeHomeT = setTimeout(scanHomeCards, 600);
        }
      }).observe(document.body, { childList: true, subtree: true });
    }
  } // ── end initDubDetector ──────────────────────────────────────────────────

  // ══════════════════════════════════════════════════════════════════════════
  //  FEATURE: CONTINUE WATCHING
  // ══════════════════════════════════════════════════════════════════════════

  if (settings.cwEnabled) {
    initContinueWatching();
  }

  function initContinueWatching() {
    const CW_KEY = "ape_cw_v1";
    const MAX_ITEMS = 24;

    // ── List helpers ─────────────────────────────────────────────────────────

    async function getList() {
      const raw = await stGet(CW_KEY);
      try {
        return JSON.parse(raw || "[]");
      } catch {
        return [];
      }
    }

    async function saveList(list) {
      await stSet(CW_KEY, JSON.stringify(list));
    }

    async function upsert(item) {
      let list = await getList();
      const prev = list.find((e) => e.playUrl === item.playUrl);
      if (prev) {
        item.progress = prev.progress || 0;
        item.duration = prev.duration || 0;
      }
      list = list.filter((e) => e.playUrl !== item.playUrl);
      list.unshift(item);
      if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
      await saveList(list);
    }

    async function removeItem(playUrl) {
      await saveList((await getList()).filter((e) => e.playUrl !== playUrl));
    }

    async function clearAll() {
      await saveList([]);
    }

    // ── Routing ──────────────────────────────────────────────────────────────

    const path = location.pathname;

    if (path === "/" || path === "") {
      waitForElement(
        '#latest-release, .latest-release, [id*="latest"], [class*="latest"]',
        handleHome,
        { fallbackSelector: ".content-wrapper, main, #content, body > div" },
      );
    } else if (path.startsWith("/play/")) {
      waitForElement(".theatre-info", handlePlay, { maxWait: 10000 });
    }

    // ── Play page: record visit and bridge iframe messages ────────────────────

    async function handlePlay() {
      const parts = path.split("/").filter(Boolean);
      const animeSession = parts[1];
      const episodeSession = parts[2];
      if (!animeSession || !episodeSession) return;

      // Extract metadata from the DOM
      const h1 = document.querySelector(".theatre-info h1");
      const linkEl = h1?.querySelector("a");

      const animeName = linkEl ? linkEl.textContent.trim() : document.title;
      const animeHref = linkEl
        ? toAbsolute(linkEl.getAttribute("href") || "")
        : "";

      const heading = h1 ? h1.textContent.trim() : "";
      const afterName = heading
        .slice(animeName.length)
        .replace(/^[\s\-–—]+/, "");
      const epNumMatch = afterName.match(/(\d+(?:\.\d+)?)/);
      const episodeNum = epNumMatch ? epNumMatch[1] : "?";

      const posterEl = document.querySelector(".anime-poster");
      let poster = posterEl
        ? posterEl.getAttribute("src") ||
          posterEl.getAttribute("data-src") ||
          ""
        : "";
      poster = poster.replace(/\.th\.(jpe?g|png|webp)$/i, ".$1");

      // We no longer blindly save here! We wait for the video to start.
      let sessionUpserted = false;

      // ── Communicate with the embedded video player iframe ─────────────────
      window.addEventListener("message", async (e) => {
        if (!e.data?.type) return;

        // Iframe asking for saved timestamp
        if (e.data.type === "AP_CW_REQUEST_TIME") {
          const list = await getList();
          const current = list.find(
            (it) => it.playUrl === window.location.href,
          );
          if (current?.progress && e.source) {
            e.source.postMessage(
              { type: "AP_CW_RESTORE_TIME", time: current.progress },
              "*",
            );
          }

          // Iframe reporting current playback position (VIDEO IS PLAYING)
        } else if (e.data.type === "AP_CW_UPDATE_TIME") {
          const list = await getList();

          const idx = list.findIndex((it) => it.animeSession === animeSession);

          if (idx !== -1) {
            // 2A. We found the anime. Is it the exact SAME episode?
            if (list[idx].episodeSession === episodeSession) {
              list[idx].progress = e.data.time;
              list[idx].duration = e.data.duration;

              // Move to the front of the list only once per page load
              if (!sessionUpserted) {
                const [item] = list.splice(idx, 1);
                item.timestamp = Date.now();
                list.unshift(item);
                sessionUpserted = true;
              }
              await saveList(list);
            } else {
              const newItem = {
                playUrl: window.location.href,
                animeSession,
                episodeSession,
                animeName,
                animeHref,
                episodeNum,
                poster,
                timestamp: Date.now(),
                progress: e.data.time,
                duration: e.data.duration,
              };

              list.splice(idx, 1);
              list.unshift(newItem);

              if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
              await saveList(list);
              sessionUpserted = true;
            }
          } else {
            // 3. First time playing ANY episode of this anime! Add it.
            const newItem = {
              playUrl: window.location.href,
              animeSession,
              episodeSession,
              animeName,
              animeHref,
              episodeNum,
              poster,
              timestamp: Date.now(),
              progress: e.data.time,
              duration: e.data.duration,
            };

            list.unshift(newItem);
            if (list.length > MAX_ITEMS) list.length = MAX_ITEMS;
            await saveList(list);
            sessionUpserted = true;
          }
        }
      });
    }

    // ── Home page: render "Continue Watching" section with Show More/Less ─────
    async function handleHome(anchor) {
      const list = await getList();
      if (!list.length) return;

      injectCwStyles();

      const section = document.createElement("section");
      section.id = "ape-cw-section";

      // Determine if we need a toggle button (e.g., if more than 6 items)
      const SHOW_LIMIT = 6;
      const needsToggle = list.length > SHOW_LIMIT;

      section.innerHTML = `
        <div class="ape-cw-header">
          <h2 class="ape-cw-heading">
            <svg class="ape-cw-heading-icon" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2ZM9 7l4.5 3L9 13V7Z"/>
            </svg>
            Continue Watching
          </h2>
          <div class="ape-cw-controls">
            ${needsToggle ? `<button id="ape-cw-toggle" class="ape-cw-util-btn">Show More</button>` : ""}
            <button id="ape-cw-clear" class="ape-cw-util-btn danger" title="Clear all history">Clear All</button>
          </div>
        </div>
        <div class="ape-cw-grid ${needsToggle ? "collapsed" : ""}" id="ape-cw-grid"></div>
      `;

      const grid = section.querySelector("#ape-cw-grid");
      list.forEach((item) =>
        grid.appendChild(buildCard(item, removeItem, grid, section)),
      );

      // Toggle Logic
      if (needsToggle) {
        const toggleBtn = section.querySelector("#ape-cw-toggle");
        toggleBtn.addEventListener("click", () => {
          const isCollapsed = grid.classList.toggle("collapsed");
          toggleBtn.textContent = isCollapsed ? "Show More" : "Show Less";
        });
      }

      // Clear All Logic
      section
        .querySelector("#ape-cw-clear")
        .addEventListener("click", async (e) => {
          e.preventDefault();
          if (!confirm('Clear your entire "Continue Watching" list?')) return;
          await clearAll();
          section.classList.add("ape-cw-remove-anim");
          section.addEventListener("animationend", () => section.remove(), {
            once: true,
          });
        });

      const target = anchor || document.querySelector("#latest-release");
      if (target?.parentNode) target.parentNode.insertBefore(section, target);
    }

    // ── Card builder ─────────────────────────────────────────────────────────

    function buildCard(item, removeFn, grid, section) {
      const card = document.createElement("div");
      card.className = "ape-cw-card";
      card.dataset.url = item.playUrl;

      const safeTitle = esc(item.animeName);
      const safeUrl = esc(item.playUrl);
      const safePoster = esc(item.poster);
      const safeEp = esc(String(item.episodeNum));

      let progressHtml = "";
      if (item.progress && item.duration) {
        const pct = Math.min(
          100,
          Math.max(0, (item.progress / item.duration) * 100),
        ).toFixed(1);
        progressHtml = `
          <div class="ape-cw-prog-bg">
            <div class="ape-cw-prog-bar" style="width:${pct}%"></div>
          </div>`;
      }

      card.innerHTML = `
        <a href="${safeUrl}" class="ape-cw-link" title="${safeTitle} — Episode ${safeEp}">
          <div class="ape-cw-thumb-wrap">
            <img src="${safePoster}" alt="${safeTitle}" class="ape-cw-thumb" loading="lazy"
                 onerror="this.style.display='none'">
            <div class="ape-cw-overlay" aria-hidden="true">
              <svg class="ape-cw-play-icon" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="40" r="34"
                  fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.88)" stroke-width="3"/>
                <polygon points="31,22 59,40 31,58" fill="rgba(255,255,255,.92)"/>
              </svg>
            </div>
            <span class="ape-cw-ep-badge">EP&thinsp;${safeEp}</span>
            ${progressHtml}
          </div>
          <div class="ape-cw-info">
            <span class="ape-cw-title">${safeTitle}</span>
          </div>
        </a>
        <button class="ape-cw-remove-btn" type="button"
                title="Remove from Continue Watching"
                aria-label="Remove ${safeTitle}">✕</button>
      `;

      card
        .querySelector(".ape-cw-remove-btn")
        .addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await removeFn(item.playUrl);
          card.classList.add("ape-cw-pop-out");
          card.addEventListener(
            "animationend",
            () => {
              card.remove();
              if (grid && grid.children.length === 0) section?.remove();
            },
            { once: true },
          );
        });

      return card;
    }

    // ── Styles ───────────────────────────────────────────────────────────────

    function injectCwStyles() {
      if (document.getElementById("ape-cw-styles")) return;
      const s = document.createElement("style");
      s.id = "ape-cw-styles";
      s.textContent = `
        /* ── Section wrapper ── */
        #ape-cw-section {
          padding: 32px 15px 10px;
          box-sizing: border-box;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto 6px;
        }

        /* ── Header ── */
        .ape-cw-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .ape-cw-heading {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.35rem;
          font-weight: 700;
          color: #f2f2f2;
          margin: 0;
          letter-spacing: .01em;
        }
        .ape-cw-heading-icon {
          width: 20px;
          height: 20px;
          color: #d92558;
          flex-shrink: 0;
        }
        .ape-cw-clear-btn {
          background: rgba(255,255,255,.07);
          color: #c0c0d8;
          border: 1px solid rgba(255,255,255,.1);
          padding: 5px 13px;
          border-radius: 5px;
          font-size: .82rem;
          font-weight: 600;
          cursor: pointer;
          transition: background .2s, color .2s, border-color .2s;
        }
        .ape-cw-clear-btn:hover {
          background: #d92558;
          color: #fff;
          border-color: transparent;
        }

        /* ── Grid Layout ── */
        .ape-cw-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
          align-items: start;
        }

        /* ── Grid Toggle Logic ── */
        .ape-cw-grid.collapsed {
          max-height: 320px; /* Adjust based on your card height */
          overflow: hidden;
        }

        .ape-cw-controls {
          display: flex;
          gap: 8px;
        }

        .ape-cw-util-btn {
          background: rgba(255,255,255,.07);
          color: #c0c0d8;
          border: 1px solid rgba(255,255,255,.1);
          padding: 5px 13px;
          border-radius: 5px;
          font-size: .82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all .2s;
        }

        .ape-cw-util-btn:hover {
          background: rgba(255,255,255,.15);
          color: #fff;
        }

        .ape-cw-util-btn.danger:hover {
          background: #c0392b;
          border-color: transparent;
        }

        /* ── Card ── */
        .ape-cw-card {
          position: relative;
          border-radius: 7px;
          overflow: hidden;
          background: #0c0c1e;
          transition: transform .22s ease, box-shadow .22s ease;
          will-change: transform;
        }
        .ape-cw-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 32px rgba(0,0,0,.75);
          z-index: 3;
        }
        .ape-cw-link {
          display: block;
          text-decoration: none;
          color: inherit;
          outline-offset: 3px;
        }

        /* ── Thumbnail ── */
        .ape-cw-thumb-wrap {
          position: relative;
          aspect-ratio: 2 / 3;
          overflow: hidden;
          background: #111128;
        }
        .ape-cw-thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: top center;
          display: block;
          transition: transform .35s ease;
        }
        .ape-cw-card:hover .ape-cw-thumb { transform: scale(1.07); }

        /* ── Play overlay ── */
        .ape-cw-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,.15);
          opacity: 0;
          transition: opacity .2s;
        }
        .ape-cw-card:hover .ape-cw-overlay { opacity: 1; }
        .ape-cw-play-icon {
          width: 52px;
          height: 52px;
          filter: drop-shadow(0 2px 10px rgba(0,0,0,.8));
          transition: transform .2s;
        }
        .ape-cw-card:hover .ape-cw-play-icon { transform: scale(1.13); }

        /* ── Episode badge ── */
        .ape-cw-ep-badge {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background: rgba(0,0,0,.8);
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 7px;
          border-radius: 4px;
          letter-spacing: .05em;
          line-height: 1;
          pointer-events: none;
          user-select: none;
          z-index: 6;
        }

        /* ── Progress bar ── */
        .ape-cw-prog-bg {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: rgba(0,0,0,.45);
          z-index: 5;
        }
        .ape-cw-prog-bar {
          height: 100%;
          background: #e74c3c;
          box-shadow: 0 0 6px rgba(231,76,60,.45);
          transition: width .3s ease;
        }

        /* ── Info row ── */
        .ape-cw-info { padding: 7px 9px 9px; }
        .ape-cw-title {
          display: block;
          font-size: 11.5px;
          color: #e8e8f8
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.5;
          transition: color .15s;
        }
        .ape-cw-card:hover .ape-cw-title { color: #e8e8f8; }

        /* ── Remove button ── */
        .ape-cw-remove-btn {
          position: absolute;
          top: 7px;
          right: 7px;
          z-index: 10;
          width: 24px;
          height: 24px;
          padding: 0;
          border-radius: 50%;
          border: none;
          background: rgba(12, 12, 28, .85);
          color: #d0d0e8;
          font-size: 12px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transform: scale(.7);
          transition: opacity .18s, transform .18s, background .15s, color .15s;
        }
        .ape-cw-card:hover .ape-cw-remove-btn { opacity: 1; transform: scale(1); }
        .ape-cw-remove-btn:hover {
          background: #c0392b !important;
          color: #fff !important;
          transform: scale(1.1) !important;
        }

        /* ── Animations ── */
        @keyframes ape-cw-pop-out {
          to { opacity: 0; transform: scale(.78); }
        }
        @keyframes ape-cw-section-out {
          to { opacity: 0; transform: translateY(-12px); }
        }
        .ape-cw-pop-out {
          animation: ape-cw-pop-out .26s ease forwards;
          pointer-events: none;
        }
        .ape-cw-remove-anim {
          animation: ape-cw-section-out .3s ease forwards;
          pointer-events: none;
        }
      `;
      document.head.appendChild(s);
    }
  } // ── end initContinueWatching ─────────────────────────────────────────────
})();

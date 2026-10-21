import { PAGE, getPageType } from "../../helpers/router.js";
import { CW_MAX_ENTRIES, KEYS } from "../../helpers/storage.js";
import { injectStylesheet } from "../../helpers/styles.js";
import { throttler } from "../../helpers/throttler.js";
import { playIcon, closeIcon } from "../../helpers/icons.js";

const MSG = {
  REQUEST_TIME: "AP_CW_REQUEST_TIME",
  RESTORE_TIME: "AP_CW_RESTORE_TIME",
  UPDATE_TIME: "AP_CW_UPDATE_TIME",
};

const SECTION_ID = "ape-cw-section";

// ── Efficiency tuning ────────────────────────────────────────────────────
// Progress arrives every ~2 s; storage is only written this often (plus on
// seeks, episode changes and when the tab is hidden/closed).
const FLUSH_MS = 5_000;
const SEEK_JUMP_S = 10;
// Episode snapshots seen while browsing, kept for when they are needed.
const SNAP_MAX = 300;
const SNAP_SAVE_DEBOUNCE_MS = 2_000;
const HARVEST_DEBOUNCE_MS = 400;

export class ContinueWatching {
  /** @param {import("../../helpers/storage.js").storage} storage */
  constructor(storage, settings = {}) {
    this._storage = storage;
    this._cardsPerPage = settings.cwCardsPerPage ?? 6;
    this._maxEntries = settings.cwMaxEntries ?? CW_MAX_ENTRIES;
    // false = the default compact shelf, true = the old poster-card style
    this._classic = settings.cwClassicLayout === true;
  }

  async init(initialPageType) {
    injectStylesheet(
      "ape-cw-styles",
      "content/features/css/continue-watching.css",
    );
    this._handleRoute();

    let currentUrl = location.href;
    new MutationObserver(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        this._handleRoute();
      }
    }).observe(document.body, { childList: true, subtree: true });

    this._listenForIframe();
    this._startHarvesting();
    this._listenForLayoutChange();
    const flushNow = () => this._flush();
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushNow();
    });
  }

  /** Switch between the default and classic style the moment the popup
   *  toggle changes, without needing a page reload. */
  _listenForLayoutChange() {
    chrome.storage?.onChanged?.addListener((changes, area) => {
      if (area !== "local" || !changes[KEYS.SETTINGS]) return;
      const next = changes[KEYS.SETTINGS].newValue?.cwClassicLayout === true;
      if (next === this._classic) return;
      this._classic = next;
      const section = document.getElementById(SECTION_ID);
      if (!section) return;
      section.classList.toggle("ape-cw-classic", next);
      // The two styles use different images (poster vs. episode still).
      section.querySelectorAll(".ape-cw-card").forEach((card) => {
        const img = card.querySelector(".ape-cw-thumb");
        if (img && card._apeEntry) {
          img.style.display = "";
          img.src = this._imgUrl(card._apeEntry);
        }
      });
      this._applyMatch?.();
    });
  }

  // Every listing (episode list, home "Latest Releases") already renders the
  // episode's snapshot next to its /play/<anime>/<episode> link. Remember
  // those pairs as we browse (pure DOM reading, zero network) so a Continue
  // Watching card can use the right thumbnail without asking the API.

  async _snaps() {
    if (!this._snapMap) {
      const raw = await this._storage.get(KEYS.CW_SNAPSHOTS);
      this._snapMap = raw && typeof raw === "object" ? { ...raw } : {};
    }
    return this._snapMap;
  }

  _startHarvesting() {
    let timer = null;
    const run = () => {
      timer = null;
      this._harvestSnapshots();
    };
    const schedule = () => {
      if (!timer) timer = setTimeout(run, HARVEST_DEBOUNCE_MS);
    };
    schedule();
    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  async _harvestSnapshots() {
    const found = [];
    for (const a of document.querySelectorAll('a[href*="/play/"]')) {
      if (a.closest(`#${SECTION_ID}`)) continue;
      const m = (a.getAttribute("href") || "").match(
        /\/play\/[^/]+\/([^/?#]+)/,
      );
      if (!m) continue;
      const img =
        a.querySelector("img") ||
        a
          .closest(".episode-wrap, .episode, .episode-snapshot")
          ?.querySelector("img");
      const url =
        img?.currentSrc ||
        img?.getAttribute("src") ||
        img?.getAttribute("data-src") ||
        "";
      // Only real episode stills (never the anime poster or a placeholder).
      if (!/\/snapshots\//.test(url)) continue;
      found.push([m[1], url]);
    }
    if (!found.length) return;

    const map = await this._snaps();
    let changed = false;
    for (const [ep, url] of found) {
      if (map[ep] === url) continue;
      delete map[ep]; // re-insert so the most recently seen stay last (LRU)
      map[ep] = url;
      changed = true;
    }
    if (!changed) return;

    const keys = Object.keys(map);
    for (const k of keys.slice(0, Math.max(0, keys.length - SNAP_MAX))) {
      delete map[k];
    }
    clearTimeout(this._snapSaveTimer);
    this._snapSaveTimer = setTimeout(
      () => this._storage.set(KEYS.CW_SNAPSHOTS, map),
      SNAP_SAVE_DEBOUNCE_MS,
    );
  }

  async _handleRoute() {
    const pageType = getPageType();
    if (pageType === PAGE.HOME) {
      await this._renderSection();
    }
  }

  _waitForElement(selector, cb, fallbackSelector = "", maxWait = 8000) {
    const el = document.querySelector(selector);
    if (el) {
      cb(el);
      return;
    }

    let fired = false;
    const obs = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        fired = true;
        obs.disconnect();
        cb(found);
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    setTimeout(() => {
      obs.disconnect();
      if (!fired && fallbackSelector) {
        const fallback = document.querySelector(fallbackSelector);
        if (fallback) cb(fallback);
      }
    }, maxWait);
  }

  async _renderSection() {
    const list = await this._storage.getCwList();
    if (!list.length) return;

    this._waitForElement(
      '#latest-release, .latest-release, [class*="latest"]',
      (target) => {
        if (document.getElementById(SECTION_ID)) return;
        const section = this._buildSection(list);
        target.parentNode.insertBefore(section, target);
        this._matchSite(section, target);
        this._resolveThumbnails(list);
      },
      ".content-wrapper, main, body > div",
    );
  }

  /** Find the "Latest Releases" heading element (it may sit inside or just
   *  above the target container). */
  _findLatestHeading(target) {
    for (const root of [target, target.parentElement]) {
      if (!root) continue;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (/^\s*Latest\s+Releases\s*$/i.test(node.nodeValue)) {
          const el = node.parentElement;
          if (el && !el.closest(`#${SECTION_ID}`)) return el;
        }
      }
    }
    return null;
  }

  /** Copy the site's real heading style and card-grid geometry onto the
   *  shelf so it lines up with Latest Releases whatever the viewport. */
  _matchSite(section, target) {
    const apply = () => {
      if (!section.isConnected) return;

      const heading = this._findLatestHeading(target);
      const ours = section.querySelector(".ape-cw-heading");
      const classic = section.classList.contains("ape-cw-classic");
      if (classic && ours) ours.removeAttribute("style");
      if (!classic && heading && ours) {
        const cs = getComputedStyle(heading);
        for (const prop of [
          "fontFamily",
          "fontSize",
          "fontWeight",
          "lineHeight",
          "letterSpacing",
          "color",
          "textTransform",
        ]) {
          ours.style[prop] = cs[prop];
        }
      }

      const cards = [...target.querySelectorAll("a")]
        .filter((a) => a.querySelector("img") && !a.closest(`#${SECTION_ID}`))
        .map((a) => ({ a, r: a.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0);

      // Reset first so we measure the section's natural position.
      section.style.marginLeft = "";
      section.style.width = "";
      const base = section.getBoundingClientRect();

      let left;
      let right;
      let row = [];
      if (cards.length) {
        cards.sort((x, y) => x.r.top - y.r.top || x.r.left - y.r.left);
        const firstTop = cards[0].r.top;
        row = cards.filter(({ r }) => Math.abs(r.top - firstTop) < 4);
        left = row[0].r.left;
        right = Math.max(...row.map(({ r }) => r.right));
      } else {
        // Cards aren't rendered yet (the site fills Latest Releases in
        // late). Align to the heading / container for now; the observer
        // below re-runs this as soon as the cards appear.
        const anchor = heading || target;
        const ar = anchor.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        if (!(tr.width > 0)) return;
        left = Math.max(ar.left, tr.left);
        right = tr.right;
      }
      if (!(right - left > 0)) return;
      section.style.marginLeft = `${left - base.left}px`;
      section.style.width = `${right - left}px`;

      if (row.length > 1) {
        const gap = row[1].r.left - row[0].r.right;
        if (gap >= 0 && gap < 60)
          section.style.setProperty("--ape-cw-gap", `${gap}px`);
      }
      if (!row.length) return;
      const radius = getComputedStyle(row[0].a).borderRadius;
      if (radius && radius !== "0px")
        section.style.setProperty("--ape-cw-radius", radius);
    };

    this._applyMatch = apply;
    requestAnimationFrame(apply);
    window.addEventListener("load", apply, { once: true });
    window.addEventListener("resize", apply);

    // Latest Releases is rendered/updated after we inject, and the page
    // layout can shift as images and fonts load — re-align on any change.
    let pending = false;
    const schedule = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        apply();
      });
    };
    new MutationObserver(schedule).observe(target, {
      childList: true,
      subtree: true,
    });
    if (document.fonts?.ready) document.fonts.ready.then(schedule);
    if (typeof ResizeObserver === "function") {
      let lastWidth = 0;
      new ResizeObserver(() => {
        const w = target.getBoundingClientRect().width;
        if (w !== lastWidth) {
          lastWidth = w;
          apply();
        }
      }).observe(target);
    }
  }

  _buildSection(list) {
    const section = document.createElement("section");
    section.id = SECTION_ID;
    section.classList.toggle("ape-cw-classic", this._classic);
    section.setAttribute("aria-label", "Continue Watching");

    const header = document.createElement("div");
    header.className = "ape-cw-header";

    const titleRow = document.createElement("div");
    titleRow.className = "ape-cw-title-row";
    const heading = document.createElement("h2");
    heading.className = "ape-cw-heading";
    heading.textContent = "Continue Watching";
    const count = document.createElement("span");
    count.className = "ape-cw-count";
    count.textContent = String(list.length);
    titleRow.append(heading, count);

    const controls = document.createElement("div");
    controls.className = "ape-cw-controls";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.id = "ape-cw-toggle";
    toggleBtn.className = "ape-cw-btn";
    toggleBtn.textContent = "Show more";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.id = "ape-cw-clear";
    clearBtn.className = "ape-cw-btn danger";
    clearBtn.textContent = "Clear all";
    clearBtn.setAttribute("aria-haspopup", "dialog");
    clearBtn.setAttribute("aria-expanded", "false");

    controls.append(toggleBtn, clearBtn);

    // Inline confirmation (replaces window.confirm)
    const confirmBox = document.createElement("div");
    confirmBox.className = "ape-cw-confirm";
    confirmBox.setAttribute("role", "alertdialog");
    confirmBox.setAttribute("aria-label", "Clear Continue Watching");
    confirmBox.hidden = true;
    const confirmText = document.createElement("p");
    confirmText.className = "ape-cw-confirm-text";
    const actions = document.createElement("div");
    actions.className = "ape-cw-confirm-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ape-cw-btn";
    cancelBtn.textContent = "Cancel";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "ape-cw-btn primary";
    okBtn.textContent = "Clear all";
    actions.append(cancelBtn, okBtn);
    confirmBox.append(confirmText, actions);

    header.append(titleRow, controls, confirmBox);

    const grid = document.createElement("div");
    grid.className = "ape-cw-grid collapsed";
    grid.id = "ape-cw-grid";
    section.append(header, grid);

    list.forEach((entry) =>
      grid.appendChild(this._buildCard(entry, grid, section)),
    );

    const sync = () => this._syncSection(section, grid, count, toggleBtn);
    this._sync = sync;
    sync();

    toggleBtn.addEventListener("click", () => {
      const isCollapsed = grid.classList.toggle("collapsed");
      toggleBtn.textContent = isCollapsed ? "Show more" : "Show less";
    });

    let outside = null;
    const closeConfirm = (returnFocus = false) => {
      confirmBox.hidden = true;
      clearBtn.classList.remove("is-open");
      clearBtn.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", outside, true);
      document.removeEventListener("keydown", onKey, true);
      if (returnFocus) clearBtn.focus();
    };
    const onKey = (e) => {
      if (e.key === "Escape") closeConfirm(true);
    };
    outside = (e) => {
      if (!confirmBox.contains(e.target) && e.target !== clearBtn)
        closeConfirm();
    };

    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!confirmBox.hidden) return closeConfirm(true);
      const n = grid.children.length;
      confirmText.textContent = `Clear all ${n} episode${n === 1 ? "" : "s"} from Continue Watching?`;
      confirmBox.hidden = false;
      clearBtn.classList.add("is-open");
      clearBtn.setAttribute("aria-expanded", "true");
      document.addEventListener("click", outside, true);
      document.addEventListener("keydown", onKey, true);
      cancelBtn.focus();
    });
    cancelBtn.addEventListener("click", () => closeConfirm(true));
    okBtn.addEventListener("click", async () => {
      closeConfirm();
      await this._storage.clearCwList();
      section.classList.add("ape-cw-remove-anim");
      section.addEventListener("animationend", () => section.remove(), {
        once: true,
      });
    });

    return section;
  }

  /** Keep the count pill, the "Show more" button and the collapsed overflow
   *  in step with however many cards are currently in the grid. */
  _syncSection(section, grid, count, toggleBtn) {
    const cards = [...grid.children];
    count.textContent = String(cards.length);
    cards.forEach((c, i) =>
      c.classList.toggle("ape-cw-extra", i >= this._cardsPerPage),
    );
    const needsToggle = cards.length > this._cardsPerPage;
    toggleBtn.hidden = !needsToggle;
    if (!needsToggle) grid.classList.add("collapsed");
  }

  /** Classic style shows the anime poster; the default shows the episode
   *  still. Entries saved before posters were kept fall back to the still. */
  _imgUrl(entry) {
    return this._classic
      ? entry.posterUrl || entry.thumbnailUrl
      : entry.thumbnailUrl;
  }

  _timeLeftLabel(entry) {
    if (!(entry.duration > 0)) return "";
    const left = Math.max(0, entry.duration - (entry.time || 0));
    if (left < 60) return "Almost done";
    return `${Math.ceil(left / 60)} min left`;
  }

  _buildCard(entry, grid, section) {
    const pct =
      entry.duration > 0
        ? Math.min(
            100,
            Math.max(0, (entry.time / entry.duration) * 100),
          ).toFixed(1)
        : 0;
    const timeLeft = this._timeLeftLabel(entry);

    const card = document.createElement("div");
    card.className = "ape-cw-card";
    card.dataset.apeCw = `${entry.animeSession}/${entry.epSession}`;
    card._apeEntry = entry;

    const link = document.createElement("a");
    link.href = entry.playUrl;
    link.className = "ape-cw-link";
    link.title = `${entry.animeTitle} — Episode ${entry.epNumber}`;
    link.setAttribute(
      "aria-label",
      `${entry.animeTitle}, episode ${entry.epNumber}${timeLeft ? `, ${timeLeft}` : ""}`,
    );

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "ape-cw-thumb-wrap";

    const img = document.createElement("img");
    img.src = this._imgUrl(entry);
    img.alt = "";
    img.className = "ape-cw-thumb";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      img.style.display = "none";
    });

    const grad = document.createElement("div");
    grad.className = "ape-cw-grad";

    const overlay = document.createElement("div");
    overlay.className = "ape-cw-overlay";
    overlay.setAttribute("aria-hidden", "true");
    const play = document.createElement("span");
    play.className = "ape-cw-play";
    play.appendChild(playIcon(20));
    overlay.appendChild(play);

    thumbWrap.append(img, grad, overlay);

    if (timeLeft) {
      const left = document.createElement("span");
      left.className = "ape-cw-left";
      left.textContent = timeLeft;
      thumbWrap.appendChild(left);
    }

    const title = document.createElement("span");
    title.className = "ape-cw-title";
    title.textContent = entry.animeTitle;

    const ep = document.createElement("span");
    ep.className = "ape-cw-ep";
    const epLabel = document.createElement("small");
    epLabel.textContent = "EP";
    ep.append(epLabel, document.createTextNode(String(entry.epNumber)));

    thumbWrap.append(title, ep);

    if (entry.duration > 0) {
      const progBg = document.createElement("div");
      progBg.className = "ape-cw-prog-bg";
      const progBar = document.createElement("div");
      progBar.className = "ape-cw-prog-bar";
      progBar.style.width = `${pct}%`;
      progBg.appendChild(progBar);
      thumbWrap.appendChild(progBg);
    }

    link.appendChild(thumbWrap);

    // Title bar under the poster (only shown in the classic style).
    const caption = document.createElement("span");
    caption.className = "ape-cw-caption";
    caption.textContent = entry.animeTitle;
    link.appendChild(caption);

    const removeBtn = document.createElement("button");
    removeBtn.className = "ape-cw-remove-btn";
    removeBtn.type = "button";
    removeBtn.title = "Remove from Continue Watching";
    removeBtn.setAttribute("aria-label", `Remove ${entry.animeTitle}`);
    removeBtn.appendChild(closeIcon(12));

    card.append(link, removeBtn);

    removeBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const list = await this._storage.getCwList();
      await this._storage.setCwList(
        list.filter((x) => x.animeSession !== entry.animeSession),
      );
      card.classList.add("ape-cw-pop-out");
      card.addEventListener(
        "animationend",
        () => {
          card.remove();
          if (grid?.children.length === 0) section?.remove();
          else this._sync?.();
        },
        { once: true },
      );
    });

    return card;
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
    if (titleMatch) {
      epNumber = titleMatch[1];
    }
    if (epNumber === "?") {
      const epTitleEl =
        document.querySelector(".dropdown-menu .dropdown-item.active") ||
        document.querySelector(".episode-title") ||
        document.querySelector(".theatre-info .episode") ||
        document.querySelector(".theatre-info [class*=\'ep\']") ||
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
    const POSTER_SELECTORS = [
      ".anime-poster img",
      ".anime-poster",
      ".theatre-info .anime-cover img",
      ".theatre-info .poster img",
      ".theatre-info img",
      ".anime-cover img",
      ".anime-info img",
      'aside img[src*="i.animepahe"]',
      'img[src*="i.animepahe"]',
    ];
    let thumbnailUrl = "";
    for (const sel of POSTER_SELECTORS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const url =
        el.getAttribute("src") ||
        el.getAttribute("data-src") ||
        el.getAttribute("data-lazy-src") ||
        "";
      if (url) {
        thumbnailUrl = url;
        break;
      }
    }
    thumbnailUrl = thumbnailUrl.replace(/\.th\.(jpe?g|png|webp)$/i, ".$1");

    return {
      animeSession,
      epSession,
      animeTitle,
      epNumber,
      thumbnailUrl,
      posterUrl: thumbnailUrl,
      playUrl: window.location.href,
    };
  }

  _listenForIframe() {
    window.addEventListener("message", async (event) => {
      if (
        event.data?.type !== MSG.REQUEST_TIME &&
        event.data?.type !== MSG.UPDATE_TIME
      )
        return;

      const meta = this._extractPlayerMeta();
      if (!meta.animeSession) return;

      if (event.data?.type === MSG.REQUEST_TIME) {
        const list = await this._storage.getCwList();
        const saved = list.find(
          (x) =>
            x.animeSession === meta.animeSession &&
            x.epSession === meta.epSession,
        );
        event.source?.postMessage(
          { type: MSG.RESTORE_TIME, time: saved?.time ?? 0 },
          "*",
        );
      }

      if (event.data?.type === MSG.UPDATE_TIME) {
        await this._saveProgress(meta, event.data.time, event.data.duration);
      }
    });
  }

  // ── Saving progress ─────────────────────────────────────────────────────
  // Coalesced: the latest tick is kept in memory and written at most every
  // FLUSH_MS (immediately on a seek, an episode change, or when the tab is
  // hidden/closed), instead of a read-modify-write of the whole list every
  // couple of seconds.

  _saveProgress(meta, time, duration) {
    this._pending = { meta, time, duration };

    const now = Date.now();
    const last = this._lastWrite;
    const episodeChanged =
      !last ||
      last.animeSession !== meta.animeSession ||
      last.epSession !== meta.epSession;
    // Playing normally, the position advances as fast as the clock does; a
    // bigger discrepancy means the viewer seeked, so save right away.
    const seeked =
      last && Math.abs(time - last.time - (now - last.at) / 1000) > SEEK_JUMP_S;

    if (episodeChanged || seeked || now - (last?.at ?? 0) >= FLUSH_MS) {
      return this._flush();
    }
    if (!this._flushTimer) {
      this._flushTimer = setTimeout(
        () => this._flush(),
        FLUSH_MS - (now - last.at),
      );
    }
  }

  async _flush() {
    clearTimeout(this._flushTimer);
    this._flushTimer = null;
    const pending = this._pending;
    if (!pending) return;
    this._pending = null;

    const { meta, time, duration } = pending;
    const snaps = await this._snaps();
    let list = await this._storage.getCwList();
    const prev = list.find(
      (x) =>
        x.animeSession === meta.animeSession && x.epSession === meta.epSession,
    );

    // Best thumbnail we can get without any network request:
    // a snapshot seen while browsing > the one already saved > the poster.
    const snap = snaps[meta.epSession];
    const entry = { ...meta, time, duration };
    if (!entry.posterUrl && prev?.posterUrl) entry.posterUrl = prev.posterUrl;
    if (snap) {
      entry.thumbnailUrl = snap;
      entry.thumbKind = "episode";
    } else if (prev?.thumbKind) {
      entry.thumbnailUrl = prev.thumbnailUrl;
      entry.thumbKind = prev.thumbKind;
    }

    list = list.filter((x) => x.animeSession !== meta.animeSession);
    list.unshift(entry);
    if (list.length > this._maxEntries) list = list.slice(0, this._maxEntries);

    this._lastWrite = {
      animeSession: meta.animeSession,
      epSession: meta.epSession,
      time,
      at: Date.now(),
    };
    await this._storage.setCwList(list);
  }

  // ── Resolving thumbnails for the shelf ──────────────────────────────────
  // Order of preference, cheapest first:
  //   1. snapshot harvested from a listing (no network)
  //   2. already saved on the entry
  //   3. ONE API lookup per home-page load, only for the first entry still
  //      missing one (never while a video plays), result remembered
  //   4. the anime poster

  async _resolveThumbnails(list) {
    const snaps = await this._snaps();
    let updated = false;
    const missing = [];

    for (const e of list) {
      if (!e.animeSession || !e.epSession) continue;
      const snap = snaps[e.epSession];
      if (snap && e.thumbnailUrl !== snap) {
        // Keep the poster before it is replaced by the episode still.
        if (!e.posterUrl && e.thumbKind !== "episode" && e.thumbnailUrl) {
          e.posterUrl = e.thumbnailUrl;
        }
        e.thumbnailUrl = snap;
        e.thumbKind = "episode";
        updated = true;
        this._setCardThumb(e);
      } else if (!snap && !e.thumbKind) {
        missing.push(e);
      }
    }

    if (updated) {
      const current = await this._storage.getCwList();
      for (const e of list) {
        const cur = current.find(
          (x) =>
            x.animeSession === e.animeSession && x.epSession === e.epSession,
        );
        if (cur && e.thumbKind === "episode") {
          cur.thumbnailUrl = e.thumbnailUrl;
          cur.thumbKind = "episode";
          if (e.posterUrl) cur.posterUrl = e.posterUrl;
        }
      }
      await this._storage.setCwList(current);
    }

    if (missing.length) await this._lookupOne(missing[0]);
  }

  _setCardThumb(entry) {
    const key = `${entry.animeSession}/${entry.epSession}`;
    document
      .querySelectorAll(`[data-ape-cw="${CSS.escape(key)}"] .ape-cw-thumb`)
      .forEach((img) => {
        img.style.display = "";
        img.src = this._imgUrl(entry);
      });
  }

  async _lookupOne(entry) {
    const PER_PAGE = 30;
    const n = Math.floor(Number(entry.epNumber));
    const page = Number.isFinite(n) && n > 0 ? Math.ceil(n / PER_PAGE) : 1;

    let url = "";
    try {
      const data = await throttler.fetch(
        `/api?m=release&id=${entry.animeSession}&sort=episode_asc&page=${page}`,
        true,
        { maxRetries: 1 },
      );
      const eps = Array.isArray(data?.data)
        ? data.data
        : Object.values(data?.data || {});
      url = String(
        eps.find((e) => e?.session === entry.epSession)?.snapshot || "",
      );
    } catch {
      return; // rate-limited / offline: stay silent, try again next visit
    }

    const list = await this._storage.getCwList();
    const cur = list.find(
      (x) =>
        x.animeSession === entry.animeSession &&
        x.epSession === entry.epSession,
    );
    if (!cur) return;
    cur.thumbKind = url ? "episode" : "poster"; // "poster" = don't ask again
    if (url) {
      if (!cur.posterUrl && cur.thumbnailUrl) cur.posterUrl = cur.thumbnailUrl;
      cur.thumbnailUrl = url;
    }
    await this._storage.setCwList(list);
    if (url) {
      entry.posterUrl = cur.posterUrl;
      entry.thumbnailUrl = url;
      entry.thumbKind = "episode";
      this._setCardThumb(entry);
    }
  }
}

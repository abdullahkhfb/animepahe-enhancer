import { PAGE, getPageType } from "../helpers/router.js";
import { CW_MAX_ENTRIES } from "../helpers/storage.js";

const MSG = {
  REQUEST_TIME: "AP_CW_REQUEST_TIME",
  RESTORE_TIME: "AP_CW_RESTORE_TIME",
  UPDATE_TIME: "AP_CW_UPDATE_TIME",
};

const SECTION_ID = "ape-cw-section";

export class ContinueWatching {
  /** @param {import("../helpers/storage.js").storage} storage */
  constructor(storage, settings = {}) {
    this._storage = storage;
    this._cardsPerPage = settings.cwCardsPerPage ?? 6;
    this._maxEntries = settings.cwMaxEntries ?? CW_MAX_ENTRIES;
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

    this._listenForIframe();
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
      },
      ".content-wrapper, main, body > div",
    );
  }

  _buildSection(list) {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const section = document.createElement("section");
    section.id = SECTION_ID;

    const needsToggle = list.length > this._cardsPerPage;

    const header = document.createElement("div");
    header.className = "ape-cw-header";

    const heading = document.createElement("h2");
    heading.className = "ape-cw-heading";

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "ape-cw-heading-icon");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("fill", "currentColor");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2ZM9 7l4.5 3L9 13V7Z");
    svg.appendChild(path);

    heading.append(svg, " Continue Watching");

    const controls = document.createElement("div");
    controls.className = "ape-cw-controls";

    let toggleBtn = null;
    if (needsToggle) {
      toggleBtn = document.createElement("button");
      toggleBtn.id = "ape-cw-toggle";
      toggleBtn.className = "ape-cw-util-btn";
      toggleBtn.textContent = "Show More";
      controls.appendChild(toggleBtn);
    }

    const clearBtn = document.createElement("button");
    clearBtn.id = "ape-cw-clear";
    clearBtn.className = "ape-cw-util-btn danger";
    clearBtn.title = "Clear all history";
    clearBtn.textContent = "Clear All";
    controls.appendChild(clearBtn);

    header.append(heading, controls);

    const grid = document.createElement("div");
    grid.className = needsToggle ? "ape-cw-grid collapsed" : "ape-cw-grid";
    grid.id = "ape-cw-grid";

    section.append(header, grid);

    list.forEach((entry) =>
      grid.appendChild(this._buildCard(entry, grid, section)),
    );

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const isCollapsed = grid.classList.toggle("collapsed");
        toggleBtn.textContent = isCollapsed ? "Show More" : "Show Less";
      });
    }

    clearBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!confirm('Clear your entire "Continue Watching" list?')) return;
      await this._storage.clearCwList();
      section.classList.add("ape-cw-remove-anim");
      section.addEventListener("animationend", () => section.remove(), {
        once: true,
      });
    });

    return section;
  }

  _buildCard(entry, grid, section) {
    const SVG_NS = "http://www.w3.org/2000/svg";

    const pct =
      entry.duration > 0
        ? Math.min(
            100,
            Math.max(0, (entry.time / entry.duration) * 100),
          ).toFixed(1)
        : 0;

    const card = document.createElement("div");
    card.className = "ape-cw-card";

    const link = document.createElement("a");
    link.href = entry.playUrl;
    link.className = "ape-cw-link";
    link.title = `${entry.animeTitle} — Episode ${entry.epNumber}`;

    const thumbWrap = document.createElement("div");
    thumbWrap.className = "ape-cw-thumb-wrap";

    const img = document.createElement("img");
    img.src = entry.thumbnailUrl;
    img.alt = entry.animeTitle;
    img.className = "ape-cw-thumb";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      img.style.display = "none";
    });

    const overlay = document.createElement("div");
    overlay.className = "ape-cw-overlay";
    overlay.setAttribute("aria-hidden", "true");

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "ape-cw-play-icon");
    svg.setAttribute("viewBox", "0 0 80 80");
    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("cx", "40");
    circle.setAttribute("cy", "40");
    circle.setAttribute("r", "34");
    circle.setAttribute("fill", "rgba(0,0,0,.55)");
    circle.setAttribute("stroke", "rgba(255,255,255,.88)");
    circle.setAttribute("stroke-width", "3");
    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("points", "31,22 59,40 31,58");
    polygon.setAttribute("fill", "rgba(255,255,255,.92)");
    svg.append(circle, polygon);
    overlay.appendChild(svg);

    const epBadge = document.createElement("span");
    epBadge.className = "ape-cw-ep-badge";
    epBadge.textContent = `EP\u2009${entry.epNumber}`;

    thumbWrap.append(img, overlay, epBadge);

    if (entry.duration > 0) {
      const progBg = document.createElement("div");
      progBg.className = "ape-cw-prog-bg";
      const progBar = document.createElement("div");
      progBar.className = "ape-cw-prog-bar";
      progBar.style.width = `${pct}%`;
      progBg.appendChild(progBar);
      thumbWrap.appendChild(progBg);
    }

    const info = document.createElement("div");
    info.className = "ape-cw-info";
    const titleSpan = document.createElement("span");
    titleSpan.className = "ape-cw-title";
    titleSpan.textContent = entry.animeTitle;
    info.appendChild(titleSpan);

    link.append(thumbWrap, info);

    const removeBtn = document.createElement("button");
    removeBtn.className = "ape-cw-remove-btn";
    removeBtn.type = "button";
    removeBtn.title = "Remove from Continue Watching";
    removeBtn.setAttribute("aria-label", `Remove ${entry.animeTitle}`);
    removeBtn.textContent = "\u2715";

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

  async _saveProgress(meta, time, duration) {
    let list = await this._storage.getCwList();

    list = list.filter((x) => x.animeSession !== meta.animeSession);

    list.unshift({ ...meta, time, duration });

    if (list.length > this._maxEntries) list = list.slice(0, this._maxEntries);
    await this._storage.setCwList(list);
  }
}

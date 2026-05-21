import { PAGE, getPageType } from "../helpers/router.js";
import { CW_MAX_ENTRIES } from "../helpers/storage.js";

const MSG = {
  REQUEST_TIME: "AP_CW_REQUEST_TIME",
  RESTORE_TIME: "AP_CW_RESTORE_TIME",
  UPDATE_TIME: "AP_CW_UPDATE_TIME",
};

const SECTION_ID = "ape-cw-section";
const CARDS_PER_PAGE = 6;

export class ContinueWatching {
  /** @param {import("../helpers/storage.js").storage} storage */
  constructor(storage) {
    this._storage = storage;
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
    const section = document.createElement("section");
    section.id = SECTION_ID;

    const needsToggle = list.length > CARDS_PER_PAGE;
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
    list.forEach((entry) =>
      grid.appendChild(this._buildCard(entry, grid, section)),
    );

    if (needsToggle) {
      const toggleBtn = section.querySelector("#ape-cw-toggle");
      toggleBtn.addEventListener("click", () => {
        const isCollapsed = grid.classList.toggle("collapsed");
        toggleBtn.textContent = isCollapsed ? "Show More" : "Show Less";
      });
    }

    section
      .querySelector("#ape-cw-clear")
      .addEventListener("click", async (e) => {
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
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const pct =
      entry.duration > 0
        ? Math.min(
            100,
            Math.max(0, (entry.time / entry.duration) * 100),
          ).toFixed(1)
        : 0;
    const progressHtml =
      entry.duration > 0
        ? `<div class="ape-cw-prog-bg"><div class="ape-cw-prog-bar" style="width:${pct}%"></div></div>`
        : "";

    const card = document.createElement("div");
    card.className = "ape-cw-card";
    card.innerHTML = `
      <a href="${esc(entry.playUrl)}" class="ape-cw-link" title="${esc(entry.animeTitle)} — Episode ${esc(entry.epNumber)}">
        <div class="ape-cw-thumb-wrap">
          <img src="${esc(entry.thumbnailUrl)}" alt="${esc(entry.animeTitle)}" class="ape-cw-thumb" loading="lazy" onerror="this.style.display='none'">
          <div class="ape-cw-overlay" aria-hidden="true">
            <svg class="ape-cw-play-icon" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="34" fill="rgba(0,0,0,.55)" stroke="rgba(255,255,255,.88)" stroke-width="3"/>
              <polygon points="31,22 59,40 31,58" fill="rgba(255,255,255,.92)"/>
            </svg>
          </div>
          <span class="ape-cw-ep-badge">EP&thinsp;${esc(entry.epNumber)}</span>
          ${progressHtml}
        </div>
        <div class="ape-cw-info">
          <span class="ape-cw-title">${esc(entry.animeTitle)}</span>
        </div>
      </a>
      <button class="ape-cw-remove-btn" type="button" title="Remove from Continue Watching" aria-label="Remove ${esc(entry.animeTitle)}">✕</button>
    `;

    card
      .querySelector(".ape-cw-remove-btn")
      .addEventListener("click", async (e) => {
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

    const heading = h1 ? h1.textContent.trim() : "";
    const afterName = heading
      .slice(animeTitle.length)
      .replace(/^[\s\-–—]+/, "");
    const epNumMatch = afterName.match(/(\d+(?:\.\d+)?)/);
    const epNumber = epNumMatch ? epNumMatch[1] : "?";

    const posterEl = document.querySelector(".anime-poster");
    let thumbnailUrl = posterEl
      ? posterEl.getAttribute("src") || posterEl.getAttribute("data-src") || ""
      : "";
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

    if (list.length > CW_MAX_ENTRIES) list = list.slice(0, CW_MAX_ENTRIES);
    await this._storage.setCwList(list);
  }
}

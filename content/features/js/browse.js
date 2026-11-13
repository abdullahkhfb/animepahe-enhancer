import { injectStylesheet } from "../../helpers/styles.js";
import { svg } from "../../helpers/icons.js";
import {
  GROUPS,
  GROUP_BY_ID,
  SEASON_ORDER,
  SEASON_LABEL,
  DEFAULT_LIST_TTL_MS,
  keyOf,
  isValidKey,
  listPath,
  labelOf,
  readUniverse,
  peekList,
  loadList,
  ensurePosterStore,
  peekPoster,
  requestPoster,
  cancelPoster,
  getSavedLibrary,
  toggleSavedLibrary,
  clearSavedLibrary,
  loadState,
  saveStateSoon,
  gcBrowseCache,
} from "../../helpers/browse-data.js";

const BOOT_CLASS = "ape-br-boot";
const BOOT_STYLE_ID = "ape-br-boot-css";
const SCROLL_KEY = "ape_br_scroll";
const MIN_UNIVERSE = 50;

export function releaseBoot() {
  document.documentElement.classList.remove(BOOT_CLASS);
  document.getElementById(BOOT_STYLE_ID)?.remove();
}

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

const ICON = {
  search: () => svg(16, [["circle", { cx: 11, cy: 11, r: 7 }], ["path", { d: "M20 20l-3.5-3.5" }]], { sw: 2.2 }),
  chevron: () => svg(12, [["path", { d: "M6 9l6 6 6-6" }]], { sw: 2.8 }),
  grid: () =>
    svg(18, [
      ["rect", { x: 4, y: 4, width: 7, height: 7, rx: 1 }],
      ["rect", { x: 13, y: 4, width: 7, height: 7, rx: 1 }],
      ["rect", { x: 4, y: 13, width: 7, height: 7, rx: 1 }],
      ["rect", { x: 13, y: 13, width: 7, height: 7, rx: 1 }],
    ], { sw: 2 }),
  list: () => svg(18, [["path", { d: "M4 6h16M4 12h16M4 18h16" }]], { sw: 2.2 }),
  close: () => svg(10, [["path", { d: "M6 6l12 12M18 6L6 18" }]], { sw: 3.4 }),
  play: () => svg(14, [["path", { d: "M8 5v14l11-7z" }]], { fill: "currentColor", stroke: "none" }),
  bookmark: (filled = false) =>
    svg(14, [["path", { d: "M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" }]],
      filled ? { fill: "currentColor", stroke: "currentColor", sw: 1.8 } : { sw: 2 }),
};

const hashStr = (s) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
};
const letterOf = (t) => (/^[a-z]/i.test(t) ? t[0].toUpperCase() : "#");
const SEASON_SHORT = { winter: "Win", spring: "Spr", summer: "Sum", fall: "Fall" };
const isIndexPath = () => /^\/anime\/?$/i.test(location.pathname);
const isBrowseRoute = () => isIndexPath() && location.hash.startsWith("#browse");

export class Browse {
  constructor(storage, settings) {
    this._settings = settings;
    this._app = null;
    this._mounting = false;
    this._nav = null;
    this._animeItem = null;
  }

  get ttlMs() {
    const hours = Number(this._settings?.browseCacheTtlHours);
    return Number.isFinite(hours) && hours > 0 ? hours * 3_600_000 : DEFAULT_LIST_TTL_MS;
  }

  async init() {
    injectStylesheet("ape-browse-styles", "content/features/css/browse.css");
    this._addNavLink();
    window.addEventListener("hashchange", () => this._sync());
    window.addEventListener("popstate", () => this._sync());
    await this._sync();
    setTimeout(() => gcBrowseCache(this.ttlMs).catch(() => {}), 5000);
  }

  async _sync() {
    const want = isBrowseRoute();
    if (want && !this._app && !this._mounting) {
      this._mounting = true;
      const app = new BrowseApp(this.ttlMs);
      try {
        await app.mount();
        if (isBrowseRoute()) this._app = app;
        else app.unmount();
      } catch (err) {
        console.error("[animepahe-enhancer] Browse failed to mount:", err);
        app.unmount();
      } finally {
        this._mounting = false;
      }
    } else if (!want && this._app) {
      this._app.unmount();
      this._app = null;
    }
    if (!want || !this._app) releaseBoot();
    this._setNavActive(!!this._app);
  }

  _setNavActive(on) {
    if (!this._nav) return;
    this._nav.classList.toggle("active", on);
    this._nav.classList.toggle("ape-br-nav-active", on);
    const link = this._nav.tagName === "A" ? this._nav : this._nav.querySelector("a");
    link?.classList.toggle("active", on);
    link?.toggleAttribute("aria-current", on);
    if (this._animeItem) {
      const item = this._animeItem;
      if (on) {
        item.dataset.apeBrWasActive = item.classList.contains("active") ? "1" : "";
        item.classList.remove("active");
        (item.tagName === "A" ? item : item.querySelector("a"))?.classList.remove("active");
      } else if (item.dataset.apeBrWasActive) {
        item.classList.add("active");
        (item.tagName === "A" ? item : item.querySelector("a"))?.classList.add("active");
      }
    }
  }

  // Clones the site's own "anime" menu item so the new tab matches it exactly.
  _addNavLink() {
    if (document.getElementById("ape-br-nav")) return;
    const anchors = [
      ...document.querySelectorAll(".main-nav a[href], header a[href], nav a[href], .navbar-nav a[href]"),
    ].filter((x) => !x.closest(".search-results, .ui-autocomplete, .nav-search"));
    const anime = anchors.find((x) => {
      const txt = x.textContent.trim();
      let path = "";
      try {
        path = new URL(x.getAttribute("href") || "", location.href).pathname;
      } catch {
        /* ignore */
      }
      return /^anime$/i.test(txt) || /^\/anime\/?$/i.test(path);
    });
    if (!anime) return;

    const unit = anime.closest("li") || anime;
    const clone = unit.cloneNode(true);
    clone.id = "ape-br-nav";
    clone.classList.add("ape-br-nav");
    clone.classList.remove("active");
    const link = clone.tagName === "A" ? clone : clone.querySelector("a");
    if (!link) return;

    const base = new URL(anime.getAttribute("href") || "/anime", location.href);
    link.href = `${base.pathname.replace(/\/$/, "") || "/anime"}#browse`;
    link.removeAttribute("target");
    link.removeAttribute("aria-current");
    link.classList.remove("active");

    const original = anime.textContent.trim();
    const label = original === original.toUpperCase() && /[A-Z]/.test(original) ? "BROWSE"
      : original[0] === original[0]?.toUpperCase() && original[0] !== original[0]?.toLowerCase() ? "Browse" : "browse";
    const textHolder = [...link.querySelectorAll("*")].find((n) => !n.children.length && n.textContent.trim()) || link;
    textHolder.textContent = label;
    link.title = label.toLowerCase();

    const plainClick = (e) => e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;

    link.addEventListener("click", (e) => {
      if (!isIndexPath() || !plainClick(e)) return;
      e.preventDefault();
      if (!isBrowseRoute()) history.pushState(null, "", `${location.pathname}${location.search}#browse`);
      this._sync();
    });
    anime.addEventListener("click", (e) => {
      if (!this._app || !isIndexPath() || !plainClick(e)) return;
      e.preventDefault();
      history.pushState(null, "", `${location.pathname}${location.search}`);
      this._sync();
    });

    unit.after(clone);
    this._nav = clone;
    this._animeItem = unit;
  }
}

class BrowseApp {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.pageSize = window.innerWidth < 640 ? 12 : 24;
    this.s = {
      sel: {},
      modes: { g: "all", t: "all" },
      sort: "az",
      view: "grid",
      q: "",
      letter: "",
      onlyLibrary: false,
      limit: this.pageSize,
      open: "",
      tq: "",
      allThemes: false,
      older: false,
    };
    this.universe = new Map();
    this.all = [];
    this.library = new Set();
    this.pending = new Set();
    this.failed = new Map();
    this.ver = 0;
    this.root = null;
    this._hidden = [];
    this._raf = 0;
    this._last = null;
    this._lastSig = "";
    this._io = null;
    this._dead = false;
    this._cards = new Map();
    this._shown = new Set();
    this._renderedSig = "";
    this._restore = null;
    this._prevTitle = document.title;
    this._prevScrollRestoration = history.scrollRestoration;
    this._onScroll = () => this._saveScrollSoon();
    this._onHide = () => this._saveScroll();
  }

  async mount() {
    const universe = readUniverse(document);
    if (universe.size < MIN_UNIVERSE) throw new Error("anime index not found on this page");
    this.universe = universe;
    this.all = [...universe.values()].sort((a, b) => a.title.localeCompare(b.title));

    const [saved, library] = await Promise.all([loadState(), getSavedLibrary(universe), ensurePosterStore()]);
    if (this._dead) return;
    this.library = library;
    this._initState(saved);

    this._build();
    this._hideOriginal();
    document.title = "Browse :: animepahe";
    history.scrollRestoration = "manual";
    this._io = new IntersectionObserver((entries) => this._onVisible(entries), { rootMargin: "250px 0px" });
    window.addEventListener("scroll", this._onScroll, { passive: true });
    window.addEventListener("pagehide", this._onHide);
    releaseBoot();
    this._ensureLists();
    this.render();
    this._writeHash();
  }

  unmount() {
    this._dead = true;
    cancelAnimationFrame(this._raf);
    this._saveScroll();
    window.removeEventListener("scroll", this._onScroll);
    window.removeEventListener("pagehide", this._onHide);
    this._io?.disconnect();
    for (const sess of this._shown) {
      const card = this._cards.get(sess);
      if (card) cancelPoster(card._item);
    }
    this.root?.remove();
    for (const el of this._hidden) el.removeAttribute("data-ape-br-hidden");
    this._hidden = [];
    this.root = null;
    document.title = this._prevTitle;
    history.scrollRestoration = this._prevScrollRestoration;
  }

  // ── state <-> URL hash / saved state ───────────────────────────────────

  _initState(saved) {
    const i = location.hash.indexOf("?");
    const hashQs = i >= 0 ? location.hash.slice(i + 1) : "";
    const qs = hashQs || saved?.qs || "";
    this._parse(new URLSearchParams(qs));

    try {
      const raw = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "null");
      if (raw && raw.sig === this._serialize() && raw.y > 0) {
        this._restore = raw;
        this.s.limit = Math.max(this.pageSize, Math.min(raw.limit | 0, this.all.length));
      }
    } catch {
      /* ignore */
    }
  }

  _parse(p) {
    const sel = {};
    for (const g of GROUPS) {
      const v = p.get(g.id);
      if (!v) continue;
      for (const tok of v.split(",")) {
        const out = tok.startsWith("-");
        const key = keyOf(g.id, out ? tok.slice(1) : tok);
        if (isValidKey(key)) sel[key] = out ? "out" : "in";
      }
    }
    this.s.sel = sel;
    this.s.modes.g = p.get("gm") === "any" ? "any" : "all";
    this.s.modes.t = p.get("tm") === "any" ? "any" : "all";
    this.s.sort = p.get("sort") === "za" ? "za" : "az";
    this.s.view = p.get("view") === "list" ? "list" : "grid";
    this.s.onlyLibrary = p.get("lib") === "1";
    this.s.q = (p.get("q") || "").slice(0, 100);
    const l = p.get("l") || "";
    this.s.letter = /^[A-Z#]$/.test(l) ? l : "";
  }

  _serialize() {
    const p = new URLSearchParams();
    for (const g of GROUPS) {
      const toks = Object.keys(this.s.sel)
        .filter((k) => k[0] === g.id)
        .sort()
        .map((k) => (this.s.sel[k] === "out" ? "-" : "") + k.slice(2));
      if (toks.length) p.set(g.id, toks.join(","));
    }
    if (this.s.modes.g === "any") p.set("gm", "any");
    if (this.s.modes.t === "any") p.set("tm", "any");
    if (this.s.sort !== "az") p.set("sort", this.s.sort);
    if (this.s.view === "list") p.set("view", "list");
    if (this.s.onlyLibrary) p.set("lib", "1");
    if (this.s.q.trim()) p.set("q", this.s.q.trim());
    if (this.s.letter) p.set("l", this.s.letter);
    return p.toString();
  }

  _writeHash() {
    const qs = this._serialize();
    try {
      history.replaceState(null, "", `${location.pathname}${location.search}#browse${qs ? "?" + qs : ""}`);
    } catch {
      /* ignore */
    }
    saveStateSoon({ qs });
  }

  _saveScroll() {
    if (!this.root) return;
    try {
      sessionStorage.setItem(
        SCROLL_KEY,
        JSON.stringify({ sig: this._serialize(), y: Math.round(window.scrollY), limit: this.s.limit }),
      );
    } catch {
      /* ignore */
    }
  }

  _saveScrollSoon() {
    clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => this._saveScroll(), 200);
  }

  // ── replacing the site's index ─────────────────────────────────────────

  _hasAnime(el) {
    if (!el?.querySelector) return false;
    if (el.matches?.(".index") || el.querySelector(".index")) return true;
    for (const a of el.querySelectorAll("a[href*='/anime/']")) {
      const m = (a.getAttribute("href") || "").match(/\/anime\/([0-9a-fA-F-]{8,36})/);
      if (m && this.universe.has(m[1])) return true;
    }
    return false;
  }

  _hideOriginal() {
    const root = this.root;
    const h1 = [...document.querySelectorAll("h1")].find((e) => !e.closest("header, nav") && !root.contains(e)) ?? null;
    let c = h1 ? h1.parentElement : null;
    while (c && c !== document.body && !this._hasAnime(c)) c = c.parentElement;
    if (!c || c === document.documentElement || c === document.body) {
      const idx = document.querySelector(".index");
      c = idx?.parentElement || document.querySelector("main, .content-wrapper, #content") || document.body;
    }
    let anchor = null;
    for (const child of c.children) {
      if (child === root || child.id === "ape-cw-section" || /^(HEADER|NAV|FOOTER|SCRIPT|STYLE|LINK)$/i.test(child.tagName)) continue;
      if ((h1 && child.contains(h1)) || child === h1 || this._hasAnime(child)) {
        child.setAttribute("data-ape-br-hidden", "");
        this._hidden.push(child);
        anchor ??= child;
      }
    }
    if (anchor) c.insertBefore(root, anchor);
    else c.prepend(root);
  }

  // ── filter lists ───────────────────────────────────────────────────────

  _ensureLists() {
    for (const key of Object.keys(this.s.sel)) this._loadKey(key);
  }

  _loadKey(key) {
    if (peekList(key) || this.pending.has(key) || this.failed.has(key)) return;
    this.pending.add(key);
    loadList(key, { ttlMs: this.ttlMs })
      .then(() => {
        this.pending.delete(key);
        this.ver++;
      })
      .catch((err) => {
        this.pending.delete(key);
        this.failed.set(key, err);
      })
      .finally(() => this._schedule());
  }

  _retryFailed() {
    const keys = [...this.failed.keys()];
    this.failed.clear();
    for (const k of keys) if (this.s.sel[k]) this._loadKey(k);
    this._schedule();
  }

  // ── state changes ──────────────────────────────────────────────────────

  _changed() {
    this.s.limit = this.pageSize;
    this._restore = null;
    this._writeHash();
    this._ensureLists();
    this._schedule();
  }

  _cycle(k) {
    const sel = this.s.sel;
    const cur = sel[k];
    if (!cur) sel[k] = "in";
    else if (cur === "in") sel[k] = "out";
    else delete sel[k];
    this._changed();
  }

  _remove(k) {
    delete this.s.sel[k];
    this.failed.delete(k);
    this._changed();
  }

  _clearGroup(gid) {
    for (const k of Object.keys(this.s.sel)) if (k[0] === gid) delete this.s.sel[k];
    this._changed();
  }

  _resetAll() {
    this.s.sel = {};
    this.s.letter = "";
    this.s.q = "";
    this.s.onlyLibrary = false;
    this.failed.clear();
    if (this.inputQ) this.inputQ.value = "";
    this._changed();
  }

  _openPanel(id) {
    this.s.open = this.s.open === id ? "" : id;
    this._schedule();
  }

  _schedule() {
    if (this._raf || !this.root) return;
    this._raf = requestAnimationFrame(() => this.render());
  }

  // ── static skeleton ────────────────────────────────────────────────────

  _build() {
    const root = h("div", { id: "ape-br-root", class: "ape-br-root" });
    this.root = root;

    this.selSort = h("select", {
      class: "ape-br-select",
      "aria-label": "Sort results",
      onChange: (e) => {
        this.s.sort = e.target.value;
        this._changed();
      },
    }, h("option", { value: "az", text: "A–Z" }), h("option", { value: "za", text: "Z–A" }));
    const viewBtn = (view, label, icon) =>
      h("button", {
        type: "button",
        class: "ape-br-ib",
        "aria-label": label,
        title: label,
        onClick: () => {
          this.s.view = view;
          this._changed();
        },
      }, icon);
    this.btnGrid = viewBtn("grid", "Poster grid", ICON.grid());
    this.btnList = viewBtn("list", "Index list (like the site)", ICON.list());

    const top = h("div", { class: "ape-br-top" },
      h("h1", { class: "ape-br-h1", text: "Browse" }),
      h("div", { class: "ape-br-controls" },
        h("label", { class: "ape-br-sortlbl" }, h("span", { text: "Sort" }), this.selSort),
        this.btnGrid,
        this.btnList));

    this.inputQ = h("input", {
      class: "ape-br-input",
      type: "text",
      placeholder: "Filter by title…",
      "aria-label": "Filter by title",
      value: this.s.q,
      onInput: (e) => {
        this.s.q = e.target.value;
        this._changed();
      },
    });
    const field = h("label", { class: "ape-br-field" }, h("span", { class: "ico" }, ICON.search()), this.inputQ);

    this.triggers = {};
    const trigEls = GROUPS.map((g) => {
      const count = h("span", { class: "c" });
      const btn = h("button", {
        type: "button",
        class: "ape-br-tg",
        "aria-expanded": "false",
        onClick: () => this._openPanel(g.id),
      }, h("span", { text: g.name }), count, ICON.chevron());
      this.triggers[g.id] = { btn, count, name: g.name };
      return btn;
    });

    this.libCountEl = h("span", { class: "c" });
    this.btnLibrary = h("button", {
      type: "button",
      class: "ape-br-tg ape-br-lib-btn",
      "aria-pressed": "false",
      onClick: () => {
        this.s.onlyLibrary = !this.s.onlyLibrary;
        this._changed();
      },
    }, ICON.bookmark(false), h("span", { text: "Library" }), this.libCountEl);

    const bar = h("div", { class: "ape-br-bar" }, field,
      h("div", { class: "ape-br-triggers ape-br-scroll", role: "group", "aria-label": "Filter groups" }, ...trigEls, this.btnLibrary));

    this.panels = Object.fromEntries(GROUPS.map((g) => [g.id, g.id === "s" ? this._seasonPanel() : this._groupPanel(g)]));

    this.countEl = h("span", { class: "ape-br-count", "aria-live": "polite" });
    this.activeEl = h("div", { class: "ape-br-active ape-br-scroll" });
    this.clearLibBtn = h("button", {
      type: "button",
      class: "ape-br-link quiet",
      style: "flex:none",
      hidden: true,
      text: "Clear library",
      onClick: async () => {
        this.library = await clearSavedLibrary();
        this._lastSig = "";
        this._schedule();
      },
    });
    this.clearAllBtn = h("button", {
      type: "button",
      class: "ape-br-link",
      style: "flex:none",
      text: "Clear all",
      onClick: () => this._resetAll(),
    });
    const summary = h("div", { class: "ape-br-summary" }, this.countEl, this.activeEl, this.clearLibBtn, this.clearAllBtn);
    this.sourceEl = h("p", { class: "ape-br-source" });
    this.noticeEl = h("div", { class: "ape-br-notice", hidden: true, role: "status" });
    this.lettersEl = h("nav", { class: "ape-br-letters ape-br-scroll", "aria-label": "Filter by first letter" });
    this.resultsEl = h("div", { class: "ape-br-results" });
    this.moreEl = h("div", { class: "ape-br-more", hidden: true });

    root.append(top, bar, ...Object.values(this.panels).map((p) => p.el), summary, this.sourceEl, this.noticeEl, this.lettersEl, this.resultsEl, this.moreEl);
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.s.open) {
        this.s.open = "";
        this._schedule();
      }
    });
  }

  _groupPanel(group) {
    const p = { group };
    const head = h("div", { class: "ape-br-panelhead" },
      (p.hint = h("p", { class: "ape-br-hint", text: "Tap to include · again to exclude · again to clear" })));
    if (group.switchable) {
      const btn = (mode) =>
        h("button", {
          type: "button",
          class: "ape-br-mm",
          text: mode,
          onClick: () => {
            this.s.modes[group.id] = mode;
            this._changed();
          },
        });
      p.mmAll = btn("all");
      p.mmAny = btn("any");
      head.append(h("div", { class: "ape-br-match", role: "group", "aria-label": "Match mode" }, h("span", { text: "Match" }), p.mmAll, p.mmAny));
    }
    p.chips = h("div", { class: "ape-br-chips" });
    p.clear = h("button", { type: "button", class: "ape-br-link quiet", text: `Clear ${group.name.toLowerCase()}`, onClick: () => this._clearGroup(group.id) });
    p.done = h("button", {
      type: "button",
      class: "ape-br-link",
      text: "Done",
      onClick: () => {
        this.s.open = "";
        this._schedule();
      },
    });
    const foot = h("div", { class: "ape-br-foot" });
    const kids = [head];
    if (group.id === "t") {
      this.inputTq = h("input", {
        class: "ape-br-input",
        type: "text",
        placeholder: "Find a theme…",
        "aria-label": "Find a theme",
        onInput: (e) => {
          this.s.tq = e.target.value;
          this._schedule();
        },
      });
      kids.push(h("label", { class: "ape-br-field wide" }, h("span", { class: "ico" }, ICON.search()), this.inputTq));
      p.toggle = h("button", {
        type: "button",
        class: "ape-br-link",
        onClick: () => {
          this.s.allThemes = !this.s.allThemes;
          this._schedule();
        },
      });
      foot.append(p.toggle, h("span", { class: "grow" }));
    }
    foot.append(p.clear, p.done);
    kids.push(p.chips, foot);
    p.el = h("section", { class: "ape-br-panel", "aria-label": group.name, hidden: true }, ...kids);
    return p;
  }

  _seasonPanel() {
    const group = GROUP_BY_ID.s;
    const p = { group };
    p.chips = h("div", { class: "ape-br-seasons" });
    p.clear = h("button", { type: "button", class: "ape-br-link quiet", text: "Clear seasons", onClick: () => this._clearGroup("s") });
    p.toggle = h("button", {
      type: "button",
      class: "ape-br-link quiet",
      onClick: () => {
        this.s.older = !this.s.older;
        this._schedule();
      },
    });
    p.done = h("button", {
      type: "button",
      class: "ape-br-link",
      text: "Done",
      onClick: () => {
        this.s.open = "";
        this._schedule();
      },
    });
    p.el = h("section", { class: "ape-br-panel", "aria-label": "Season and year", hidden: true },
      h("div", { class: "ape-br-panelhead" }, h("p", { class: "ape-br-hint", text: "Tap a season to include · again to exclude · tap a year for all four." })),
      p.chips,
      h("div", { class: "ape-br-foot" }, p.toggle, h("span", { class: "grow" }), p.clear, p.done));
    return p;
  }

  // ── filtering ──────────────────────────────────────────────────────────

  _has(key, nt) {
    return !!peekList(key)?.has(nt);
  }

  _compute() {
    const s = this.s;
    const keys = Object.keys(s.sel).sort();
    const sig = [
      keys.map((k) => `${k}=${s.sel[k]}`).join(","),
      s.modes.g, s.modes.t,
      s.q.trim().toLowerCase(),
      s.letter,
      s.onlyLibrary ? `lib:${this.library.size}` : "",
      this.ver,
      this.all.length,
    ].join("|");
    if (this._last && this._lastSig === sig) return this._last;

    const groups = GROUPS.map((g) => {
      const loaded = keys.filter((k) => k[0] === g.id && peekList(k));
      return {
        id: g.id,
        all: (g.switchable ? s.modes[g.id] : g.rule) === "all",
        inc: loaded.filter((k) => s.sel[k] === "in"),
        exc: loaded.filter((k) => s.sel[k] === "out"),
      };
    });
    const tokens = s.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const onlyLib = s.onlyLibrary;

    const pass = (it, skipGroup, skipLetter) => {
      if (onlyLib && !this.library.has(it.nt)) return false;
      for (const g of groups) {
        if (g.id === skipGroup) continue;
        for (const k of g.exc) if (this._has(k, it.nt)) return false;
        if (g.inc.length) {
          if (g.all) {
            for (const k of g.inc) if (!this._has(k, it.nt)) return false;
          } else if (!g.inc.some((k) => this._has(k, it.nt))) return false;
        }
      }
      if (tokens.length) {
        const t = it.title.toLowerCase();
        for (const tok of tokens) if (!t.includes(tok)) return false;
      }
      if (!skipLetter && s.letter && letterOf(it.title) !== s.letter) return false;
      return true;
    };

    const resAll = [];
    const resNoLetter = [];
    for (const it of this.all) {
      if (pass(it, null, true)) {
        resNoLetter.push(it);
        if (!s.letter || letterOf(it.title) === s.letter) resAll.push(it);
      }
    }
    const result = { groups, resAll, resNoLetter, noGroup: new Map(), pass };
    this._lastSig = sig;
    this._last = result;
    return result;
  }

  _baseFor(c, gid) {
    const g = c.groups.find((x) => x.id === gid);
    if (g.all) return c.resAll;
    let cached = c.noGroup.get(gid);
    if (!cached) {
      cached = this.all.filter((it) => c.pass(it, gid, false));
      c.noGroup.set(gid, cached);
    }
    return cached;
  }

  _count(c, key) {
    const set = peekList(key);
    if (!set) return null;
    let n = 0;
    for (const it of this._baseFor(c, key[0])) if (set.has(it.nt)) n++;
    return n;
  }

  // ── rendering ──────────────────────────────────────────────────────────

  render() {
    this._raf = 0;
    if (!this.root) return;
    const s = this.s;
    const keys = Object.keys(s.sel);
    const ready = this.pending.size === 0;
    const c = ready || this._last ? this._compute() : null;

    this.libCountEl.textContent = String(this.library.size);
    this.btnLibrary.classList.toggle("has", this.library.size > 0);
    this.btnLibrary.classList.toggle("open", s.onlyLibrary);
    this.btnLibrary.setAttribute("aria-pressed", String(s.onlyLibrary));
    this.clearLibBtn.hidden = !(s.onlyLibrary && this.library.size > 0);

    this.selSort.value = s.sort;
    this.btnGrid.classList.toggle("on", s.view === "grid");
    this.btnList.classList.toggle("on", s.view === "list");
    for (const g of GROUPS) {
      const t = this.triggers[g.id];
      const n = keys.filter((k) => k[0] === g.id).length;
      t.btn.classList.toggle("open", s.open === g.id);
      t.btn.classList.toggle("has", n > 0);
      t.btn.setAttribute("aria-expanded", String(s.open === g.id));
      t.btn.setAttribute("aria-label", t.name + (n ? `, ${n} selected` : ""));
      t.count.textContent = String(n);
    }

    this._renderNotice();
    this._renderPanels(c, keys);
    this._renderSummary(c, keys);
    this.resultsEl.classList.toggle("is-busy", !ready);
    this.lettersEl.classList.toggle("is-busy", !ready);
    if (!ready && !c) {
      this.resultsEl.replaceChildren(h("p", { class: "ape-br-loading", text: "Loading filters…" }));
      this.lettersEl.replaceChildren();
      this.moreEl.hidden = true;
      return;
    }
    if (!ready) return;
    this._renderLetters(c);
    this._renderResults(c);
    this._restoreScroll();
  }

  _renderNotice() {
    const parts = [];
    if (this.pending.size) {
      parts.push(h("span", { text: `Loading ${[...this.pending].map(labelOf).join(", ")}…` }));
    }
    if (this.failed.size) {
      parts.push(h("span", { text: `Couldn’t load ${[...this.failed.keys()].map(labelOf).join(", ")} — results ignore it. ` }),
        h("button", { type: "button", class: "ape-br-link", text: "Retry", onClick: () => this._retryFailed() }));
    }
    this.noticeEl.hidden = parts.length === 0;
    this.noticeEl.replaceChildren(...parts);
  }

  _chip(c, gid, label, value) {
    const key = keyOf(gid, value);
    const st = this.s.sel[key];
    const n = c ? this._count(c, key) : null;
    const cls = "ape-br-chip" + (st === "in" ? " in" : st === "out" ? " out" : "") + (!st && n === 0 ? " zero" : "");
    return h("button", {
      type: "button",
      class: cls,
      "aria-label": label + (st === "in" ? ", included" : st === "out" ? ", excluded" : ", not selected"),
      onClick: () => this._cycle(key),
    }, h("span", { text: label }), n != null && st !== "out" ? h("span", { class: "n", text: String(n) }) : null);
  }

  _renderPanels(c, keys) {
    const s = this.s;
    for (const g of GROUPS) this.panels[g.id].el.hidden = s.open !== g.id;
    if (!s.open) return;
    const panel = this.panels[s.open];
    const group = panel.group;
    panel.clear.hidden = !keys.some((k) => k[0] === group.id);

    if (group.switchable) {
      panel.mmAll.classList.toggle("on", s.modes[group.id] === "all");
      panel.mmAny.classList.toggle("on", s.modes[group.id] === "any");
    }
    if (group.id === "s") return this._renderSeasons(panel, c);

    let values = group.values;
    if (group.id === "t") {
      const tq = s.tq.trim().toLowerCase();
      const matches = values.filter(([name]) => !tq || name.toLowerCase().includes(tq));
      const picked = ([, v]) => (s.sel[keyOf("t", v)] ? 0 : 1);
      const sorted = [...matches.filter((m) => !picked(m)), ...matches.filter((m) => picked(m))];
      values = s.allThemes || tq ? sorted : sorted.slice(0, 14);
      panel.toggle.hidden = !!tq || matches.length <= 14;
      panel.toggle.textContent = s.allThemes ? "Show fewer" : `Show all ${matches.length}`;
      const nodes = values.map(([name, v]) => this._chip(c, "t", name, v));
      if (!matches.length) nodes.push(h("p", { class: "ape-br-hint", text: "No theme matches that search." }));
      panel.chips.replaceChildren(...nodes);
      return;
    }
    panel.chips.replaceChildren(...values.map(([name, v]) => this._chip(c, group.id, name, v)));
  }

  _years() {
    const y0 = new Date().getFullYear();
    const last = this.s.older ? 1960 : y0 - 7;
    const out = [];
    for (let y = y0; y >= last; y--) out.push(y);
    return out;
  }

  _renderSeasons(panel, c) {
    const sel = this.s.sel;
    const rows = this._years().map((y) => {
      const keys = SEASON_ORDER.map((sn) => keyOf("s", `${sn}-${y}`));
      const allOn = keys.every((k) => sel[k] === "in");
      const yr = h("button", {
        type: "button",
        class: "ape-br-yr" + (allOn ? " in" : ""),
        text: String(y),
        "aria-label": `All of ${y}`,
        onClick: () => {
          for (const k of keys) {
            if (allOn) delete sel[k];
            else sel[k] = "in";
          }
          this._changed();
        },
      });
      const cells = SEASON_ORDER.map((sn, i) => {
        const k = keys[i];
        const st = sel[k];
        const n = c ? this._count(c, k) : null;
        return h("button", {
          type: "button",
          class: "ape-br-cell" + (st === "in" ? " in" : st === "out" ? " out" : "") + (!st && n === 0 ? " zero" : ""),
          text: n == null || st ? SEASON_SHORT[sn] : `${SEASON_SHORT[sn]} ${n}`,
          "aria-label": `${SEASON_LABEL[sn]} ${y}${st === "in" ? ", included" : st === "out" ? ", excluded" : ""}`,
          onClick: () => this._cycle(k),
        });
      });
      return h("div", { class: "ape-br-srow" }, yr, ...cells);
    });
    panel.chips.replaceChildren(...rows);
    panel.toggle.textContent = this.s.older ? "Fewer years" : "Older years…";
  }

  _renderSummary(c, keys) {
    this.countEl.textContent = c ? `${c.resAll.length} ${c.resAll.length === 1 ? "result" : "results"}` : "…";

    const order = Object.fromEntries(GROUPS.map((g, i) => [g.id, i]));
    const pills = keys.slice().sort((a, b) => order[a[0]] - order[b[0]]).map((k) => {
      const name = labelOf(k);
      return h("span", { class: "ape-br-af" + (this.s.sel[k] === "out" ? " out" : "") },
        h("span", { class: "k", text: GROUP_BY_ID[k[0]].short }),
        h("span", { text: name }),
        h("button", { type: "button", class: "x", "aria-label": `Remove ${name}`, onClick: () => this._remove(k) }, ICON.close()));
    });
    if (this.s.onlyLibrary) {
      pills.unshift(h("span", { class: "ape-br-af" },
        h("span", { class: "k", text: "Library" }),
        h("span", { text: `Saved (${this.library.size})` }),
        h("button", {
          type: "button",
          class: "x",
          "aria-label": "Remove Library filter",
          onClick: () => {
            this.s.onlyLibrary = false;
            this._changed();
          },
        }, ICON.close())));
    }
    if (!pills.length) pills.push(h("span", { class: "ape-br-none", text: "No filters — showing everything" }));
    this.activeEl.replaceChildren(...pills);
    this.clearAllBtn.hidden = !keys.length && !this.s.q && !this.s.letter && !this.s.onlyLibrary;

    const groups = GROUPS.map((g) => {
      const inc = keys.filter((k) => k[0] === g.id && this.s.sel[k] === "in").map(listPath);
      const join = (g.switchable ? this.s.modes[g.id] : g.rule) === "all" ? " ∩ " : " ∪ ";
      return inc.length ? { n: inc.length, s: inc.join(join) } : null;
    }).filter(Boolean);
    let src = groups.map((g) => (groups.length > 1 && g.n > 1 ? `(${g.s})` : g.s)).join(" ∩ ");
    const outs = keys.filter((k) => this.s.sel[k] === "out").map(listPath);
    if (outs.length) src += (src ? "  ∖  " : "∖ ") + outs.join(" ∖ ");
    this.sourceEl.replaceChildren(h("b", { text: "lists " }), document.createTextNode(src || "/anime (all)"));
  }

  _renderLetters(c) {
    const counts = new Map();
    for (const it of c.resNoLetter) counts.set(letterOf(it.title), (counts.get(letterOf(it.title)) || 0) + 1);
    this.lettersEl.replaceChildren(...["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((ch) => {
      const n = counts.get(ch) || 0;
      const on = this.s.letter === ch;
      return h("button", {
        type: "button",
        class: "ape-br-lt" + (on ? " on" : "") + (!on && n === 0 ? " zero" : ""),
        text: ch,
        "aria-label": `Titles starting with ${ch} (${n})`,
        onClick: () => {
          this.s.letter = on ? "" : ch;
          this._changed();
        },
      });
    }));
  }

  _renderResults(c) {
    const s = this.s;
    let list = c.resAll;
    if (s.sort === "za") list = list.slice().reverse();
    const total = list.length;
    const shown = list.slice(0, s.limit);
    const left = Math.max(0, total - shown.length);

    this._io?.disconnect();
    const nextShown = new Set(shown.map((x) => x.session));
    for (const sess of this._shown) {
      if (!nextShown.has(sess)) {
        const card = this._cards.get(sess);
        if (card) cancelPoster(card._item);
      }
    }
    this._shown = nextShown;

    if (!total) {
      const emptyLib = s.onlyLibrary && !this.library.size;
      const recent = Object.keys(s.sel).slice(-3).reverse();
      this._renderedSig = "";
      this.resultsEl.replaceChildren(h("div", { class: "ape-br-empty" },
        h("h2", { text: emptyLib ? "Your library is empty" : "Nothing matches all of these" }),
        h("p", { text: emptyLib ? "Tap the bookmark icon on any anime card to save it to your library." : "Try dropping one of your latest picks." }),
        h("div", { class: "row" },
          ...recent.map((k) => h("button", { type: "button", class: "ape-br-btn", text: `Remove ${labelOf(k)}`, onClick: () => this._remove(k) })),
          h("button", { type: "button", class: "ape-br-btn on", text: emptyLib && !recent.length ? "Show all anime" : "Clear all", onClick: () => this._resetAll() }))));
      this.moreEl.hidden = true;
      return;
    }

    const sig = `${s.view}:${shown.map((x) => x.session).join(",")}`;
    if (sig !== this._renderedSig || !this.resultsEl.children.length) {
      this._renderedSig = sig;
      if (s.view === "list") {
        this.resultsEl.replaceChildren(h("div", { class: "ape-br-list" }, ...shown.map((it) => this._row(it))));
      } else {
        const cards = shown.map((it) => this._card(it));
        this.resultsEl.replaceChildren(h("div", { class: "ape-br-grid" }, ...cards));
        for (const card of cards) if (!card._done) this._io.observe(card);
      }
    } else if (s.view === "grid") {
      for (const sess of this._shown) {
        const card = this._cards.get(sess);
        if (card && !card._done) this._io.observe(card);
      }
    }
    for (const el of this.resultsEl.querySelectorAll("[data-nt]")) this._paintLib(el);

    this.moreEl.hidden = !left;
    if (left) {
      this.moreEl.replaceChildren(h("button", {
        type: "button",
        class: "ape-br-btn",
        onClick: () => {
          s.limit += this.pageSize;
          this._schedule();
        },
      }, document.createTextNode(`Show ${Math.min(this.pageSize, left)} more`), h("small", { text: `${left} left` })));
    }
  }

  _restoreScroll() {
    if (!this._restore) return;
    const y = this._restore.y;
    this._restore = null;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }

  _paintLib(el) {
    const inLib = this.library.has(el.dataset.nt);
    if (el.classList.contains("on") === inLib && el.firstChild) return;
    el.classList.toggle("on", inLib);
    el.title = el.ariaLabel = inLib ? "Remove from Library" : "Save to Library";
    el.replaceChildren(ICON.bookmark(inLib));
  }

  _libButton(it, cls) {
    return h("button", {
      type: "button",
      class: cls,
      "data-nt": it.nt,
      onClick: async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await toggleSavedLibrary(it.nt);
        this._lastSig = "";
        this._schedule();
      },
    });
  }

  _badge(disc) {
    return disc ? h("span", { class: "ape-br-badge " + disc.toLowerCase(), text: disc }) : null;
  }

  _row(it) {
    return h("div", { class: "ape-br-row" },
      h("a", { class: "ape-br-rowlink", href: it.href }, h("span", { text: it.title }), this._badge(it.disc)),
      this._libButton(it, "ape-br-rowlib"));
  }

  _card(it) {
    const cached = this._cards.get(it.session);
    if (cached) return cached;

    const poster = h("div", { class: `ape-br-poster p${hashStr(it.session) % 6}` },
      h("span", { class: "ape-br-ini", "aria-hidden": "true", text: it.title.replace(/^(A|An|The)\s+/i, "")[0]?.toUpperCase() ?? "" }),
      h("div", { class: "ape-br-badges" }, this._badge(it.disc)),
      this._libButton(it, "ape-br-card-lib"),
      h("div", { class: "ape-br-ov" }, h("span", { class: "ape-br-play" }, ICON.play())));
    const img = h("img", { alt: "", decoding: "async", referrerpolicy: "no-referrer" });
    img.addEventListener("load", () => img.classList.add("ready"));
    img.addEventListener("error", () => {
      img.remove();
    });
    poster.prepend(img);

    const a = h("a", { class: "ape-br-card", href: it.href, "aria-label": it.title }, poster,
      h("div", { class: "ape-br-cap" }, h("div", { class: "ape-br-ttl", text: it.title })));
    a._item = it;
    a._img = img;
    a._done = false;

    const known = peekPoster(it);
    if (known) this._applyPoster(a, known);
    else if (known === null) a._done = true;

    if (this._cards.size > 600) this._cards.clear();
    this._cards.set(it.session, a);
    return a;
  }

  _applyPoster(card, url) {
    card._done = true;
    if (card._img.getAttribute("src") !== url) card._img.src = url;
  }

  _onVisible(entries) {
    for (const e of entries) {
      const card = e.target;
      const it = card._item;
      if (!it || card._done) continue;
      if (!e.isIntersecting) {
        cancelPoster(it);
        continue;
      }
      requestPoster(it).then((url) => {
        if (this._dead) return;
        if (url) this._applyPoster(card, url);
        else if (url === null && peekPoster(it) === null) card._done = true;
      });
    }
  }
}

import { keepMounted } from "../../helpers/persist.js";
import { injectStylesheet } from "../../helpers/styles.js";
import { svg, checkIcon, bellIcon } from "../../helpers/icons.js";
import { EpisodeNotifier } from "./schedule-notifier.js";
import {
  readUniverse,
  normTitle,
  ensurePosterStore,
  peekPoster,
  requestPoster,
  cancelPoster,
  getSavedLibrary,
  toggleSavedLibrary,
} from "../../helpers/browse-data.js";
import {
  DEFAULT_SCHEDULE_TTL_MS,
  weekStartOf,
  dayOf,
  loadWeek,
  buildSiteIndex,
  loadScheduleState,
  saveScheduleState,
  gcScheduleCache,
} from "../../helpers/schedule-data.js";

const BOOT_CLASS = "ape-br-boot";
const BOOT_STYLE_ID = "ape-br-boot-css";
const DAY_TOKENS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const MIN_UNIVERSE = 50;
const TICK_MS = 30_000;
const SOON_MS = 60 * 60 * 1000;

function releaseBoot() {
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
  bookmark: (filled = false, size = 14) =>
    svg(size, [["path", { d: "M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" }]],
      filled ? { fill: "currentColor", stroke: "currentColor", sw: 1.8 } : { sw: 2 }),
};

const hashStr = (s) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
  return n;
};
const dayIndexOf = (date) => (date.getDay() + 6) % 7;
const isIndexPath = () => /^\/anime\/?$/i.test(location.pathname);
const isScheduleRoute = () => isIndexPath() && location.hash.startsWith("#schedule");
const timeLabel = (at) => new Date(at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const weekday = (date, style) => date.toLocaleDateString([], { weekday: style });

function countdown(ms) {
  if (ms <= 0) return "Aired";
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `In ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `In ${hours}h ${String(mins % 60).padStart(2, "0")}m`;
  return `In ${Math.floor(hours / 24)}d ${hours % 24}h`;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export class Schedule {
  constructor(storage, settings) {
    this._settings = settings;
    this._app = null;
    this._mounting = false;
    this._nav = null;
    this._animeItem = null;
    this._notifier = null;
  }

  get ttlMs() {
    const minutes = Number(this._settings?.scheduleCacheTtlMinutes);
    return Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : DEFAULT_SCHEDULE_TTL_MS;
  }

  async init() {
    injectStylesheet("ape-schedule-styles", "content/features/css/schedule.css");
    keepMounted(() => {
      if (document.getElementById("ape-sc-nav")) return;
      this._addNavLink();
      this._setNavActive(!!this._app);
    });
    try {
      const notifier = new EpisodeNotifier(this._settings);
      await notifier.init();
      this._notifier = notifier;
    } catch (err) {
      console.error("[animepahe-enhancer] Schedule notifications failed to start:", err);
    }
    window.addEventListener("hashchange", () => this._sync());
    window.addEventListener("popstate", () => this._sync());
    window.addEventListener("ape-route", () => this._sync());
    await this._sync();
    setTimeout(() => gcScheduleCache(Math.max(this.ttlMs, 24 * 3_600_000)).catch(() => {}), 5000);
  }

  async _sync() {
    const want = isScheduleRoute();
    if (want && !this._app && !this._mounting) {
      this._mounting = true;
      const app = new ScheduleApp(this.ttlMs, this._notifier);
      try {
        await app.mount();
        if (isScheduleRoute()) this._app = app;
        else app.unmount();
      } catch (err) {
        console.error("[animepahe-enhancer] Schedule failed to mount:", err);
        app.unmount();
      } finally {
        this._mounting = false;
      }
    } else if (!want && this._app) {
      this._app.unmount();
      this._app = null;
    }
    if (want && !this._app && !this._mounting) releaseBoot();
    this._setNavActive(!!this._app);
  }

  _setNavActive(on) {
    if (!this._nav) return;
    this._nav.classList.toggle("active", on);
    this._nav.classList.toggle("ape-sc-nav-active", on);
    const link = this._nav.tagName === "A" ? this._nav : this._nav.querySelector("a");
    link?.classList.toggle("active", on);
    link?.toggleAttribute("aria-current", on);
    if (this._animeItem) {
      const item = this._animeItem;
      if (on) {
        item.dataset.apeScWasActive = item.classList.contains("active") ? "1" : "";
        item.classList.remove("active");
        (item.tagName === "A" ? item : item.querySelector("a"))?.classList.remove("active");
      } else if (item.dataset.apeScWasActive) {
        item.classList.add("active");
        (item.tagName === "A" ? item : item.querySelector("a"))?.classList.add("active");
      }
    }
  }

  // Clones the site's own "anime" menu item so the new tab matches it exactly.
  _addNavLink() {
    if (document.getElementById("ape-sc-nav")) return;
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
    clone.id = "ape-sc-nav";
    clone.classList.add("ape-sc-nav");
    clone.classList.remove("active", "ape-br-nav", "ape-br-nav-active");
    for (const n of [clone, ...clone.querySelectorAll("*")]) {
      delete n.dataset.apeBrBound;
      delete n.dataset.apeBrWasActive;
      delete n.dataset.apeScWasActive;
      delete n.dataset.apeScBound;
    }
    const link = clone.tagName === "A" ? clone : clone.querySelector("a");
    if (!link) return;

    const base = new URL(anime.getAttribute("href") || "/anime", location.href);
    link.href = `${base.pathname.replace(/\/$/, "") || "/anime"}#schedule`;
    link.removeAttribute("target");
    link.removeAttribute("aria-current");
    link.classList.remove("active");

    const original = anime.textContent.trim();
    const label = original === original.toUpperCase() && /[A-Z]/.test(original) ? "SCHEDULE"
      : original[0] === original[0]?.toUpperCase() && original[0] !== original[0]?.toLowerCase() ? "Schedule" : "schedule";
    const textHolder = [...link.querySelectorAll("*")].find((n) => !n.children.length && n.textContent.trim()) || link;
    textHolder.textContent = label;
    link.title = label.toLowerCase();

    const plainClick = (e) => e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey;

    link.addEventListener("click", (e) => {
      if (!isIndexPath() || !plainClick(e)) return;
      e.preventDefault();
      if (!isScheduleRoute()) history.pushState(null, "", `${location.pathname}${location.search}#schedule`);
      window.dispatchEvent(new Event("ape-route"));
    });
    const after = document.getElementById("ape-br-nav") ?? unit;
    const finish = () => {
      after.after(clone);
      this._nav = clone;
      this._animeItem = unit;
    };
    if (anime.dataset.apeScBound) return void finish();
    anime.dataset.apeScBound = "1";
    anime.addEventListener("click", (e) => {
      if (!this._app || !isIndexPath() || !plainClick(e)) return;
      e.preventDefault();
      history.pushState(null, "", `${location.pathname}${location.search}`);
      window.dispatchEvent(new Event("ape-route"));
    });

    // Browse inserts its own tab straight after "anime", so this one always ends up after it.
    finish();
  }
}

class ScheduleApp {
  constructor(ttlMs, notifier = null) {
    this.ttlMs = ttlMs;
    this.notifier = notifier;
    this._unsubscribe = null;
    this.weekStart = weekStartOf();
    this.s = { day: dayIndexOf(new Date()), lib: false };
    this.status = "loading";
    this.days = Array.from({ length: 7 }, () => []);
    this.universe = null;
    this.index = null;
    this.library = new Set();
    this.root = null;
    this._hidden = [];
    this._posters = [];
    this._statuses = [];
    this._io = null;
    this._tick = 0;
    this._dead = false;
    this._prevTitle = document.title;
  }

  async mount() {
    const universe = readUniverse(document);
    if (universe.size < MIN_UNIVERSE) throw new Error("anime index not found on this page");
    this.universe = universe;
    this.index = buildSiteIndex(universe);

    const [library, saved] = await Promise.all([
      getSavedLibrary(universe),
      loadScheduleState(),
      ensurePosterStore(),
    ]);
    if (this._dead) return;
    this.library = library;
    this._initState(saved);

    this._build();
    this._hideOriginal();
    document.title = "Schedule :: animepahe";
    this.notifier?.syncSessions(universe);
    this._unsubscribe = this.notifier?.onChange(() => this.render()) ?? null;
    this._io = new IntersectionObserver((entries) => this._onVisible(entries), { rootMargin: "250px 0px" });
    this._tick = setInterval(() => this._paintStatuses(), TICK_MS);
    releaseBoot();
    this.render();
    this._writeHash();
    this._load();
  }

  unmount() {
    this._dead = true;
    this._unsubscribe?.();
    clearInterval(this._tick);
    this._io?.disconnect();
    for (const poster of this._posters) cancelPoster(poster._item);
    this.root?.remove();
    for (const el of this._hidden) el.removeAttribute("data-ape-sc-hidden");
    this._hidden = [];
    this.root = null;
    document.title = this._prevTitle;
  }

  _initState(saved) {
    const i = location.hash.indexOf("?");
    const qs = new URLSearchParams(i >= 0 ? location.hash.slice(i + 1) : "");
    const day = DAY_TOKENS.indexOf(qs.get("day"));
    if (day >= 0) this.s.day = day;
    this.s.lib = qs.has("lib") ? qs.get("lib") === "1" : saved?.lib === true;
  }

  _writeHash() {
    const p = new URLSearchParams();
    if (this.s.day !== dayIndexOf(new Date())) p.set("day", DAY_TOKENS[this.s.day]);
    if (this.s.lib) p.set("lib", "1");
    const qs = p.toString();
    try {
      history.replaceState(null, "", `${location.pathname}${location.search}#schedule${qs ? "?" + qs : ""}`);
    } catch {
      /* ignore */
    }
    saveScheduleState({ lib: this.s.lib });
  }

  async _load(force = false) {
    this.status = "loading";
    this.render();
    try {
      this._decorate(await loadWeek(this.weekStart, { ttlMs: this.ttlMs, force }));
      this.status = "ready";
    } catch (err) {
      if (this._dead) return;
      console.error("[animepahe-enhancer] Schedule failed to load:", err);
      this.status = "error";
    }
    if (!this._dead) this.render();
  }

  _decorate(rows) {
    this.days = Array.from({ length: 7 }, () => []);
    for (const row of rows) {
      const site = this.index.find(row);
      if (!site) continue; // not listed on animepahe: leave it out of the schedule
      this.days[dayIndexOf(new Date(row.at * 1000))].push({ ...row, site, nt: site.nt });
    }
    for (const list of this.days) list.sort((a, b) => a.at - b.at || a.title.localeCompare(b.title));
  }

  _libraryKey(entry) {
    return [entry.nt, ...entry.titles.map(normTitle)].find((k) => this.library.has(k)) ?? null;
  }

  _visible(day) {
    return this.days[day].filter((e) => !this.s.lib || this._libraryKey(e));
  }

  _setDay(day) {
    this.s.day = day;
    this._writeHash();
    this.render();
  }

  _changed() {
    this._writeHash();
    this.render();
  }

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
        child.setAttribute("data-ape-sc-hidden", "");
        this._hidden.push(child);
        anchor ??= child;
      }
    }
    if (anchor) c.insertBefore(root, anchor);
    else c.prepend(root);
  }

  _build() {
    this.chipEl = h("span", { class: "ape-sc-chip", "aria-live": "polite" });
    this.tabsEl = h("div", {
      class: "ape-sc-tabs ape-sc-scroll",
      role: "tablist",
      "aria-label": "Day of the week",
      onKeydown: (e) => this._onTabKey(e),
    });

    const top = h("div", { class: "ape-sc-top" },
      h("div", { class: "ape-sc-heading" }, h("h1", { class: "ape-sc-h1", text: "Schedule" }), this.chipEl),
      h("div", { class: "ape-sc-controls" },
        h("span", {
          class: "ape-sc-tz",
          text: "Local time",
          title: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        h("button", {
          type: "button",
          class: "ape-sc-pill",
          text: "Today",
          onClick: () => this._setDay(dayIndexOf(new Date())),
        })));

    this.libInput = h("input", {
      type: "checkbox",
      class: "ape-sc-check",
      onChange: (e) => {
        this.s.lib = e.target.checked;
        this._changed();
      },
    });
    const filters = h("div", { class: "ape-sc-filters" },
      h("label", { class: "ape-sc-lib" }, this.libInput, h("span", { text: "My library only" })));

    this.bodyEl = h("div", { class: "ape-sc-body", role: "tabpanel" });
    this.sourceEl = h("p", { class: "ape-sc-source", text: "Airing times come from AniList and are shown in your local time." });

    this.root = h("div", { id: "ape-sc-root", class: "ape-sc-root" }, top, this.tabsEl, filters, this.bodyEl, this.sourceEl);
  }

  _onTabKey(e) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let next = this.s.day;
    if (step) next = (next + step + 7) % 7;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 6;
    else return;
    e.preventDefault();
    this._setDay(next);
    this.tabsEl.querySelector("[aria-selected='true']")?.focus();
  }

  render() {
    if (!this.root) return;
    this._renderTabs();
    this._renderControls();
    this._renderBody();
  }

  _renderTabs() {
    const today = dayIndexOf(new Date());
    const ready = this.status === "ready";
    this.tabsEl.replaceChildren(...DAY_TOKENS.map((token, i) => {
      const date = dayOf(this.weekStart, i);
      const on = i === this.s.day;
      return h("button", {
        type: "button",
        role: "tab",
        class: "ape-sc-tab" + (on ? " on" : "") + (i === today ? " today" : ""),
        "aria-selected": String(on),
        tabindex: on ? "0" : "-1",
        "aria-label": date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }),
        onClick: () => this._setDay(i),
      },
        h("span", { class: "ape-sc-dow", text: weekday(date, "short") }),
        h("span", { class: "ape-sc-dom", text: String(date.getDate()) }),
        h("span", { class: "ape-sc-cnt" },
          h("span", { class: "ape-sc-dot" }),
          h("span", { text: ready ? String(this._visible(i).length) : "" })));
    }));
  }

  _renderControls() {
    this.libInput.checked = this.s.lib;

    const isToday = this.s.day === dayIndexOf(new Date());
    const count = this.status === "ready" ? this._visible(this.s.day).length : 0;
    this.chipEl.hidden = this.status !== "ready";
    this.chipEl.textContent = `${count} ${isToday ? "today" : "on " + weekday(dayOf(this.weekStart, this.s.day), "short")}`;
  }

  _renderBody() {
    for (const poster of this._posters) cancelPoster(poster._item);
    this._io.disconnect();
    this._posters = [];
    this._statuses = [];

    if (this.status === "loading") {
      this.bodyEl.replaceChildren(h("p", { class: "ape-sc-loading", role: "status", text: "Loading this week\u2019s schedule\u2026" }));
      return;
    }
    if (this.status === "error") {
      this.bodyEl.replaceChildren(h("div", { class: "ape-sc-notice", role: "status" },
        h("span", { text: "The schedule could not be loaded. AniList may be busy." }),
        h("button", { type: "button", class: "ape-sc-btn", text: "Retry", onClick: () => this._load(true) })));
      return;
    }

    const list = this._visible(this.s.day);
    if (!list.length) {
      this.bodyEl.replaceChildren(this._empty());
      return;
    }

    const groups = new Map();
    for (const entry of list) {
      const key = timeLabel(entry.at);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    const now = Date.now();
    this.bodyEl.replaceChildren(...[...groups].map(([time, entries]) => {
      const done = entries.every((e) => e.at * 1000 <= now);
      return h("section", { class: "ape-sc-group", "aria-label": time },
        h("div", { class: "ape-sc-ghead" },
          h("span", { class: "ape-sc-time", text: time }),
          h("span", { class: "ape-sc-rule" }),
          h("span", { class: "ape-sc-gcount", text: `${entries.length} ${done ? "aired" : "releasing"}` })),
        h("div", { class: "ape-sc-grid" }, ...entries.map((e) => this._card(e))));
    }));
    for (const poster of this._posters) if (!poster._done) this._io.observe(poster);
    this._paintStatuses();
  }

  _empty() {
    const all = this.days[this.s.day];
    const dayName = weekday(dayOf(this.weekStart, this.s.day), "long");
    let title = `No releases scheduled on ${dayName}`;
    let body = "";
    let reset = false;

    if (all.length && this.s.lib) {
      title = `Nothing from your library airs on ${dayName}`;
      body = `${plural(all.length, "release")} ${all.length === 1 ? "is" : "are"} scheduled that day, including ${all.slice(0, 2).map((e) => e.title).join(" and ")}.`;
      reset = true;
    }

    return h("div", { class: "ape-sc-empty" },
      h("span", { class: "ape-sc-emptyicon" }, ICON.bookmark(false, 22)),
      h("h2", { text: title }),
      body ? h("p", { text: body }) : null,
      reset ? h("button", {
        type: "button",
        class: "ape-sc-btn on",
        text: "Show all releases",
        onClick: () => {
          this.s.lib = false;
          this._changed();
        },
      }) : null);
  }

  _card(entry) {
    const site = entry.site;
    const saved = !!this._libraryKey(entry);
    const initial = entry.title.replace(/^(A|An|The)\s+/i, "")[0]?.toUpperCase() ?? "";

    const poster = h("a", {
      class: `ape-sc-poster p${hashStr(entry.title) % 6}`,
      href: site.href,
      tabindex: "-1",
      "aria-hidden": "true",
    }, h("span", { class: "ape-sc-ini", "aria-hidden": "true", text: initial }));

    const img = h("img", { alt: "", decoding: "async", referrerpolicy: "no-referrer" });
    img.addEventListener("load", () => img.classList.add("ready"));
    img.addEventListener("error", () => img.remove());
    poster.prepend(img);
    poster._item = { nt: site.nt, title: site.title };
    poster._img = img;
    poster._done = false;
    const known = peekPoster(poster._item);
    if (known) {
      poster._done = true;
      img.src = known;
    } else if (known === null) {
      poster._done = true;
    }
    this._posters.push(poster);

    const badges = h("div", { class: "ape-sc-badges" },
      entry.episode === 1 ? h("span", { class: "ape-sc-badge new", text: "NEW" }) : null);

    const status = h("span", { class: "ape-sc-status" });
    const save = h("button", {
      type: "button",
      class: "ape-sc-save" + (saved ? " on" : ""),
      "aria-pressed": String(saved),
      "aria-label": `${saved ? "Remove" : "Save"} ${entry.title} ${saved ? "from" : "to"} Library`,
      title: saved ? "Remove from Library" : "Save to Library",
      onClick: async () => {
        await toggleSavedLibrary(this._libraryKey(entry) ?? entry.nt);
        if (!this._dead) this.render();
      },
    }, ICON.bookmark(saved, 16));

    const bell = this.notifier ? this._bellButton(entry) : null;

    const card = h("div", { class: "ape-sc-card" },
      poster,
      h("div", { class: "ape-sc-info" },
        badges,
        h("a", { class: "ape-sc-title", href: site.href, text: entry.title }),
        h("div", { class: "ape-sc-meta", text: `Episode ${entry.episode} \u00b7 ${entry.format}` }),
        h("div", { class: "ape-sc-foot" }, status, h("div", { class: "ape-sc-btns" }, bell, save))));
    this._statuses.push({ at: entry.at, el: status, card });
    return card;
  }

  _bellButton(entry) {
    const on = this.notifier.isFollowing(entry.site.nt);
    return h("button", {
      type: "button",
      class: "ape-sc-save ape-sc-bell" + (on ? " on" : ""),
      "aria-pressed": String(on),
      "aria-label": `${on ? "Stop notifying me about" : "Notify me about new episodes of"} ${entry.title}`,
      title: on ? "Stop new-episode notifications" : "Notify me when a new episode is on animepahe",
      onClick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        const { nt, title, session } = entry.site;
        try {
          await this.notifier.toggle({ nt, title, session });
        } finally {
          btn.disabled = false;
          if (!this._dead) this.render();
        }
      },
    }, bellIcon(16, on));
  }

  _paintStatuses() {
    if (!this.root) return;
    const now = Date.now();
    for (const node of this._statuses) {
      const ms = node.at * 1000 - now;
      node.el.className = "ape-sc-status " + (ms <= 0 ? "aired" : ms < SOON_MS ? "soon" : "later");
      node.el.replaceChildren(...(ms <= 0 ? [checkIcon(12)] : []), document.createTextNode(countdown(ms)));
      node.card.classList.toggle("aired", ms <= 0);
    }
  }

  _onVisible(entries) {
    for (const e of entries) {
      const poster = e.target;
      if (!poster._item || poster._done) continue;
      if (!e.isIntersecting) {
        cancelPoster(poster._item);
        continue;
      }
      requestPoster(poster._item).then((url) => {
        if (this._dead) return;
        poster._done = true;
        if (url) poster._img.src = url;
      });
    }
  }
}

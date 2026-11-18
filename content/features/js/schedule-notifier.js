import { keepMounted } from "../../helpers/persist.js";
import { injectStylesheet } from "../../helpers/styles.js";
import { bellIcon } from "../../helpers/icons.js";
import { showAction, showPill } from "../../helpers/pill.js";
import { ensurePosterStore, peekPoster } from "../../helpers/browse-data.js";
import {
  NOTIFY_KEY,
  DEFAULT_CHECK_MINUTES,
  MAX_FOLLOWED,
  normalizeNotify,
  loadNotify,
  followShow,
  unfollowShow,
  markRead,
  markAllRead,
  syncSessions,
  checkFollowed,
} from "../../helpers/schedule-notify.js";

const POLL_MS = 60_000;
const FIRST_CHECK_DELAY_MS = 4_000;
const PANEL_WIDTH = 380;
const HEAD_PX = 46;
const FOOT_PX = 46;
const FOLLOW_ROW_PX = 41;
const ROW_PX = 76;
const MAX_ROWS = 6;

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

function ago(ms) {
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}\u2026` : text);
const followKeys = (state) => Object.keys(state.follow).sort().join("\n");

/** New-episode notifications for followed shows: menu bell, unread badge and a dropdown. */
export class EpisodeNotifier {
  constructor(settings) {
    this._settings = settings;
    this._state = normalizeNotify(null);
    this._listeners = new Set();
    this._wrap = null;
    this._btn = null;
    this._badge = null;
    this._panel = null;
    this._view = "feed";
    this._open = false;
    this._onDocClick = (e) => {
      if (this._open && !this._wrap.contains(e.target) && !this._panel.contains(e.target)) this.close();
    };
    this._onKey = (e) => {
      if (e.key === "Escape" && this._open) {
        this.close();
        this._btn.focus();
      }
    };
    this._onResize = () => {
      if (!this._open) return;
      this._renderPanel();
      this._place();
    };
  }

  get checkMs() {
    const minutes = Number(this._settings?.scheduleNotifyCheckMinutes);
    return (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_CHECK_MINUTES) * 60_000;
  }

  async init() {
    injectStylesheet("ape-schedule-notify-styles", "content/features/css/schedule-notify.css");
    this._state = await loadNotify();
    await ensurePosterStore().catch(() => {});
    keepMounted(() => this._mountBell());

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[NOTIFY_KEY]) this._apply(normalizeNotify(changes[NOTIFY_KEY].newValue));
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.check();
    });
    setTimeout(() => this.check(), FIRST_CHECK_DELAY_MS);
    setInterval(() => {
      if (!document.hidden) this.check();
    }, POLL_MS);
  }

  isFollowing(nt) {
    return !!this._state.follow[nt];
  }

  /** Called when the set of followed shows changes, here or in another tab. */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  syncSessions(universe) {
    return syncSessions(universe).catch(() => {});
  }

  async toggle(show) {
    if (this.isFollowing(show.nt)) {
      await unfollowShow(show.nt);
      this._apply(await loadNotify());
      return { following: false };
    }
    const res = await followShow(show);
    if (!res.ok) {
      showPill(`You can follow up to ${MAX_FOLLOWED} shows. Unfollow one from its schedule card first.`, 6000);
      return { following: false };
    }
    this._apply(await loadNotify());
    return { following: true };
  }

  async check(force = false) {
    let fresh;
    try {
      fresh = await checkFollowed({ intervalMs: this.checkMs, force });
    } catch {
      return [];
    }
    if (!fresh.length) return [];
    this._apply(await loadNotify());
    this._toast(fresh);
    return fresh;
  }

  open(view = "feed") {
    if (!this._btn) return;
    this._view = view;
    this._open = true;
    this._btn.setAttribute("aria-expanded", "true");
    this._renderPanel();
    this._panel.hidden = false;
    this._place();
    document.addEventListener("click", this._onDocClick, true);
    document.addEventListener("keydown", this._onKey);
    window.addEventListener("resize", this._onResize);
  }

  close() {
    if (!this._panel) return;
    const hadUnread = this._open && this._unread().length > 0;
    this._open = false;
    this._panel.hidden = true;
    this._btn?.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", this._onDocClick, true);
    document.removeEventListener("keydown", this._onKey);
    window.removeEventListener("resize", this._onResize);
    if (hadUnread) markAllRead().catch(() => {}); // seen it: clear the badge once the popup is dismissed
  }

  _apply(next) {
    const before = followKeys(this._state);
    this._state = next;
    this._paintBadge();
    if (this._open) this._renderPanel();
    if (followKeys(next) !== before) for (const fn of this._listeners) fn();
  }

  _unread() {
    return this._state.feed.filter((i) => !i.read);
  }

  _mountBell() {
    if (this._wrap?.isConnected) return;
    if (this._open) this.close();
    for (const stale of document.querySelectorAll(".ape-nf-wrap")) stale.remove(); // e.g. a copy carried over by the site
    const nav = document.querySelector(".navbar-nav");
    const host = nav?.parentElement ?? document.querySelector("header, .navbar");
    if (!host) return;

    this._badge = h("span", { class: "ape-nf-badge", hidden: true, "aria-hidden": "true" });
    this._btn = h("button", {
      type: "button",
      class: "ape-nf-bell",
      "aria-haspopup": "dialog",
      "aria-expanded": "false",
      onClick: () => (this._open ? this.close() : this.open()),
    }, bellIcon(18), this._badge);
    this._wrap = h("div", { id: "ape-nf-wrap", class: "ape-nf-wrap" }, this._btn);

    if (!this._panel) {
      this._panel = h("div", {
        class: "ape-nf-panel",
        role: "dialog",
        "aria-label": "New episodes",
        hidden: true,
      });
    }
    if (!this._panel.isConnected) document.body.append(this._panel);

    if (nav) nav.after(this._wrap);
    else host.append(this._wrap);
    this._paintBadge();
  }

  _paintBadge() {
    if (!this._btn) return;
    const n = this._unread().length;
    this._badge.hidden = n === 0;
    this._badge.textContent = n > 9 ? "9+" : String(n);
    const label = n ? `New episodes (${n} unread)` : "New episodes";
    this._btn.setAttribute("aria-label", label);
    this._btn.title = label;
  }

  _place() {
    const rect = this._btn.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    this._panel.style.width = `${width}px`;
    this._panel.style.left = `${left}px`;
    this._panel.style.top = `${rect.bottom + 8}px`;
  }

  _toast(items) {
    const pill = document.getElementById("ape-pill");
    if (pill && pill.style.opacity === "1") return; // never cover another feature's status
    const [first] = items;
    showAction({
      icon: "bell",
      text: items.length === 1 ? clip(first.title, 30) : `${items.length} new episodes`,
      detail: items.length === 1 ? `Episode ${first.episode} is out` : "",
      action: { label: "View", onClick: () => this.open() },
      autohideMs: 9000,
    });
  }

  _renderPanel() {
    const following = this._view === "following";
    const room = window.innerHeight - 96 - HEAD_PX - FOOT_PX;
    const rows = following
      ? Math.max(1, Math.min(10, Math.floor(room / FOLLOW_ROW_PX)))
      : Math.max(1, Math.min(MAX_ROWS, Math.floor(room / ROW_PX)));

    const head = h("div", { class: "ape-nf-head" },
      h("span", { class: "ape-nf-title", text: following ? "Following" : "New episodes" }));
    const body = h("div", { class: "ape-nf-body" }, following ? this._followingList(rows) : this._feedList(rows));
    const count = Object.keys(this._state.follow).length;
    const foot = h("div", { class: "ape-nf-foot" },
      h("button", {
        type: "button",
        class: "ape-nf-link",
        text: following ? "Back to new episodes" : `Following (${count})`,
        onClick: () => {
          this._view = following ? "feed" : "following";
          this._renderPanel();
        },
      }),
      h("a", { class: "ape-nf-link", href: "/anime#schedule", text: "Schedule", onClick: () => this.close() }));
    this._panel.replaceChildren(head, body, foot);
  }

  _feedList(rows) {
    const feed = this._state.feed.slice(0, rows);
    if (!feed.length) {
      const none = !Object.keys(this._state.follow).length;
      return h("p", {
        class: "ape-nf-empty",
        text: none
          ? "Follow a show with the bell on its schedule card to see here when a new episode is on animepahe."
          : "Nothing new yet. You will see new episodes of the shows you follow here.",
      });
    }
    return h("ul", { class: "ape-nf-list" }, ...feed.map((item) => {
      const poster = peekPoster({ nt: item.nt });
      const thumb = h("span", { class: "ape-nf-thumb", "aria-hidden": "true" },
        poster ? h("img", { src: poster, alt: "", decoding: "async", referrerpolicy: "no-referrer" }) : item.title[0]?.toUpperCase() ?? "");
      return h("li", {},
        h("a", {
          class: "ape-nf-item" + (item.read ? "" : " unread"),
          href: `/play/${item.session}/${item.epSession}`,
          onClick: () => markRead(item.epSession),
        },
          thumb,
          h("span", { class: "ape-nf-text" },
            h("span", { class: "ape-nf-name", text: item.title }),
            h("span", { class: "ape-nf-sub", text: `Episode ${item.episode} \u00b7 ${ago(item.at)}` })),
          item.read ? null : h("span", { class: "ape-nf-dot", "aria-label": "Unread" })));
    }));
  }

  /** Followed shows with an Unfollow button; the popup never scrolls, so extras are summarised. */
  _followingList(rows) {
    const entries = Object.entries(this._state.follow).sort((a, b) => a[1].title.localeCompare(b[1].title));
    if (!entries.length) {
      return h("p", { class: "ape-nf-empty", text: "You are not following any shows yet." });
    }
    const shown = entries.slice(0, rows);
    const hidden = entries.length - shown.length;
    return h("ul", { class: "ape-nf-list" },
      ...shown.map(([nt, f]) =>
        h("li", { class: "ape-nf-row" },
          h("a", { class: "ape-nf-name", href: `/anime/${f.session}`, text: f.title }),
          h("button", {
            type: "button",
            class: "ape-nf-link",
            text: "Unfollow",
            "aria-label": `Unfollow ${f.title}`,
            onClick: async () => {
              await unfollowShow(nt);
              this._apply(await loadNotify());
            },
          }))),
      hidden > 0 ? h("li", { class: "ape-nf-more", text: `+${hidden} more, manage them from the schedule cards` }) : null);
  }
}

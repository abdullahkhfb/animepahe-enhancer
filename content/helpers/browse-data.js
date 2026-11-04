/**
 * browse-data.js — data layer for Browse.
 *
 * Filtering is done the same way the AnimePahe Improvements userscript does it:
 * every selected filter maps to one of animepahe's own list pages
 *
 *   /anime/genre/{slug}   /anime/theme/{slug}   /anime/demographic/{slug}
 *   /anime/type/{slug}    /anime/season/{season}-{year}   /anime/{airing|completed}
 *
 * which is downloaded once, parsed into a set of titles and cached. Results are
 * then combined locally (AND / OR within a group, AND between groups, excluded
 * tags removed). Nothing is guessed from titles.
 *
 * Request budget:
 *   - a filter list is only fetched when the user selects it, then cached
 *     (browseCacheTtlHours, default 72h) and held in memory;
 *   - at most 2 list downloads run at once;
 *   - posters are looked up one title at a time, only for cards that are on
 *     screen, with a hard cap of 2 search requests per title, and the result
 *     (including "no poster found") is cached.
 */

import { throttler } from "./throttler.js";
import { readCache, writeCache, parseCacheEntry } from "./cache.js";
import { storage } from "./storage.js";

export const LIST_PREFIX = "bl2_";
export const POSTER_KEY = "ape_br_posters_v1";
export const LIBRARY_KEY = "ape_br_lib_v1";
export const STATE_KEY = "ape_br_state_v1";

const LEGACY_KEYS = [
  "ape_bm_v1", // old poster/meta store (contained guessed seasons/years)
  "ape_bw_lib_v2",
  "ape_bw_lib_v1",
  "bi_library_v1",
];

// ── filter definitions (values copied from the userscript's filterValues) ──

const GENRE_VALUES = [
    ["Action", "action"],
    ["Adventure", "adventure"],
    ["Avant Garde", "avant-garde"],
    ["Award Winning", "award-winning"],
    ["Boys Love", "boys-love"],
    ["Comedy", "comedy"],
    ["Drama", "drama"],
    ["Ecchi", "ecchi"],
    ["Erotica", "erotica"],
    ["Fantasy", "fantasy"],
    ["Girls Love", "girls-love"],
    ["Gourmet", "gourmet"],
    ["Hentai", "hentai"],
    ["Horror", "horror"],
    ["Mystery", "mystery"],
    ["Romance", "romance"],
    ["Sci-Fi", "sci-fi"],
    ["Slice of Life", "slice-of-life"],
    ["Sports", "sports"],
    ["Supernatural", "supernatural"],
    ["Suspense", "suspense"]
];
const THEME_VALUES = [
    ["Super Power", "super-power"],
    ["School", "school"],
    ["Isekai", "isekai"],
    ["Reincarnation", "reincarnation"],
    ["Video Game", "video-game"],
    ["Martial Arts", "martial-arts"],
    ["Psychological", "psychological"],
    ["Military", "military"],
    ["Adult Cast", "adult-cast"],
    ["Detective", "detective"],
    ["Historical", "historical"],
    ["Parody", "parody"],
    ["Samurai", "samurai"],
    ["Space", "space"],
    ["Anthropomorphic", "anthropomorphic"],
    ["CGDCT", "cgdct"],
    ["Childcare", "childcare"],
    ["Combat Sports", "combat-sports"],
    ["Crossdressing", "crossdressing"],
    ["Delinquents", "delinquents"],
    ["Educational", "educational"],
    ["Gag Humor", "gag-humor"],
    ["Gore", "gore"],
    ["Harem", "harem"],
    ["High Stakes Game", "high-stakes-game"],
    ["Idols (Female)", "idols-female"],
    ["Idols (Male)", "idols-male"],
    ["Iyashikei", "iyashikei"],
    ["Love Polygon", "love-polygon"],
    ["Love Status Quo", "love-status-quo"],
    ["Magical Sex Shift", "magical-sex-shift"],
    ["Mahou Shoujo", "mahou-shoujo"],
    ["Mecha", "mecha"],
    ["Medical", "medical"],
    ["Music", "music"],
    ["Mythology", "mythology"],
    ["Organized Crime", "organized-crime"],
    ["Otaku Culture", "otaku-culture"],
    ["Performing Arts", "performing-arts"],
    ["Pets", "pets"],
    ["Racing", "racing"],
    ["Reverse Harem", "reverse-harem"],
    ["Romantic Subtext", "romantic-subtext"],
    ["Showbiz", "showbiz"],
    ["Strategy Game", "strategy-game"],
    ["Survival", "survival"],
    ["Team Sports", "team-sports"],
    ["Time Travel", "time-travel"],
    ["Urban Fantasy", "urban-fantasy"],
    ["Vampire", "vampire"],
    ["Villainess", "villainess"],
    ["Visual Arts", "visual-arts"],
    ["Workplace", "workplace"]
];
const DEMOGRAPHIC_VALUES = [
    ["Josei", "josei"],
    ["Kids", "kids"],
    ["Seinen", "seinen"],
    ["Shoujo", "shoujo"],
    ["Shounen", "shounen"]
];
const TYPE_VALUES = [
    ["TV", "tv"],
    ["Movie", "movie"],
    ["OVA", "ova"],
    ["ONA", "ona"],
    ["Special", "special"],
    ["Music", "music"]
];

const SEASON_NAMES = ["winter", "spring", "summer", "fall"];
export const SEASON_LABEL = { winter: "Winter", spring: "Spring", summer: "Summer", fall: "Fall" };

/**
 * id        – one-letter prefix used in filter keys ("g:action") and in the URL hash
 * rule      – how several *included* tags of this group combine: "all" (AND) or "any" (OR).
 *             Genres and themes default to AND like the userscript; the user can switch them.
 * switchable – whether the panel offers an all/any switch
 */
export const GROUPS = [
  { id: "g", name: "Genres", short: "Genre", rule: "all", switchable: true, values: GENRE_VALUES },
  { id: "t", name: "Themes", short: "Theme", rule: "all", switchable: true, values: THEME_VALUES },
  { id: "d", name: "Demographic", short: "Demo", rule: "any", values: DEMOGRAPHIC_VALUES },
  { id: "y", name: "Type", short: "Type", rule: "any", values: TYPE_VALUES },
  { id: "a", name: "Status", short: "Status", rule: "any", values: [["Airing", "airing"], ["Completed", "completed"]] },
  { id: "s", name: "Season", short: "Season", rule: "any", values: null },
];
export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

const SEASON_VALUE_RE = /^(winter|spring|summer|fall)-(\d{4})$/;

export const keyOf = (gid, value) => `${gid}:${value}`;
export const groupOfKey = (key) => key[0];
export const valueOfKey = (key) => key.slice(2);
export const seasonValue = (season, year) => `${season}-${year}`;

/** True for keys that name a real filter (used to sanitise URL / saved state). */
export function isValidKey(key) {
  if (typeof key !== "string" || key[1] !== ":") return false;
  const group = GROUP_BY_ID[key[0]];
  if (!group) return false;
  const value = key.slice(2);
  if (group.id === "s") return SEASON_VALUE_RE.test(value);
  return group.values.some(([, v]) => v === value);
}

/** animepahe path that lists the anime for one filter key. */
export function listPath(key) {
  const gid = key[0];
  const value = key.slice(2);
  switch (gid) {
    case "g": return `/anime/genre/${value}`;
    case "t": return `/anime/theme/${value}`;
    case "d": return `/anime/demographic/${value}`;
    case "y": return `/anime/type/${value}`;
    case "a": return `/anime/${value}`;
    case "s": return `/anime/season/${value}`;
    default: throw new Error(`Unknown filter key: ${key}`);
  }
}

export function labelOf(key) {
  const gid = key[0];
  const value = key.slice(2);
  if (gid === "s") {
    const m = SEASON_VALUE_RE.exec(value);
    return m ? `${SEASON_LABEL[m[1]]} ${m[2]}` : value;
  }
  const hit = GROUP_BY_ID[gid]?.values?.find(([, v]) => v === value);
  return hit ? hit[0] : value;
}

export const SEASON_ORDER = SEASON_NAMES;

// ── titles & parsing ─────────────────────────────────────────────────────

export function normTitle(title) {
  if (!title || typeof title !== "string") return "";
  return title
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d`´]/g, "'")
    .replace(/\s+/g, " ");
}

const RESERVED = new Set(["genre", "theme", "demographic", "season", "studio", "index", "anime", "browse", "type", "airing", "completed"]);
const DISC_RE = /^(BD|DVD)$/i;
const SKIP_ANCESTORS = "header, nav, footer, .search-results, .ui-autocomplete, .navbar, #ape-br-root, #ape-cw-section";

export function cleanSession(raw) {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim().replace(/[?#].*$/, "");
  const m = s.match(/\/anime\/([0-9a-fA-F-]{8,36})\/?$/);
  if (m && !RESERVED.has(m[1].toLowerCase())) return m[1];
  return "";
}

function entryFromAnchor(a, col) {
  if (!a || a.closest(SKIP_ANCESTORS)) return null;
  const href = a.getAttribute("href") || "";
  const session = cleanSession(href);
  if (!session) return null;

  const clone = a.cloneNode(true);
  let disc = "";
  for (const b of clone.querySelectorAll(".badge, [class*='badge']")) {
    const t = b.textContent.trim();
    if (!disc && DISC_RE.test(t)) disc = t.toUpperCase();
    b.remove();
  }
  const title = (a.getAttribute("title") || clone.textContent || "").replace(/\s+/g, " ").trim();
  if (!title) return null;

  if (!disc && col) {
    for (const b of col.querySelectorAll(".badge, [class*='badge']")) {
      const t = b.textContent.trim();
      if (DISC_RE.test(t)) {
        disc = t.toUpperCase();
        break;
      }
    }
  }
  return { session, title, nt: normTitle(title), disc, href: `/anime/${session}` };
}

/**
 * Reads the anime list out of an animepahe list page (the A–Z index, or any
 * /anime/<filter> page) — a live Document or one parsed from fetched HTML.
 * Returns Map<session, {session, title, nt, disc, href}>.
 */
export function parseAnimeList(root) {
  const out = new Map();
  if (!root?.querySelectorAll) return out;

  // The site lays entries out as `.col-12 > a` rows (same selector the userscript uses).
  for (const col of root.querySelectorAll(".col-12")) {
    const first = col.children[0];
    const a = first && first.tagName === "A" ? first : col.querySelector("a[href]");
    const e = entryFromAnchor(a, col);
    if (e && !out.has(e.session)) out.set(e.session, e);
  }
  if (out.size) return out;

  // Layout fallback: any anchor that points at an anime page.
  for (const a of root.querySelectorAll("a[href*='/anime/']")) {
    const e = entryFromAnchor(a, null);
    if (e && !out.has(e.session)) out.set(e.session, e);
  }
  return out;
}

/** The full anime index, read from the page we are on. */
export function readUniverse(root = document) {
  return parseAnimeList(root);
}

// ── filter lists ─────────────────────────────────────────────────────────

export const DEFAULT_LIST_TTL_MS = 72 * 60 * 60 * 1000;

// key -> { set: Set<normTitle> | null, promise }
const listMem = new Map();

function limiter(max) {
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < max && queue.length) {
      const { fn, resolve, reject } = queue.shift();
      active++;
      fn()
        .then(resolve, reject)
        .finally(() => {
          active--;
          pump();
        });
    }
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      pump();
    });
}
const listSlot = limiter(2);

const CHALLENGE_TITLE_RE = /^\s*(just a moment|attention required|checking your browser)/i;

async function downloadList(path) {
  const html = await listSlot(() => throttler.fetch(path, false, { plain: true, maxRetries: 2 }));
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  if (CHALLENGE_TITLE_RE.test(doc.title || "")) {
    throw new Error("Blocked by a Cloudflare challenge");
  }
  const titles = new Set();
  for (const e of parseAnimeList(doc).values()) if (e.nt) titles.add(e.nt);
  return titles;
}

/** Already-loaded set for a key (never triggers a request). */
export function peekList(key) {
  return listMem.get(key)?.set ?? null;
}

/**
 * Loads one filter list: memory -> storage cache -> network. Concurrent callers
 * share one promise. A failed load is forgotten so it can be retried.
 */
export function loadList(key, { ttlMs = DEFAULT_LIST_TTL_MS } = {}) {
  const existing = listMem.get(key);
  if (existing) return existing.promise;

  const entry = { set: null, promise: null };
  entry.promise = (async () => {
    const cached = await readCache(LIST_PREFIX + key, ttlMs).catch(() => null);
    if (Array.isArray(cached)) {
      entry.set = new Set(cached);
      return entry.set;
    }
    let titles;
    try {
      titles = await downloadList(listPath(key));
    } catch (err) {
      // A season that doesn't exist (yet) is a 404: that is "no anime", not a failure.
      if (/HTTP 404/.test(String(err?.message))) titles = new Set();
      else throw err;
    }
    entry.set = titles;
    writeCache(LIST_PREFIX + key, [...titles]).catch(() => {});
    return titles;
  })().catch((err) => {
    listMem.delete(key);
    throw err;
  });
  listMem.set(key, entry);
  return entry.promise;
}

export async function getBrowseCacheInfo() {
  const [lists, posters] = await Promise.all([
    storage.keysWithPrefix(LIST_PREFIX),
    storage.get(POSTER_KEY),
  ]);
  const posterCount = posters && typeof posters === "object" ? Object.keys(posters.d || {}).length : 0;
  return { lists: lists.length, posters: posterCount };
}

export async function gcBrowseCache(ttlMs) {
  const all = await storage.getWithPrefix(LIST_PREFIX);
  const now = Date.now();
  const stale = [];
  for (const [key, raw] of Object.entries(all)) {
    const entry = parseCacheEntry(raw);
    if (!entry || now - entry.timestamp > ttlMs) stale.push(key);
  }
  // Remove data written by the earlier local Browse build.
  stale.push(...LEGACY_KEYS.filter((k) => k !== "ape_bw_lib_v2" && k !== "ape_bw_lib_v1" && k !== "bi_library_v1"));
  if (stale.length) await chrome.storage.local.remove(stale);
}

/** Clears downloaded lists and poster lookups. The user's Library is kept. */
export async function clearBrowseCache() {
  const keys = await storage.keysWithPrefix(LIST_PREFIX);
  await chrome.storage.local.remove([...keys, POSTER_KEY, "ape_bm_v1"]);
  listMem.clear();
  posterStore?.clear();
}

// ── posters ──────────────────────────────────────────────────────────────
//
// Keyed by normalised title (stable across animepahe session rotations).
// Record: [posterUrl | "", timestamp]. "" means "searched, no poster found".

const POSTER_TTL = 14 * 24 * 60 * 60 * 1000;
const POSTER_MISS_TTL = 12 * 60 * 60 * 1000;
const POSTER_MAX = 9000;
const POSTER_WORKERS = 2;
const POSTER_GAP_MS = 250;
const MAX_QUERIES_PER_TITLE = 2;

let posterStore = null; // Map<nt, [url, ts]>
let posterLoading = null;
let posterSaveTimer = 0;
let apiFailStreak = 0;
let apiSuccesses = 0;
let apiDown = false;

export function ensurePosterStore() {
  if (posterStore) return Promise.resolve(posterStore);
  posterLoading ??= (async () => {
    const m = new Map();
    try {
      const raw = await storage.get(POSTER_KEY);
      const now = Date.now();
      if (raw && typeof raw === "object" && raw.d) {
        for (const [nt, rec] of Object.entries(raw.d)) {
          if (!Array.isArray(rec)) continue;
          const [url, ts] = rec;
          const ttl = url ? POSTER_TTL : POSTER_MISS_TTL;
          if (typeof ts === "number" && now - ts < ttl) m.set(nt, [url || "", ts]);
        }
      }
    } catch {
      /* start empty */
    }
    posterStore = m;
    return m;
  })();
  return posterLoading;
}

let posterDirty = false;

async function flushPosters() {
  clearTimeout(posterSaveTimer);
  if (!posterStore || !posterDirty) return;
  posterDirty = false;
  while (posterStore.size > POSTER_MAX) posterStore.delete(posterStore.keys().next().value);
  try {
    await storage.set(POSTER_KEY, { v: 1, d: Object.fromEntries(posterStore) });
  } catch {
    /* quota: the in-memory copy still works */
  }
}

function savePostersSoon() {
  posterDirty = true;
  clearTimeout(posterSaveTimer);
  posterSaveTimer = setTimeout(flushPosters, 1500);
}

/** string = poster url, null = looked up and none exists, undefined = not looked up yet. */
export function peekPoster(item) {
  const rec = posterStore?.get(item.nt);
  if (!rec) return undefined;
  return rec[0] || null;
}

function searchQueries(title) {
  const raw = String(title || "").trim();
  if (raw.length < 2) return [];
  // Same normalisation the userscript uses for /api?m=search.
  const queries = [raw.replaceAll(" -", " ").slice(0, 80)];
  const cleaned = raw
    .replace(/[#★☆♡♪♥!?~"“”'’`´:;/\\\-–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  if (cleaned.length >= 3 && cleaned !== queries[0]) queries.push(cleaned);
  return queries.slice(0, MAX_QUERIES_PER_TITLE);
}

async function searchOnce(q) {
  const json = await throttler.fetch(`/api?m=search&q=${encodeURIComponent(q)}`, true, { maxRetries: 1 });
  const data = Array.isArray(json?.data) ? json.data : [];
  const now = Date.now();
  for (const e of data) {
    if (!e?.poster || !e.title) continue;
    const nt = normTitle(e.title);
    if (nt) posterStore.set(nt, [String(e.poster), now]);
  }
  apiFailStreak = 0;
  apiSuccesses++;
}

const posterJobs = new Map(); // nt -> { item, promise, resolve, started }
const posterQueue = []; // nt, in request order

async function runPosterJob(job) {
  const { item } = job;
  let found = false;
  for (const q of searchQueries(item.title)) {
    if (apiDown) break;
    try {
      await searchOnce(q);
    } catch (err) {
      apiFailStreak++;
      if (err?.isCfChallenge || (apiSuccesses === 0 && apiFailStreak >= 4)) apiDown = true;
      break;
    }
    if (posterStore.get(item.nt)?.[0]) {
      found = true;
      break;
    }
  }
  if (!found && !apiDown && !posterStore.get(item.nt)?.[0]) {
    posterStore.set(item.nt, ["", Date.now()]); // remember the miss
  }
  savePostersSoon();
  return posterStore.get(item.nt)?.[0] || null;
}

let posterWorkers = 0;
function pumpPosters() {
  while (posterWorkers < POSTER_WORKERS && posterQueue.length) {
    const nt = posterQueue.shift();
    const job = posterJobs.get(nt);
    if (!job) continue;
    job.started = true;
    posterWorkers++;
    runPosterJob(job)
      .then(job.resolve, () => job.resolve(null))
      .finally(async () => {
        posterJobs.delete(nt);
        await new Promise((r) => setTimeout(r, POSTER_GAP_MS));
        posterWorkers--;
        pumpPosters();
      });
  }
}

/**
 * Asks for an item's poster. Resolves to a URL or null. Cached results resolve
 * immediately without any request; identical requests share one job.
 */
export async function requestPoster(item) {
  const store = await ensurePosterStore();
  const rec = store.get(item.nt);
  if (rec) return rec[0] || null;
  if (apiDown || !item.nt) return null;

  let job = posterJobs.get(item.nt);
  if (!job) {
    job = { item, started: false };
    job.promise = new Promise((resolve) => (job.resolve = resolve));
    posterJobs.set(item.nt, job);
    posterQueue.push(item.nt);
    pumpPosters();
  }
  return job.promise;
}

/** Drops a queued (not yet started) lookup, e.g. when its card scrolled away. */
export function cancelPoster(item) {
  const job = posterJobs.get(item.nt);
  if (!job || job.started) return;
  const i = posterQueue.indexOf(item.nt);
  if (i >= 0) posterQueue.splice(i, 1);
  posterJobs.delete(item.nt);
  job.resolve(null);
}

// ── Library (saved anime) ────────────────────────────────────────────────
// Stored as normalised titles so a saved anime survives session rotation.

let libraryMem = null;

export async function getSavedLibrary(universe) {
  if (libraryMem) return libraryMem;
  const set = new Set();
  try {
    const raw = await storage.get(LIBRARY_KEY);
    if (Array.isArray(raw)) for (const nt of raw) if (typeof nt === "string") set.add(nt);

    // One-time import of the earlier Browse build's library (it stored sessions).
    const legacy = await chrome.storage.local.get(["ape_bw_lib_v2", "ape_bw_lib_v1", "bi_library_v1"]);
    const legacySessions = Object.values(legacy).flatMap((v) => (Array.isArray(v) ? v : []));
    if (legacySessions.length && universe) {
      for (const s of legacySessions) {
        const hit = universe.get(s);
        if (hit?.nt) set.add(hit.nt);
      }
    }
    if (Object.keys(legacy).length) {
      if (set.size) await storage.set(LIBRARY_KEY, [...set]);
      await chrome.storage.local.remove(Object.keys(legacy));
    }
  } catch {
    /* start empty */
  }
  libraryMem = set;
  return set;
}

export async function toggleSavedLibrary(nt) {
  const set = await getSavedLibrary();
  if (!nt) return { saved: false, size: set.size };
  if (set.has(nt)) set.delete(nt);
  else set.add(nt);
  try {
    await storage.set(LIBRARY_KEY, [...set]);
  } catch {
    /* ignore */
  }
  return { saved: set.has(nt), size: set.size };
}

export async function clearSavedLibrary() {
  libraryMem = new Set();
  try {
    await chrome.storage.local.remove([LIBRARY_KEY]);
  } catch {
    /* ignore */
  }
  return libraryMem;
}

// ── remembered view state ────────────────────────────────────────────────

export async function loadState() {
  try {
    const s = await storage.get(STATE_KEY);
    return s && typeof s === "object" ? s : null;
  } catch {
    return null;
  }
}

let stateTimer = 0;
let pendingState = null;

function flushState() {
  clearTimeout(stateTimer);
  if (!pendingState) return;
  const state = pendingState;
  pendingState = null;
  storage.set(STATE_KEY, state).catch(() => {});
}

export function saveStateSoon(state) {
  pendingState = state;
  clearTimeout(stateTimer);
  stateTimer = setTimeout(flushState, 400);
}

// Don't lose the last few changes when the page is left or reloaded.
function flushAll() {
  flushState();
  flushPosters();
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushAll);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
}

import { readCache, writeCache, parseCacheEntry } from "./cache.js";
import { storage } from "./storage.js";
import { normTitle } from "./browse-data.js";

const ANILIST_URL = "https://graphql.anilist.co";

export const SCHEDULE_PREFIX = "ape_sc_week_";
export const SCHEDULE_STATE_KEY = "ape_sc_state_v1";
export const DEFAULT_SCHEDULE_TTL_MS = 60 * 60 * 1000;

const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const PAGE_GAP_MS = 800;
const FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);
const FORMAT_LABEL = { TV: "TV", TV_SHORT: "TV", ONA: "ONA" };

const QUERY = `query ($from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: ${PAGE_SIZE}) {
    pageInfo { hasNextPage }
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      airingAt
      episode
      media { id title { romaji english } format countryOfOrigin isAdult }
    }
  }
}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function weekStartOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function dayOf(start, index) {
  const d = new Date(start);
  d.setDate(d.getDate() + index);
  return d;
}

function weekKey(start) {
  const mm = String(start.getMonth() + 1).padStart(2, "0");
  const dd = String(start.getDate()).padStart(2, "0");
  return `${SCHEDULE_PREFIX}${start.getFullYear()}${mm}${dd}`;
}

async function downloadRange(from, to) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { from: from - 1, to, page } }),
    });
    if (res.status === 429) {
      const err = new Error("AniList rate limit reached");
      err.rateLimited = true;
      throw err;
    }
    if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);

    const json = await res.json();
    const data = json?.data?.Page;
    if (!data) throw new Error("AniList returned no schedule");

    for (const item of data.airingSchedules ?? []) {
      const media = item.media;
      if (!media || media.isAdult || media.countryOfOrigin !== "JP") continue;
      if (!FORMATS.has(media.format)) continue;
      rows.push([
        item.airingAt,
        item.episode,
        media.id,
        media.title?.romaji ?? "",
        media.title?.english ?? "",
        FORMAT_LABEL[media.format],
      ]);
    }
    if (!data.pageInfo?.hasNextPage) break;
    await sleep(PAGE_GAP_MS);
  }
  return rows;
}

function inflate([at, episode, id, romaji, english, format]) {
  const titles = [english, romaji].filter(Boolean);
  return { at, episode, id, format, title: titles[0] ?? "Untitled", titles };
}

/** Loads one Monday-to-Sunday week of airing episodes: storage cache, then AniList. */
export async function loadWeek(start, { ttlMs = DEFAULT_SCHEDULE_TTL_MS, force = false } = {}) {
  const key = weekKey(start);
  if (!force) {
    const hit = await readCache(key, ttlMs).catch(() => null);
    if (Array.isArray(hit)) return hit.map(inflate);
  }
  const end = dayOf(start, 7);
  const rows = await downloadRange(Math.floor(start.getTime() / 1000), Math.floor(end.getTime() / 1000));
  writeCache(key, rows).catch(() => {});
  return rows.map(inflate);
}

const looseKey = (title) => normTitle(title).replace(/[^\p{L}\p{N}]+/gu, "");

/** Matches AniList titles against animepahe's own anime index (no requests). */
export function buildSiteIndex(universe) {
  const exact = new Map();
  const loose = new Map();
  for (const item of universe.values()) {
    if (!exact.has(item.nt)) exact.set(item.nt, item);
    const key = looseKey(item.title);
    if (key && !loose.has(key)) loose.set(key, item);
  }
  return {
    find(entry) {
      for (const title of entry.titles) {
        const hit = exact.get(normTitle(title));
        if (hit) return hit;
      }
      for (const title of entry.titles) {
        const hit = loose.get(looseKey(title));
        if (hit) return hit;
      }
      return null;
    },
  };
}

export async function loadScheduleState() {
  try {
    const state = await storage.get(SCHEDULE_STATE_KEY);
    return state && typeof state === "object" ? state : null;
  } catch {
    return null;
  }
}

export function saveScheduleState(state) {
  storage.set(SCHEDULE_STATE_KEY, state).catch(() => {});
}

export async function getScheduleCacheInfo() {
  const keys = await storage.keysWithPrefix(SCHEDULE_PREFIX);
  return { weeks: keys.length };
}

export async function clearScheduleCache() {
  const keys = await storage.keysWithPrefix(SCHEDULE_PREFIX);
  if (keys.length) await chrome.storage.local.remove(keys);
}

export async function gcScheduleCache(ttlMs) {
  const all = await storage.getWithPrefix(SCHEDULE_PREFIX);
  const now = Date.now();
  const stale = Object.entries(all)
    .filter(([, raw]) => {
      const entry = parseCacheEntry(raw);
      return !entry || now - entry.timestamp > ttlMs;
    })
    .map(([key]) => key);
  if (stale.length) await chrome.storage.local.remove(stale);
}

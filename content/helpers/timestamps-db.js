/**
 * timestamps-db.js
 *
 * Provides access to the open-anime-timestamps dataset
 * (https://github.com/Ellivers/open-anime-timestamps) for the
 * Intro/Outro Skip feature.
 *
 * Responsibilities:
 *   1. Resolve animepahe animeSession -> animeTitle -> AniList ID
 *   2. Resolve AniList ID -> AniDB ID via relations.yuna.moe
 *   3. Fetch and cache the (large, ~27 MB) timestamps.json blob
 *      in IndexedDB, with conditional GET (ETag) refresh
 *   4. Look up intro/outro timestamps for a given episode
 *
 * Caching strategy:
 *   - ID resolution (animeSession -> AniDB ID) goes through the
 *     existing chrome.storage.local helper cache (`ape_isid_` prefix)
 *     so we don't re-query AniList and yuna.moe on every visit.
 *   - The big timestamps JSON lives in IndexedDB (chrome.storage.local
 *     has a 10 MB quota — too small). We store the raw text + ETag +
 *     fetchedAt, and refresh on a configurable schedule.
 *   - The parsed object is cached in module scope for the lifetime
 *     of the page so repeated lookups on the same page are free.
 */

import { storage } from "./storage.js";
import { readCache, writeCache } from "./cache.js";

const TIMESTAMPS_URL =
  "https://raw.githubusercontent.com/Ellivers/open-anime-timestamps/master/timestamps.json";

const ANILIST_URL = "https://graphql.anilist.co";
const RELATIONS_URL = "https://relations.yuna.moe/api/ids";

const ID_CACHE_PREFIX = "ape_isid_";
const ID_CACHE_VERSION = "v1";

// The big timestamps JSON lives in IndexedDB (chrome.storage.local would
// need the unlimitedStorage permission for a 27 MB value, and every get()
// would re-deserialize the whole thing).
const DB_NAME = "ape_intro_skip";
const DB_STORE = "kv";
const DB_KEY_TIMESTAMPS = "timestamps_blob";
const DB_VERSION = 1;

// Small metadata record shared between the content script and the popup
// via chrome.storage.local. The popup can't see the content script's
// IndexedDB (different origin), so it reads this instead.
const META_KEY = "ape_is_db_meta";

let _dbPromise = null;
let _parsedCache = null;
let _inflightFetch = null;

// ────────────────────────────────────────────────────────────────────────
// IndexedDB wrapper (minimal key-value store)
// ────────────────────────────────────────────────────────────────────────

function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ────────────────────────────────────────────────────────────────────────
// ID resolution: animeSession -> animeTitle -> AniList ID -> AniDB ID
// ────────────────────────────────────────────────────────────────────────

function normalizeTitle(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function titleSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

const ANILIST_SEARCH_QUERY = `
query ($q: String) {
  Page(perPage: 8) {
    media(search: $q, type: ANIME, sort: SEARCH_MATCH) {
      id
      idMal
      title { romaji english }
      synonyms
    }
  }
}`.trim();

async function queryAniList(title) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: ANILIST_SEARCH_QUERY,
      variables: { q: title },
    }),
  });
  if (!res.ok) {
    throw new Error(`AniList HTTP ${res.status}`);
  }
  const json = await res.json();
  return json?.data?.Page?.media ?? [];
}

async function resolveAnilistId(animeTitle) {
  if (!animeTitle) return null;
  const media = await queryAniList(animeTitle);
  if (!media.length) return null;

  const nTitle = normalizeTitle(animeTitle);

  // Pick the closest match by title similarity, preferring English > romaji > synonym.
  let best = null;
  let bestScore = -1;
  for (const m of media) {
    const candidates = [
      m.title?.english,
      m.title?.romaji,
      ...(m.synonyms ?? []),
    ].filter((t) => t && t.length >= 2);

    for (const c of candidates) {
      const score = titleSimilarity(nTitle, normalizeTitle(c));
      if (score > bestScore) {
        bestScore = score;
        best = { anilistId: m.id, idMal: m.idMal ?? null };
      }
    }
  }

  // Reject poor matches — if the best similarity is below 0.5 we likely
  // matched the wrong series and would feed garbage into the timestamps DB.
  if (!best || bestScore < 0.5) return null;
  return best;
}

async function resolveAniDbId(anilistId, idMal) {
  // Try via AniList ID first, fall back to MAL ID — yuna.moe supports both.
  const trySources = [];
  if (anilistId) trySources.push({ source: "anilist", id: anilistId });
  if (idMal) trySources.push({ source: "myanimelist", id: idMal });

  for (const { source, id } of trySources) {
    try {
      const res = await fetch(
        `${RELATIONS_URL}?source=${source}&id=${id}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.anidb) return json.anidb;
    } catch {}
  }
  return null;
}

/**
 * Returns the AniDB ID for a given animepahe animeSession + animeTitle.
 * Cached per animeSession in chrome.storage.local with TTL.
 */
export async function getAniDbIdForAnime(animeSession, animeTitle, ttlMs) {
  const ids = await resolveIdsForAnime(animeSession, animeTitle, ttlMs);
  return ids?.anidbId ?? null;
}

/**
 * Returns ALL the IDs we can resolve for a given animepahe animeSession +
 * animeTitle: AniDB, AniList, and MAL. Cached per animeSession with TTL.
 */
export async function resolveIdsForAnime(animeSession, animeTitle, ttlMs) {
  const cacheKey = `${ID_CACHE_PREFIX}${ID_CACHE_VERSION}_${animeSession}`;
  const cached = await readCache(cacheKey, ttlMs);
  if (cached && cached.anidbId != null) return cached;

  const anilistHit = await resolveAnilistId(animeTitle);
  if (!anilistHit) {
    // Cache negative results too, with a short TTL, to avoid spamming AniList.
    await writeCache(cacheKey, { anidbId: null });
    return null;
  }

  const anidbId = await resolveAniDbId(anilistHit.anilistId, anilistHit.idMal);
  const entry = {
    anidbId,
    anilistId: anilistHit.anilistId,
    idMal: anilistHit.idMal,
  };
  await writeCache(cacheKey, entry);
  return entry;
}

// ────────────────────────────────────────────────────────────────────────
// Timestamps JSON database (IndexedDB + conditional GET)
// ────────────────────────────────────────────────────────────────────────

/**
 * Returns the parsed timestamps database object, fetching and caching
 * it as needed. Re-uses an in-memory cache so repeated calls on the
 * same page are free.
 *
 * @param {number} refreshHours  Max age in hours before re-fetching.
 * @param {(msg: string, pct?: number) => void} [onProgress]  Optional callback for status updates.
 */
export async function getTimestampsDb(refreshHours, onProgress) {
  const refreshMs = refreshHours * 60 * 60 * 1_000;
  const cached = await idbGet(DB_KEY_TIMESTAMPS);
  // Meta lives in chrome.storage.local (shared with the popup). If it's
  // missing, the user cleared the cache from the popup — force a re-fetch
  // even if the IndexedDB blob is still around.
  const meta = await readMeta();

  if (_parsedCache) return _parsedCache;

  let rawText = cached?.text ?? null;
  let etag = cached?.etag ?? meta?.etag ?? null;
  const fetchedAt = meta?.fetchedAt ?? cached?.fetchedAt ?? 0;
  const isStale =
    !rawText || !meta || Date.now() - fetchedAt > refreshMs;

  if (isStale) {
    if (onProgress) onProgress("Downloading skip database…");
    try {
      const headers = { Accept: "application/json" };
      if (etag) headers["If-None-Match"] = etag;

      if (!_inflightFetch) {
        _inflightFetch = (async () => {
          const res = await fetch(TIMESTAMPS_URL, { headers });
          if (res.status === 304 && rawText) {
            // Not modified — refresh metadata only.
            const now = Date.now();
            await idbSet(DB_KEY_TIMESTAMPS, {
              text: rawText,
              etag,
              fetchedAt: now,
            });
            await writeMeta({
              fetchedAt: now,
              sizeBytes: rawText.length,
              etag,
            });
            return { text: rawText, etag, notModified: true };
          }
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} fetching timestamps.json`);
          }
          const text = await res.text();
          const newEtag = res.headers.get("etag") ?? etag;
          const now = Date.now();
          await idbSet(DB_KEY_TIMESTAMPS, {
            text,
            etag: newEtag,
            fetchedAt: now,
          });
          await writeMeta({
            fetchedAt: now,
            sizeBytes: text.length,
            etag: newEtag,
          });
          return { text, etag: newEtag, notModified: false };
        })().finally(() => {
          _inflightFetch = null;
        });
      }

      const result = await _inflightFetch;
      rawText = result.text;
      etag = result.etag;
    } catch (err) {
      // Network/CDN failure — fall back to the cached copy if we have one.
      if (!rawText) throw err;
      console.warn(
        "[IntroSkip] Failed to refresh timestamps DB, using cached copy:",
        err,
      );
    }
  }

  if (onProgress) onProgress("Parsing skip database…");
  _parsedCache = JSON.parse(rawText);
  return _parsedCache;
}

async function writeMeta(meta) {
  try {
    await storage.set(META_KEY, meta);
  } catch {}
}

async function readMeta() {
  try {
    return await storage.get(META_KEY);
  } catch {
    return null;
  }
}

/**
 * Look up intro/outro timestamps for a specific episode from the local
 * open-anime-timestamps dataset.
 *
 * The dataset uses -1 to mean "unknown" and -2 to mean "explicitly none".
 * For start-only entries we extend with a default duration so users still
 * get a usable skip target.
 *
 * @param {string|number} anidbId
 * @param {string|number} episodeNumber
 * @param {object} settings
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<{ intro: {start:number,end:number}|null, outro: {start:number,end:number}|null, recap: {start:number,end:number}|null, previewStart: number|null, source: 'oat'|null }>}
 */
export async function getTimestampsForEpisode(
  anidbId,
  episodeNumber,
  settings,
  onProgress,
) {
  const refreshHours = settings?.introSkipDbRefreshHours ?? 168;
  const defaultOp = settings?.introSkipDefaultOpDuration ?? 90;
  const defaultEd = settings?.introSkipDefaultEdDuration ?? 90;

  if (anidbId != null) {
    let db = null;
    try {
      db = await getTimestampsDb(refreshHours, onProgress);
    } catch (err) {
      console.warn("[IntroSkip] OAT DB unavailable:", err);
    }

    const eps = db?.[String(anidbId)];
    if (Array.isArray(eps) && eps.length) {
      const ep = eps.find(
        (e) => Number(e.episode_number) === Number(episodeNumber),
      );
      if (ep) {
        const result = {
          intro: normalizeSegment(ep.opening, defaultOp),
          outro: normalizeSegment(ep.ending, defaultEd),
          recap: normalizeSegment(ep.recap, 0),
          previewStart: normalizeScalar(ep.preview_start),
          source: "oat",
        };
        if (result.intro || result.outro) return result;
      }
    }
  }

  return {
    intro: null,
    outro: null,
    recap: null,
    previewStart: null,
    source: null,
  };
}

function normalizeSegment(seg, defaultDuration) {
  if (!seg || typeof seg !== "object") return null;
  let { start, end } = seg;
  start = Number(start);
  end = Number(end);
  if (!Number.isFinite(start)) return null;

  // -2 = explicitly no segment exists; -1 = unknown.
  if (start < 0) return null;

  if (!Number.isFinite(end) || end < 0) {
    if (defaultDuration > 0) {
      end = start + defaultDuration;
    } else {
      // No default duration available — surface a start-only hint so the
      // caller can still show a Skip button without a target.
      return { start, end: null };
    }
  }

  if (end <= start) return null;
  return { start, end };
}

function normalizeScalar(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

// ────────────────────────────────────────────────────────────────────────
// Cache management (used by popup "Clear Cache" button)
// ────────────────────────────────────────────────────────────────────────

export async function clearTimestampsCache() {
  _parsedCache = null;
  try {
    await idbSet(DB_KEY_TIMESTAMPS, null);
  } catch {}
  try {
    await storage.remove(META_KEY);
  } catch {}
  const idKeys = await storage.keysWithPrefix(ID_CACHE_PREFIX);
  if (idKeys.length) await chrome.storage.local.remove(idKeys);
}

export async function getTimestampsCacheInfo() {
  const meta = await readMeta();
  const idKeys = await storage.keysWithPrefix(ID_CACHE_PREFIX);
  if (!meta) {
    return {
      hasDb: false,
      idEntries: idKeys.length,
      sizeBytes: 0,
      fetchedAt: 0,
    };
  }
  return {
    hasDb: true,
    idEntries: idKeys.length,
    sizeBytes: meta.sizeBytes ?? 0,
    fetchedAt: meta.fetchedAt ?? 0,
  };
}

export { ID_CACHE_PREFIX, TIMESTAMPS_URL, META_KEY };

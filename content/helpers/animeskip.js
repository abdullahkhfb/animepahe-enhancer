/**
 * animeskip.js
 *
 * Fallback timestamps source for the Intro/Outro Skip feature.
 *
 * Service: Anime Skip (https://anime-skip.com)
 * Endpoint: https://api.anime-skip.com/graphql
 * Auth: Anonymous reads are allowed, BUT a X-Client-ID header is required.
 *   We use the shared public client ID below — it's rate-limited, so we
 *   cache aggressively (24h per episode's timestamps, 7d per show's
 *   episode list, 7d per AniList→show mapping).
 *
 * Resolution chain:
 *   AniList ID -> findShowsByExternalId(service: ANILIST, serviceId)
 *   -> pick the show with the most episodes
 *   -> findEpisodesByShowId(showId)
 *   -> match episode by number
 *   -> findTimestampsByEpisodeId(episodeId)
 *   -> derive intro/outro/recap segments
 *
 * Timestamp model: each timestamp marks the START of a segment with `at`
 * (seconds, float). The END of a segment is the `at` of the next
 * timestamp in the episode (or the episode's baseDuration if it's the
 * last one). The segment type is identified by `typeId` — a stable UUID
 * (not a GraphQL enum), so we hardcode the ones we care about.
 */

import { readCache, writeCache } from "./cache.js";

const ANIMESKIP_GQL_URL = "https://api.anime-skip.com/graphql";
const ANIMESKIP_CLIENT_ID = "ZGfO0sMF3eCwLYf8yMSCJjlynwNGRXWE";

const CACHE_PREFIX = "ape_askip_";
const CACHE_TTL_SHOW_MS = 7 * 24 * 60 * 60 * 1_000; // 7 days
const CACHE_TTL_EPISODES_MS = 7 * 24 * 60 * 60 * 1_000;
const CACHE_TTL_TIMESTAMPS_MS = 24 * 60 * 60 * 1_000; // 1 day

// Stable timestamp type UUIDs (from allTimestampTypes query).
const TYPE_ID = {
  INTRO: "14550023-2589-46f0-bfb4-152976506b4c",
  MIXED_INTRO: "5ed1a3ec-4795-4607-8c19-e2f41c2bbb7d",
  NEW_INTRO: "f76ddcf0-e53e-4d73-b3b1-e3a1c8aae0c5",
  CREDITS: "2a730a51-a601-439b-bc1f-7b94a640ffb9", // = outro
  MIXED_CREDITS: "8b0b3df6-914e-4f5a-bdb2-21fb0d46b9b8",
  NEW_CREDITS: "99591f37-d25b-4ee3-a8a2-f3c0f5a5d1c4",
  RECAP: "f38ac196-0d49-40a9-8fcf-f3ef2f40f127",
  PREVIEW: "0fc6c2f8-1b1b-4b9c-b4b7-2f41c2bbb7d",
};

const INTRO_TYPE_IDS = new Set([
  TYPE_ID.INTRO,
  TYPE_ID.MIXED_INTRO,
  TYPE_ID.NEW_INTRO,
]);
const OUTRO_TYPE_IDS = new Set([
  TYPE_ID.CREDITS,
  TYPE_ID.MIXED_CREDITS,
  TYPE_ID.NEW_CREDITS,
]);

// ────────────────────────────────────────────────────────────────────────
// GraphQL queries
// ────────────────────────────────────────────────────────────────────────

const QUERY_SHOWS_BY_ANILIST = `
query ($anilistId: String!) {
  findShowsByExternalId(service: ANILIST, serviceId: $anilistId) {
    id
    name
    episodeCount
  }
}`.trim();

const QUERY_EPISODES_BY_SHOW = `
query ($showId: ID!) {
  findEpisodesByShowId(showId: $showId) {
    id
    name
    season
    number
    absoluteNumber
    baseDuration
  }
}`.trim();

const QUERY_TIMESTAMPS_BY_EPISODE = `
query ($episodeId: ID!) {
  findTimestampsByEpisodeId(episodeId: $episodeId) {
    id
    at
    typeId
    type { id name }
  }
}`.trim();

// ────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────

/**
 * Query Anime Skip for intro/outro/recap timestamps for a specific episode.
 *
 * @param {{ anilistId?: number|null, malId?: number|null, episodeNumber: number|string, animeTitle?: string }} params
 * @param {number} defaultOpDuration  Fallback OP length (seconds) when only start is known.
 * @param {number} defaultEdDuration  Fallback ED length (seconds) when only start is known.
 * @returns {Promise<{ intro: {start:number,end:number}|null, outro: {start:number,end:number}|null, recap: {start:number,end:number}|null, previewStart: number|null } | null>}
 */
export async function queryAnimeSkipTimestamps(
  { anilistId, malId, episodeNumber, animeTitle },
  defaultOpDuration = 90,
  defaultEdDuration = 90,
) {
  if (!anilistId) {
    // Anime Skip only supports AniList IDs — without one we can't query.
    return null;
  }

  const showId = await resolveShowId(anilistId);
  if (!showId) return null;

  const episode = await findEpisode(showId, episodeNumber);
  if (!episode) return null;

  const timestamps = await fetchTimestamps(episode.id);
  if (!timestamps?.length) return null;

  return parseTimestamps(
    timestamps,
    episode.baseDuration ?? 0,
    defaultOpDuration,
    defaultEdDuration,
  );
}

// ────────────────────────────────────────────────────────────────────────
// Step 1: resolve show ID from AniList ID
// ────────────────────────────────────────────────────────────────────────

async function resolveShowId(anilistId) {
  const cacheKey = `${CACHE_PREFIX}show_${anilistId}`;
  const cached = await readCache(cacheKey, CACHE_TTL_SHOW_MS);
  if (cached?.showId) return cached.showId;

  const data = await gql(QUERY_SHOWS_BY_ANILIST, {
    anilistId: String(anilistId),
  });
  const shows = data?.findShowsByExternalId ?? [];
  if (!shows.length) {
    await writeCache(cacheKey, { showId: null });
    return null;
  }

  // Multiple shows may map to the same AniList ID — pick the one with the
  // most episodes (best coverage for our episode-number lookup).
  shows.sort((a, b) => (b.episodeCount ?? 0) - (a.episodeCount ?? 0));
  const showId = shows[0].id;
  await writeCache(cacheKey, { showId, name: shows[0].name });
  return showId;
}

// ────────────────────────────────────────────────────────────────────────
// Step 2: find the episode matching episodeNumber
// ────────────────────────────────────────────────────────────────────────

async function findEpisode(showId, episodeNumber) {
  const targetNum = Number(episodeNumber);

  const cacheKey = `${CACHE_PREFIX}eps_${showId}`;
  let episodes = await readCache(cacheKey, CACHE_TTL_EPISODES_MS);

  if (!episodes) {
    const data = await gql(QUERY_EPISODES_BY_SHOW, { showId });
    episodes = data?.findEpisodesByShowId ?? null;
    if (episodes) await writeCache(cacheKey, episodes);
  }

  if (!episodes?.length) return null;

  // Try exact match on `number` (which is a String in the schema).
  let match = episodes.find((e) => Number(e.number) === targetNum);
  if (match) return match;

  // Fall back to `absoluteNumber` (also a String).
  match = episodes.find((e) => Number(e.absoluteNumber) === targetNum);
  return match ?? null;
}

// ────────────────────────────────────────────────────────────────────────
// Step 3: fetch timestamps for the episode
// ────────────────────────────────────────────────────────────────────────

async function fetchTimestamps(episodeId) {
  const cacheKey = `${CACHE_PREFIX}ts_${episodeId}`;
  let timestamps = await readCache(cacheKey, CACHE_TTL_TIMESTAMPS_MS);

  if (!timestamps) {
    const data = await gql(QUERY_TIMESTAMPS_BY_EPISODE, { episodeId });
    timestamps = data?.findTimestampsByEpisodeId ?? null;
    if (timestamps) await writeCache(cacheKey, timestamps);
  }

  return timestamps ?? null;
}

// ────────────────────────────────────────────────────────────────────────
// Step 4: parse timestamps into { intro, outro, recap, previewStart }
//
// Anime Skip timestamps are point-in-time: each `at` marks the START of a
// segment. The END is the `at` of the NEXT timestamp (chronologically),
// or the episode's baseDuration if it's the last one. We sort by `at`,
// then walk the list deriving ranges.
// ────────────────────────────────────────────────────────────────────────

function parseTimestamps(
  timestamps,
  episodeDuration,
  defaultOpDuration,
  defaultEdDuration,
) {
  const result = {
    intro: null,
    outro: null,
    recap: null,
    previewStart: null,
  };

  const sorted = [...timestamps]
    .filter((ts) => Number.isFinite(Number(ts.at)) && Number(ts.at) >= 0)
    .sort((a, b) => Number(a.at) - Number(b.at));

  for (let i = 0; i < sorted.length; i++) {
    const ts = sorted[i];
    const start = Number(ts.at);
    const next = sorted[i + 1];
    // End = next timestamp's start, or the episode duration, or a default.
    let end = next ? Number(next.at) : episodeDuration;
    if (!Number.isFinite(end) || end <= start) {
      // No next timestamp and no episode duration — extend with a default
      // based on type so the caller still has a usable skip target.
      const isOutro = OUTRO_TYPE_IDS.has(ts.typeId);
      end = start + (isOutro ? defaultEdDuration : defaultOpDuration);
    }

    const seg = { start, end };
    if (INTRO_TYPE_IDS.has(ts.typeId)) {
      if (!result.intro) result.intro = seg;
    } else if (OUTRO_TYPE_IDS.has(ts.typeId)) {
      if (!result.outro) result.outro = seg;
    } else if (ts.typeId === TYPE_ID.RECAP) {
      if (!result.recap) result.recap = seg;
    } else if (ts.typeId === TYPE_ID.PREVIEW) {
      if (result.previewStart == null) result.previewStart = start;
    }
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────
// GraphQL helper
// ────────────────────────────────────────────────────────────────────────

async function gql(query, variables) {
  const res = await fetch(ANIMESKIP_GQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Client-ID": ANIMESKIP_CLIENT_ID,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`AnimeSkip HTTP ${res.status}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(
      `AnimeSkip GraphQL: ${json.errors[0]?.message ?? "error"}`,
    );
  }
  return json.data ?? null;
}

export { ANIMESKIP_GQL_URL, CACHE_PREFIX as ANIMESKIP_CACHE_PREFIX };

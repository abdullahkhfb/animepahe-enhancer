import { throttler } from "./throttler.js";
import { storage } from "./storage.js";
import { normTitle } from "./browse-data.js";

export const NOTIFY_KEY = "ape_sc_notify_v1";
export const DEFAULT_CHECK_MINUTES = 30;
export const MAX_FOLLOWED = 40;

const MAX_FEED = 100;
const MAX_NEW_PER_SHOW = 5;
const API_RETRIES = 2;

const emptyState = () => ({ v: 1, follow: {}, feed: [], checkedAt: 0 });

/** Accepts whatever storage returns and always gives back a well-formed state. */
export function normalizeNotify(raw) {
  const state = emptyState();
  if (!raw || typeof raw !== "object") return state;
  if (raw.follow && typeof raw.follow === "object") {
    for (const [nt, f] of Object.entries(raw.follow)) {
      if (!f || typeof f.session !== "string" || typeof f.title !== "string") continue;
      state.follow[nt] = {
        session: f.session,
        title: f.title,
        lastAt: Number(f.lastAt) || 0,
        lastEp: Number(f.lastEp) || 0,
      };
    }
  }
  if (Array.isArray(raw.feed)) {
    for (const i of raw.feed) {
      if (!i || typeof i.epSession !== "string" || !Number.isFinite(Number(i.episode))) continue;
      state.feed.push({
        nt: String(i.nt ?? ""),
        title: String(i.title ?? ""),
        session: String(i.session ?? ""),
        epSession: i.epSession,
        episode: Number(i.episode),
        at: Number(i.at) || 0,
        read: i.read === true,
      });
    }
  }
  state.checkedAt = Number(raw.checkedAt) || 0;
  return state;
}

export async function loadNotify() {
  try {
    return normalizeNotify(await storage.get(NOTIFY_KEY));
  } catch {
    return emptyState();
  }
}

// Serialised so two quick writes in one tab can't overwrite each other.
let writeQueue = Promise.resolve();
function mutate(fn) {
  const run = async () => {
    const state = await loadNotify();
    const out = fn(state);
    await storage.set(NOTIFY_KEY, state);
    return out;
  };
  const next = writeQueue.then(run, run);
  writeQueue = next.catch(() => {});
  return next;
}

// created_at is "YYYY-MM-DD HH:MM:SS" in UTC.
function parseAt(value) {
  if (typeof value !== "string") return null;
  const ms = Date.parse(`${value.replace(" ", "T")}Z`);
  return Number.isFinite(ms) ? ms : null;
}

async function fetchEpisodes(session) {
  const json = await throttler.fetch(
    `/api?m=release&id=${encodeURIComponent(session)}&sort=episode_desc&page=1`,
    true,
    { maxRetries: API_RETRIES },
  );
  const rows = Array.isArray(json?.data) ? json.data : Object.values(json?.data ?? {});
  const eps = [];
  for (const row of rows) {
    const at = parseAt(row?.created_at);
    const episode = Number(row?.episode);
    if (at == null || !Number.isFinite(episode) || !row?.session) continue;
    eps.push({ episode, epSession: String(row.session), at });
  }
  return eps;
}

async function resolveSession(entry, nt) {
  const json = await throttler.fetch(
    `/api?m=search&q=${encodeURIComponent(entry.title.slice(0, 80))}`,
    true,
    { maxRetries: 1 },
  );
  const hit = (Array.isArray(json?.data) ? json.data : []).find(
    (e) => e?.session && normTitle(e.title) === nt,
  );
  return hit ? String(hit.session) : null;
}

const isBlocked = (err) => err?.rateLimited || err?.isCfChallenge;

// Sessions can rotate on animepahe, so a failing session is looked up again by title.
async function fetchWithRecovery(entry, nt) {
  let session = entry.session;
  let eps = null;
  try {
    eps = await fetchEpisodes(session);
  } catch (err) {
    if (isBlocked(err)) throw err;
  }
  if (!eps || (!eps.length && entry.lastEp > 0)) {
    const fresh = await resolveSession(entry, nt);
    if (fresh && fresh !== session) {
      session = fresh;
      eps = await fetchEpisodes(session).catch((err) => {
        if (isBlocked(err)) throw err;
        return null;
      });
    }
  }
  return { session, eps };
}

/**
 * Follows a show. The newest episode on animepahe right now becomes the
 * baseline, so only episodes released after this moment notify.
 */
export async function followShow({ nt, title, session }) {
  const state = await loadNotify();
  if (state.follow[nt]) return { ok: true };
  if (Object.keys(state.follow).length >= MAX_FOLLOWED) return { ok: false, reason: "limit" };

  let lastAt = Date.now();
  let lastEp = 0;
  try {
    const eps = await fetchEpisodes(session);
    // An empty list is a real answer: nothing is out yet, so the first upload is new.
    lastAt = eps.length ? Math.max(...eps.map((e) => e.at)) : 0;
    lastEp = eps.length ? Math.max(...eps.map((e) => e.episode)) : 0;
  } catch {
    /* offline or blocked: fall back to the clock */
  }
  await mutate((s) => {
    s.follow[nt] = { session, title, lastAt, lastEp };
  });
  return { ok: true };
}

export function unfollowShow(nt) {
  return mutate((s) => {
    delete s.follow[nt];
    s.feed = s.feed.filter((i) => i.nt !== nt);
  });
}

export function markRead(epSession) {
  return mutate((s) => {
    for (const i of s.feed) if (i.epSession === epSession) i.read = true;
  });
}

export function markAllRead() {
  return mutate((s) => {
    for (const i of s.feed) i.read = true;
  });
}

/** Keeps followed shows pointing at the session the site's index uses today. */
export function syncSessions(universe) {
  const byTitle = new Map();
  for (const item of universe.values()) if (!byTitle.has(item.nt)) byTitle.set(item.nt, item.session);
  return mutate((s) => {
    for (const [nt, f] of Object.entries(s.follow)) {
      const session = byTitle.get(nt);
      if (session && session !== f.session) f.session = session;
    }
  });
}

async function checkOne(nt) {
  const entry = (await loadNotify()).follow[nt];
  if (!entry) return [];
  const { session, eps } = await fetchWithRecovery(entry, nt);

  return mutate((s) => {
    const cur = s.follow[nt];
    if (!cur) return [];
    cur.session = session;
    if (!eps) return [];

    const known = new Set(s.feed.map((i) => i.epSession));
    const fresh = eps
      .filter((e) => e.at > cur.lastAt && !known.has(e.epSession))
      .sort((a, b) => b.episode - a.episode)
      .slice(0, MAX_NEW_PER_SHOW)
      .map((e) => ({ nt, title: cur.title, session, epSession: e.epSession, episode: e.episode, at: e.at, read: false }));

    for (const e of eps) {
      cur.lastAt = Math.max(cur.lastAt, e.at);
      cur.lastEp = Math.max(cur.lastEp, e.episode);
    }
    if (fresh.length) {
      s.feed = [...fresh, ...s.feed].sort((a, b) => b.at - a.at).slice(0, MAX_FEED);
    }
    return fresh;
  });
}

/**
 * Looks for new episodes of every followed show, at most once per interval
 * across all open tabs. Resolves to the episodes found by this run.
 */
export async function checkFollowed({ intervalMs, force = false } = {}) {
  const due = (s) => Object.keys(s.follow).length > 0 && (force || Date.now() - s.checkedAt >= intervalMs);
  // Read first: the claim below writes, and this runs every minute in every tab.
  if (!due(await loadNotify())) return [];

  // Re-checked inside the write so only one tab claims the run.
  const names = await mutate((s) => {
    if (!due(s)) return [];
    s.checkedAt = Date.now();
    return Object.keys(s.follow);
  });

  const found = [];
  for (const nt of names) {
    try {
      found.push(...(await checkOne(nt)));
    } catch (err) {
      if (isBlocked(err)) break;
    }
  }
  return found;
}

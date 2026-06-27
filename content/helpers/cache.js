import { storage } from "./storage.js";

export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
export const EP_PREFIX = "d2_";
export const HOME_PREFIX = "h2_";

const CACHE_VERSION = "v1";

export function parseCacheEntry(raw) {
  if (!raw || typeof raw !== "string") return null;
  const pipe = raw.indexOf("|");
  if (pipe === -1) return null;
  const timestamp = Number(raw.slice(0, pipe));
  if (!Number.isFinite(timestamp)) return null;
  const rest = raw.slice(pipe + 1);

  if (!rest.startsWith(CACHE_VERSION + "|")) return null;
  const valuePart = rest.slice(CACHE_VERSION.length + 1);

  return { timestamp, valuePart };
}

export function makeCacheEntry(value) {
  return `${Date.now()}|${CACHE_VERSION}|${JSON.stringify(value)}`;
}

export async function readCache(key, ttlMs = DEFAULT_CACHE_TTL_MS) {
  const raw = await storage.get(key);
  const entry = parseCacheEntry(raw);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) return null;
  try {
    return JSON.parse(entry.valuePart);
  } catch {
    return null;
  }
}

export async function writeCache(key, value) {
  return storage.set(key, makeCacheEntry(value));
}

export const epCacheKey = (epSession) => `${EP_PREFIX}${epSession}`;
export const homeCacheKey = (animeSession) => `${HOME_PREFIX}${animeSession}`;

export async function gcDubCache(ttlMs = DEFAULT_CACHE_TTL_MS) {
  const [epEntries, homeEntries] = await Promise.all([
    storage.getWithPrefix(EP_PREFIX),
    storage.getWithPrefix(HOME_PREFIX),
  ]);

  const staleKeys = [];
  const now = Date.now();

  for (const [key, raw] of Object.entries({ ...epEntries, ...homeEntries })) {
    const entry = parseCacheEntry(raw);
    if (!entry || now - entry.timestamp > ttlMs) {
      staleKeys.push(key);
    }
  }

  if (staleKeys.length) {
    await chrome.storage.local.remove(staleKeys);
  }
}

export async function clearDubCache() {
  const [epKeys, homeKeys] = await Promise.all([
    storage.keysWithPrefix(EP_PREFIX),
    storage.keysWithPrefix(HOME_PREFIX),
  ]);
  const all = [...epKeys, ...homeKeys];
  if (all.length) await chrome.storage.local.remove(all);
}

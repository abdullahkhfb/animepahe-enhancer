import { readCache, writeCache } from "../helpers/cache.js";

const ANILIST_URL = "https://graphql.anilist.co";
const CACHE_PFX = "ape_ss_";
const MIN_TITLE_LEN = 2;

const ANILIST_QUERY = `
query ($q: String) {
  Page(perPage: 15) {
    media(search: $q, type: ANIME, sort: SEARCH_MATCH) {
      title { romaji english }
      synonyms
    }
  }
}`.trim();

function norm(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
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

function fuzzyMatch(a, b) {
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const maxDist = Math.floor(Math.max(a.length, b.length) * 0.25);
  return levenshtein(a, b) <= maxDist;
}

function isRelevant(itemTitle, altTitlesNorms, nq) {
  const nItem = norm(itemTitle);
  if (nItem.includes(nq) || fuzzyMatch(nItem, nq)) return true;

  for (const nAlt of altTitlesNorms) {
    if (nItem.includes(nAlt) || nAlt.includes(nItem)) return true;
    if (fuzzyMatch(nItem, nAlt)) return true;

    const altWords = nAlt.split(" ");
    let overlap = 0;
    for (const w of altWords) {
      if (nItem.includes(w)) overlap++;
    }
    if (altWords.length > 0 && overlap / altWords.length >= 0.7) return true;
  }
  return false;
}

async function getAltTitles(query, ttlMs) {
  const key = `${CACHE_PFX}${norm(query).replace(/\s/g, "_").slice(0, 80)}`;
  try {
    const hit = await readCache(key, ttlMs);
    if (hit !== null && hit.allTitles && hit.allTitles.length > 0) return hit;
  } catch {}

  const resObj = { allTitles: [], queryCandidates: [], bestMatch: "" };
  try {
    let json = null;
    console.log(`[SmartSearch] Direct fetch to AniList Data...`);

    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { q: query } }),
    });
    if (res.ok) json = await res.json();

    const media = json?.data?.Page?.media ?? [];

    if (media.length > 0) {
      resObj.bestMatch =
        media[0].title?.english || media[0].title?.romaji || "";
      const nq = norm(query);
      let targetMedia = media[0];
      for (const m of media) {
        const allM = [
          m.title?.romaji,
          m.title?.english,
          ...(m.synonyms || []),
        ].map((t) => norm(t));
        if (allM.some((t) => fuzzyMatch(t, nq))) {
          targetMedia = m;
          break;
        }
      }

      const r = targetMedia.title?.romaji;
      const e = targetMedia.title?.english;
      const syns = targetMedia.synonyms ?? [];
      const rawAll = [r, e, ...syns].filter(Boolean);
      resObj.allTitles = [
        ...new Set(rawAll.filter((t) => t.length >= MIN_TITLE_LEN)),
      ];
      const rawCands = [e, r, ...syns].filter(Boolean);
      resObj.queryCandidates = [
        ...new Set(rawCands.filter((t) => t.length >= MIN_TITLE_LEN)),
      ];

      console.log(`[SmartSearch] Synonyms Extracted:`, resObj.queryCandidates);
    }
  } catch (err) {
    console.error(`[SmartSearch] Critical Error in getAltTitles:`, err);
  }

  if (resObj.allTitles.length > 0) {
    try {
      await writeCache(key, resObj);
    } catch {}
  }
  return resObj;
}

async function apSearch(q) {
  try {
    const res = await fetch(`/api?m=search&q=${encodeURIComponent(q)}`, {
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    if (!res.ok) {
      console.warn(
        `[SmartSearch] AnimePahe API returned status ${res.status} for query: ${q}`,
      );
      return [];
    }
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch (err) {
    console.warn(
      `[SmartSearch] AnimePahe API Fetch failed for query: ${q}`,
      err,
    );
    return [];
  }
}

function getInput() {
  return document.querySelector("input[name='q']");
}

function getDropdown() {
  return document.querySelector(".search-results, .search-results ul");
}

function buildRow(item, originalQuery) {
  let posterEl;
  if (item.poster) {
    posterEl = document.createElement("img");
    posterEl.src = item.poster;
    posterEl.alt = item.title ?? "";
    posterEl.style.cssText =
      "width:40px !important; height:40px !important; border-radius:50% !important; object-fit:cover !important; flex-shrink:0 !important; display:block !important; margin:0 !important; padding:0 !important;";
  } else {
    posterEl = document.createElement("div");
    posterEl.style.cssText =
      "width:40px; height:40px; border-radius:50%; background:#1a1a30; flex-shrink:0;";
  }

  const meta = [
    item.type,
    item.episodes ? `${item.episodes} Eps` : "",
    item.season,
    item.year,
  ]
    .filter(Boolean)
    .join(" - ");

  const row = document.createElement("li");
  row.dataset.apeSSExtra = "1";
  row.dataset.apeSession = item.session ?? "";
  row.style.cssText =
    "border-left: 3px solid #d92558 !important; list-style: none !important; margin: 0 !important; padding: 0 !important;";

  const link = document.createElement("a");
  link.href = `/anime/${item.session ?? ""}`;
  link.style.cssText =
    "display:flex !important; align-items:center !important; gap:12px !important; padding:8px 12px !important; text-decoration:none !important; color:inherit !important; cursor:pointer !important; background:transparent !important;";

  const textWrap = document.createElement("div");
  textWrap.style.cssText =
    "display:flex; flex-direction:column; justify-content:center; overflow:hidden; line-height:1.3;";

  const titleEl = document.createElement("strong");
  titleEl.style.cssText =
    "color:#ffffff !important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:13px !important; display:block; font-weight:bold !important;";
  titleEl.textContent = item.title ?? "";

  const metaEl = document.createElement("small");
  metaEl.style.cssText =
    "color:#a0a0a0 !important; font-size:11px !important; display:block; margin-top:2px;";
  metaEl.textContent = meta;

  const matchEl = document.createElement("span");
  matchEl.style.cssText =
    "display:block; font-size:10px !important; color:#d97090 !important; font-style:italic !important; margin-top:2px; font-weight:600 !important;";
  matchEl.textContent = `also matching "${originalQuery}"`;

  textWrap.append(titleEl, metaEl, matchEl);
  link.append(posterEl, textWrap);
  row.appendChild(link);

  return row;
}

function injectRows(data, originalQuery) {
  const list = getDropdown();
  if (!list) return;

  list
    .querySelectorAll("[data-ape-ss-extra], .ape-ss-dym")
    .forEach((el) => el.remove());

  if (data.dym) {
    const dymRow = document.createElement("li");
    dymRow.className = "ape-ss-dym";
    dymRow.style.cssText =
      "padding: 8px 12px; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); list-style: none;";

    const dymLabel = document.createElement("span");
    dymLabel.style.cssText = "color: #888;";
    dymLabel.textContent = "Did you mean:";

    const dymLink = document.createElement("a");
    dymLink.href = "#";
    dymLink.style.cssText =
      "color: #d92558; font-weight: bold; text-decoration: none;";
    dymLink.textContent = data.dym;

    dymRow.append(dymLabel, " ", dymLink, "?");

    dymLink.addEventListener("click", (e) => {
      e.preventDefault();
      const input = getInput();
      if (input) {
        input.value = data.dym;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    list.insertBefore(dymRow, list.firstChild);
  }

  for (const item of data.items) {
    if (list.querySelector(`[href*="${item.session}"]`)) continue;
    const row = buildRow(item, originalQuery);
    list.appendChild(row);
  }

  if (list.style.display === "none" && (data.items.length > 0 || data.dym)) {
    list.style.display = "block";
  }
}

export class SmartSearch {
  constructor(storage, settings = {}) {
    this._storage = storage;
    this._debounceTimer = null;
    this._lastQuery = "";
    this._pendingResults = null;
    this._dropdownObserver = null;
    this._minLen = settings.ssMinQueryLen ?? 2;
    this._debounceMs = settings.ssDebounceMs ?? 100;
    this._maxSynonyms = settings.ssMaxSynonyms ?? 3;
    this._synonymDelay = settings.ssSynonymDelay ?? 250;
    this._cacheTtlMs = (settings.cacheTtlHours ?? 24) * 60 * 60 * 1_000;
  }

  async init(_pageType) {
    this._attachInputListener();
  }

  _attachInputListener() {
    document.addEventListener(
      "input",
      (e) => {
        const input = e.target;
        if (!input.matches("input[name='q']")) return;

        const q = input.value.trim();
        clearTimeout(this._debounceTimer);

        if (q.length < this._minLen) {
          this._lastQuery = "";
          this._pendingResults = null;
          const list = getDropdown();
          if (list)
            list
              .querySelectorAll("[data-ape-ss-extra], .ape-ss-dym")
              .forEach((el) => el.remove());
          return;
        }

        this._debounceTimer = setTimeout(() => {
          this._prefetch(q);
        }, this._debounceMs);
      },
      true,
    );
  }

  _observeDropdown() {
    const list = getDropdown();
    if (!list) return;
    const parent = list.parentElement || document.body;

    if (this._dropdownObserver) this._dropdownObserver.disconnect();

    this._dropdownObserver = new MutationObserver(() => {
      const currentList = getDropdown();
      if (currentList && !currentList.querySelector("[data-ape-ss-extra]")) {
        this._dropdownObserver.disconnect();
        this._tryInjectPending();
        this._dropdownObserver.observe(parent, {
          childList: true,
          subtree: true,
        });
      }
    });

    this._dropdownObserver.observe(parent, { childList: true, subtree: true });
  }

  async _prefetch(query) {
    console.log(`\n--- [SmartSearch] INITIALIZED FOR: "${query}" ---`);
    const nq = norm(query);
    if (nq === norm(this._lastQuery)) return;
    this._lastQuery = query;
    this._pendingResults = null;

    const promise = this._fetchExtras(query, nq);
    this._pendingResults = { nq, promise, data: null, originalQuery: query };

    promise.then((data) => {
      if (this._pendingResults?.nq === nq) {
        this._pendingResults.data = data;
        this._waitForDropdown().then(() => {
          this._observeDropdown();
          this._tryInjectPending();
        });
      }
    });
  }

  async _fetchExtras(query, nq) {
    const [altData, nativeItems] = await Promise.all([
      getAltTitles(query, this._cacheTtlMs),
      apSearch(query),
    ]);

    console.log(
      `[SmartSearch] Native AnimePahe Results Found:`,
      nativeItems.length,
    );

    const altTitles = altData.allTitles || [];
    const queryCandidates = altData.queryCandidates || [];
    const nativeNorms = new Set(nativeItems.map((r) => norm(r.title ?? "")));
    const altTitlesNorms = altTitles.map((t) => norm(t));

    const candidates = [
      ...new Set(queryCandidates.filter((t) => norm(t) !== nq)),
    ].slice(0, this._maxSynonyms);

    const result = { items: [], dym: null };

    if (
      nativeItems.length === 0 &&
      altData.bestMatch &&
      norm(altData.bestMatch) !== nq
    ) {
      result.dym = altData.bestMatch;
    }

    if (!candidates.length) {
      console.log(`[SmartSearch] No extra synonyms needed searching.`);
      return result;
    }

    const seen = new Set(nativeNorms);

    for (const c of candidates) {
      console.log(`[SmartSearch] Querying AnimePahe API for synonym: "${c}"`);
      const batch = await apSearch(c);

      for (const item of batch) {
        const n = norm(item.title ?? "");
        if (!seen.has(n) && isRelevant(item.title, altTitlesNorms, nq)) {
          seen.add(n);
          result.items.push(item);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, this._synonymDelay));
    }

    console.log(
      `[SmartSearch] Total extra relevant results injected:`,
      result.items.length,
    );
    return result;
  }

  _tryInjectPending() {
    const pending = this._pendingResults;
    if (!pending || !pending.data) return;

    const currentNq = norm(getInput()?.value?.trim() ?? "");
    if (currentNq !== pending.nq) return;

    injectRows(pending.data, pending.originalQuery);
  }

  _waitForDropdown(maxMs = 2000) {
    return new Promise((resolve) => {
      if (getDropdown()) return resolve();
      const t0 = Date.now();
      const obs = new MutationObserver(() => {
        if (getDropdown() || Date.now() - t0 > maxMs) {
          obs.disconnect();
          resolve();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    });
  }
}

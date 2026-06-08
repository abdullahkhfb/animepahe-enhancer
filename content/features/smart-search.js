import { readCache, writeCache } from "../helpers/cache.js";

const ANILIST_URL = "https://graphql.anilist.co";
const CACHE_PFX = "ape_ss_";
const MIN_LEN = 2;
const DEBOUNCE_MS = 300;

const ANILIST_QUERY = `
query ($q: String) {
  Page(perPage: 5) {
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

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isRelevant(itemTitle, altTitlesNorms, nq) {
  const nItem = norm(itemTitle);

  if (nItem.includes(nq) || nq.includes(nItem)) return true;

  const itemWords = nItem.split(" ");

  for (const nAlt of altTitlesNorms) {
    if (nItem.includes(nAlt) || nAlt.includes(nItem)) return true;

    const altWords = nAlt.split(" ");
    let overlap = 0;
    for (const w of altWords) {
      if (itemWords.includes(w)) overlap++;
    }

    const altRatio = overlap / altWords.length;
    const itemRatio = overlap / itemWords.length;

    if (altRatio >= 0.8 && itemRatio >= 0.5) return true;
  }
  return false;
}

async function getAltTitles(query) {
  const key = `${CACHE_PFX}${norm(query).replace(/\s/g, "_").slice(0, 80)}`;
  try {
    const hit = await readCache(key);
    if (hit !== null && hit.allTitles) return hit;
  } catch {}

  const resObj = { allTitles: [], queryCandidates: [] };
  try {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { q: query } }),
    });
    if (!res.ok) throw new Error(`AniList ${res.status}`);
    const json = await res.json();
    const media = json?.data?.Page?.media ?? [];

    if (media.length > 0) {
      const nq = norm(query);
      let targetMedia = media[0];

      for (const m of media) {
        const allM = [
          m.title?.romaji,
          m.title?.english,
          ...(m.synonyms || []),
        ].map((t) => norm(t));
        if (allM.includes(nq)) {
          targetMedia = m;
          break;
        }
      }

      const r = targetMedia.title?.romaji;
      const e = targetMedia.title?.english;
      const syns = targetMedia.synonyms ?? [];

      const rawAll = [r, e, ...syns].filter(Boolean);
      resObj.allTitles = [
        ...new Set(rawAll.filter((t) => t.length >= MIN_LEN)),
      ];

      const rawCands = [r, e, ...syns].filter(Boolean);
      resObj.queryCandidates = [
        ...new Set(rawCands.filter((t) => t.length >= MIN_LEN)),
      ];
    }
  } catch (err) {
    console.warn("[ape-ss] AniList:", err);
  }

  try {
    await writeCache(key, resObj);
  } catch {}
  return resObj;
}

async function apSearch(q) {
  try {
    const res = await fetch(`/api?m=search&q=${encodeURIComponent(q)}`, {
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data : [];
  } catch {
    return [];
  }
}

function getDropdown() {
  return (
    document.querySelector("#suggestionList") ||
    document.querySelector(".ui-autocomplete") ||
    document.querySelector("ul.suggestions") ||
    document.querySelector(".search-results ul") ||
    (() => {
      const input = getInput();
      if (!input) return null;
      let el = input.parentElement;
      for (let d = 0; d < 5; d++) {
        const ul = el?.querySelector("ul");
        if (ul && ul.children.length > 0) return ul;
        el = el?.parentElement;
      }
      return null;
    })()
  );
}

function getInput() {
  return document.querySelector(
    "input#inputSearch, input[name='q'], input[placeholder*='earch' i]",
  );
}

function buildRow(item, originalQuery, referenceRow) {
  let row;

  if (referenceRow) {
    row = referenceRow.cloneNode(true);
    row.removeAttribute("data-ape-ss-extra");

    const a = row.querySelector("a");

    if (a) {
      a.href = `/anime/${esc(item.session ?? "")}`;
      a.innerHTML = "";

      const posterStr = item.poster
        ? `<img src="${esc(item.poster)}" alt="${esc(item.title ?? "")}" style="float:left; margin-right:10px; flex-shrink:0;">`
        : `<span style="width:40px; height:40px; background:#1a1a30; border-radius:50%; float:left; margin-right:10px; flex-shrink:0; display:inline-block;"></span>`;

      const meta1 = [
        item.type,
        item.episodes ? `${item.episodes} Episodes` : "",
        item.status ? `(${item.status})` : "",
      ]
        .filter(Boolean)
        .join(" - ")
        .replace("- (", "(");
      const meta2 = [item.season, item.year].filter(Boolean).join(" ");

      a.innerHTML = `
        ${posterStr}
        <div style="display:flex; flex-direction:column; justify-content:center; line-height:1.4; overflow:hidden;">
          <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${esc(item.title ?? "")}</strong>
          ${meta1 ? `<span style="font-size:11px; opacity:0.7; margin-top:2px;">${esc(meta1)}</span>` : ""}
          ${meta2 ? `<span style="font-size:11px; opacity:0.7;">${esc(meta2)}</span>` : ""}
          <span class="ape-ss-aka">also known as "${esc(originalQuery)}"</span>
        </div>
        <div style="clear:both;"></div>
      `;
    }
  } else {
    row = document.createElement("li");

    const posterStr = item.poster
      ? `<img src="${esc(item.poster)}" alt="${esc(item.title ?? "")}" style="float:left; margin-right:10px; flex-shrink:0;">`
      : `<span style="width:40px; height:40px; background:#1a1a30; border-radius:50%; float:left; margin-right:10px; flex-shrink:0; display:inline-block;"></span>`;

    row.innerHTML = `
      <a href="/anime/${esc(item.session ?? "")}" style="display:block; padding:8px 12px; text-decoration:none; color:inherit; overflow:hidden;">
        ${posterStr}
        <div style="display:flex; flex-direction:column; justify-content:center; line-height:1.4;">
          <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${esc(item.title ?? "")}</strong>
          <span class="ape-ss-aka">also known as "${esc(originalQuery)}"</span>
        </div>
        <div style="clear:both;"></div>
      </a>
    `;
  }

  row.dataset.apeSSExtra = "1";
  row.dataset.apeSession = item.session ?? "";
  return row;
}

function injectRows(extraItems, originalQuery) {
  const list = getDropdown();
  if (!list || !extraItems.length) return;

  list.querySelectorAll("[data-ape-ss-extra]").forEach((el) => el.remove());
  list.querySelector(".ape-ss-header")?.remove();

  if (!extraItems.length) return;

  const nativeRows = [...list.children].filter((li) => !li.dataset.apeSSExtra);
  const referenceRow = nativeRows[0] ?? null;

  const header = document.createElement("li");
  header.className = "ape-ss-header";
  header.innerHTML = `Also matching <strong>"${esc(originalQuery)}"</strong>`;
  list.insertBefore(header, list.firstChild);

  let insertAfter = header;
  for (const item of extraItems) {
    if (list.querySelector(`[data-ape-session="${item.session}"]`)) continue;
    const row = buildRow(item, originalQuery, referenceRow);
    insertAfter.insertAdjacentElement("afterend", row);
    insertAfter = row;
  }
}

function injectStyles() {
  if (document.getElementById("ape-ss-styles")) return;
  const s = document.createElement("style");
  s.id = "ape-ss-styles";
  s.textContent = `
    #suggestionList img, .ui-autocomplete img, .search-results img, ul.suggestions img {
        border-radius: 50% !important;
        width: 40px !important;
        height: 40px !important;
        object-fit: cover !important;
    }

    .ape-ss-header {
      padding: 4px 12px;
      font-size: 10px;
      font-weight: 700;
      color: #888;
      letter-spacing: .06em;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(255,255,255,.06);
      cursor: default;
      list-style: none;
    }
    .ape-ss-header strong { color: #d92558; }

    li[data-ape-ss-extra] {
      border-left: 3px solid #d92558;
    }
    li[data-ape-ss-extra]:hover {
      background: rgba(217,37,88,.08) !important;
    }
    .ape-ss-aka {
      display: block;
      font-size: 10px;
      color: #d97090;
      font-style: italic;
      font-weight: 600;
      margin-top: 3px;
      pointer-events: none;
    }
  `;
  document.head.appendChild(s);
}

export class SmartSearch {
  constructor(storage) {
    this._storage = storage;
    this._debounceTimer = null;
    this._lastQuery = "";
    this._dropdownObserver = null;
  }

  async init(_pageType) {
    injectStyles();
    this._attachInputListener();
  }

  _attachInputListener() {
    document.addEventListener(
      "input",
      (e) => {
        const input = e.target;
        if (
          !input.matches(
            "input#inputSearch, input[name='q'], input[placeholder*='earch' i]",
          )
        )
          return;
        const q = input.value.trim();
        clearTimeout(this._debounceTimer);
        if (q.length < MIN_LEN) {
          this._lastQuery = "";
          return;
        }
        this._debounceTimer = setTimeout(
          () => this._handleQuery(q),
          DEBOUNCE_MS,
        );
      },
      true,
    );
  }

  async _handleQuery(query) {
    if (norm(query) === norm(this._lastQuery)) return;
    this._lastQuery = query;

    const [altData, nativeItems] = await Promise.all([
      getAltTitles(query),
      apSearch(query),
    ]);

    const altTitles = altData.allTitles || [];
    const queryCandidates = altData.queryCandidates || [];

    const nq = norm(query);
    const nativeNorms = new Set(nativeItems.map((r) => norm(r.title ?? "")));
    const altTitlesNorms = altTitles.map((t) => norm(t));

    const candidates = [
      ...new Set(queryCandidates.filter((t) => norm(t) !== nq)),
    ].slice(0, 3);

    if (!candidates.length) return;

    const batches = await Promise.all(candidates.map((c) => apSearch(c)));

    const seen = new Set(nativeNorms);
    const extras = [];

    for (const batch of batches) {
      for (const item of batch) {
        const n = norm(item.title ?? "");
        if (!seen.has(n)) {
          if (isRelevant(item.title, altTitlesNorms, nq)) {
            seen.add(n);
            extras.push(item);
          }
        }
      }
    }

    if (!extras.length) return;

    const currentQuery = getInput()?.value?.trim() ?? "";
    if (norm(currentQuery) !== nq) return;

    await this._waitForDropdown();

    if (norm(getInput()?.value?.trim() ?? "") !== nq) return;

    injectRows(extras, query);
  }

  _waitForDropdown(maxMs = 1500) {
    return new Promise((resolve) => {
      if (getDropdown()) {
        resolve();
        return;
      }
      const t0 = Date.now();
      const obs = new MutationObserver(() => {
        if (getDropdown() || Date.now() - t0 > maxMs) {
          obs.disconnect();
          resolve();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        obs.disconnect();
        resolve();
      }, maxMs);
    });
  }
}

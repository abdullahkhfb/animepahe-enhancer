/**
 * background.js — Skip Wait backend
 *
 * The normal animepahe download path is:
 *
 *   animepahe dropdown link  ->  pahe.win/XXXX  (5 second wait)
 *     ->  kwik.cx/f/YYYY  (the page with the "Download" button)
 *
 * The countdown on pahe.win is purely client-side — the kwik link is already
 * in the page HTML. So when you click a download link we fetch pahe.win in
 * the background, read the kwik link out of it, and open kwik.cx/f/YYYY
 * directly. The pahe.win page is never shown.
 *
 * If the link can't be found for any reason, the original pahe.win page opens
 * instead, so the click always does something.
 *
 * Classic script (no ES modules) so the same file works as a Chrome service
 * worker and as a Firefox event page.
 */

const MSG_SKIP_WAIT = "AP_SKIP_WAIT";

// Only ever act on pahe.win short links — this listener must not become a
// generic "fetch any URL for any page" proxy.
const PAHE_LINK = /^https:\/\/(?:[\w-]+\.)*pahe\.win\/[\w-]+\/?$/i;

// kwik file page. Also matches escaped slashes, since the link can sit inside
// an inline <script> as https:\/\/kwik.cx\/f\/abc.
const KWIK_LINK =
  /https?:(?:\\?\/){2}(kwik\.[a-z]{2,})(?:\\?\/)([fde])(?:\\?\/)([A-Za-z0-9]+)/i;

const FETCH_TIMEOUT_MS = 15_000;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== MSG_SKIP_WAIT) return false;

  skipWait(msg.url, sender.tab)
    .then(sendResponse)
    .catch((err) =>
      sendResponse({ ok: false, error: String(err?.message || err) }),
    );
  return true; // async response
});

async function skipWait(paheUrl, senderTab) {
  if (typeof paheUrl !== "string" || !PAHE_LINK.test(paheUrl)) {
    return { ok: false, error: "Not a pahe.win link" };
  }

  // Open next to the episode tab, like the original target="_blank" link.
  const position = senderTab ? { index: senderTab.index + 1 } : {};

  try {
    const kwikUrl = await resolveKwikUrl(paheUrl);
    await chrome.tabs.create({ url: kwikUrl, active: true, ...position });
    return { ok: true };
  } catch (err) {
    console.warn("[animepahe-enhancer] Skip Wait failed, opening pahe.win:", err);
    await chrome.tabs.create({ url: paheUrl, active: true, ...position });
    return { ok: false, fellBack: true, error: String(err?.message || err) };
  }
}

/** pahe.win/XXXX  ->  https://kwik.cx/f/YYYY */
async function resolveKwikUrl(paheUrl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(paheUrl, { credentials: "include", signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }

  // Some short links are a plain HTTP redirect straight to kwik.
  const m = res.url.match(KWIK_LINK) || (await res.text()).match(KWIK_LINK);
  if (!m) throw new Error("No kwik link found on the pahe.win page");

  const [, host, , id] = m;
  return `https://${host.toLowerCase()}/f/${id}`;
}

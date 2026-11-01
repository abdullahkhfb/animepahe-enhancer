const MSG_SKIP_WAIT = "AP_SKIP_WAIT";

// Only pahe.win links: this must not become a generic fetch proxy.
const PAHE_LINK = /^https:\/\/(?:[\w-]+\.)*pahe\.win\/[\w-]+\/?$/i;

// Also matches escaped slashes (the link may sit inside an inline <script>).
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
  return true;
});

async function skipWait(paheUrl, senderTab) {
  if (typeof paheUrl !== "string" || !PAHE_LINK.test(paheUrl)) {
    return { ok: false, error: "Not a pahe.win link" };
  }

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

async function resolveKwikUrl(paheUrl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(paheUrl, { credentials: "include", signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }

  const m = res.url.match(KWIK_LINK) || (await res.text()).match(KWIK_LINK);
  if (!m) throw new Error("No kwik link found on the pahe.win page");

  const [, host, , id] = m;
  return `https://${host.toLowerCase()}/f/${id}`;
}

import { storage, FEATURE_SUBOPTIONS } from "../../content/helpers/storage.js";
import {
  clearTimestampsCache,
  getTimestampsCacheInfo,
} from "../../content/helpers/timestamps-db.js";
import { h } from "../components/dom.js";
import { FEATURES } from "../components/features/feature-config.js";
import { FeatureRow } from "../components/features/FeatureRow.js";

const CW_KEY = "ape_cw_v1";
// Must match CACHE_PFX in content/features/js/smart-search.js — smart
// search results are cached under this prefix, not "ape_alt_".
const SS_CACHE_PREFIX = "ape_ss_";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Per-feature stat readers and clear actions. A reader returns
 * `{ text, canClear }`; `clear` wipes whatever that feature has cached.
 */
const STATS = {
  cw: {
    async read() {
      const raw = (await chrome.storage.local.get([CW_KEY]))[CW_KEY];
      let n = 0;
      try {
        n = typeof raw === "string" ? JSON.parse(raw).length : 0;
      } catch {
        n = 0;
      }
      return { text: plural(n, "item"), canClear: n > 0 };
    },
    clear: () => chrome.storage.local.remove(CW_KEY),
  },
  dub: {
    read: () => countPrefixed(["d2_", "h2_"]),
    clear: () => removePrefixed(["d2_", "h2_"]),
  },
  ss: {
    read: () => countPrefixed([SS_CACHE_PREFIX]),
    clear: () => removePrefixed([SS_CACHE_PREFIX]),
  },
  is: {
    // The timestamps database is only ever "cached" or "not cached" from
    // the user's point of view — we don't surface its size or age here.
    async read() {
      try {
        const info = await getTimestampsCacheInfo();
        if (info.hasDb) return { text: "Database cached", canClear: true };
        if (info.idEntries > 0)
          return { text: `${plural(info.idEntries, "ID")} cached`, canClear: true };
      } catch {
        /* fall through to "not cached" */
      }
      return { text: "Not cached", canClear: false };
    },
    clear: () => clearTimestampsCache(),
  },
};

async function keysWithPrefixes(prefixes) {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all).filter((k) => prefixes.some((p) => k.startsWith(p)));
}
async function countPrefixed(prefixes) {
  const n = (await keysWithPrefixes(prefixes)).length;
  return { text: `${n} cached`, canClear: n > 0 };
}
async function removePrefixed(prefixes) {
  await chrome.storage.local.remove(await keysWithPrefixes(prefixes));
}

/**
 * Builds the Features tab.
 * @param {{panel: HTMLElement, timeline: HTMLElement & {update(s: object): void},
 *          notifyReload: () => void}} ctx
 */
export async function initFeaturesTab({ panel, timeline, notifyReload }) {
  let settings = await storage.getSettings();

  const states = () =>
    Object.fromEntries(FEATURES.map((f) => [f.id, !!settings[f.settingKey]]));
  timeline.update(states());

  async function save(patch) {
    settings = await storage.setSettings(patch);
    timeline.update(states());
    notifyReload();
  }

  const rows = new Map();
  const list = h("div", { class: "feature-list" });

  for (const feature of FEATURES) {
    const stats = STATS[feature.id];
    const subopts = (FEATURE_SUBOPTIONS[feature.id] ?? []).map((item) => ({
      key: item.key,
      label: item.label,
      note: item.note,
      checked: settings[item.key] ?? item.default,
      onChange: (checked) => save({ [item.key]: checked }),
    }));

    const row = FeatureRow({
      feature,
      enabled: !!settings[feature.settingKey],
      subopts,
      onToggle: (enabled) => save({ [feature.settingKey]: enabled }),
      // Accordion: only one body is open at a time so the popup never grows
      // past its fixed height and needs no scrolling.
      onOpen: () => {
        for (const [id, other] of rows) if (id !== feature.id) other.setOpen(false);
      },
      onClear: stats
        ? async () => {
            await stats.clear();
            await refresh(feature.id);
          }
        : undefined,
    });
    rows.set(feature.id, row);
    list.append(row.el);
  }
  panel.append(list);

  async function refresh(id) {
    const { text, canClear } = await STATS[id].read();
    rows.get(id).setStat(text, canClear);
  }
  await Promise.all(Object.keys(STATS).map(refresh));
}

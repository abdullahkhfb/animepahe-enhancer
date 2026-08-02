import {
  storage,
  FEATURE_SUBOPTIONS,
} from "../../content/helpers/storage.js";
import {
  clearTimestampsCache,
  getTimestampsCacheInfo,
} from "../../content/helpers/timestamps-db.js";
import { makeCollapsible, animateButton, makeInfoNote } from "./common.js";

const CW_KEY = "ape_cw_v1";
// Must match CACHE_PFX in content/features/smart-search.js — smart search
// results are cached under this prefix, not "ape_alt_".
const SS_CACHE_PREFIX = "ape_ss_";

export async function initFeaturesTab() {
  const toggleCw = document.getElementById("toggle-cw");
  const toggleDub = document.getElementById("toggle-dub");
  const toggleSs = document.getElementById("toggle-ss");
  const toggleIs = document.getElementById("toggle-is");
  const toggleBw = document.getElementById("toggle-bw");
  const cwCount = document.getElementById("cw-count");
  const dubCacheCount = document.getElementById("dub-cache-count");
  const ssCacheCount = document.getElementById("ss-cache-count");
  const isStatusChip = document.getElementById("is-status-chip");
  const btnClearCw = document.getElementById("cw-clear");
  const btnClearDub = document.getElementById("dub-clear-cache");
  const btnClearSs = document.getElementById("ss-clear-cache");
  const btnClearIs = document.getElementById("is-clear-cache");
  const reloadNotice = document.getElementById("reload-notice");
  const cwCard = document.getElementById("cw-card");
  const dubCard = document.getElementById("dub-card");
  const ssCard = document.getElementById("ss-card");
  const isCard = document.getElementById("is-card");
  const bwCard = document.getElementById("bw-card");

  let settings = await storage.getSettings();

  toggleCw.checked = settings.cwEnabled;
  toggleDub.checked = settings.dubEnabled;
  toggleSs.checked = settings.smartSearchEnabled;
  toggleIs.checked = settings.introSkipEnabled;
  toggleBw.checked = settings.bingeWatchEnabled;

  updateCardStyles();

  // The toggle switch sits inside each card's clickable header; without
  // this it would also trigger the header's expand/collapse.
  document.querySelectorAll(".feature-top .toggle").forEach((toggle) => {
    toggle.addEventListener("click", (e) => e.stopPropagation());
  });

  // Sub-feature toggles render inside their parent feature's card
  // (FEATURE_SUBOPTIONS in helpers/storage.js), not under Advanced.
  renderSubopts("dub", settings);
  renderSubopts("is", settings);

  const data = await chrome.storage.local.get([CW_KEY]);
  updateCwStats(data[CW_KEY]);
  await updateDubStats();
  await updateSsStats();
  await updateIsStats();

  // Every card starts collapsed to keep the tab short.
  document.querySelectorAll(".feature-card").forEach((card) => {
    const header = card.querySelector(".feature-header");
    const body = card.querySelector(".feature-body");
    if (!body) return;
    makeCollapsible({
      container: card,
      header,
      body,
      expandedClass: "expanded",
      startExpanded: false,
    });
  });

  toggleCw.addEventListener("change", () => {
    saveSettings({ cwEnabled: toggleCw.checked });
  });
  toggleDub.addEventListener("change", () => {
    saveSettings({ dubEnabled: toggleDub.checked });
  });
  toggleSs.addEventListener("change", () => {
    saveSettings({ smartSearchEnabled: toggleSs.checked });
  });
  toggleIs.addEventListener("change", () => {
    saveSettings({ introSkipEnabled: toggleIs.checked });
  });
  toggleBw.addEventListener("change", () => {
    saveSettings({ bingeWatchEnabled: toggleBw.checked });
  });

  async function saveSettings(patch) {
    settings = await storage.setSettings(patch);
    updateCardStyles();
    reloadNotice.hidden = false;
  }

  function updateCardStyles() {
    cwCard.classList.toggle("disabled", !settings.cwEnabled);
    dubCard.classList.toggle("disabled", !settings.dubEnabled);
    ssCard.classList.toggle("disabled", !settings.smartSearchEnabled);
    isCard.classList.toggle("disabled", !settings.introSkipEnabled);
    bwCard.classList.toggle("disabled", !settings.bingeWatchEnabled);
  }

  /**
   * Builds the sub-feature toggle rows for one card from
   * FEATURE_SUBOPTIONS[cardId], if any are defined. Each row gets its own
   * switch (saved immediately, same as a top-level feature toggle) and an
   * info button whose note shows on hover (native title tooltip) or on
   * click (toggled inline, so it also works without a mouse).
   */
  function renderSubopts(cardId, currentSettings) {
    const items = FEATURE_SUBOPTIONS[cardId];
    const container = document.getElementById(`${cardId}-subopts`);
    if (!items?.length || !container) return;

    container.innerHTML = "";

    for (const item of items) {
      const row = document.createElement("div");
      row.className = "subopt-row";

      const main = document.createElement("div");
      main.className = "subopt-main";

      const infoBtn = document.createElement("button");
      infoBtn.type = "button";
      infoBtn.className = "subopt-info";
      infoBtn.title = item.note;
      infoBtn.setAttribute("aria-label", `About: ${item.label}`);
      infoBtn.textContent = "i";

      const label = document.createElement("span");
      label.className = "subopt-label";
      label.textContent = item.label;

      const toggleLabel = document.createElement("label");
      toggleLabel.className = "toggle toggle-sm";
      toggleLabel.setAttribute("aria-label", `Toggle ${item.label}`);
      toggleLabel.addEventListener("click", (e) => e.stopPropagation());

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = currentSettings[item.key] ?? item.default;

      const track = document.createElement("span");
      track.className = "toggle-track";
      const thumb = document.createElement("span");
      thumb.className = "toggle-thumb";
      track.appendChild(thumb);

      toggleLabel.append(input, track);
      main.append(infoBtn, label, toggleLabel);

      const note = document.createElement("p");
      note.className = "subopt-note";
      note.textContent = item.note;
      note.hidden = true;

      row.append(main, note);
      container.appendChild(row);

      makeInfoNote(infoBtn, note);

      input.addEventListener("change", () => {
        saveSettings({ [item.key]: input.checked });
      });
    }
  }

  btnClearCw.addEventListener("click", () =>
    animateButton(btnClearCw, async () => {
      await chrome.storage.local.remove(CW_KEY);
      updateCwStats(null);
    }),
  );

  btnClearDub.addEventListener("click", () =>
    animateButton(btnClearDub, async () => {
      const all = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(all).filter(
        (k) => k.startsWith("d2_") || k.startsWith("h2_"),
      );
      await chrome.storage.local.remove(keysToRemove);
      await updateDubStats();
    }),
  );

  btnClearSs.addEventListener("click", () =>
    animateButton(btnClearSs, async () => {
      const all = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(all).filter((k) =>
        k.startsWith(SS_CACHE_PREFIX),
      );
      await chrome.storage.local.remove(keysToRemove);
      await updateSsStats();
    }),
  );

  btnClearIs.addEventListener("click", () =>
    animateButton(btnClearIs, async () => {
      await clearTimestampsCache();
      await updateIsStats();
    }),
  );

  function updateCwStats(cwRaw) {
    try {
      const list = typeof cwRaw === "string" ? JSON.parse(cwRaw) : [];
      cwCount.textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;
      btnClearCw.style.display = list.length === 0 ? "none" : "block";
    } catch {
      cwCount.textContent = "0 items";
      btnClearCw.style.display = "none";
    }
  }

  async function updateDubStats() {
    const all = await chrome.storage.local.get(null);
    const count = Object.keys(all).filter(
      (k) => k.startsWith("d2_") || k.startsWith("h2_"),
    ).length;
    dubCacheCount.textContent = `${count} cached`;
    btnClearDub.style.display = count === 0 ? "none" : "block";
  }

  async function updateSsStats() {
    const all = await chrome.storage.local.get(null);
    const count = Object.keys(all).filter((k) =>
      k.startsWith(SS_CACHE_PREFIX),
    ).length;
    ssCacheCount.textContent = `${count} cached`;
    btnClearSs.style.display = count === 0 ? "none" : "block";
  }

  async function updateIsStats() {
    // The timestamps database is only ever "cached" or "not cached" from
    // the user's point of view — we don't surface its file size or age
    // here, just whether it (or any per-anime ID lookups) exist locally.
    try {
      const info = await getTimestampsCacheInfo();
      if (info.hasDb) {
        isStatusChip.textContent = "Database cached";
        btnClearIs.style.display = "block";
      } else if (info.idEntries > 0) {
        isStatusChip.textContent = `${info.idEntries} ID${info.idEntries === 1 ? "" : "s"} cached`;
        btnClearIs.style.display = "block";
      } else {
        isStatusChip.textContent = "Not cached";
        btnClearIs.style.display = "none";
      }
    } catch {
      isStatusChip.textContent = "Not cached";
      btnClearIs.style.display = "none";
    }
  }
}

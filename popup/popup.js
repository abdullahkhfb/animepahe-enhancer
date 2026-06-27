import {
  storage,
  ADVANCED_SETTINGS_SCHEMA,
} from "../content/helpers/storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  const CW_KEY = "ape_cw_v1";
  const SS_CACHE_PREFIX = "ape_alt_";

  const toggleCw = document.getElementById("toggle-cw");
  const toggleDub = document.getElementById("toggle-dub");
  const toggleSs = document.getElementById("toggle-ss");
  const cwCount = document.getElementById("cw-count");
  const dubCacheCount = document.getElementById("dub-cache-count");
  const ssCacheCount = document.getElementById("ss-cache-count");
  const btnClearCw = document.getElementById("cw-clear");
  const btnClearDub = document.getElementById("dub-clear-cache");
  const btnClearSs = document.getElementById("ss-clear-cache");
  const reloadNotice = document.getElementById("reload-notice");
  const cwCard = document.getElementById("cw-card");
  const dubCard = document.getElementById("dub-card");
  const ssCard = document.getElementById("ss-card");
  const versionBadge = document.getElementById("version-badge");

  const advancedToggle = document.getElementById("advanced-toggle");
  const advancedPanel = document.getElementById("advanced-panel");
  const advancedGroups = document.getElementById("advanced-groups");
  const advancedResetAll = document.getElementById("advanced-reset-all");

  const manifest = chrome.runtime.getManifest();
  versionBadge.textContent = `v${manifest.version}`;

  let settings = await storage.getSettings();

  const data = await chrome.storage.local.get([CW_KEY]);

  toggleCw.checked = settings.cwEnabled;
  toggleDub.checked = settings.dubEnabled;
  toggleSs.checked = settings.smartSearchEnabled;
  updateCardStyles();
  updateCwStats(data[CW_KEY]);
  updateDubStats();
  updateSsStats();
  buildAdvancedPanel();

  toggleCw.addEventListener("change", () => {
    saveSettings({ cwEnabled: toggleCw.checked });
  });

  toggleDub.addEventListener("change", () => {
    saveSettings({ dubEnabled: toggleDub.checked });
  });

  toggleSs.addEventListener("change", () => {
    saveSettings({ smartSearchEnabled: toggleSs.checked });
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
  }

  btnClearCw.addEventListener("click", async () => {
    await animateButton(btnClearCw, async () => {
      await chrome.storage.local.remove(CW_KEY);
      updateCwStats(null);
    });
  });

  btnClearDub.addEventListener("click", async () => {
    await animateButton(btnClearDub, async () => {
      const all = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(all).filter(
        (k) => k.startsWith("d2_") || k.startsWith("h2_"),
      );
      await chrome.storage.local.remove(keysToRemove);
      updateDubStats();
    });
  });

  btnClearSs.addEventListener("click", async () => {
    await animateButton(btnClearSs, async () => {
      const all = await chrome.storage.local.get(null);
      const keysToRemove = Object.keys(all).filter((k) =>
        k.startsWith(SS_CACHE_PREFIX),
      );
      await chrome.storage.local.remove(keysToRemove);
      updateSsStats();
    });
  });

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

  // Utility for smooth button animations
  async function animateButton(btn, actionFn) {
    const originalText = btn.textContent;
    btn.textContent = "Clearing...";
    btn.style.pointerEvents = "none";

    await actionFn();

    setTimeout(() => {
      btn.textContent = "Cleared!";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.pointerEvents = "auto";
      }, 1500);
    }, 400);
  }

  advancedToggle.addEventListener("click", () => {
    const isOpen = !advancedPanel.hidden;
    advancedPanel.hidden = isOpen;
    advancedToggle.classList.toggle("open", !isOpen);
    advancedToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  function buildAdvancedPanel() {
    advancedGroups.innerHTML = "";

    for (const group of ADVANCED_SETTINGS_SCHEMA) {
      const groupEl = document.createElement("div");
      groupEl.className = "advanced-group";

      const heading = document.createElement("p");
      heading.className = "advanced-group-title";
      heading.textContent = group.group;
      groupEl.appendChild(heading);

      for (const item of group.items) {
        groupEl.appendChild(buildSettingRow(item));
      }

      advancedGroups.appendChild(groupEl);
    }
  }

  function buildSettingRow(item) {
    const row = document.createElement("div");
    row.className = "advanced-row";

    const top = document.createElement("div");
    top.className = "advanced-row-top";

    const label = document.createElement("label");
    label.className = "advanced-row-label";
    label.textContent = item.label;
    label.setAttribute("for", `adv-${item.key}`);

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "advanced-reset-btn";
    resetBtn.title = `Reset to default (${item.default})`;
    resetBtn.setAttribute("aria-label", `Reset ${item.label} to default`);
    resetBtn.innerHTML =
      '<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 2.5a5.5 5.5 0 1 0 5.16 7.4.75.75 0 0 1 1.41.5A7 7 0 1 1 8 1c1.77 0 3.36.71 4.53 1.86V1.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5h1.7A5.48 5.48 0 0 0 8 2.5Z"/></svg>';

    top.appendChild(label);
    top.appendChild(resetBtn);

    const desc = document.createElement("p");
    desc.className = "advanced-row-desc";
    desc.textContent = item.desc;

    const input = document.createElement("input");
    input.type = "number";
    input.id = `adv-${item.key}`;
    input.className = "advanced-row-input";
    input.min = String(item.min);
    input.max = String(item.max);
    input.step = String(item.step);
    input.value = settings[item.key] ?? item.default;

    const commit = async () => {
      let value = Number(input.value);
      if (!Number.isFinite(value)) value = item.default;
      value = Math.min(item.max, Math.max(item.min, value));
      input.value = value;
      if (value !== settings[item.key]) {
        await saveSettings({ [item.key]: value });
      }
    };

    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);

    resetBtn.addEventListener("click", async () => {
      input.value = item.default;
      await saveSettings({ [item.key]: item.default });
    });

    row.appendChild(top);
    row.appendChild(desc);
    row.appendChild(input);

    return row;
  }

  advancedResetAll.addEventListener("click", async () => {
    if (
      !confirm(
        "Reset every advanced setting back to its default value? This won't change your feature toggles above.",
      )
    )
      return;

    const resetPatch = {};
    for (const group of ADVANCED_SETTINGS_SCHEMA) {
      for (const item of group.items) {
        resetPatch[item.key] = item.default;
      }
    }
    await saveSettings(resetPatch);
    buildAdvancedPanel();
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  // Storage Keys (must match what is in animepahe.js)
  const SETTINGS_KEY = "ape_settings";
  const CW_KEY = "ape_cw_v1";

  // DOM Elements
  const toggleCw = document.getElementById("toggle-cw");
  const toggleDub = document.getElementById("toggle-dub");
  const cwCount = document.getElementById("cw-count");
  const dubCacheCount = document.getElementById("dub-cache-count");
  const btnClearCw = document.getElementById("cw-clear");
  const btnClearDub = document.getElementById("dub-clear-cache");
  const reloadNotice = document.getElementById("reload-notice");
  const cwCard = document.getElementById("cw-card");
  const dubCard = document.getElementById("dub-card");
  const versionBadge = document.getElementById("version-badge");

  // Auto-fill version from manifest
  const manifest = chrome.runtime.getManifest();
  versionBadge.textContent = `v${manifest.version}`;

  // Default settings
  let settings = { cwEnabled: true, dubEnabled: true };

  // 1. Load Initial State
  const data = await chrome.storage.local.get([SETTINGS_KEY, CW_KEY]);
  if (data[SETTINGS_KEY]) {
    settings = { ...settings, ...data[SETTINGS_KEY] };
  }

  // Initialize UI state
  toggleCw.checked = settings.cwEnabled;
  toggleDub.checked = settings.dubEnabled;
  updateCardStyles();
  updateCwStats(data[CW_KEY]);
  updateDubStats();

  // 2. Toggle Listeners
  toggleCw.addEventListener("change", () => {
    settings.cwEnabled = toggleCw.checked;
    saveSettings();
  });

  toggleDub.addEventListener("change", () => {
    settings.dubEnabled = toggleDub.checked;
    saveSettings();
  });

  function saveSettings() {
    chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    updateCardStyles();
    reloadNotice.hidden = false; // Prompt user to reload animepahe
  }

  function updateCardStyles() {
    cwCard.classList.toggle("disabled", !settings.cwEnabled);
    dubCard.classList.toggle("disabled", !settings.dubEnabled);
  }

  // 3. Clear Buttons Logic
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

  // 4. Stat Updaters
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
});

import { setupTabs } from "./scripts/common.js";
import { initFeaturesTab } from "./scripts/features.js";
import { initAdvancedTab } from "./scripts/advanced.js";
import { initLinksTab } from "./scripts/links.js";

document.addEventListener("DOMContentLoaded", async () => {
  const manifest = chrome.runtime.getManifest();
  document.getElementById("version-badge").textContent =
    `v${manifest.version}`;

  setupTabs({
    features: document.getElementById("panel-features"),
    advanced: document.getElementById("panel-advanced"),
    links: document.getElementById("panel-links"),
  });

  await initFeaturesTab();
  await initAdvancedTab();
  initLinksTab();
});

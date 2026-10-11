import { h } from "./components/dom.js";
import { Header } from "./components/layout/Header.js";
import { Timeline } from "./components/layout/Timeline.js";
import { Tabs } from "./components/layout/Tabs.js";
import { Notice } from "./components/ui/Notice.js";
import { FEATURES } from "./components/features/feature-config.js";
import { initFeaturesTab } from "./scripts/features.js";
import { initAdvancedTab } from "./scripts/advanced.js";
import { initLinksTab } from "./scripts/links.js";

const TABS = [
  { id: "features", label: "Features" },
  { id: "advanced", label: "Advanced" },
  { id: "links", label: "Links" },
];

document.addEventListener("DOMContentLoaded", async () => {
  const app = document.getElementById("app");

  const notice = Notice("Reload page to apply");
  const timeline = Timeline(FEATURES);
  // Shown on the same line as "N of 5 active" so it never adds height.
  timeline.append(notice);
  const panels = Object.fromEntries(
    TABS.map((t) => [
      t.id,
      h("section", {
        class: "panel",
        id: `panel-${t.id}`,
        role: "tabpanel",
        "aria-labelledby": `tab-${t.id}`,
        hidden: true,
      }),
    ]),
  );

  const tabs = Tabs({
    tabs: TABS,
    onSelect: (id) => {
      for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== id;
    },
  });

  app.append(
    Header({ version: chrome.runtime.getManifest().version }),
    timeline,
    tabs,
    ...Object.values(panels),
  );

  const ctx = { notifyReload: () => notice.show(), timeline };
  await initFeaturesTab({ panel: panels.features, ...ctx });
  await initAdvancedTab({ panel: panels.advanced, ...ctx });
  initLinksTab({ panel: panels.links });

  tabs.select("features");
});

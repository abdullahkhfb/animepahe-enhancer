import {
  storage,
  ADVANCED_SETTINGS_SCHEMA,
} from "../../content/helpers/storage.js";
import { makeCollapsible } from "./common.js";

export async function initAdvancedTab() {
  const advancedGroups = document.getElementById("advanced-groups");
  const advancedResetAll = document.getElementById("advanced-reset-all");
  const advancedApply = document.getElementById("advanced-apply");
  const applyStatus = document.getElementById("apply-status");

  let settings = await storage.getSettings();
  // Staged edits made in this tab. Nothing here is persisted until the
  // user presses "Apply Changes".
  let pending = {};

  buildPanel();

  advancedApply.addEventListener("click", async () => {
    if (Object.keys(pending).length === 0) return;
    settings = await storage.setSettings(pending);
    pending = {};
    document
      .querySelectorAll(".advanced-row.dirty")
      .forEach((row) => row.classList.remove("dirty"));
    updateApplyState();
    advancedApply.textContent = "Applied ✓";
    advancedApply.classList.add("saved");
    applyStatus.textContent = "Saved — reload the page to apply";
    applyStatus.classList.remove("pending");
    setTimeout(() => {
      advancedApply.classList.remove("saved");
      updateApplyState();
    }, 1800);
    document.querySelectorAll(".advanced-row-input").forEach((input) => {
      const key = input.id.replace(/^adv-/, "");
      if (key in settings) input.value = settings[key];
    });
  });

  advancedResetAll.addEventListener("click", async () => {
    if (
      !confirm(
        "Reset every advanced setting back to its default value? This won't change your feature toggles in the Features tab.",
      )
    )
      return;

    const resetPatch = {};
    for (const group of ADVANCED_SETTINGS_SCHEMA) {
      for (const item of group.items) {
        resetPatch[item.key] = item.default;
      }
    }
    settings = await storage.setSettings(resetPatch);
    buildPanel();
  });

  function buildPanel() {
    advancedGroups.innerHTML = "";
    pending = {};
    updateApplyState();

    for (const group of ADVANCED_SETTINGS_SCHEMA) {
      advancedGroups.appendChild(buildGroup(group));
    }
  }

  function buildGroup(group) {
    const groupEl = document.createElement("div");
    groupEl.className = "advanced-group";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "advanced-group-header";

    const title = document.createElement("span");
    title.className = "advanced-group-title";
    title.textContent = group.group;

    const count = document.createElement("span");
    count.className = "advanced-group-count";
    count.textContent = String(group.items.length);

    const chevron = document.createElement("img");
    chevron.className = "advanced-group-chevron chevron-icon";
    chevron.src = "../icons/chevron.svg";
    chevron.alt = "";
    chevron.width = 12;
    chevron.height = 12;

    header.append(title, count, chevron);

    const body = document.createElement("div");
    body.className = "advanced-group-body";

    for (const item of group.items) {
      body.appendChild(buildSettingRow(item));
    }

    groupEl.append(header, body);

    // Every group starts collapsed uniformly, so the tab is only ever as
    // tall as the groups the user actually opens.
    makeCollapsible({
      container: groupEl,
      header,
      body,
      expandedClass: "open",
      startExpanded: false,
    });

    return groupEl;
  }

  function buildSettingRow(item) {
    const row = document.createElement("div");
    row.className = "advanced-row";
    row.dataset.key = item.key;

    const top = document.createElement("div");
    top.className = "advanced-row-top";

    const label = document.createElement("label");
    label.className = "advanced-row-label";
    label.setAttribute("for", `adv-${item.key}`);

    const dirtyDot = document.createElement("span");
    dirtyDot.className = "dirty-dot";
    dirtyDot.title = "Unapplied change";

    const labelText = document.createElement("span");
    labelText.textContent = item.label;

    label.append(dirtyDot, labelText);

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "advanced-reset-btn";
    resetBtn.title = `Reset to default (${item.default})`;
    resetBtn.setAttribute("aria-label", `Reset ${item.label} to default`);
    resetBtn.innerHTML =
      '<svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 2.5a5.5 5.5 0 1 0 5.16 7.4.75.75 0 0 1 1.41.5A7 7 0 1 1 8 1c1.77 0 3.36.71 4.53 1.86V1.75a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5h1.7A5.48 5.48 0 0 0 8 2.5Z"/></svg>';

    top.append(label, resetBtn);

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

    const stage = (value) => {
      value = Math.min(item.max, Math.max(item.min, value));
      input.value = value;
      if (value === settings[item.key]) {
        delete pending[item.key];
        row.classList.remove("dirty");
      } else {
        pending[item.key] = value;
        row.classList.add("dirty");
      }
      updateApplyState();
    };

    const commit = () => {
      let value = Number(input.value);
      if (!Number.isFinite(value)) value = item.default;
      stage(value);
    };

    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
    resetBtn.addEventListener("click", () => stage(item.default));

    row.append(top, desc, input);
    return row;
  }

  function updateApplyState() {
    const changedCount = Object.keys(pending).length;
    advancedApply.disabled = changedCount === 0;
    advancedApply.classList.remove("saved");
    if (changedCount === 0) {
      advancedApply.textContent = "Apply Changes";
      applyStatus.textContent = "";
      applyStatus.classList.remove("pending");
    } else {
      advancedApply.textContent = `Apply Changes (${changedCount})`;
      applyStatus.textContent = `${changedCount} unsaved change${changedCount === 1 ? "" : "s"}`;
      applyStatus.classList.add("pending");
    }
  }
}

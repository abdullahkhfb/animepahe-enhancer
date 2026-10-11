import { storage, ADVANCED_SETTINGS_SCHEMA } from "../../content/helpers/storage.js";
import { h, clear } from "../components/dom.js";
import { GroupChips } from "../components/advanced/GroupChips.js";
import { SettingRow } from "../components/advanced/SettingRow.js";

/** Short chip labels so all groups fit on two rows (full name shown as tooltip). */
const CHIP_LABELS = {
  "Continue Watching": "Continue",
  "DUB Detector": "DUB",
  "Network Throttler": "Network",
  "Smart Search": "Search",
  "Intro / Outro Skip": "Skip",
  "Binge Watch": "Binge",
};

/**
 * Builds the Advanced tab. Everything is generated from
 * ADVANCED_SETTINGS_SCHEMA, so adding a tunable there needs no popup edit.
 * Edits are staged and only saved when "Apply" is pressed.
 *
 * @param {{panel: HTMLElement, notifyReload: () => void}} ctx
 */
export async function initAdvancedTab({ panel, notifyReload }) {
  let settings = await storage.getSettings();
  /** Staged edits — nothing here is persisted until Apply. */
  let pending = {};
  /** key → row, for every setting (across all groups) */
  const rowByKey = new Map();

  const groupOf = (key) =>
    ADVANCED_SETTINGS_SCHEMA.find((g) => g.items.some((i) => i.key === key));

  // Layout ----------------------------------------------------------
  const rowsHost = h("div", { class: "settings" });
  const HELP_HINT = "Tap (i) on a setting to see what it does.";
  const help = h("p", { class: "settings-help" }, HELP_HINT);
  let helpKey = null;
  function showHelp(item) {
    helpKey = item ? item.key : null;
    help.textContent = item ? item.desc : HELP_HINT;
    help.classList.toggle("is-active", !!item);
    for (const [k, r] of rowByKey) r.setInfoActive(k === helpKey);
  }
  const status = h("span", { class: "apply__status" });
  const applyBtn = h("button", { type: "button", class: "btn btn--primary", disabled: true }, "Apply");
  const resetAllBtn = h("button", { type: "button", class: "btn btn--outline", title: "Reset every advanced setting to its default" }, "Reset all");

  const chips = GroupChips({
    groups: ADVANCED_SETTINGS_SCHEMA.map((g) => ({ id: g.group, title: CHIP_LABELS[g.group] ?? g.group, full: g.group })),
    onSelect: showGroup,
  });

  panel.append(
    chips,
    rowsHost,
    help,
    h("div", { class: "apply" }, status, resetAllBtn, applyBtn),
  );

  buildRows();
  chips.select(ADVANCED_SETTINGS_SCHEMA[0].group);

  // Rows ------------------------------------------------------------
  function buildRows() {
    rowByKey.clear();
    for (const group of ADVANCED_SETTINGS_SCHEMA) {
      for (const item of group.items) {
        const row = SettingRow({
          item,
          value: settings[item.key] ?? item.default,
          onChange: (value) => stage(item, group, value),
          onInfo: () => showHelp(item.key === helpKey ? null : item),
        });
        rowByKey.set(item.key, row);
      }
    }
  }

  function showGroup(groupName) {
    clear(rowsHost);
    showHelp(null);
    const group = ADVANCED_SETTINGS_SCHEMA.find((g) => g.group === groupName);
    for (const item of group.items) rowsHost.append(rowByKey.get(item.key).el);
  }

  function stage(item, group, value) {
    if (value === settings[item.key]) delete pending[item.key];
    else pending[item.key] = value;
    rowByKey.get(item.key).setDirty(item.key in pending);
    chips.setDirty(
      group.group,
      group.items.some((i) => i.key in pending),
    );
    updateApplyState();
  }

  function updateApplyState() {
    const n = Object.keys(pending).length;
    applyBtn.disabled = n === 0;
    applyBtn.textContent = n === 0 ? "Apply" : `Apply (${n})`;
    status.textContent = n === 0 ? "No changes" : `${n} unsaved change${n === 1 ? "" : "s"}`;
  }
  updateApplyState();

  // Actions ---------------------------------------------------------
  applyBtn.addEventListener("click", async () => {
    if (Object.keys(pending).length === 0) return;
    const changedKeys = Object.keys(pending);
    settings = await storage.setSettings(pending);
    pending = {};
    for (const key of changedKeys) {
      rowByKey.get(key).setDirty(false);
      chips.setDirty(groupOf(key).group, false);
    }
    updateApplyState();
    notifyReload();
  });

  resetAllBtn.addEventListener("click", async () => {
    if (
      !confirm(
        "Reset every advanced setting back to its default value? This won't change your feature toggles in the Features tab.",
      )
    )
      return;

    const patch = {};
    for (const group of ADVANCED_SETTINGS_SCHEMA)
      for (const item of group.items) patch[item.key] = item.default;
    settings = await storage.setSettings(patch);
    pending = {};

    for (const group of ADVANCED_SETTINGS_SCHEMA) {
      for (const item of group.items) {
        const row = rowByKey.get(item.key);
        row.setValue(item.default);
        row.setDirty(false);
      }
      chips.setDirty(group.group, false);
    }
    updateApplyState();
    notifyReload();
  });
}

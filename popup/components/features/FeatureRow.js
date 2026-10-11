import { h } from "../dom.js";
import { Toggle } from "../ui/Toggle.js";
import { Button } from "../ui/Button.js";
import { StatChip } from "../ui/StatChip.js";
import { animateButton } from "../../scripts/common.js";

/**
 * One feature: icon + name + description (click to expand), a master
 * switch, and an expandable body with cache stats, a clear button,
 * sub-option switches and/or a short note.
 *
 * @param {{
 *   feature: import("./feature-config.js").FEATURES[number],
 *   enabled: boolean,
 *   subopts?: {key: string, label: string, note: string, checked: boolean,
 *              onChange: (v: boolean) => void}[],
 *   onToggle: (enabled: boolean) => void,
 *   onClear?: () => Promise<void>,
 *   onOpen?: () => void,   // called when the user expands this row
 *   open?: boolean,
 * }} opts
 */
export function FeatureRow({ feature, enabled, subopts = [], onToggle, onClear, onOpen, open = false }) {
  const { Icon } = feature;

  const bodyId = `feature-body-${feature.id}`;
  const expandBtn = h(
    "button",
    { type: "button", class: "feature__expand", "aria-expanded": String(open), "aria-controls": bodyId },
    h("span", { class: "feature__icon" }, Icon({ size: 20 })),
    h(
      "span",
      { class: "feature__text" },
      h("span", { class: "feature__name" }, feature.name),
      h("span", { class: "feature__desc" }, feature.desc),
    ),
  );

  const toggle = Toggle({
    label: `Toggle ${feature.name}`,
    checked: enabled,
    onChange: (v) => {
      el.classList.toggle("is-on", v);
      onToggle(v);
    },
  });

  // Body ------------------------------------------------------------
  const chip = StatChip("");
  const clearBtn = onClear
    ? Button({
        label: feature.clearLabel,
        onClick: () => animateButton(clearBtn, onClear),
      })
    : null;
  const statRow = onClear ? h("div", { class: "feature__stat" }, chip, clearBtn) : null;

  const subRows = subopts.map((opt) =>
    h(
      "div",
      { class: "subopt" },
      h(
        "div",
        { class: "subopt__text" },
        h("span", { class: "subopt__label" }, opt.label),
        h("span", { class: "subopt__note" }, opt.note),
      ),
      Toggle({ label: opt.label, checked: opt.checked, small: true, onChange: opt.onChange }),
    ),
  );
  const note = feature.note ? h("p", { class: "feature__note" }, feature.note) : null;

  const body = h("div", { class: "feature__body", id: bodyId, hidden: !open }, statRow, subRows, note);

  const el = h(
    "div",
    { class: `feature${enabled ? " is-on" : ""}${open ? " is-open" : ""}` },
    h("div", { class: "feature__head" }, expandBtn, toggle),
    body,
  );
  el.style.setProperty("--c", feature.color);
  el.style.setProperty("--tint", feature.tint);

  function setOpen(next) {
    body.hidden = !next;
    el.classList.toggle("is-open", next);
    expandBtn.setAttribute("aria-expanded", String(next));
  }
  expandBtn.addEventListener("click", () => {
    const next = body.hidden;
    setOpen(next);
    if (next) onOpen?.();
  });

  return {
    el,
    setOpen,
    setEnabled(v) {
      toggle.setChecked(v);
      el.classList.toggle("is-on", v);
    },
    /** @param {string} text @param {boolean} canClear */
    setStat(text, canClear) {
      chip.textContent = text;
      if (clearBtn) clearBtn.hidden = !canClear;
    },
  };
}

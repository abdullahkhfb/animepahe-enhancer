import { h } from "../dom.js";
import { Toggle } from "../ui/Toggle.js";
import { Button } from "../ui/Button.js";
import { StatChip } from "../ui/StatChip.js";
import { animateButton } from "../../scripts/common.js";

export function FeatureRow({ feature, enabled, subopts = [], onToggle, onClear, onOpen, open = false }) {
  const { Icon } = feature;

  const bodyId = `feature-body-${feature.id}`;
  const expandBtn = h(
    "button",
    { type: "button", class: "feature-expand", "aria-expanded": String(open), "aria-controls": bodyId },
    h("span", { class: "feature-icon" }, Icon({ size: 20 })),
    h(
      "span",
      { class: "feature-text" },
      h("span", { class: "feature-name" }, feature.name),
      h("span", { class: "feature-desc" }, feature.desc),
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

  const chip = StatChip("");
  const clearBtn = onClear
    ? Button({
        label: feature.clearLabel,
        onClick: () => animateButton(clearBtn, onClear),
      })
    : null;
  const statRow = onClear ? h("div", { class: "feature-stat" }, chip, clearBtn) : null;

  const subRows = subopts.map((opt) =>
    h(
      "div",
      { class: "subopt" },
      h(
        "div",
        { class: "subopt-text" },
        h("span", { class: "subopt-label" }, opt.label),
        h("span", { class: "subopt-note" }, opt.note),
      ),
      Toggle({ label: opt.label, checked: opt.checked, small: true, onChange: opt.onChange }),
    ),
  );
  const note = feature.note ? h("p", { class: "feature-note" }, feature.note) : null;

  const body = h("div", { class: "feature-body", id: bodyId, hidden: !open }, statRow, subRows, note);

  const el = h(
    "div",
    { class: `feature${enabled ? " is-on" : ""}${open ? " is-open" : ""}` },
    h("div", { class: "feature-head" }, expandBtn, toggle),
    body,
  );

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
    setStat(text, canClear) {
      chip.textContent = text;
      if (clearBtn) clearBtn.hidden = !canClear;
    },
  };
}

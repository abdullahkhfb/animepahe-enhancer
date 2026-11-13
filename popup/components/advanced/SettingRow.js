import { h } from "../dom.js";
import { Stepper } from "../ui/Stepper.js";

export function SettingRow({ item, value, onChange, onInfo }) {
  const dot = h("span", { class: "setting-dot", title: "Unapplied change", hidden: true });
  const resetBtn = h("button", {
    type: "button",
    class: "setting-reset",
    "aria-label": `Reset ${item.label} to default ${item.default}`,
    hidden: value === item.default,
    onClick: () => {
      stepper.setValue(item.default);
      change(item.default);
    },
  }, `Default ${item.default}`);

  const stepper = Stepper({
    id: `adv-${item.key}`,
    label: item.label,
    value,
    min: item.min,
    max: item.max,
    step: item.step,
    onChange: (v) => change(v),
  });

  function change(v) {
    resetBtn.hidden = v === item.default;
    onChange(v);
  }

  const infoBtn = h("button", {
    type: "button",
    class: "setting-info",
    title: item.desc,
    "aria-label": `About ${item.label}`,
    "aria-pressed": "false",
    onClick: () => onInfo?.(),
  }, "i");

  const el = h(
    "div",
    { class: "setting", dataset: { key: item.key } },
    h(
      "div",
      { class: "setting-text" },
      h("div", { class: "setting-top" },
        h("label", { class: "setting-label", for: `adv-${item.key}` }, item.label, dot),
        infoBtn,
        resetBtn,
      ),
    ),
    stepper,
  );

  return {
    el,
    setValue(v) {
      stepper.setValue(v);
      resetBtn.hidden = v === item.default;
    },
    setInfoActive(active) {
      infoBtn.setAttribute("aria-pressed", String(active));
      infoBtn.classList.toggle("is-open", active);
    },
    setDirty(dirty) {
      dot.hidden = !dirty;
      stepper.input.classList.toggle("is-dirty", dirty);
    },
  };
}

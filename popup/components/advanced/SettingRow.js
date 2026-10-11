import { h } from "../dom.js";
import { Stepper } from "../ui/Stepper.js";

/**
 * One tunable from ADVANCED_SETTINGS_SCHEMA: label, description, a
 * "Default N" reset link (only while changed) and a stepper.
 *
 * @param {{item: {key: string, label: string, desc: string, min: number,
 *   max: number, step: number, default: number}, value: number,
 *   onChange: (value: number) => void}} opts
 */
export function SettingRow({ item, value, onChange, onInfo }) {
  const dot = h("span", { class: "setting__dot", title: "Unapplied change", hidden: true });
  const resetBtn = h("button", {
    type: "button",
    class: "setting__reset",
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

  // The description lives in a shared help line below the list (see
  // advanced.js), so every row stays one line tall.
  const infoBtn = h("button", {
    type: "button",
    class: "setting__info",
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
      { class: "setting__text" },
      h("div", { class: "setting__top" },
        h("label", { class: "setting__label", for: `adv-${item.key}` }, item.label, dot),
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

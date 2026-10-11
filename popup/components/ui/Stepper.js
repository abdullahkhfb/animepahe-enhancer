import { h } from "../dom.js";

/**
 * − [ value ] + number control. The centre is a real <input type=number>,
 * so values can still be typed; the buttons nudge by `step`.
 *
 * @param {{id: string, label: string, value: number, min: number,
 *          max: number, step: number, onChange: (v: number) => void}} opts
 */
export function Stepper({ id, label, value, min, max, step, onChange }) {
  const input = h("input", {
    id,
    class: "stepper__input",
    type: "number",
    min,
    max,
    step,
    value,
  });
  const clamp = (v) => Math.min(max, Math.max(min, v));
  const commit = (raw) => {
    let v = Number(raw);
    if (!Number.isFinite(v)) v = value;
    v = clamp(v);
    input.value = v;
    value = v;
    onChange(v);
  };

  const el = h(
    "div",
    { class: "stepper" },
    h("button", { type: "button", class: "stepper__btn", "aria-label": `Decrease ${label}`, onClick: () => commit(Number(input.value) - step) }, "−"),
    input,
    h("button", { type: "button", class: "stepper__btn", "aria-label": `Increase ${label}`, onClick: () => commit(Number(input.value) + step) }, "+"),
  );
  input.addEventListener("change", () => commit(input.value));
  el.setValue = (v) => {
    value = v;
    input.value = v;
  };
  el.input = input;
  return el;
}

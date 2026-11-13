import { h } from "../dom.js";

export function Stepper({ id, label, value, min, max, step, onChange }) {
  const input = h("input", {
    id,
    class: "stepper-input",
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
    h("button", { type: "button", class: "stepper-btn", "aria-label": `Decrease ${label}`, onClick: () => commit(Number(input.value) - step) }, "−"),
    input,
    h("button", { type: "button", class: "stepper-btn", "aria-label": `Increase ${label}`, onClick: () => commit(Number(input.value) + step) }, "+"),
  );
  input.addEventListener("change", () => commit(input.value));
  el.setValue = (v) => {
    value = v;
    input.value = v;
  };
  el.input = input;
  return el;
}

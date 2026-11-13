import { h } from "../dom.js";

export function Toggle({ label, checked = false, small = false, onChange }) {
  const el = h(
    "button",
    {
      type: "button",
      class: `toggle${small ? " toggle-sm" : ""}`,
      role: "switch",
      "aria-checked": String(checked),
      "aria-label": label,
    },
    h("span", { class: "toggle-track" }, h("span", { class: "toggle-thumb" })),
  );
  el.addEventListener("click", () => {
    const next = el.getAttribute("aria-checked") !== "true";
    el.setChecked(next);
    onChange?.(next);
  });
  el.setChecked = (v) => el.setAttribute("aria-checked", String(v));
  return el;
}

import { h } from "../dom.js";

/**
 * Accessible on/off switch (a real <button role="switch">).
 * The 44px-tall hit area is larger than the visible track.
 *
 * @param {{label: string, checked?: boolean, small?: boolean,
 *          onChange?: (checked: boolean) => void}} opts
 * @returns {HTMLButtonElement & {setChecked(v: boolean): void}}
 */
export function Toggle({ label, checked = false, small = false, onChange }) {
  const el = h(
    "button",
    {
      type: "button",
      class: `toggle${small ? " toggle--sm" : ""}`,
      role: "switch",
      "aria-checked": String(checked),
      "aria-label": label,
    },
    h("span", { class: "toggle__track" }, h("span", { class: "toggle__thumb" })),
  );
  el.addEventListener("click", () => {
    const next = el.getAttribute("aria-checked") !== "true";
    el.setChecked(next);
    onChange?.(next);
  });
  el.setChecked = (v) => el.setAttribute("aria-checked", String(v));
  return el;
}

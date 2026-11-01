import { h } from "../dom.js";

export function Notice(text) {
  const el = h(
    "div",
    { class: "notice", role: "status", hidden: true },
    h("span", { class: "notice__dot" }),
    h("span", {}, text),
  );
  el.show = () => (el.hidden = false);
  return el;
}

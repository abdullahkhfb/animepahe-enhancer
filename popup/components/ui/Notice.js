import { h } from "../dom.js";

/** Floating "Reload the page" pill; hidden until show() is called. */
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

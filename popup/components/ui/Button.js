import { h } from "../dom.js";

/** Small outlined action button ("Clear cache", "Clear list"). */
export function Button({ label, onClick, variant = "outline", title }) {
  return h("button", { type: "button", class: `btn btn--${variant}`, title, onClick }, label);
}

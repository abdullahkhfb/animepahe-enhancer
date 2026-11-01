import { h } from "../dom.js";
import { ExternalLinkIcon } from "../icons/index.js";

export function LinkRow({ href, title, desc, tile, accent = false }) {
  return h(
    "a",
    { class: `link-row${accent ? " link-row--accent" : ""}`, href, target: "_blank", rel: "noopener" },
    h("span", { class: "link-row__tile" }, tile),
    h(
      "span",
      { class: "link-row__text" },
      h("span", { class: "link-row__name" }, title),
      h("span", { class: "link-row__desc" }, desc),
    ),
    ExternalLinkIcon(),
  );
}

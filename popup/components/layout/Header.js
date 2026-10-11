import { h } from "../dom.js";
import { ApMark } from "../icons/index.js";

/** Logo tile, product name, "animepahe companion" subtitle and version. */
export function Header({ version }) {
  return h(
    "header",
    { class: "header" },
    h("span", { class: "header__mark" }, ApMark({ size: 34 })),
    h(
      "div",
      { class: "header__titles" },
      h("div", { class: "header__name" }, "Enhancer"),
      h(
        "div",
        { class: "header__sub" },
        h("span", { class: "header__sub-light" }, "anime"),
        h("span", { class: "header__sub-bold" }, "pahe"),
        " companion",
      ),
    ),
    h("span", { class: "header__version" }, `v${version}`),
  );
}

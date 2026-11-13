import { h } from "../dom.js";
import { ApMark } from "../icons/index.js";

export function Header({ version }) {
  return h(
    "header",
    { class: "header" },
    h("span", { class: "header-mark" }, ApMark({ size: 36 })),
    h(
      "div",
      { class: "header-titles" },
      h("div", { class: "header-name" }, "Enhancer"),
      h(
        "div",
        { class: "header-sub" },
        h("span", { class: "header-sub-light" }, "anime"),
        h("span", { class: "header-sub-bold" }, "pahe"),
        " companion",
      ),
    ),
    h("span", { class: "header-version" }, `v${version}`),
  );
}

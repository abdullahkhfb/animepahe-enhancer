import { h } from "../dom.js";

export function SiteLogo({ height = 24 } = {}) {
  return h("img", {
    class: "site-logo",
    src: "../icons/animepahe-wordmark.svg",
    alt: "animepahe",
    height,
    style: { height: `${height}px`, width: "auto" },
  });
}

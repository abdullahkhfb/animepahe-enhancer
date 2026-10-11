import { h } from "../dom.js";
import { ExternalLinkIcon, SiteLogo } from "../icons/index.js";

/** Hero card for the animepahe site: its real wordmark, large. */
export function SiteCard({ href, desc }) {
  return h(
    "a",
    { class: "site-card", href, target: "_blank", rel: "noopener", "aria-label": "animepahe — open the site" },
    h("span", { class: "site-card__logo" }, SiteLogo({ height: 26 })),
    h(
      "span",
      { class: "site-card__foot" },
      h("span", { class: "site-card__desc" }, desc),
      ExternalLinkIcon(),
    ),
  );
}

import { h } from "../components/dom.js";
import { SourceCodeIcon, ReportIssueIcon, MalSyncLogo } from "../components/icons/index.js";
import { LinkRow } from "../components/links/LinkRow.js";
import { SiteCard } from "../components/links/SiteCard.js";

const REPO = "https://github.com/abdullahkhfb/animepahe-enhancer";

/** Builds the Quick Links tab. @param {{panel: HTMLElement}} ctx */
export function initLinksTab({ panel }) {
  panel.append(
    SiteCard({ href: "https://animepahe.pw", desc: "Open the site" }),

    h("p", { class: "group-label" }, "Project"),
    LinkRow({
      href: REPO,
      title: "Source code",
      desc: "GitHub repository and releases",
      tile: SourceCodeIcon(),
    }),
    LinkRow({
      href: `${REPO}/issues`,
      title: "Report an issue",
      desc: "Bugs and feature requests",
      tile: ReportIssueIcon(),
    }),

    h("p", { class: "group-label" }, "Pairs well with"),
    LinkRow({
      href: "https://malsync.moe",
      title: "MalSync",
      desc: "Syncs progress to MAL, AniList and Kitsu",
      tile: MalSyncLogo({ size: 28 }),
      accent: true,
    }),
  );

  // Open in a real tab (and close the popup) instead of inside the popup.
  panel.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", (e) => {
      if (!chrome?.tabs?.create) return; // fall back to default <a> behavior
      e.preventDefault();
      chrome.tabs.create({ url: link.href });
      window.close();
    });
  });
}

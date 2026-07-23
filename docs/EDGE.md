<a name="top"></a>

# Microsoft Edge — Current Status

## Short version

**The Edge Add-ons listing is live, but it's stuck on version 0.0.2 — a very early build that predates most of what the extension does today.** If you install from the Edge store right now, don't expect Smart Search, Intro/Outro Skip, or the current popup to be there; you may hit bugs that have long since been fixed too. This isn't a small version gap, so **we'd recommend the manual install below over the store listing** until the update clears review.

A newer update was submitted and got blocked by Microsoft's certification review (see below) — that's what's keeping 0.0.2 stuck as the public listing.

<p align="center">
  <img src="../screenshots/edge_live_sc.png" alt="Screenshot showing the animepahe Enhancer listing is Live on the Edge Add-ons store at version 0.0.2" width="600" />
  <br />
  <sub>The listing itself: live, but stuck on version 0.0.2.</sub>
</p>

## What's going on

The version currently live (0.0.2) passed review fine. The problem is with the **update** submitted after it — Microsoft's certification review returned **"Attention needed"** and flagged that submission under one policy:

<p align="center">
  <img src="../screenshots/edge_certification_sc.png" alt="Screenshot of the certification report showing the Adult Content policy flag" width="600" />
  <br />
  <sub>The certification report for the blocked update.</sub>
</p>

| Field | Value |
| --- | --- |
| Status | ⚠️ Attention needed |
| Policy cited | 2.7 Adult Content |
| Reviewer's note | "The extension contains content that is pornographic or sexually explicit." |
| Review completed | 2026-07-21 |

The extension's own code doesn't include, generate, or display any adult content — it only adds UI features (progress tracking, dub badges, search, skip buttons) on top of whatever animepahe.pw itself shows a visitor. The most likely explanation is that animepahe's catalog includes a number of titles carrying an 18+/ecchi rating, and Microsoft's review is attributing that to the extension because it operates on that site — not because the extension adds, hosts, or promotes any of that content itself.

**Status of the appeal:** we've reached out to Microsoft for clarification, referencing the Product ID and Store ID for this listing, and received an acknowledgement asking for those identifiers (which have since been provided). No resolution yet. This page will be updated as soon as there's something new to report.

If you've navigated a similar Edge Add-ons rejection successfully, [open an issue](https://github.com/abdullahkhfb/animepahe-enhancer/issues) — we'd genuinely like to hear how.

If you were sent here from the main README or the popup's Quick Links tab, that's expected: we wanted to explain the version gap rather than leave people wondering why Edge is behind.

## Installing manually instead

Given the gap between what's live and what's actually in the extension now, this is the recommended way to get it on Edge until the update clears review. It gets you the exact current version — just loaded locally instead of through Edge's store pipeline.

1. Download the latest `Animepahe-Enhancer.zip` from the [GitHub Releases](https://github.com/abdullahkhfb/animepahe-enhancer/releases) page.
2. Unzip it somewhere you won't accidentally delete it (Edge needs to keep reading from that folder).
3. Go to `edge://extensions` in your address bar.
4. Turn on **Developer mode** (toggle, usually bottom-left or top-right of the page).
5. Click **Load unpacked** and select the unzipped folder.

The extension will now behave identically to a store install — it just needs to be reloaded manually if you move or delete the folder, and Edge may occasionally show a "Developer mode extensions" warning banner, which is expected and harmless. If you install this way, you may want to disable/remove the store version first to avoid running both at once.

## Prefer a different browser?

The [Firefox Add-on](https://addons.mozilla.org/en-US/firefox/addon/animepahe-enhancer/) listing is fully live and up to date, and is the easiest way to get the current version without any manual steps. See the [main README](../README.md#install) for all current install options.

<p align="right"><a href="#top">↑ Back to top</a></p>

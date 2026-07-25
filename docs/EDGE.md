<a name="top"></a>

# Microsoft Edge — Current Status

## Short version

**There is currently no live Edge Add-ons listing at all.** The store page that used to serve v0.0.2 was unpublished, and the pending update remains unapproved (see below), so right now there's no way to install this extension from the Edge store in any form. **Use the manual install further down** — it's the only way to get it on Edge at the moment. This isn't expected to be a quick fix.

<p align="center">
  <img src="../screenshots/edge_live_sc.png" alt="Screenshot showing the animepahe Enhancer listing was live on the Edge Add-ons store at version 0.0.2 (since unpublished)" width="600" />
  <br />
  <sub>The listing as it looked when v0.0.2 was still live — since unpublished.</sub>
</p>

## What's going on

The version that used to be live (0.0.2) had passed review fine. The problem was with the **update** submitted after it — Microsoft's certification review returned **"Attention needed"** and flagged that submission under one policy:

<p align="center">
  <img src="../screenshots/edge_certification_sc.png" alt="Screenshot of the certification report showing the Adult Content policy flag" width="600" />
  <br />
  <sub>The certification report for the blocked update.</sub>
</p>

| Field            | Value                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| Status           | ⚠️ Attention needed                                                         |
| Policy cited     | 2.7 Adult Content                                                           |
| Reviewer's note  | "The extension contains content that is pornographic or sexually explicit." |
| Review completed | 2026-07-21                                                                  |

The extension's own code doesn't include, generate, or display any adult content — it only adds UI features (progress tracking, dub badges, search, skip buttons) on top of whatever animepahe.pw itself shows a visitor. We asked Microsoft to clarify whether the flag was about a specific submitted asset or about the source site in general. On 2026-07-24, they gave a direct answer:

> "The extension works on/is designed for a website that contains content that is pornographic or sexually explicit. Product submitted to the store cannot be of sexually explicit or pornographic content nature or purpose."
> — Microsoft Store Certification Team

**This is a final determination, not a request for more info.** Microsoft isn't objecting to a specific screenshot or description anymore — they're saying no version of this extension can be approved, because of what site it operates on rather than anything the extension itself adds or contains. That's a different, harder blocker than the original review note suggested.

**What this means practically:**

- The listing that used to serve v0.0.2 has since been unpublished, so there's currently **no live Edge listing in any version** — not even the old one.
- We don't expect the pending update to get approved as-is, and don't plan to keep resubmitting it unchanged.
- We're checking whether the original, already-approved v0.0.2 package can be republished — since Microsoft's blanket statement doesn't obviously square with the fact that version passed review in the first place. If that goes through, it'd at least restore a working (if outdated) store listing while the bigger question gets sorted out.
- The same reasoning would very plausibly apply to a **future Chrome Web Store submission** too, since Google's content policies raise similar concerns about extensions built around adult-content-adjacent sites. We haven't submitted to Chrome yet and don't have a Google-specific answer, but we're not assuming this is an Edge-only problem.
- **Firefox (AMO) has already reviewed and approved the extension** without raising this, so Firefox remains the most reliable store option by a wide margin right now.

If you've gotten a browser extension approved for a similar general-purpose-tool-on-an-adult-adjacent-site situation, [open an issue](https://github.com/abdullahkhfb/animepahe-enhancer/issues) — we'd like to know what worked.

If you were sent here from the main README or the popup's Quick Links tab, that's expected: we wanted to explain the version gap and the reasoning behind it, rather than leave people wondering why Edge is behind.

## Installing manually instead

This is currently the **only** way to get the extension on Edge — there's nothing live in the store to install from at all right now. It gets you the exact current version, just loaded locally instead of through Edge's store pipeline.

1. Download the latest `Animepahe-Enhancer.zip` from the [GitHub Releases](https://github.com/abdullahkhfb/animepahe-enhancer/releases) page.
2. Unzip it somewhere you won't accidentally delete it (Edge needs to keep reading from that folder).
3. Go to `edge://extensions` in your address bar.
4. Turn on **Developer mode** (toggle, usually bottom-left or top-right of the page).
5. Click **Load unpacked** and select the unzipped folder.

The extension will now behave identically to a store install — it just needs to be reloaded manually if you move or delete the folder, and Edge may occasionally show a "Developer mode extensions" warning banner, which is expected and harmless.

## Prefer a different browser?

The [Firefox Add-on](https://addons.mozilla.org/en-US/firefox/addon/animepahe-enhancer/) listing is fully live and up to date, and is the easiest way to get the current version without any manual steps. See the [main README](../README.md#install) for all current install options.

<p align="right"><a href="#top">↑ Back to top</a></p>

<a name="top"></a>

# Microsoft Edge — Current Status

## Short version

**The Edge Add-ons submission is currently blocked, not just "not working."** Microsoft's certification review flagged it under their Adult Content policy. Please don't wait on the store listing — use the manual install steps below instead. It only takes a minute and works exactly the same as the store version would.

<p align="center">
  <img src="../screenshots/edge_sc.jpeg" alt="Screenshot of the animepahe Enhancer listing on the Microsoft Edge Add-ons store" width="600" />
  <br />
  <sub>The current state of the Edge Add-ons listing.</sub>
</p>

## What's going on

Microsoft's certification review returned **"Attention needed"** and flagged the submission under one policy:

| Field            | Value                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| Status           | ⚠️ Attention needed                                                         |
| Policy cited     | 2.7 Adult Content                                                           |
| Reviewer's note  | "The extension contains content that is pornographic or sexually explicit." |
| Review completed | 2026-07-21                                                                  |

The extension's own code doesn't include, generate, or display any adult content — it only adds UI features (progress tracking, dub badges, search, skip buttons) on top of whatever animepahe.pw itself shows a visitor. The most likely explanation is that animepahe's catalog includes a number of titles carrying an 18+/ecchi rating, and Microsoft's review is attributing that to the extension because it operates on that site — not because the extension adds, hosts, or promotes any of that content itself.

We don't yet know whether this is resolvable. It may come down to clarifying with Microsoft how "adult content" should be attributed to a browser extension versus the website it enhances, or it may simply not be something we can fix while animepahe's own catalog includes that content, regardless of what the extension does or doesn't touch. If you've navigated a similar Edge Add-ons rejection successfully, [open an issue](https://github.com/abdullahkhfb/animepahe-enhancer/issues) — we'd genuinely like to hear how.

This page will be updated as soon as there's something new to report.

If you were sent here from the main README or the popup's Quick Links tab, that's expected: we'd rather point you to a working install method than let you hit a blocked store submission.

## Installing manually instead

This gets you the exact same extension the store version would have been — just loaded locally instead of through Edge's store pipeline.

1. Download the latest `Animepahe-Enhancer.zip` from the [GitHub Releases](https://github.com/abdullahkhfb/animepahe-enhancer/releases) page.
2. Unzip it somewhere you won't accidentally delete it (Edge needs to keep reading from that folder).
3. Go to `edge://extensions` in your address bar.
4. Turn on **Developer mode** (toggle, usually bottom-left or top-right of the page).
5. Click **Load unpacked** and select the unzipped folder.

The extension will now behave identically to a store install — it just needs to be reloaded manually if you move or delete the folder, and Edge may occasionally show a "Developer mode extensions" warning banner, which is expected and harmless.

## Prefer a different browser?

The [Firefox Add-on](https://addons.mozilla.org/en-US/firefox/addon/animepahe-enhancer/) listing is fully live and is the easiest way to get the extension without any manual steps. See the [main README](../README.md#install) for all current install options.

<p align="right"><a href="#top">↑ Back to top</a></p>

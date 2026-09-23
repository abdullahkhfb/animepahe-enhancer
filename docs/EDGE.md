<a name="top"></a>

# Microsoft Edge — Current Status

## Short version

**The Edge Add-ons listing is live again**, at v0.3.1.2. After being unpublished and then blocked for a while (see below), a new submission passed certification and is now up on the store — link and details below. The manual-install steps further down still work if you'd rather not wait on store updates, but they're no longer the only option.

<p align="center">
  <img src="../screenshots/edge_live_sc.png" alt="Screenshot of the animepahe Enhancer listing, live on the Edge Add-ons store at version 0.3.1.2" width="600" />
  <br />
  <sub>The listing as it looks now, live at v0.3.1.2.</sub>
</p>

**Get it here:** [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/omdenhapffjpbafkliiedijooomljbgd) · Store ID `0RDCKD4MDFZC` · CRX ID `omdenhapffjpbafkliiedijooomljbgd`

## What happened before this

For a while, this page explained why Edge had no working listing at all. Short recap, kept here for context:

- The original listing (v0.0.2) passed review fine, but the **update** submitted after it was flagged by Microsoft's certification review under policy **2.7 Adult Content**, with the reviewer's note: "The extension contains content that is pornographic or sexually explicit."
- The extension's own code doesn't include, generate, or display any adult content — it only adds UI features (progress tracking, dub badges, search, skip buttons) on top of whatever animepahe.pw itself shows a visitor. We asked Microsoft to clarify whether the flag was about a specific asset or the source site in general, and on 2026-07-24 they confirmed it was the latter: a site-level objection, not a request for changes to the submission.
- That determination led to the old v0.0.2 listing being unpublished as well, leaving **no live Edge listing in any version** for a period.

That blanket determination has since been superseded — the current listing is live proof the review outcome changed. We don't have a public explanation from Microsoft for the reversal, but the practical result is the extension is installable from the Edge store again as of this update.

**Note for Chrome:** we still haven't submitted to the Chrome Web Store, and don't yet know whether Google's review would raise the same kind of objection. **Firefox (AMO)** has remained live and approved throughout.

If you've dealt with a similar review reversal on Edge or Chrome, [open an issue](https://github.com/abdullahkhfb/animepahe-enhancer/issues) — we're interested in how consistent this is.

## Installing manually instead

If you'd rather not wait on Edge's store update pipeline, or want a specific version, manual install still works:

1. Download the latest `Animepahe-Enhancer.zip` from the [GitHub Releases](https://github.com/abdullahkhfb/animepahe-enhancer/releases) page.
2. Unzip it somewhere you won't accidentally delete it (Edge needs to keep reading from that folder).
3. Go to `edge://extensions` in your address bar.
4. Turn on **Developer mode** (toggle, usually bottom-left or top-right of the page).
5. Click **Load unpacked** and select the unzipped folder.

The extension will now behave identically to a store install — it just needs to be reloaded manually if you move or delete the folder, and Edge may occasionally show a "Developer mode extensions" warning banner, which is expected and harmless.

## Prefer a different browser?

The [Firefox Add-on](https://addons.mozilla.org/en-US/firefox/addon/animepahe-enhancer/) listing is fully live and up to date. See the [main README](../README.md#install) for all current install options.

<p align="right"><a href="#top">↑ Back to top</a></p>

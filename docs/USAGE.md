<a name="top"></a>

# Usage Guide

> Step-by-step instructions for every feature. For a quick overview instead, see the [main README](../README.md).

## Table of Contents

- [Continue Watching](#continue-watching)
- [DUB Detector](#dub-detector)
- [Smart Search](#smart-search)
- [Intro / Outro Skip](#intro--outro-skip)
- [Binge Watch](#binge-watch)
- [Popup Settings Panel](#popup-settings-panel)

---

## Continue Watching

When you watch an episode on animepahe:

1. The extension automatically records your progress after the video starts playing. No manual action is required.
2. The next time you visit the **animepahe home page**, a **Continue Watching** section appears above the Latest Releases grid.
3. Each card shows:
   - The anime's poster thumbnail
   - A red progress bar at the bottom of the thumbnail indicating how far through the episode you are
   - The episode number badge (bottom-right of the thumbnail)
   - The anime title below the thumbnail
4. Click any card to jump directly back to that episode. The video will automatically seek to your saved position.
5. Hover over a card to reveal the **✕** remove button (top-right of the thumbnail) to remove that individual entry.
6. Use **Show More / Show Less** if you have more than 6 entries in your history.
7. Use **Clear All** (from the home page section or the popup) to wipe the entire list.

<p align="right"><a href="#top">↑ Back to top</a></p>

## DUB Detector

The DUB Detector runs automatically in the background on three page types:

**Anime episode list page (`/anime/{session}`):**

- All visible episode cards are scanned (using binary search) when the page loads.
- Dubbed episodes receive a pink **DUB** badge in the top-right corner of their card; sub-only episodes receive an orange **SUB ONLY** badge.
- A status pill appears in the bottom-right of the screen with real-time scan progress, including a live percentage indicator that resolves to the final count on completion (e.g., `🎙 DUB: 12 episodes dubbed ✓`).
- The scan re-runs automatically when the episode list is paginated or updated via AJAX.

**Player page (`/play/{animeSession}/{epSession}`):**

- A quick check runs on load.
- If the episode is dubbed, a **DUB** badge is appended inline to the episode title; otherwise a **SUB ONLY** badge is shown.

**Home page (latest releases grid):**

- Every anime card in the latest release feed is scanned.
- Cards with dubbed episodes receive a pink badge showing `dubbed/total` episodes (e.g., `12/24`).
- Scanning is batched (2 at a time by default) to avoid rate-limiting.

**Cache:** DUB results are cached for **24 hours by default**. Stale entries are garbage-collected automatically. Both the batch size and cache duration are configurable in Advanced Settings, and you can force-clear the cache from the popup.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Smart Search

Smart Search activates automatically while you type in the animepahe search bar — no extra steps are needed:

1. Start typing any title in the search bar. After a 100 ms debounce by default (configurable), Smart Search kicks in alongside the native search.
2. animepahe's regular results appear as normal. Smart Search then queries AniList for alternative titles associated with your term.
3. Any additional matching anime found via those alternative titles are **injected at the top** of the dropdown under a labelled divider.
4. Each extra result card shows the anime's poster thumbnail, its title as listed on animepahe, and a pink _also known as "…"_ tag showing which search term led to this result.
5. Click any result card (native or injected) to navigate to that anime's page as normal.
6. If Smart Search finds nothing additional, the dropdown is left unchanged.

**Cache:** AniList lookup results are cached for **24 hours by default** (configurable in the Advanced tab). You can force-clear the cache from the popup.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Intro / Outro Skip

The Intro / Outro Skip feature activates automatically on the player page (`/play/{animeSession}/{epSession}`):

1. When you navigate to a player page, the extension extracts the anime title and episode number from the page.
2. It resolves the anime to an AniDB ID (via AniList search → relations.yuna.moe) and looks up intro/outro timestamps for that episode. A status pill in the bottom-right corner shows progress.
3. If timestamps are found, a result pill appears (e.g., `⏭ Intro/Outro (database): OP ✓ · ED ✓`) and the skip ranges are sent to the Kwik player.
4. In **manual mode** (default): A **Skip Intro** or **Skip Outro** button appears overlaid on the video when playback enters an intro or outro range. Click it to jump past the segment. The button auto-hides after a configurable delay but reappears if you move your mouse.
5. In **auto-skip mode** (opt-in, toggled on the Intro / Outro Skip row): The player automatically seeks past intros and outros as soon as playback enters the range.
6. **Progress bar highlights**: Coloured segments are drawn directly on the Kwik player's scrubber — blue for intros, orange for outros, purple for recaps. This can be disabled in Advanced Settings.
7. If the anime isn't in the local open-anime-timestamps database, the status pill shows "not found" — there's no online fallback for this feature, so nothing is skipped for that episode.

**Data sources and caching:**

- The open-anime-timestamps database (~27 MB) is downloaded from GitHub and cached in **IndexedDB** (too large for `chrome.storage.local`'s default quota). It's refreshed on a configurable schedule (7 days by default) using conditional GET with ETag headers to avoid re-downloading unchanged data.
- AniList → AniDB ID mappings are cached per anime session in `chrome.storage.local` (configurable TTL, default 7 days).
- You can see whether the database is currently cached, or clear all cached data, from the popup.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Binge Watch

Binge Watch auto-plays the next episode when the current one ends. It's **off by default** since it navigates your browser on its own — turn it on from its card in the popup's Features tab.

1. Once enabled, nothing changes until an episode actually finishes playing.
2. When the video hits its native "ended" event, the extension looks up the next episode via animepahe's own release listing.
3. A short countdown pill appears (`▶ Binge Watch: next episode in 5s`) in the bottom-right corner. Click it any time before it finishes to cancel and stay on the current episode.
4. If you don't cancel, the browser navigates to the next episode automatically once the countdown ends.
5. While the feature is on, animepahe's "Click to load" placeholder over the embed is clicked automatically on **every** episode page you land on — not just ones Binge Watch navigates to — so nothing sits waiting for a click.
6. If there's no next episode (you're on the latest one), nothing happens — playback just ends normally.

**Tuning:** The countdown length is configurable in the Advanced tab (`Countdown before next episode`) and can be set to **0** to skip the pill entirely and jump straight to the next episode.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Popup Settings Panel

Click the extension icon in the browser toolbar to open the settings popup. It's split into three tabs:

**Features tab** — one row per feature, each with its own colour. A status strip under the header lights one segment per enabled feature ("4 of 5 active"). Click a row to expand it and:

- See a quick stat (items saved, entries cached, or whether the timestamps database is cached)
- Clear that feature's cache/history with one click
- Flip any sub-option that belongs to that feature (for example, auto-skip for Intro/Outro Skip)

The switch on the right of each row turns that feature on or off.

**Advanced tab** — every internal tunable, grouped by feature:

- Pick a group from the pill selector to see only that group's settings
- Each setting shows a plain-language description and a stepper (− / + buttons, or type a value), plus a **Default N** link that appears once you change it
- Edits are staged (marked with a small dot) until you press **Apply** — nothing saves until then
- **Reset all advanced settings** restores every tunable to default without touching your feature toggles

**Links tab** — the animepahe site (shown with its real logo), the GitHub repository, the issue tracker, and a recommended companion tool, [MalSync](https://malsync.moe) (with its real logo), for syncing your progress to MyAnimeList/AniList/Kitsu.

The popup is 400px wide and as tall as its content, so there is no inner scrolling. The tab bar sits right under the header on every tab.

> After toggling a feature or applying an advanced setting, reload the animepahe page for changes to take effect. The popup shows a reminder notice automatically.

<p align="right"><a href="#top">↑ Back to top</a></p>

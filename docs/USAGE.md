<a name="top"></a>

# Usage Guide

> Step-by-step instructions for every feature. For a quick overview instead, see the [main README](../README.md).

## Table of Contents

- [Continue Watching](#continue-watching)
- [DUB Detector](#dub-detector)
- [Smart Search](#smart-search)
- [Intro / Outro Skip](#intro--outro-skip)
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

**Cache:** AniList lookup results are cached for **24 hours by default** (configurable in Advanced Settings). You can force-clear the cache from the popup.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Intro / Outro Skip

The Intro / Outro Skip feature activates automatically on the player page (`/play/{animeSession}/{epSession}`):

1. When you navigate to a player page, the extension extracts the anime title and episode number from the page.
2. It resolves the anime to an AniDB ID (via AniList search → relations.yuna.moe) and looks up intro/outro timestamps for that episode. A status pill in the bottom-right corner shows progress.
3. If timestamps are found, a result pill appears (e.g., `⏭ Intro/Outro (database): OP ✓ · ED ✓`) and the skip ranges are sent to the Kwik player.
4. In **manual mode** (default): A **Skip Intro** or **Skip Outro** button appears overlaid on the video when playback enters an intro or outro range. Click it to jump past the segment. The button auto-hides after a configurable delay but reappears if you move your mouse.
5. In **auto-skip mode** (opt-in, toggled in Advanced Settings): The player automatically seeks past intros and outros as soon as playback enters the range.
6. **Progress bar highlights**: Coloured segments are drawn directly on the Kwik player's scrubber — blue for intros, orange for outros, purple for recaps. This can be disabled in Advanced Settings.
7. If the anime isn't in the local open-anime-timestamps database, the status pill shows "not found" — there's no online fallback for this feature, so nothing is skipped for that episode.

**Data sources and caching:**

- The open-anime-timestamps database (~27 MB) is downloaded from GitHub and cached in **IndexedDB** (too large for `chrome.storage.local`'s default quota). It's refreshed on a configurable schedule (7 days by default) using conditional GET with ETag headers to avoid re-downloading unchanged data.
- AniList → AniDB ID mappings are cached per anime session in `chrome.storage.local` (configurable TTL, default 7 days).
- You can see whether the database is currently cached, or clear all cached data, from the popup.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Popup Settings Panel

Click the extension icon in the browser toolbar to open the settings popup. It's split into three tabs:

**Features tab** — one collapsible card per feature. Click a card to expand it and:

- Toggle that feature on or off
- See a quick stat (items saved, entries cached, or whether the timestamps database is cached)
- Clear that feature's cache/history with one click

**Advanced Settings tab** — every internal tunable, grouped by feature and collapsed by default:

- Click a group's header to expand it
- Each setting shows a plain-language description and a bounded number input, plus its own **↺ reset** button
- Edits are staged (marked with a small dot) until you press **Apply Changes** — nothing saves until then
- **Reset All Advanced Settings** restores every tunable to default without touching your feature toggles

**Quick Links tab** — shortcuts to the GitHub repository, the issue tracker, the animepahe site, and a recommended companion tool ([MalSync](https://malsync.moe)) for syncing your progress to MyAnimeList/AniList/Kitsu.

> After toggling a feature or applying an advanced setting, reload the animepahe page for changes to take effect. The popup shows a reminder notice automatically.

<p align="right"><a href="#top">↑ Back to top</a></p>

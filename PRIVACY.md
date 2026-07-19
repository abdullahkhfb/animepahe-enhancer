# Privacy Policy for animepahe Enhancer

**Effective Date:** July 16, 2026

This Privacy Policy explains how the **animepahe Enhancer** extension, published by **Vixon**, handles data. Transparency and strict digital privacy are core principles of this project.

## 1. Information Collection and Use

**animepahe Enhancer** is designed to operate as locally as possible. The extension **does not** collect, harvest, transmit, or sell any Personally Identifiable Information (PII), browsing history, or usage analytics to external servers. User settings and Continue Watching progress are stored exclusively in your browser's local storage and never leave your device.

However, several features make outbound network requests to specific third-party APIs to provide their functionality. These requests are described in detail below. **No request includes account information, personal data, or browsing history beyond the minimum data required for the specific API call.**

- **Video Progress Tracking:** To provide a seamless viewing experience and remember where you left off, the extension utilizes your browser's `chrome.storage.local` API. This watch progress data is stored solely on your device. It never leaves your browser and cannot be accessed by the developer or any external third parties.
- **Dub Detection and UI Enhancements:** Features that modify the viewing interface or detect available audio tracks (such as dubs) operate purely client-side. The extension analyzes the Document Object Model (DOM) of the active webpage locally to apply these enhancements. Network requests for DUB detection go only to the animepahe origin itself.
- **Smart Search — AniList Title Lookups:** When the Smart Search feature is enabled, your search query is sent to the [AniList GraphQL API](https://anilist.co) (`graphql.anilist.co`) solely to retrieve a list of alternative and romanized titles for the anime you are searching for. Only the search term itself is transmitted; no account information, personal data, or browsing history is included. AniList results are cached locally for 24 hours by default (configurable) to minimise repeat requests. The extension has no affiliation with AniList; it uses the publicly available, unauthenticated GraphQL endpoint. If you prefer no data to leave your browser at all, Smart Search can be disabled from the extension popup.
- **Intro / Outro Skip — Timestamp Resolution:** When the Intro / Outro Skip feature is enabled and you visit a player page, the extension makes outbound requests to resolve intro and outro timestamps for the current episode. This involves three potential external services:
  1. **[AniList GraphQL API](https://anilist.co) (`graphql.anilist.co`):** The anime title extracted from the page is sent to AniList to find a matching anime and retrieve its AniList and MyAnimeList IDs. Only the anime title string is transmitted. This is the same endpoint used by Smart Search — results are cached per anime session for 7 days by default (configurable).
  2. **[relations.yuna.moe](https://relations.yuna.moe) (`relations.yuna.moe/api/ids`):** The resolved AniList or MAL ID is sent to this service to obtain the corresponding AniDB ID, which is used as the key for the timestamp database. Only a numeric ID and a source identifier (`anilist` or `myanimelist`) are transmitted. Results are cached per anime session alongside the AniList ID lookup.
  3. **[open-anime-timestamps](https://github.com/Ellivers/open-anime-timestamps) (`raw.githubusercontent.com`):** A ~27 MB community-maintained JSON database of intro/outro timestamps is downloaded from GitHub and cached locally in your browser's IndexedDB. It is refreshed on a configurable schedule (7 days by default) using HTTP conditional GET (ETag) to avoid re-downloading unchanged data. This download contains no user-specific data — it is a public, static dataset. The database is used purely for local lookups after download. If an episode isn't in this database, no timestamps are shown for it — there is no online fallback.

## 2. Permissions Justification

To function correctly, the extension requires specific browser permissions, which are limited to the absolute minimum necessary:

- `storage`: Required to save your customized configuration preferences, video progress, and various feature caches (DUB detection, Smart Search, Intro Skip) locally on your device.
- `host permissions` for animepahe and Kwik domains: Required to execute the necessary UI and video player scripts specifically on the designated streaming domains. The extension remains strictly inactive on all other websites.
- `host permissions` for `graphql.anilist.co`: Required by the Smart Search feature to fetch alternative anime title data, and by the Intro / Outro Skip feature to resolve anime titles to AniList IDs. Only the search term or anime title is transmitted; no account information or personal data is included.
- `host permissions` for `relations.yuna.moe`: Required exclusively by the Intro / Outro Skip feature to resolve AniList/MAL IDs to AniDB IDs for timestamp database lookups. Only a numeric ID and source identifier are transmitted.
- `host permissions` for `raw.githubusercontent.com` (Ellivers/open-anime-timestamps repository): Required exclusively by the Intro / Outro Skip feature to download the community-maintained timestamp database (~27 MB). The downloaded file is a public, static JSON dataset containing no user-specific data. It is cached locally in IndexedDB and refreshed on a configurable schedule using conditional GET.

## 3. Third-Party Services

This extension does not incorporate any third-party analytics trackers, telemetry frameworks, or advertising modules. Your data and browsing habits are not monetized in any way.

The extension makes outbound requests to the following public APIs for specific functionality:

| Service | URL | Purpose | Data Sent | Caching |
| --- | --- | --- | --- | --- |
| [AniList](https://anilist.co) | `graphql.anilist.co` | Smart Search alt-title lookups; Intro Skip anime title → ID resolution | Search query (Smart Search) or anime title (Intro Skip) | 24h (Smart Search), 7d (Intro Skip) — both configurable |
| [relations.yuna.moe](https://relations.yuna.moe) | `relations.yuna.moe/api/ids` | Intro Skip AniList/MAL → AniDB ID resolution | Numeric ID + source identifier | 7 days (configurable) |
| [open-anime-timestamps](https://github.com/Ellivers/open-anime-timestamps) | `raw.githubusercontent.com` | Intro Skip timestamp database download | None (static file download) | IndexedDB, refreshed every 7 days by default (configurable) via ETag |

All requests carry no personal identifiers. These API calls are subject to each service's own Terms of Service and Privacy Policy:

- [AniList Terms of Service](https://anilist.co/terms)

Features that make outbound requests (Smart Search and Intro / Outro Skip) can be individually disabled from the extension popup. Disabling a feature prevents all outbound requests associated with it.

## 4. Data Retention

Settings, Continue Watching progress, and all cached API responses are stored entirely under your control using your browser's `chrome.storage.local` and IndexedDB. You can instantly and permanently delete all saved data at any time by:

- Clearing your browser's local extension data
- Uninstalling the extension
- Using the "Clear Cache" buttons in the popup for individual features (DUB cache, Smart Search cache, Intro Skip cache/DB)

## 5. Changes to This Privacy Policy

This policy may be updated periodically to reflect new features or comply with browser store requirements. Any updates will be published on this page with a revised "Effective Date."

## 6. Contact Information

For any questions, concerns, or technical audits regarding this privacy policy or the extension's underlying code, please open an issue on the official GitHub repository or contact the developer directly at **rynvexa@proton.me**.
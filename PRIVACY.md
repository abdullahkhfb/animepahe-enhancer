# Privacy Policy for animepahe Enhancer

**Last Modified:** October 15, 2026

This Privacy Policy explains how the **animepahe Enhancer** extension, published by **Vixon**, handles data. Transparency and strict digital privacy are core principles of this project.

## 1. Information Collection and Use

**animepahe Enhancer** is designed to operate as locally as possible. The extension does not collect data for the developer, or use analytics or telemetry. User settings and Continue Watching progress are stored in your browser and never sent to the developer. Features that make network requests send only the information needed for that feature, as described below; the receiving services may also see standard connection metadata, such as your IP address.

However, several features make outbound network requests to animepahe, pahe.win, and specific third-party services to provide their functionality. The extension does not read account details or browsing history for its own use or send them to the developer. Requests to animepahe and pahe.win may include the browser's existing site credentials, as normal site requests do; the extension does not read or store those credentials.

- **Video Progress Tracking:** To provide a seamless viewing experience and remember where you left off, the extension utilizes your browser's `chrome.storage.local` API. This watch progress data is stored solely on your device. It never leaves your browser and cannot be accessed by the developer or any external third parties.
- **Dub Detection and UI Enhancements:** The extension analyzes the Document Object Model (DOM) of the active webpage locally to apply its interface enhancements. DUB detection requests go to the animepahe origin itself and use the browser's normal site credentials.
- **Smart Search — Alternative Title Lookups:** When Smart Search is enabled, the text you type as a search query is sent to the [AniList GraphQL API](https://anilist.co) (`graphql.anilist.co`) to retrieve alternative and romanized anime titles. The query itself is sent, so do not enter personal information in the anime search field. The extension then searches animepahe's own search API with the original and selected alternate titles to find matching entries. AniList results are cached locally for 24 hours by default (configurable) to minimise repeat requests. The extension has no affiliation with AniList; it uses the publicly available, unauthenticated GraphQL endpoint. Smart Search can be disabled from the extension popup.
- **Intro / Outro Skip — Timestamp Resolution:** When the Intro / Outro Skip feature is enabled and you visit a player page, the extension makes outbound requests to resolve intro and outro timestamps for the current episode. This involves three potential external services:
  1. **[AniList GraphQL API](https://anilist.co) (`graphql.anilist.co`):** The anime title extracted from the page is sent to AniList to find a matching anime and retrieve its AniList and MyAnimeList IDs. The title string is transmitted. This is the same endpoint used by Smart Search — ID-resolution results are cached per anime session for 7 days by default (configurable).
  2. **[relations.yuna.moe](https://relations.yuna.moe) (`relations.yuna.moe/api/ids`):** The resolved AniList or MAL ID is sent to this service to obtain the corresponding AniDB ID, which is used as the key for the timestamp database. Only a numeric ID and a source identifier (`anilist` or `myanimelist`) are transmitted. Results are cached per anime session alongside the AniList ID lookup.
  3. **[open-anime-timestamps](https://github.com/Ellivers/open-anime-timestamps) (`raw.githubusercontent.com`):** A ~27 MB community-maintained JSON database of intro/outro timestamps is downloaded from GitHub and cached locally in your browser's IndexedDB. It is refreshed on a configurable schedule (7 days by default) using HTTP conditional GET (ETag) to avoid re-downloading unchanged data. This download contains no user-specific data — it is a public, static dataset. The database is used purely for local lookups after download. If an episode isn't in this database, no timestamps are shown for it — there is no online fallback.
- **Binge Watch — Automatic Next-Episode Playback:** **Off by default**, since it navigates your browser on its own. When switched on, the extension listens for the current video ending and requests the next episode's identifier from animepahe's own release-listing API — the same origin the page is already on, not a third party — then automatically navigates the browser to that episode and clicks the player's own "load" placeholder so it starts without further input from you. No data beyond the anime and episode identifiers already present in the page's own URL is transmitted, and nothing is sent to any external service. Disabling the feature in the popup stops all of this immediately.
- **Skip Wait — Download Link Resolution:** When you click a `pahe.win` link in an episode's Download menu, the extension requests that one `pahe.win` page (the same page your browser would otherwise have opened), reads the Kwik link out of it, and opens that Kwik page in a new tab for you. The request carries no data beyond what a normal visit to that link would. Nothing is sent to any other service, nothing is stored, and the extension does not interact with the Kwik page. Disabling the feature in the popup restores the normal behaviour immediately.

## 2. Permissions Justification

To function correctly, the extension requires specific browser permissions, which are limited to the absolute minimum necessary:

- `storage`: Required to save your customized configuration preferences, video progress, and various feature caches (DUB detection, Smart Search, Intro Skip) locally on your device.
- `host permissions` for animepahe and Kwik domains: Required to execute the main content script and embedded-player script on those sites. Other host permissions below allow feature-specific network requests; they do not inject content scripts on those service domains.
- `host permissions` for `pahe.win`: Required exclusively by the Skip Wait feature, so the extension's background script can read the Kwik link out of a `pahe.win` download-link page you clicked. No other use.
- `host permissions` for `graphql.anilist.co`: Required by Smart Search to fetch alternative anime title data, and by Intro / Outro Skip to resolve anime titles to AniList IDs. The search query or page's anime title is sent in the request payload.
- `host permissions` for `relations.yuna.moe`: Required exclusively by the Intro / Outro Skip feature to resolve AniList/MAL IDs to AniDB IDs for timestamp database lookups. Only a numeric ID and source identifier are transmitted.
- `host permissions` for `raw.githubusercontent.com` (Ellivers/open-anime-timestamps repository): Required exclusively by the Intro / Outro Skip feature to download the community-maintained timestamp database (~27 MB). The downloaded file is a public, static JSON dataset containing no user-specific data. It is cached locally in IndexedDB and refreshed on a configurable schedule using conditional GET.

## 3. Third-Party Services

This extension does not incorporate any third-party analytics trackers, telemetry frameworks, or advertising modules. Your data and browsing habits are not monetized in any way.

The extension makes outbound requests to the following public APIs for specific functionality:

| Service | URL | Purpose | Data Sent | Caching |
| --- | --- | --- | --- | --- |
| [AniList](https://anilist.co) | `graphql.anilist.co` | Smart Search alt-title lookups; Intro Skip anime title → ID resolution | Search query (Smart Search) or anime title (Intro Skip) | 24h (Smart Search), 7d (Intro Skip) — both configurable |
| [relations.yuna.moe](https://relations.yuna.moe) | `relations.yuna.moe/api/ids` | Intro Skip AniList/MAL → AniDB ID resolution | Numeric ID + source identifier | 7 days (configurable) |
| [open-anime-timestamps](https://github.com/Ellivers/open-anime-timestamps) | `raw.githubusercontent.com` | Intro Skip timestamp database download | Static dataset request; conditional ETag header when available | IndexedDB, refreshed every 7 days by default (configurable) via ETag |

The request payloads to these services do not include account details or browsing history. Services may receive standard connection metadata, such as your IP address, when your browser connects to them. These API calls are subject to each service's own Terms of Service and Privacy Policy:

- [AniList Terms of Service](https://anilist.co/terms)

Features that make outbound requests (Smart Search and Intro / Outro Skip) can be individually disabled from the extension popup. Disabling a feature prevents all outbound requests associated with it.

## 4. Data Retention

Settings, Continue Watching progress, and all cached API responses are stored entirely under your control using your browser's `chrome.storage.local` and IndexedDB. You can instantly and permanently delete all saved data at any time by:

- Clearing your browser's local extension data
- Uninstalling the extension
- Using the "Clear Cache" buttons in the popup for individual features (DUB cache, Smart Search cache, Intro Skip cache/DB)

## 5. Changes to This Privacy Policy

This policy may be updated periodically to reflect new features or comply with browser store requirements. Any updates will be published on this page with a revised "Last Modified" date.

## 6. Contact Information

For any questions, concerns, or technical audits regarding this privacy policy or the extension's underlying code, please open an issue on the official GitHub repository or contact the developer directly at **rynvexa@proton.me**.
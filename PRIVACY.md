# Privacy Policy for animepahe Enhancer

**Effective Date:** June 09, 2026

This Privacy Policy explains how the **animepahe Enhancer** extension, published by **Vixon**, handles data. Transparency and strict digital privacy are core principles of this project.

## 1. Information Collection and Use

**animepahe Enhancer** is designed to operate entirely locally on your machine. The extension **does not** collect, harvest, transmit, or sell any Personally Identifiable Information (PII), browsing history, or usage analytics to external servers.

- **Video Progress Tracking:** To provide a seamless viewing experience and remember where you left off, the extension utilizes your browser's local storage API. This watch progress data is stored solely on your device. It never leaves your browser and cannot be accessed by the developer or any external third parties.
- **Dub Detection and UI Enhancements:** Features that modify the viewing interface or detect available audio tracks (such as dubs) operate purely client-side. The extension analyzes the Document Object Model (DOM) of the active webpage locally to apply these enhancements.
- **Smart Search — AniList Title Lookups:** When the Smart Search feature is enabled, your search query is sent to the [AniList GraphQL API](https://anilist.co) (`graphql.anilist.co`) solely to retrieve a list of alternative and romanized titles for the anime you are searching for. Only the search term itself is transmitted; no account information, personal data, or browsing history is included. AniList results are cached locally for 24 hours to minimise repeat requests. The extension has no affiliation with AniList; it uses the publicly available, unauthenticated GraphQL endpoint. If you prefer no data to leave your browser at all, Smart Search can be disabled from the extension popup.

## 2. Permissions Justification

To function correctly, the extension requires specific browser permissions, which are limited to the absolute minimum necessary:

- `storage`: Required exclusively to save your customized configuration preferences and video progress locally on your device.
- `host permissions` for animepahe and Kwik domains: Required to execute the necessary UI and video player scripts specifically on the designated streaming domains. The extension remains strictly inactive on all other websites.
- `host permissions` for `graphql.anilist.co`: Required exclusively by the Smart Search feature to fetch alternative anime title data from the AniList public API. This permission is not used by any other feature.

## 3. Third-Party Services

This extension does not incorporate any third-party analytics trackers, telemetry frameworks, or advertising modules. Your data and browsing habits remain entirely private and are not monetized in any way.

The **Smart Search** feature makes outbound requests to the publicly available [AniList GraphQL API](https://anilist.co) (`graphql.anilist.co`) for the sole purpose of looking up alternative anime titles. These requests contain only the search query string and carry no personal identifiers. This API call is subject to [AniList's own Terms of Service and Privacy Policy](https://anilist.co/terms). Smart Search can be disabled in the extension popup if you wish to prevent all outbound network requests.

## 4. Data Retention

Because no data is transmitted to or stored on external servers, data retention is entirely under your control. You can instantly and permanently delete all saved preferences and video progress tracking data at any time by clearing your browser's local extension data or by uninstalling the extension.

## 5. Changes to This Privacy Policy

This policy may be updated periodically to reflect new features or comply with browser store requirements. Any updates will be published on this page with a revised "Effective Date".

## 6. Contact Information

For any questions, concerns, or technical audits regarding this privacy policy or the extension's underlying code, please open an issue on the official GitHub repository or contact the developer directly at **rynvexa@proton.me**.

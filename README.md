# animepahe Enhancer

> A lightweight browser extension that supercharges your animepahe experience — featuring automatic DUB detection and seamless Continue Watching with per-episode progress tracking.

<p align="center">
  <img src="icons/icon128.png" alt="animepahe Enhancer logo" width="96" />
</p>
<p align="center">
  <a href="https://addons.mozilla.org/en-US/firefox/addon/animepahe-enhancer/"><img alt="Firefox Add-on" src="https://img.shields.io/badge/Firefox-Add--on-FF7139?logo=firefox-browser&logoColor=white" /></a> <a href="https://microsoftedge.microsoft.com/addons/detail/omdenhapffjpbafkliiedijooomljbgd"><img alt="Edge Add-on" src="https://img.shields.io/badge/Edge-Add--on-0078D7?logo=microsoft-edge&logoColor=white" /></a> <img alt="Manifest Version" src="https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white" /> <img alt="License" src="https://img.shields.io/badge/License-MIT-green" /> <img alt="Version" src="https://img.shields.io/badge/version-0.0.6.1-blue" />
</p>

> [!WARNING]
> **Edge (v0.0.2) Bug Alert:** The current live Edge version has known issues. A fully patched update (**v0.0.6.1**) has been submitted and will automatically roll out to resolve these bugs as soon as Microsoft review completes.

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
  - [Firefox](#firefox)
  - [Microsoft Edge (Desktop)](#microsoft-edge-desktop)
  - [Other Chromium Browsers (Manual)](#other-chromium-browsers-manual)
- [Usage](#usage)
  - [Continue Watching](#continue-watching)
  - [DUB Detector](#dub-detector)
  - [Popup Settings Panel](#popup-settings-panel)
- [Architecture](#architecture)
  - [File Structure](#file-structure)
  - [How It Works](#how-it-works)
  - [Adding a New Feature](#adding-a-new-feature)
- [Permissions](#permissions)
- [Supported Domains](#supported-domains)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### ▶ Continue Watching

Never lose your place again. animepahe Enhancer tracks your exact playback position for every episode you watch and surfaces a **Continue Watching** row directly on the animepahe home page.

- Automatically saves your progress every 2 seconds while the video plays
- Resumes exactly where you left off when you revisit an episode
- Displays a visual progress bar on each card in the Continue Watching grid
- Supports up to **24 episodes** in your watch history (FIFO — oldest entries are pruned automatically)
- Individual episodes can be removed with a hover-reveal ✕ button
- The entire list can be cleared in one click from the popup or the home page
- Works across all official animepahe mirror domains

### 🎙 DUB Detector

Instantly know which episodes are available in English dub without opening them. The DUB Detector automatically scans anime listings, episode pages, and the home feed and overlays colour-coded badges:

| Location        | Badge colour                    | Example                                     |
| --------------- | ------------------------------- | ------------------------------------------- |
| Episode list    | Pink `DUB` badge              | A single dubbed episode                     |
| Home page cards | Pink `N/total` badge            | `12/24` dubbed out of 24 total              |
| Player page     | Inline `DUB` badge on the title | Confirmation when watching a dubbed episode |

Detection uses a two-method strategy with a 12-hour local cache to minimise network requests:

1. **Lightweight JSON API check** — hits animepahe's `/api?m=links` endpoint
2. **HTML page fallback** — parses the play page if the API check is inconclusive

A smart **binary search** algorithm is used on episode lists, since dubbed episodes always form a contiguous block from the beginning of a series. This cuts the number of network requests from O(n) to O(log n).

---

## Screenshots

<img width="1390" height="1213" alt="image" src="https://github.com/user-attachments/assets/73c57c2f-384e-4c83-b6fa-4c809745bc3f" />
<img width="1500" height="395" alt="image" src="https://github.com/user-attachments/assets/7ae473e9-d98f-4692-9509-ddb2235f9589" />
<img width="1920" height="998" alt="image" src="https://github.com/user-attachments/assets/001e014b-6e9e-472c-a6f5-6efac4c60804" />
<img width="1388" height="852" alt="image" src="https://github.com/user-attachments/assets/3228f406-223f-4bd6-82a0-25a7b7db33ae" />
<img width="1375" height="112" alt="image" src="https://github.com/user-attachments/assets/799950cc-a656-404a-9f32-d33688074a13" />
<img width="1920" height="1020" alt="image" src="https://github.com/user-attachments/assets/6902d90e-ea4a-4e9a-82d3-64aca52ec57c" />

---

## Installation

### Firefox

Install directly from the **Firefox Add-ons store**:

👉 [**animepahe Enhancer on AMO**](https://addons.mozilla.org/en-US/firefox/addon/animepahe-enhancer/)

Requires **Firefox 109.0 or later**.

### Microsoft Edge (Desktop)

Install directly from the **Microsoft Edge Add-ons store**:

👉 [**animepahe Enhancer on Edge Add-ons**](https://microsoftedge.microsoft.com/addons/detail/omdenhapffjpbafkliiedijooomljbgd)

### Other Chromium Browsers (Manual)

1. Download the latest compiled production bundle `Animepahe-Enhancer.zip` from the [Releases page](https://github.com/abdullahkhfb/animepahe-enhancer/releases).
2. Unzip the archive to a permanent directory on your machine.
3. Navigate to `chrome://extensions` (or your browser's extensions dashboard).
4. Toggle **Developer mode** to active (top-right switch).
5. Click **Load unpacked** and select the unzipped directory.

---

## Usage

### Continue Watching

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

### DUB Detector

The DUB Detector runs automatically in the background on three page types:

**Anime episode list page (`/anime/{session}`):**

- All visible episode cards are scanned (using binary search) when the page loads.
- Dubbed episodes receive an orange **DUB** badge in the top-right corner of their card.
- A status pill appears in the bottom-right of the screen with real-time scan progress (e.g., `🎙 DUB: 12 episodes dubbed ✓`).
- The scan re-runs automatically when the episode list is paginated or updated via AJAX.

**Player page (`/play/{animeSession}/{epSession}`):**

- A quick check runs on load.
- If the episode is dubbed, a **DUB** badge is appended inline to the episode title (`<h1>`).
- The status pill shows `🎙 DUB: Dubbed ✓` or `🎙 DUB: Sub only`.

**Home page (latest releases grid):**

- Every anime card in the latest release feed is scanned.
- Cards with dubbed episodes receive a pink badge showing `dubbed/total` episodes (e.g., `12/24`).
- Scanning is batched (3 at a time) to avoid rate-limiting.

**Cache:** DUB results are cached in `chrome.storage.local` for **12 hours**. Stale entries are garbage-collected automatically 3 seconds after each page load. You can force-clear the cache from the popup.

### Popup Settings Panel

Click the extension icon in the browser toolbar to open the settings popup. From here you can:

- **Toggle Continue Watching** on or off
- **Toggle DUB Detector** on or off
- See how many items are currently in your Continue Watching list
- **Clear your Continue Watching list**
- See how many DUB detection results are currently cached
- **Clear the DUB cache** (forces a fresh scan on next visit)

> After toggling a feature, reload the animepahe page for changes to take effect. The popup will show a reminder notice automatically.

---

## Architecture

### File Structure

```
animepahe-enhancer/
├── manifest.json                  # Extension manifest (Manifest V3)
│
├── content/
│   ├── main.js                    # Entry point — loads settings, detects page,
│   │                              # dynamically imports and initializes features
│   ├── iframe-player.js           # Kwik iframe script — postMessage bridge
│   │
│   ├── features/                  # One file per feature
│   │   ├── continue-watching.js   # Continue Watching — home row + player bridge
│   │   └── dub-detector.js        # DUB Detector — badges, binary search, cache
│   │
│   └── helpers/                   # Shared helpers imported by any feature
│       ├── storage.js             # chrome.storage.local wrapper + key constants
│       ├── router.js              # Page-type detection from the current URL
│       └── cache.js               # DUB cache read/write/GC
│
├── popup/
│   ├── popup.html                 # Settings popup UI
│   ├── popup.css                  # Popup styles
│   └── popup.js                   # Popup logic (settings, stats, clear actions)
│
├── icons/
│   ├── icon16.{png,svg}
│   ├── icon48.{png,svg}
│   └── icon128.{png,svg}
│
└── .github/
    └── workflows/
        └── deploy.yml             # CI/CD: Unified production deployment engine
```

### How It Works

#### Module loading — no bundler required

`content/main.js` is the sole entry point registered in `manifest.json`. It uses the browser's native dynamic `import()` with `chrome.runtime.getURL()` to load feature and utility modules at runtime:

```
manifest.json
└─ content_scripts → content/main.js
   │
   ├─ import(helpers/storage.js)
   ├─ import(helpers/router.js)
   ├─ import(helpers/cache.js)
   │
   ├─ [cwEnabled]  → import(features/continue-watching.js)
   │                    new ContinueWatching(storage).init(pageType)
   │
   └─ [dubEnabled] → import(features/dub-detector.js)
                        new DubDetector(storage).init(pageType)
```

Feature files are listed in `web_accessible_resources` so the extension runtime can import them. No bundler, no build step — plain ES2020+ modules.

#### Continue Watching — Cross-Frame Communication

animepahe embeds the actual video player in a sandboxed `<iframe>` served from a separate domain (Kwik). Because the iframe and the parent page are on different origins, direct DOM access is impossible. The extension solves this with a **`postMessage` bridge**:

```
┌─────────────────────────────────────────────────────────────┐
│  animepahe page (features/continue-watching.js)             │
│                                                             │
│  • Listens for messages from the iframe                     │
│  • Saves/loads progress via chrome.storage.local            │
│  • Renders the Continue Watching section on the home page   │
└──────────────────────────┬──────────────────────────────────┘
                           │  window.postMessage
                    ┌──────▼───────────────────┐
                    │  Kwik iframe              │
                    │  (iframe-player.js)       │
                    │                           │
                    │  • Finds the <video> el   │
                    │  • Requests saved time    │
                    │  • Reports timeupdate     │
                    │    every 2 s              │
                    │  • Seeks on restore       │
                    └───────────────────────────┘
```

**Message types:**

| Type                 | Direction       | Payload              | Description                               |
| -------------------- | --------------- | -------------------- | ----------------------------------------- |
| `AP_CW_REQUEST_TIME` | iframe → parent | —                    | Iframe asks parent for saved timestamp    |
| `AP_CW_RESTORE_TIME` | parent → iframe | `{ time: number }`   | Parent sends saved position; iframe seeks |
| `AP_CW_UPDATE_TIME`  | iframe → parent | `{ time, duration }` | Iframe reports current playback position  |

#### DUB Detector — Binary Search

Dubbed episodes on animepahe always occupy a **contiguous leading block** (episodes 1, 2, 3 … N are dubbed; the rest are sub-only). The detector exploits this property:

1. Check episode 1 — if not dubbed, stop (0 dubbed).
2. Check the last episode — if dubbed, all are dubbed.
3. Otherwise, binary-search the boundary, performing only **O(log n)** API calls.

Detection itself uses two methods tried in sequence:

```
isEpisodeDubbed(animeSession, epSession)
│
├─ 1. Cache hit?  →  Return cached result immediately
│
├─ 2. Method A: GET /api?m=links&id=…&session=…&p=kwik
│       Parse JSON for "eng" / "english" / "dub" strings
│       ✓ Fast, minimal data transfer
│
└─ 3. Method B (fallback): GET /play/{animeSession}/{epSession}
        Parse HTML — check title, download section, inline <script> tags
        ✓ More thorough, handles edge cases
```

#### Storage Schema

All data is stored in `chrome.storage.local` (no external servers, no tracking):

| Key                 | Type                  | Description                                                               |
| ------------------- | --------------------- | ------------------------------------------------------------------------- |
| `ape_settings`      | `object`              | `{ cwEnabled: boolean, dubEnabled: boolean }`                             |
| `ape_cw_v1`         | `string` (JSON array) | Continue Watching list, up to 24 entries                                  |
| `d2_{epSession}`    | `string`              | DUB result cache for a single episode. Format: `"{timestamp}\|{boolean}"` |
| `h2_{animeSession}` | `string`              | DUB stats cache for a home card. Format: `"{timestamp}\|{dubs, total}"`   |

Cache entries prefixed `d2_` and `h2_` expire after 12 hours and are garbage-collected on each page load.

### Adding a New Feature

1. Create `content/features/my-feature.js` and export a class that satisfies the feature contract:

```js
export class MyFeature {
  constructor(storage) {
    /* ... */
  }
  async init(pageType) {
    /* ... */
  }
}
```

2. Add a settings key and default in `content/helpers/storage.js`:

```js
export const DEFAULT_SETTINGS = {
  cwEnabled: true,
  dubEnabled: true,
  myFeatureEnabled: true, // ← add here
};
```

3. Register the feature in `content/main.js`:

```js
const FEATURES = [
  // ...existing entries...
  {
    module: "content/features/my-feature.js",
    export: "MyFeature",
    enabled: settings.myFeatureEnabled,
  },
];
```

That's it — no other files need to change.

---

## Permissions

The extension requests the minimum permissions necessary:

| Permission                                                            | Reason                                                                            |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `storage`                                                             | Save Continue Watching progress and DUB detection cache to `chrome.storage.local` |
| Host permissions for `*.animepahe.{pw,org,com,ru}`                    | Inject the main content script into animepahe pages                               |
| Host permissions for `*.kwik.{cx}` | Inject the iframe player script into the embedded Kwik video player               |

**No data is ever sent to any external server.** All storage is local to your browser.

---

## Supported Domains

**animepahe (main content script):**

- `animepahe.pw`
- `animepahe.org`
- `animepahe.com`
- `animepahe.ru`

**Kwik video player (iframe script):**

- `kwik.cx`
---

## Development

### Getting Started

No build step is required. The extension is plain JavaScript (ES2020+) with no bundler, no TypeScript, and no external dependencies.

```bash
git clone https://github.com/abdullahkhfb/animepahe-enhancer.git
cd animepahe-enhancer
```

That's it — the directory is the extension.

### Loading the Extension Locally

**Firefox:**

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` file inside the cloned directory.

The extension will be active until Firefox is restarted. To persist it across restarts, use a [Firefox developer profile](https://extensionworkshop.com/documentation/develop/debugging/).

**Chrome / Edge:**

1. Navigate to `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the cloned directory

### Releasing a New Version

The release pipeline is fully automated via GitHub Actions:

1. Bump the `version` field in `manifest.json`.
2. Create and publish a new **GitHub Release** (tag it `v0.x.x`).
3. The [`deploy.yml`](.github/workflows/deploy.yml) workflow triggers automatically:
   - Packages the extension into `Animepahe-Enhancer.zip` and attaches it to the release.
   - Pushes to the Firefox AMO queue and the Microsoft Edge Add-ons dashboard simultaneously.

**Required repository secrets:**

| Secret                  | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `AMO_JWT_ISSUER`        | AMO API key issuer (from addons.mozilla.org credentials) |
| `AMO_JWT_SECRET`        | AMO API key secret                                       |
| `EDGE_PRODUCT_ID`       | Microsoft Partner Center Application UUID                |
| `EDGE_CLIENT_ID`        | Microsoft Partner Center App API Client ID               |
| `EDGE_CLIENT_SECRET`    | Microsoft Partner Center API client secret               |                      |

---

## Contributing

Contributions, bug reports, and feature suggestions are welcome!

1. [Open an issue](https://github.com/abdullahkhfb/animepahe-enhancer/issues/new) to discuss what you'd like to change.
2. Fork the repository and create your branch from `main`.
3. Make your changes — keep the code style consistent (ES2020+, no build step).
4. Open a Pull Request with a clear description of the change and the problem it solves.

---

## License

[MIT](LICENSE) © [abdullahkhfb](https://github.com/abdullahkhfb)

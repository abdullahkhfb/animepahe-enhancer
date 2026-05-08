# animepahe Enhancer

> A lightweight browser extension that supercharges your animepahe experience — featuring automatic DUB detection and seamless Continue Watching with per-episode progress tracking.

<p align="center">
  <img src="icons/icon128.png" alt="animepahe Enhancer logo" width="96" />
</p>

<p align="center">
  <a href="https://addons.mozilla.org/en-US/firefox/addon/animepahe-enhancer/">
    <img alt="Firefox Add-on" src="https://img.shields.io/badge/Firefox-Add--on-FF7139?logo=firefox-browser&logoColor=white" />
  </a>
  <img alt="Manifest Version" src="https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green" />
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.1-blue" />
</p>

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
  - [Firefox (Recommended)](#firefox-recommended)
  - [Chromium-based Browsers (Manual)](#chromium-based-browsers-manual)
- [Usage](#usage)
  - [Continue Watching](#continue-watching)
  - [DUB Detector](#dub-detector)
  - [Popup Settings Panel](#popup-settings-panel)
- [Architecture](#architecture)
  - [File Structure](#file-structure)
  - [How It Works](#how-it-works)
- [Permissions](#permissions)
- [Supported Domains](#supported-domains)
- [Development](#development)
  - [Getting Started](#getting-started)
  - [Loading the Extension Locally](#loading-the-extension-locally)
  - [Releasing a New Version](#releasing-a-new-version)
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

| Location | Badge colour | Example |
|----------|-------------|---------|
| Episode list | Orange `DUB` badge | A single dubbed episode |
| Home page cards | Pink `N/total` badge | `12/24` dubbed out of 24 total |
| Player page | Inline `DUB` badge on the title | Confirmation when watching a dubbed episode |

Detection uses a two-method strategy with a 12-hour local cache to minimise network requests:
1. **Lightweight JSON API check** — hits animepahe's `/api?m=links` endpoint
2. **HTML page fallback** — parses the play page if the API check is inconclusive

A smart **binary search** algorithm is used on episode lists, since dubbed episodes always form a contiguous block from the beginning of a series. This cuts the number of network requests from O(n) to O(log n).

---

## Screenshots

> _Coming soon — screenshots of the home Continue Watching row, episode list badges, and the popup._

---

## Installation

### Firefox (Recommended)

Install directly from the **Firefox Add-ons store**:

👉 [**animepahe Enhancer on AMO**](https://addons.mozilla.org/en-US/firefox/addon/animepahe-enhancer/)

The extension requires **Firefox 109.0 or later**.

### Chromium-based Browsers (Manual)

> **Note:** Automated publishing to the Microsoft Edge Add-ons store is planned. For now, install manually — the code is standard Manifest V3 and works without modification.

1. Download the latest release zip from the [Releases page](https://github.com/abdullahkhfb/animepahe-enhancer/releases).
2. Unzip the archive to a permanent folder on your machine.
3. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the unzipped folder.

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
- All visible episode cards are scanned (in batches) when the page loads.
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
├── manifest.json               # Extension manifest (Manifest V3)
│
├── content/
│   ├── animepahe.js            # Main content script — runs on animepahe pages
│   └── iframe-player.js        # Iframe script — runs inside the Kwik video player
│
├── popup/
│   ├── popup.html              # Settings popup UI
│   ├── popup.css               # Popup styles
│   └── popup.js                # Popup logic (settings, stats, clear actions)
│
├── icons/
│   ├── icon16.{png,svg}        # 16×16 toolbar icon
│   ├── icon48.{png,svg}        # 48×48 extension manager icon
│   └── icon128.{png,svg}       # 128×128 store listing icon
│
└── .github/
    └── workflows/
        └── firefox-deploy.yml  # CI/CD: auto-publish to Firefox AMO on release
```

### How It Works

#### Continue Watching — Cross-Frame Communication

animepahe embeds the actual video player in a sandboxed `<iframe>` served from a separate domain (Kwik). Because the iframe and the parent page are on different origins, direct DOM access is impossible. The extension solves this with a **`postMessage` bridge**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  animepahe page (animepahe.js)                                      │
│                                                                     │
│  • Listens for messages from the iframe                             │
│  • Saves/loads progress via chrome.storage.local                    │
│  • Renders the Continue Watching section on the home page           │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  window.postMessage
                    ┌──────▼───────────────────┐
                    │  Kwik iframe              │
                    │  (iframe-player.js)        │
                    │                           │
                    │  • Finds the <video> el   │
                    │  • Requests saved time    │
                    │  • Reports timeupdate     │
                    │    every 2 s              │
                    │  • Seeks on restore       │
                    └───────────────────────────┘
```

**Message types:**

| Type | Direction | Payload | Description |
|------|-----------|---------|-------------|
| `AP_CW_REQUEST_TIME` | iframe → parent | — | Iframe asks parent for saved timestamp |
| `AP_CW_RESTORE_TIME` | parent → iframe | `{ time: number }` | Parent sends saved position; iframe seeks |
| `AP_CW_UPDATE_TIME` | iframe → parent | `{ time, duration }` | Iframe reports current playback position |

#### DUB Detector — Binary Search

Dubbed episodes on animepahe always occupy a **contiguous leading block** (episodes 1, 2, 3 … N are dubbed; the rest are sub-only). The detector exploits this property:

1. Check episode 1 — if not dubbed, stop (0 dubbed).
2. Check the last episode — if dubbed, all are dubbed.
3. Otherwise, binary-search the boundary, performing only **O(log n)** API calls instead of checking each episode individually.

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
          Parse HTML — check #pickDownload, #scrollArea,
          inline <script> tags, and raw string scan
          ✓ More thorough, handles edge cases
```

#### Storage Schema

All data is stored in `chrome.storage.local` (no external servers, no tracking):

| Key | Type | Description |
|-----|------|-------------|
| `ape_settings` | `object` | `{ cwEnabled: boolean, dubEnabled: boolean }` |
| `ape_cw_v1` | `string` (JSON array) | Continue Watching list, up to 24 entries |
| `d2_{epSession}` | `string` | DUB result cache for a single episode. Format: `"{timestamp}\|{boolean}"` |
| `h2_{animeSession}` | `string` | DUB stats cache for a home card. Format: `"{timestamp}\|{dubs, total}"` |

Cache entries prefixed `d2_` and `h2_` expire after 12 hours and are garbage-collected on each page load.

---

## Permissions

The extension requests the minimum permissions necessary:

| Permission | Reason |
|------------|--------|
| `storage` | Save Continue Watching progress and DUB detection cache to `chrome.storage.local` |
| Host permissions for `*.animepahe.{pw,org,com,ru}` | Inject the main content script into animepahe pages |
| Host permissions for `*.kwik.{cx,sh,si,bz}` and `*.yaneura.{top,com}` | Inject the iframe player script into the embedded Kwik video player |

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
- `kwik.sh`
- `kwik.si`
- `kwik.bz`
- `yaneura.top`
- `yaneura.com`

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
2. Create and publish a new **GitHub Release** (tag it `v1.x.x`).
3. The [`firefox-deploy.yml`](.github/workflows/firefox-deploy.yml) workflow triggers automatically:
   - Packages the extension into `extension.zip` (excluding `.git`, `.github`, `README.md`, `.gitignore`)
   - Uploads the zip to the [Firefox Add-on Store (AMO)](https://addons.mozilla.org/) using the `browser-actions/release-firefox-addon` action

> **Planned:** Automated publishing to the Microsoft Edge Add-ons store is on the roadmap. The extension is already fully Manifest V3 compatible, so it requires only CI wiring and Edge Add-ons API credentials.

**Required repository secrets:**

| Secret | Description |
|--------|-------------|
| `AMO_JWT_ISSUER` | AMO API key issuer (from addons.mozilla.org API credentials) |
| `AMO_JWT_SECRET` | AMO API key secret |

---

## Contributing

Contributions, bug reports, and feature suggestions are welcome!

1. [Open an issue](https://github.com/abdullahkhfb/animepahe-enhancer/issues) to discuss what you'd like to change.
2. Fork the repository and create your branch from `main`.
3. Make your changes — keep the code style consistent (single-file content scripts, no build step).
4. Open a Pull Request with a clear description of the change and the problem it solves.

---

## License

[MIT](LICENSE) © [abdullahkhfb](https://github.com/abdullahkhfb)

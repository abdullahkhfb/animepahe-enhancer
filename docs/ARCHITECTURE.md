<a name="top"></a>

# Architecture

> How the codebase is put together. For a plain-language overview, see the [main README](../README.md).

## Table of Contents

- [File Structure](#file-structure)
- [How It Works](#how-it-works)
- [Adding a New Feature](#adding-a-new-feature)
- [Adding an Advanced Setting](#adding-an-advanced-setting)
- [Adding a Sub-Feature](#adding-a-sub-feature)

---

## File Structure

```
📦 animepahe-enhancer/
├── ⚙️  manifest.json              # Extension manifest (Manifest V3) — Firefox build
├── ⚙️  manifest.chromium.json     # Same manifest for Chrome / Edge: only `background` differs
├── 📄 background.js               # Background script (service worker / event page) —
│                                  #   Skip Wait: resolves pahe.win → kwik and opens the tab
│
├── 📁 content/
│   ├── 📄 main.js                 # Entry point — loads settings, detects page,
│   │                              #   dynamically imports and initializes features
│   ├── 🎨 main.css                # Shared base styles (currently: the status pill)
│   ├── 📄 iframe-player.js        # Kwik iframe script — postMessage bridge for
│   │                              #   Continue Watching + Intro/Outro Skip controller
│   │
│   ├── 📁 features/               # Feature modules, with optional stylesheets,
│   │   │                          #   kept in separate css/ and js/ folders
│   │   ├── 📁 js/
│   │   │   ├── 📄 continue-watching.js  # Continue Watching — home row + player bridge
│   │   │   ├── 📄 dub-detector.js       # DUB Detector — badges, binary search, cache
│   │   │   ├── 📄 smart-search.js       # Smart Search — AniList alt-title lookup + dropdown injection
│   │   │   ├── 📄 intro-skip.js         # Intro/Outro Skip — timestamp lookup + range orchestration
│   │   │   ├── 📄 binge-watch.js        # Binge Watch — auto-plays the next episode, off by default
│   │   │   └── 📄 skip-wait.js          # Skip Wait — download links bypass the pahe.win countdown page
│   │   └── 📁 css/
│   │       ├── 🎨 continue-watching.css
│   │       ├── 🎨 dub-detector.css
│   │       ├── 🎨 intro-skip.css        # Also loaded inside the kwik iframe (see iframe-player.js)
│   │       └── 🎨 binge-watch.css
│   │
│   └── 📁 helpers/                # Shared helpers imported by any feature
│       ├── 📄 storage.js          # chrome.storage.local wrapper + DEFAULT_SETTINGS
│       │                          #   + ADVANCED_SETTINGS_SCHEMA + FEATURE_SUBOPTIONS
│       ├── 📄 router.js           # Page-type detection from the current URL
│       ├── 📄 cache.js            # DUB cache read/write/GC (configurable TTL)
│       ├── 📄 throttler.js        # RequestThrottler — rate-limiting, jitter, retry
│       │                          #   (tunable at runtime via updateOptions())
│       ├── 📄 styles.js           # injectStylesheet() — one-line CSS loading, shared
│       │                          #   by every feature so none of them duplicate it
│       ├── 📄 pill.js             # showPill() — the shared bottom-right status toast
│       └── 📄 timestamps-db.js    # open-anime-timestamps dataset access (IndexedDB
│                                  #   cache, ID resolution, episode lookup)
│
├── 📁 popup/                      # The toolbar popup — built from small components
│   ├── 🌐 popup.html              # Empty shell: stylesheets + <div id="app">
│   ├── 📄 popup.js                # Entry point — mounts the header, timeline strip,
│   │                              #   tab bar and the three tab panels
│   ├── 📁 components/             # One file per component, grouped by role
│   │   ├── 📄 dom.js              #   h() element builder shared by every component
│   │   ├── 📁 icons/              #   One file per icon (and per real logo image)
│   │   │   ├── 📄 ContinueWatchingIcon.js, DubDetectorIcon.js, SmartSearchIcon.js,
│   │   │   │      IntroSkipIcon.js, BingeWatchIcon.js,
│   │   │   │      SkipWaitIcon.js                         # the six feature icons
│   │   │   ├── 📄 SourceCodeIcon.js, ReportIssueIcon.js, ExternalLinkIcon.js
│   │   │   ├── 📄 ApMark.js       #   The extension's logo tile
│   │   │   ├── 📄 SiteLogo.js     #   Real animepahe wordmark (icons/animepahe-wordmark.svg)
│   │   │   ├── 📄 MalSyncLogo.js  #   Real MalSync logo (icons/malsync.svg)
│   │   │   ├── 📄 svg.js          #   SVG helpers (line-icon frame, path/circle)
│   │   │   └── 📄 index.js        #   Single import point for all icons
│   │   ├── 📁 ui/                 #   Toggle, Button, StatChip, Stepper, Notice
│   │   ├── 📁 layout/             #   Header, Timeline (status strip), Tabs
│   │   ├── 📁 features/           #   FeatureRow + feature-config.js (name, colour, icon)
│   │   ├── 📁 advanced/           #   SettingRow, GroupChips
│   │   └── 📁 links/              #   LinkRow, SiteCard
│   ├── 📁 scripts/                # Data wiring — connects components to storage
│   │   ├── 📄 common.js           #   Button feedback shared by every tab (DRY)
│   │   ├── 📄 features.js         #   Features tab: toggles, stats, clear actions
│   │   ├── 📄 advanced.js         #   Advanced tab: staged edits, Apply, Reset all
│   │   └── 📄 links.js            #   Links tab
│   ├── 📁 styles/                 # Design tokens + one stylesheet per concern
│   │   ├── 🎨 tokens.css          #   Fonts, colours, reset, base
│   │   ├── 🎨 components.css      #   Toggle, buttons, stepper, notice
│   │   ├── 🎨 layout.css          #   Header, timeline strip, tabs, panels
│   │   ├── 🎨 features.css
│   │   ├── 🎨 advanced.css
│   │   └── 🎨 links.css
│   └── 📁 fonts/                  # Bricolage Grotesque + DM Mono (OFL), bundled offline; licence .txt files stay in the repo but are left out of builds
│
├── 📁 icons/
│   ├── 🖼️  icon16.png             # Toolbar / store icons (the "ap" mark)
│   ├── 🖼️  icon48.png
│   ├── 🖼️  icon128.png
│   ├── 🖼️  animepahe-wordmark.svg # The real animepahe site logo (Links tab)
│   └── 🖼️  malsync.svg            # The real MalSync logo (Links tab)
│
├── 📁 docs/                       # Detailed documentation (this file lives here)
│   └── 📁 widgets/                # Reusable install-prompt snippets for README.md
│
└── 📁 .github/
    ├── 📁 actions/
    │   └── 📁 build-zip/             # Composite action: single source of truth
    │       └── ⚙️  action.yml        #   for the store-zip exclusion list
    └── 📁 workflows/
        ├── ⚙️  deploy-firefox.yml    # Auto-deploys to Firefox on release publish
        └── ⚙️  deploy-edge.yml       # Manual-only deploy to Edge (workflow_dispatch)
```

<p align="right"><a href="#top">↑ Back to top</a></p>

## How It Works

### Module loading — no bundler required

`content/main.js` is the sole content-script entry point for animepahe pages registered in `manifest.json` (the only other scripts are `content/iframe-player.js` for the Kwik iframe and `background.js`, described under [Skip Wait](#skip-wait--background-flow)). It uses the browser's native dynamic `import()` with `chrome.runtime.getURL()` to load feature and utility modules at runtime:

```mermaid
flowchart TD
    MF["📄 manifest.json"] --> CM["content/main.js\n(entry point)"]
    CM --> HS["helpers/storage.js\n(getSettings)"]
    CM --> HR["helpers/router.js"]
    CM --> HCache["helpers/cache.js"]
    CM --> TH["helpers/throttler.js\nthrottler.updateOptions(settings)"]
    CM -->|cwEnabled| CW["features/js/continue-watching.js"]
    CM -->|dubEnabled| DD["features/js/dub-detector.js"]
    CM -->|smartSearchEnabled| SS["features/js/smart-search.js"]
    CM -->|introSkipEnabled| IS["features/js/intro-skip.js"]
    CM -->|bingeWatchEnabled| BW["features/js/binge-watch.js"]
    CM -->|skipWaitEnabled| SW["features/js/skip-wait.js"]
    CW --> CWI["new ContinueWatching(storage, settings)\n.init(pageType)"]
    DD --> DDI["new DubDetector(storage, settings)\n.init(pageType)"]
    SS --> SSI["new SmartSearch(storage, settings)\n.init(pageType)"]
    IS --> ISI["new IntroSkip(storage, settings)\n.init(pageType)"]
    BW --> BWI["new BingeWatch(storage, settings)\n.init(pageType)"]
    SW --> SWI["new SkipWait(storage, settings)\n.init(pageType)"]
```

Feature files are listed in `web_accessible_resources` so the extension runtime can import them. No bundler, no build step — plain ES2020+ modules. Every feature constructor receives the same `settings` object (loaded once via `storage.getSettings()`), so reading a user-tuned value is just `settings.someKey ?? someDefault`.

### Skip Wait — Background Flow

Skip Wait is the one feature that needs a background script, because a content script on animepahe can't read another origin's page (`pahe.win`) — the extension's own background context can, via the `*://*.pahe.win/*` host permission.

```mermaid
sequenceDiagram
    participant U as You (episode page)
    participant S as skip-wait.js (content script)
    participant B as background.js
    participant P as pahe.win
    U->>S: click a Download-menu link (capture phase)
    S->>S: preventDefault — no pahe.win tab
    S->>B: runtime message AP_SKIP_WAIT { url }
    B->>P: fetch pahe.win/XXXX
    P-->>B: HTML containing the kwik link
    B->>U: open kwik.cx/f/YYYY in a new tab next to the episode
```

- `background.js` is a classic script (no ES modules). Firefox only runs it from `background.scripts` (`manifest.json`); Chrome and Edge only accept `background.service_worker` in Manifest V3 and warn about `scripts` (`manifest.chromium.json`). That's why there are two manifests — everything else in them is identical, and the release build picks the right one.
- It only accepts `https://*.pahe.win/<id>` URLs — it is deliberately not a generic "fetch any URL" proxy.
- If no kwik link is found in the page, it opens the original `pahe.win` URL so the click still does something.
- Ctrl / Shift / Alt / Cmd-clicks and middle-clicks are ignored by `skip-wait.js`, so the original behaviour is always one modifier key away.

### Continue Watching — Cross-Frame Communication

animepahe embeds the actual video player in a sandboxed `<iframe>` served from a separate domain (Kwik). Because the iframe and the parent page are on different origins, direct DOM access is impossible. The extension solves this with a **`postMessage` bridge**:

```mermaid
sequenceDiagram
    participant P as animepahe page (continue-watching.js)
    participant K as Kwik iframe (iframe-player.js)

    K->>P: AP_CW_REQUEST_TIME
    Note over K,P: Iframe asks parent for saved timestamp
    P->>K: AP_CW_RESTORE_TIME { time }
    Note over K,P: Parent sends saved position — iframe seeks
    loop Every 2 seconds
        K->>P: AP_CW_UPDATE_TIME { time, duration }
        Note over P: Progress saved to chrome.storage.local
    end
```

**Message types:**

| Type                 | Direction       | Payload                                                          | Description                                      |
| --------------------- | ---------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| `AP_CW_REQUEST_TIME` | iframe → parent | —                                                                | Iframe asks parent for saved timestamp           |
| `AP_CW_RESTORE_TIME` | parent → iframe | `{ time: number }`                                               | Parent sends saved position; iframe seeks        |
| `AP_CW_UPDATE_TIME`  | iframe → parent | `{ time, duration }`                                             | Iframe reports current playback position         |
| `AP_IS_SET_RANGES`   | parent → iframe | `{ ranges, autoSkip, pollMs, buttonAutoHideMs, showHighlights }` | Parent sends intro/outro skip ranges to iframe   |
| `AP_IS_SEEK`         | parent → iframe | `{ time: number }`                                               | Parent instructs iframe to seek (reserved)       |
| `AP_IS_READY`        | iframe → parent | —                                                                | Iframe signals it's ready to receive skip ranges |

<p align="right"><a href="#top">↑ Back to top</a></p>

### DUB Detector — Binary Search

Dubbed episodes on animepahe are expected to occupy a **contiguous leading block** (episodes 1, 2, 3 … N are dubbed; the rest are sub-only). The detector checks the first and last episodes, then gallops backward from the newest episode to bracket the cutoff before binary-searching that bracket. The initial endpoint checks may run together; the gallop and binary-search probes run one at a time. This takes **O(log n)** API calls under that ordering assumption.

Detection itself uses two methods tried in sequence:

```mermaid
flowchart TD
    A["isEpisodeDubbed(animeSession, epSession)"] --> B{Cache hit?}
    B -->|Yes| C["✓ Return cached result immediately"]
    B -->|No| D["Method A\nGET /api?m=links&id=…&session=…&p=kwik\nParse JSON for 'eng' / 'english' / 'dub'\n✓ Fast, minimal data transfer"]
    D -->|Conclusive| E["✓ Return & cache result"]
    D -->|Inconclusive| F["Method B — fallback\nGET /play/{animeSession}/{epSession}\nParse HTML: title, download section, scripts\n✓ More thorough, handles edge cases"]
    F --> G["✓ Return & cache result"]
```

<p align="right"><a href="#top">↑ Back to top</a></p>

### Storage Schema

All settings and cache data are stored in `chrome.storage.local`. The large open-anime-timestamps database is stored in **IndexedDB** (see the [Intro / Outro Skip](FEATURES.md#-intro--outro-skip) feature page).

| Key                     | Type                  | Description                                                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ape_settings`          | `object`              | Feature toggles, feature sub-options, and Advanced Settings values (cache TTL, throttling, batch sizes, debounce timings, skip durations, etc.). The full list of keys, labels, bounds, and defaults lives in `ADVANCED_SETTINGS_SCHEMA` and `FEATURE_SUBOPTIONS` in `content/helpers/storage.js`. |
| `ape_cw_v1`             | `string` (JSON array) | Continue Watching list, up to 24 entries by default (configurable)                                                                                                                                                                                                                                                                             |
| `d2_{epSession}`        | `string`              | DUB result cache for a single episode. Format: `"{timestamp}\|v1\|{JSON payload}"`                                                                                                                                                                                                                                                                                                                                      |
| `h2_{animeSession}`     | `string`              | DUB stats cache for a home card. Format: `"{timestamp}\|v1\|{JSON payload}"`                                                                                                                                                                                                                                                                        |
| `ape_ss_{query}`        | `string`              | Smart Search AniList cache for a normalised query. Stores `allTitles` and `queryCandidates` arrays.                                                                                                                                                                                                                                            |
| `ape_isid_v1_{session}` | `string` (JSON)       | Intro Skip ID resolution cache — maps an animepahe `animeSession` to its resolved AniDB/AniList/MAL IDs. TTL is configurable (default 7 days).                                                                                                                                                                                                |
| `ape_is_db_meta`        | `object`              | Metadata for the open-anime-timestamps database cached in IndexedDB: `{ fetchedAt, sizeBytes, etag }`. Shared between the content script and popup (the popup can't access the content script's IndexedDB).                                                                                                                                  |

Entries prefixed `d2_`, `h2_`, and `ape_ss_` use the same configurable 24-hour default TTL. Expired DUB entries (`d2_` and `h2_`) are garbage-collected; expired Smart Search entries are ignored on lookup but remain stored until cleared. The Intro Skip ID cache (`ape_isid_`) has its own independent TTL (7 days by default). The timestamps database in IndexedDB is refreshed on a separate configurable schedule (7 days by default).

<p align="right"><a href="#top">↑ Back to top</a></p>

### Smart Search — AniList Alt-Title Lookup

Smart Search enriches the native animepahe dropdown by resolving alternative titles through the AniList GraphQL API:

```mermaid
flowchart TD
    A["User types in search bar (debounced 100 ms by default)"] --> B["Parallel: apSearch(query) + getAltTitles(query)"]
    B --> C{AniList cache hit?}
    C -->|Yes| D["✓ Return cached allTitles + queryCandidates"]
    C -->|No| E["POST graphql.anilist.co\nQuery up to 15 media, extract romaji/english/synonyms"]
    E --> F["Write to ape_ss_ cache (24h TTL by default)"]
    F --> D
    D --> G["Filter candidates: remove query itself, keep up to 3 by default"]
    G --> H["apSearch(candidate) one at a time\n(250 ms pause by default)"]
    H --> I["Relevance filter: substring + word-overlap check"]
    I --> J["Append extra rows after native results\n(deduplicated)"]
```

Key design decisions:

- **Debounce (100 ms by default, configurable)** prevents API calls on every keystroke.
- **Normalisation** (`norm()`) strips punctuation and lowercases before any comparison.
- **Relevance filter** (`isRelevant()`) uses title substring/fuzzy similarity and requires at least 70 % overlap of alternate-title words for its word-overlap match.
- **Deduplication** suppresses any result whose normalised title already appears in the native dropdown.
- **Stale-query guard** — if the input changes while awaiting results, the injection is silently aborted.

<p align="right"><a href="#top">↑ Back to top</a></p>

### RequestThrottler

All outbound DUB detection requests are routed through `helpers/throttler.js`, which exports a shared `throttler` singleton (and the `RequestThrottler` class for custom instances). It provides:

- **Concurrency cap** — limits simultaneous in-flight fetches (`maxConcurrent`, default 6)
- **Interval + jitter** — enforces a minimum gap between request launches with ± random variation to avoid burst patterns
- **Exponential back-off with retry** — on HTTP 429/403 or a Cloudflare challenge response, the request is re-queued and the entire drain loop backs off for `baseBackoff × 2ⁿ` ms (up to `maxRetries` attempts)
- **`pendingCount` getter** — used by the DUB Detector's ETA pill to display live scan progress
- **`updateOptions(opts)`** — applies new values to the live singleton without dropping anything already queued or in-flight; `main.js` calls this once on startup with the user's Advanced Settings → Network Throttler values

<p align="right"><a href="#top">↑ Back to top</a></p>

## Adding a New Feature

1. Create `content/features/js/my-feature.js` and export a class that satisfies the feature contract:

```js
export class MyFeature {
  constructor(storage, settings) {
    /* settings is the fully-merged object from storage.getSettings() */
  }
  async init(pageType) {
    /* ... */
  }
}
```

2. If it needs any styling, give it its own `content/features/css/my-feature.css` and inject it from `init()` using the shared helper (don't hand-roll a `<style>` tag or reuse another feature's CSS file):

```js
import { injectStylesheet } from "../../helpers/styles.js";
// ...
injectStylesheet("ape-mf-styles", "content/features/css/my-feature.css");
```

The existing `web_accessible_resources` globs already cover files in these feature and helper folders; check that both manifests continue to expose any new module or stylesheet. Anything the new feature's CSS has in common with another feature's belongs in `content/main.css` instead (loaded once by `main.js`), not copy-pasted — same goes for the shared status pill, see `content/helpers/pill.js`.

3. Add a settings key and default in `content/helpers/storage.js`:

```js
export const DEFAULT_SETTINGS = {
  cwEnabled: true,
  dubEnabled: true,
  smartSearchEnabled: true,
  introSkipEnabled: true,
  bingeWatchEnabled: false,
  skipWaitEnabled: true,
  myFeatureEnabled: true, // ← add here
  ...FEATURE_SUBOPTIONS_DEFAULTS,
  ...ADVANCED_DEFAULTS,
};
```

4. Register the feature in `content/main.js`:

```js
const FEATURES = [
  // ...existing entries...
  {
    module: "content/features/js/my-feature.js",
    export: "MyFeature",
    enabled: settings.myFeatureEnabled,
  },
];
```

5. Give it a row in the popup, with no markup to write:
   - Add an icon component, e.g. `popup/components/icons/MyFeatureIcon.js` (copy `BingeWatchIcon.js`; they are all a few lines) and export it from `popup/components/icons/index.js`.
   - Add an entry to `FEATURES` in `popup/components/features/feature-config.js` — `id`, `settingKey`, `name`, `desc`, `color`/`tint`, timeline `weight` and the `Icon`. The row, its switch and its segment in the status strip are generated from that.
   - If it has a cache to show or clear, add a `read()`/`clear()` pair for its `id` in `STATS` in `popup/scripts/features.js`.

If any of the feature's toggleable options are everyday options rather than tuning knobs, give it entries in `FEATURE_SUBOPTIONS` (see below) instead of `ADVANCED_SETTINGS_SCHEMA` — they'll render right on the feature's own card.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Adding an Advanced Setting

The Advanced tab in the popup isn't hand-written markup — it's generated entirely from one schema, so adding a new tunable doesn't touch `popup.html` or any popup CSS/JS.

1. Add an entry to `ADVANCED_SETTINGS_SCHEMA` in `content/helpers/storage.js`, under an existing `group` or a new one:

```js
{
  key: "myNewTunable",
  label: "My new tunable",
  desc: "What this controls, in plain language.",
  min: 0,
  max: 100,
  step: 1,
  default: 10,
}
```

2. Read it wherever it's needed, with a fallback to that same default:

```js
this._myValue = settings.myNewTunable ?? 10;
```

The popup automatically renders a labeled stepper, an info button for the description, and its own **Default N** reset button for the new setting, and folds it into **Reset all** — for free.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Adding a Sub-Feature

Sub-features are toggleable options that belong to a specific feature but aren't "advanced" (no timing/caching/request tuning) — they render directly on that feature's own card in the popup instead of the Advanced Settings tab. Add an entry to `FEATURE_SUBOPTIONS` in `content/helpers/storage.js`, keyed by the feature card's id (`dub`, `is`, `bw`, ...):

```js
export const FEATURE_SUBOPTIONS = {
  dub: [
    {
      key: "dubHomeScanEnabled",
      label: "Scan homepage cards",
      note: "Also checks homepage cards for dub status.",
      default: true,
    },
  ],
};
```

`popup/scripts/features.js` renders every row's list generically (through `FeatureRow`), so no popup markup or JS needs to change. Read the setting in the feature module the same way as any other: `settings.dubHomeScanEnabled !== false`.

<p align="right"><a href="#top">↑ Back to top</a></p>

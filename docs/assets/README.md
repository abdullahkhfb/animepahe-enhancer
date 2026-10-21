# Documentation Assets

This folder holds the SVG icons and UI badge graphics embedded in [`docs/FEATURES.md`](../FEATURES.md), [`docs/USAGE.md`](../USAGE.md), and [`README.md`](../../README.md).

Because [`build-zip`](../../.github/actions/build-zip/action.yml) excludes the entire `docs/` directory (`"docs/*"`), none of these documentation assets are ever bundled into the Firefox or Chromium extension `.zip` packages.

## Feature Tile Icons

Derived from [`popup/components/icons/`](../../popup/components/icons/) and [`popup/components/features/feature-config.js`](../../popup/components/features/feature-config.js):

| Asset | Preview | Source Component | Accent / Tint |
| :--- | :---: | :--- | :--- |
| `continue-watching.svg` | <img src="continue-watching.svg" width="28" height="28" align="absmiddle" alt="Continue Watching" /> | `ContinueWatchingIcon.js` | `#FF4D94` / `rgba(255, 77, 148, 0.14)` |
| `dub-detector.svg` | <img src="dub-detector.svg" width="28" height="28" align="absmiddle" alt="DUB Detector" /> | `DubDetectorIcon.js` | `#FFB02E` / `rgba(255, 176, 46, 0.14)` |
| `smart-search.svg` | <img src="smart-search.svg" width="28" height="28" align="absmiddle" alt="Smart Search" /> | `SmartSearchIcon.js` | `#5BB8FF` / `rgba(91, 184, 255, 0.14)` |
| `intro-skip.svg` | <img src="intro-skip.svg" width="28" height="28" align="absmiddle" alt="Intro / Outro Skip" /> | `IntroSkipIcon.js` | `#A98BFF` / `rgba(169, 139, 255, 0.14)` |
| `binge-watch.svg` | <img src="binge-watch.svg" width="28" height="28" align="absmiddle" alt="Binge Watch" /> | `BingeWatchIcon.js` | `#3DD6A3` / `rgba(61, 214, 163, 0.14)` |
| `skip-wait.svg` | <img src="skip-wait.svg" width="28" height="28" align="absmiddle" alt="Skip Wait" /> | `SkipWaitIcon.js` | `#FF7A59` / `rgba(255, 122, 89, 0.14)` |
| `advanced-settings.svg` | <img src="advanced-settings.svg" width="28" height="28" align="absmiddle" alt="Advanced Settings" /> | Advanced Settings tab | `#C9C4D6` / `#23222d` |
| `shield.svg` | <img src="shield.svg" width="28" height="28" align="absmiddle" alt="Cloudflare & Rate-Limit Protection" /> | `challenge.js` + `throttler.js` | `#5BB8FF` / `#1a2430` |

## On-Page UI Icons & Badges

Derived from [`content/helpers/icons.js`](../../content/helpers/icons.js), [`content/helpers/pill.js`](../../content/helpers/pill.js), [`content/iframe-player.js`](../../content/iframe-player.js), and [`content/features/css/`](../../content/features/css/):

| Asset | Preview | Feature / Helper |
| :--- | :---: | :--- |
| `cw-count.svg` | <img src="cw-count.svg" height="20" align="absmiddle" alt="6" /> | Continue Watching — `.ape-cw-count` header pill |
| `cw-btn-more.svg` | <img src="cw-btn-more.svg" height="22" align="absmiddle" alt="Show more" /> | Continue Watching — `#ape-cw-toggle` button |
| `cw-btn-clear.svg` | <img src="cw-btn-clear.svg" height="22" align="absmiddle" alt="Clear all" /> | Continue Watching — `#ape-cw-clear` button |
| `play.svg` | <img src="play.svg" width="24" height="24" align="absmiddle" alt="Play" /> | Continue Watching — `playIcon` in `.ape-cw-play` |
| `close.svg` | <img src="close.svg" width="22" height="22" align="absmiddle" alt="Remove" /> | Continue Watching — `closeIcon` in `.ape-cw-remove-btn` |
| `cw-time-left.svg` | <img src="cw-time-left.svg" height="20" align="absmiddle" alt="14 min left" /> | Continue Watching — `.ape-cw-left` time-remaining badge |
| `cw-ep-badge.svg` | <img src="cw-ep-badge.svg" height="22" align="absmiddle" alt="EP 6" /> | Continue Watching — `.ape-cw-ep` badge |
| `cw-prog-bar.svg` | <img src="cw-prog-bar.svg" width="110" height="10" align="absmiddle" alt="Progress bar" /> | Continue Watching — `.ape-cw-prog-bar` |
| `mic.svg` | <img src="mic.svg" width="16" height="16" align="absmiddle" alt="Mic" /> | DUB Detector — `micIcon` in `content/helpers/icons.js` |
| `badge-dub.svg` | <img src="badge-dub.svg" height="22" align="absmiddle" alt="DUB" /> | DUB Detector — `.ape-dub-badge-ep` / `.ape-dub-inline` |
| `badge-sub-only.svg` | <img src="badge-sub-only.svg" height="22" align="absmiddle" alt="SUB ONLY" /> | DUB Detector — `.ape-sub-badge-ep` / `.ape-sub-badge-home` / `.ape-sub-inline` |
| `badge-dub-home.svg` | <img src="badge-dub-home.svg" height="22" align="absmiddle" alt="6/10" /> | DUB Detector — `.ape-dub-badge-home` with `.ape-dub-meter` |
| `badge-scanning.svg` | <img src="badge-scanning.svg" height="22" align="absmiddle" alt="SCANNING" /> | DUB Detector — `.ape-dub-spin` home card spinner |
| `badge-dub-summary.svg` | <img src="badge-dub-summary.svg" height="24" align="absmiddle" alt="6 of 9 dubbed" /> | DUB Detector — `.ape-dub-summary` with `.ape-dub-seg` |
| `progress-ring.svg` | <img src="progress-ring.svg" width="18" height="18" align="absmiddle" alt="Progress ring" /> | Status Toast — `.ape-pill-ring` (`showStatus` progress state) |
| `check.svg` | <img src="check.svg" width="18" height="18" align="absmiddle" alt="Check" /> | Status Toast — `.ape-pill-ok` (`checkIcon` in `showStatus` success state) |
| `amber-dot.svg` | <img src="amber-dot.svg" width="14" height="14" align="absmiddle" alt="Amber dot" /> | Status Toast — `.ape-pill-dot` (`showStatus` empty/paused state) |
| `ss-dym-badge.svg` | <img src="ss-dym-badge.svg" height="24" align="absmiddle" alt="Did you mean" /> | Smart Search — `.ape-ss-dym` banner |
| `ss-extra-row.svg` | <img src="ss-extra-row.svg" height="36" align="absmiddle" alt="Extra search row" /> | Smart Search — `li[data-ape-ss-extra="1"]` row |
| `skip-btn-icon.svg` | <img src="skip-btn-icon.svg" width="18" height="18" align="absmiddle" alt="Skip icon" /> | Intro / Outro Skip — `.ape-is-skip-icon` |
| `badge-skip-intro.svg` | <img src="badge-skip-intro.svg" height="26" align="absmiddle" alt="Skip Intro" /> | Intro / Outro Skip — `#ape-is-skip-btn` |
| `scrubber-intro.svg` | <img src="scrubber-intro.svg" width="72" height="14" align="absmiddle" alt="Intro scrubber" /> | Intro / Outro Skip — `.ape-is-hl-intro` (`#3b82f6`) |
| `scrubber-outro.svg` | <img src="scrubber-outro.svg" width="72" height="14" align="absmiddle" alt="Outro scrubber" /> | Intro / Outro Skip — `.ape-is-hl-outro` (`#e8710a`) |
| `scrubber-recap.svg` | <img src="scrubber-recap.svg" width="72" height="14" align="absmiddle" alt="Recap scrubber" /> | Intro / Outro Skip — `.ape-is-hl-recap` (`#a855f7`) |
| `pill-bw-countdown.svg` | <img src="pill-bw-countdown.svg" height="26" align="absmiddle" alt="Binge Watch countdown" /> | Binge Watch — `.ape-bw-pill` cancelable countdown toast |
| `pill-sw-opened.svg` | <img src="pill-sw-opened.svg" height="26" align="absmiddle" alt="Skip Wait opened kwik" /> | Skip Wait — completion toast |

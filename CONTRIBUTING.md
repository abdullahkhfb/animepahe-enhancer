# Contributing to animepahe Enhancer

Thank you for your interest in improving animepahe Enhancer! This document explains how to contribute effectively — whether you're fixing a bug, proposing a feature, or improving documentation.

---

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Ground Rules](#ground-rules)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
  - [Bug Fixes](#bug-fixes)
  - [New Features](#new-features)
  - [New Advanced Settings](#new-advanced-settings)
  - [Documentation](#documentation)
- [Code Style](#code-style)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Issue Guidelines](#issue-guidelines)
- [Release Process](#release-process)
- [Questions](#questions)

---

## Ways to Contribute

- **Report a bug** — open a [GitHub issue](https://github.com/abdullahkhfb/animepahe-enhancer/issues/new) with clear reproduction steps.
- **Request a feature** — open an issue describing the problem you want to solve and why it fits the project.
- **Fix a bug** — pick up an open issue labelled `bug` and open a pull request.
- **Build a feature** — discuss first in an issue, then implement it.
- **Improve the docs** — fix typos, clarify explanations, or add missing information in `README.md`, `docs/`, `PRIVACY.md`, `SECURITY.md`, or code comments.
- **Report a security vulnerability** — see [`SECURITY.md`](SECURITY.md) for the private disclosure process. Do **not** open a public issue.

---

## Ground Rules

- **Discuss before you build.** For anything beyond a trivial bug fix, open an issue first. This avoids duplicated effort and ensures the change aligns with the project's direction.
- **One concern per PR.** Keep pull requests focused. A PR that fixes a bug and adds an unrelated feature is harder to review and slows everything down.
- **No build step required.** The extension is plain ES2020+ JavaScript with no bundler, no TypeScript, and no external npm dependencies. Keep it that way.
- **Minimal permissions.** Any change that would require adding a new entry to `permissions` or `host_permissions` in either manifest needs strong justification and will be scrutinised carefully.
- **Local-first data.** Keep new data flows limited to what a feature needs. Existing network requests include animepahe requests for DUB detection, Smart Search, Continue Watching fallback thumbnail lookup, and Binge Watch; `pahe.win` link resolution for Skip Wait; and AniList, `relations.yuna.moe`, and the `open-anime-timestamps` dataset for Smart Search and Intro/Outro Skip. New network targets or data sent require explicit discussion and a `PRIVACY.md` update.
- **Be respectful.** This project adheres to its [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Development Setup

No build tools, no package manager, no Node.js — the repository _is_ the extension.

```bash
git clone https://github.com/abdullahkhfb/animepahe-enhancer.git
cd animepahe-enhancer
```

### Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `manifest.json` inside the cloned directory.

The extension stays active until Firefox is restarted. For persistent development, use a [Firefox developer profile](https://extensionworkshop.com/documentation/develop/debugging/).

### Load in Chrome / Edge / other Chromium browsers

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (toggle in the top-right corner)
3. Chrome and Edge require the Chromium manifest in place of Firefox's `manifest.json`. Follow the manifest-copy and restore steps in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#loading-the-extension-locally), then click **Load unpacked** and select the cloned directory.

### Reloading after changes

After editing any file:

- **Firefox:** click the reload icon next to the extension on `about:debugging`.
- **Chrome/Edge:** click the refresh icon on the extension card at `chrome://extensions`.

Then reload any open animepahe tab.

---

## Project Structure

```
animepahe-enhancer/
├── manifest.json                 # Firefox Manifest V3 manifest
├── manifest.chromium.json        # Chrome / Edge Manifest V3 manifest
├── background.js                 # Skip Wait link-resolution background handler
│
├── content/
│   ├── main.js                   # Entry point — awaits whenSiteReady(), loads settings, imports features
│   ├── main.css                  # Shared base styles (status toast: plain + rich states)
│   ├── iframe-player.js          # Injected into Kwik iframe; ensurePlayback() + postMessage bridge for
│   │                             #   Continue Watching, Intro/Outro Skip, and Binge Watch
│   │
│   ├── features/                 # Feature modules with optional stylesheets
│   │   ├── js/                   #   Each file exports a class with init(pageType)
│   │   │   ├── continue-watching.js
│   │   │   ├── dub-detector.js
│   │   │   ├── smart-search.js
│   │   │   ├── intro-skip.js     # Intro/Outro Skip — timestamp lookup + range orchestration
│   │   │   ├── binge-watch.js    # Binge Watch — auto-loads embed + auto-plays next episode
│   │   │   └── skip-wait.js      # Skip Wait — bypasses the pahe.win countdown
│   │   └── css/                  #   Stylesheets for features that need them
│   │       ├── continue-watching.css
│   │       ├── dub-detector.css
│   │       ├── intro-skip.css
│   │       └── binge-watch.css
│   │
│   └── helpers/                  # Shared utilities imported by any feature
│       ├── storage.js            # chrome.storage.local wrapper + KEYS + DEFAULT_SETTINGS
│       │                         #   + ADVANCED_SETTINGS_SCHEMA + FEATURE_SUBOPTIONS
│       ├── router.js             # Page-type detection from the current URL
│       ├── challenge.js          # Cloudflare challenge detection & page-load gate (whenSiteReady())
│       ├── cache.js              # Shared TTL cache read/write/garbage collection
│       ├── throttler.js          # RequestThrottler — concurrency, jitter, priority queue, back-off
│       │                         #   (tunable at runtime via updateOptions())
│       ├── icons.js              # Shared inline-SVG factory (micIcon, checkIcon, playIcon, closeIcon)
│       ├── styles.js             # injectStylesheet() — shared one-line CSS loading
│       ├── pill.js               # showPill() + showStatus() — shared bottom-right status toast
│       └── timestamps-db.js      # open-anime-timestamps dataset access (IndexedDB cache,
│                                 #   AniList → AniDB ID resolution, episode lookup)
│
├── popup/
│   ├── popup.html                # Empty shell — everything is built from components/
│   ├── popup.js                  # Entry point — mounts header, timeline, tabs and panels
│   ├── components/               # One file per component
│   │   ├── dom.js                #   h() element builder
│   │   ├── icons/                #   One file per icon + the real site/MalSync logos
│   │   ├── ui/                   #   Toggle, Button, StatChip, Stepper, Notice
│   │   ├── layout/               #   Header, Timeline, Tabs
│   │   ├── features/             #   FeatureRow + feature-config.js
│   │   ├── advanced/             #   SettingRow, GroupChips
│   │   └── links/                #   LinkRow, SiteCard
│   ├── scripts/                  # Wires components to storage (one module per tab)
│   │   ├── common.js, features.js, advanced.js, links.js
│   ├── styles/                   # tokens, components, layout + one file per tab
│   └── fonts/                    # Bundled Bricolage Grotesque + DM Mono (OFL); licence .txt files are excluded from builds
│
├── icons/
│   ├── icon16.png, icon48.png, icon128.png   # the "ap" mark
│   ├── animepahe-wordmark.svg    # Real animepahe site logo
│   └── malsync.svg               # Real MalSync logo
│
├── docs/                         # Detailed documentation, Markdown SVG assets (docs/assets/), and store widgets
│
└── .github/
    ├── actions/
    │   └── build-zip/
    │       └── action.yml        # Shared: builds the store-ready Firefox and Chromium zips
    └── workflows/
        ├── deploy-firefox.yml    # Auto-deploys to Firefox on release publish
        └── deploy-edge.yml       # Manual-only deploy to Edge
```

---

## Making Changes

### Bug Fixes

1. Confirm the bug is reproducible on the latest version.
2. Check that no existing open issue or PR already covers it.
3. Open an issue (or comment on the existing one) so work is tracked.
4. Fork the repository, create a branch named `fix/<short-description>`, make your change, and open a PR.

### New Features

Every feature is registered in the feature loader and has a settings key; a stylesheet and popup row are added when needed:

**1. Create `content/features/js/my-feature.js`** (and, if it needs styling, `content/features/css/my-feature.css`)

```js
export class MyFeature {
  constructor(storage, settings) {
    this.storage = storage;
    this.settings = settings; // the fully-merged object from storage.getSettings()
  }

  async init(pageType) {
    // Run only on the pages where this feature applies
    if (pageType !== "home") return;
    // … feature logic …
  }
}
```

**2. Add a settings key in `content/helpers/storage.js`**

```js
export const DEFAULT_SETTINGS = {
  // Keep the existing feature toggles and settings here.
  myFeatureEnabled: true, // ← add here
  ...FEATURE_SUBOPTIONS_DEFAULTS,
  ...ADVANCED_DEFAULTS,
};
```

**3. Register the feature in `content/main.js`**

```js
const FEATURES = [
  // … existing entries …
  {
    module: "content/features/js/my-feature.js",
    export: "MyFeature",
    enabled: settings.myFeatureEnabled,
  },
];
```

**4. Confirm both manifests expose the module** (if it needs to be importable by the content script)

```json
"web_accessible_resources": [
  {
    "resources": ["content/features/js/*.js", "content/features/css/*.css", "content/helpers/*.js", "content/main.css"],
    "matches": ["*://*.animepahe.pw/*", "..."]
  }
]
```

The existing resource globs already cover feature modules and stylesheets; update them only if the new file is outside those paths. To give the feature a row in the popup, add an icon component in `popup/components/icons/` and an entry in `popup/components/features/feature-config.js` — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#adding-a-new-feature).

### New Advanced Settings

If your change adds a tunable value (a timing, limit, batch size, etc.) rather than a new on/off feature, it almost certainly belongs in the **Advanced Settings** panel instead of a bespoke popup control. That panel is generated entirely from one schema — you don't touch `popup.html`, `popup.js`, or any CSS.

**1. Add an entry to `ADVANCED_SETTINGS_SCHEMA` in `content/helpers/storage.js`**, under an existing `group` or a new one:

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

**2. Read it wherever it's needed**, with a fallback to that same default:

```js
this._myValue = settings.myNewTunable ?? 10;
```

That's it. The popup will automatically render a labeled stepper, an info button for your description, and its own **Default N** reset button for the new setting, and fold it into **Reset all** — no other popup files need to change.

A few conventions to follow:

- Pick a sensible `min`/`max` range — the input is hard-clamped to it on every change.
- `default` must match whatever the code already falls back to today, so existing users see no behavior change until they touch the new control.
- Keep `desc` to one plain-language sentence — it's read by people who don't necessarily know the implementation.
- If the value is shared by more than one feature (e.g. cache duration is read by both the DUB Detector and Smart Search), say so in `desc` rather than adding a second, duplicate setting.

### Documentation

- Update the documentation page that covers the affected feature or workflow; update `PRIVACY.md` or `SECURITY.md` as well when data flows or security-relevant behavior changes.
- Code comments are valued — explain _why_ something is done, not just _what_ it does.
- Diagrams in `docs/ARCHITECTURE.md` and `docs/FEATURES.md` use [Mermaid](https://mermaid.js.org/) syntax and render natively on GitHub.

---

## Code Style

There is no linter or formatter enforced by CI. Follow the conventions already in the codebase:

| Concern              | Convention                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Syntax**           | ES2020+ — `async/await`, dynamic `import()`, optional chaining, nullish coalescing                                    |
| **Modules**          | Native ES modules (`export`/`import`). No CommonJS. No bundler.                                                       |
| **Naming**           | `camelCase` for variables and functions; `PascalCase` for classes; `SCREAMING_SNAKE_CASE` for module-level constants  |
| **Indentation**      | 2 spaces                                                                                                              |
| **Strings**          | Double quotes for HTML attribute strings; single or template literals for JavaScript                                  |
| **DOM manipulation** | Prefer `createElement`/`appendChild` over `innerHTML` for any content that includes user-supplied, animepahe-sourced, or AniList-sourced data |
| **Error handling**   | Follow existing feature-specific error handling and logging patterns; use `[animepahe-enhancer]` for shared entry-point messages |
| **Comments**         | JSDoc for exported classes and public methods; inline comments for non-obvious logic                                  |
| **Storage keys**     | Use established key prefixes (`ape_`, `d2_`, `h2_`) and document new keys in `storage.js` or the relevant helper |

---

## Submitting a Pull Request

1. **Fork** the repository and create a branch:

   ```bash
   git checkout -b fix/dub-badge-overlap
   # or
   git checkout -b feat/skip-intro-button
   ```

2. **Make your changes.** Test them manually by loading the extension and visiting the relevant animepahe pages.

3. **Write a clear commit message:**

   ```
   fix(dub-detector): prevent badge overlap on narrow episode cards

   Badges were clipping into the episode number when cards were narrower
   than 120 px. Fixed by reducing badge font size and padding at that width.

   Closes #42
   ```

4. **Open a pull request** against the `main` branch. Fill in the PR template:
   - **What does this change?** — a concise summary.
   - **Why?** — the problem it solves or the improvement it makes.
   - **How was it tested?** — browsers tested, animepahe pages visited, edge cases checked.
   - **Screenshots or recordings** — strongly encouraged for UI changes.

5. **Respond to review feedback.** PRs that go unaddressed for 30 days without activity may be closed.

### Checklist before opening a PR

- [ ] Tested manually in at least one browser (Firefox or Chrome/Edge)
- [ ] No new `permissions` or `host_permissions` added without justification
- [ ] No `innerHTML` used with untrusted/third-party data (animepahe DOM, AniList responses)
- [ ] `DEFAULT_SETTINGS` updated if a new toggle was added
- [ ] `ADVANCED_SETTINGS_SCHEMA` updated (with a matching `default`) if a new tunable was added, instead of hand-rolling popup UI
- [ ] `manifest.json` and `manifest.chromium.json` `version` fields **not** bumped (maintainer handles versioning)
- [ ] `README.md` and `docs/` updated if user-facing behaviour changed
- [ ] `PRIVACY.md` updated if new network targets or data flows were introduced
- [ ] `SECURITY.md` updated if new attack surface was introduced

---

## Issue Guidelines

Good issues save everyone time. Please include:

**For bug reports:**

- Extension version (visible in the popup header or `manifest.json`)
- Browser name and version
- Operating system
- The animepahe URL or page type where the issue occurs
- Steps to reproduce
- What you expected to happen vs. what actually happened
- Browser console errors (open DevTools → Console while on the affected page)

**For feature requests:**

- The problem you are trying to solve
- Your proposed solution (optional but helpful)
- Any alternative approaches you considered

**For questions about usage:**

- Use the ❓ Question template — it prompts for what you're stuck on and which part of the extension it relates to

The issue tracker offers three templates (🐛 Bug report, 💡 Feature request, ❓ Question) plus a **blank issue**, for anything — a doc fix, a process suggestion, a security-adjacent question that isn't a vulnerability report, or anything else that doesn't fit the three templates above.

Use the existing issue labels to help triage:

| Label              | Meaning                                            |
| ------------------ | -------------------------------------------------- |
| `bug`              | Confirmed misbehaviour                             |
| `enhancement`      | New feature or improvement                         |
| `documentation`    | Docs-only change                                   |
| `question`         | General question about usage (via the ❓ Question template) |
| `good first issue` | Suitable for a first contribution                  |
| `help wanted`      | Maintainer is open to a community PR               |

---

## Release Process

Releases are handled by the maintainer. Contributors do **not** bump the version or create releases.

When a release is ready:

1. The `version` field in **both** `manifest.json` and `manifest.chromium.json` is bumped following [Semantic Versioning](https://semver.org/).
2. A GitHub Release is published with a tag matching `v<version>`.
3. [`deploy-firefox.yml`](.github/workflows/deploy-firefox.yml) triggers automatically: packages the extension into `Animepahe-Enhancer-Firefox.zip` and `Animepahe-Enhancer-Chromium.zip`, submits the Firefox build to the AMO review queue, and attaches both zips to the GitHub Release.
4. Edge is **not** automatic — it's a separate, deliberate step run manually from the Actions tab (see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#releasing-a-new-version) for why).

---

## Questions

For general questions about usage, open an issue using the ❓ Question template (it applies the `question` label for you). If it doesn't fit a bug report, feature request, or question, a blank issue is fine too.

For security concerns, follow the process in [`SECURITY.md`](SECURITY.md).

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
- **Improve the docs** — fix typos, clarify explanations, or add missing information in `README.md`, `PRIVACY.md`, or code comments.
- **Report a security vulnerability** — see [`SECURITY.md`](SECURITY.md) for the private disclosure process. Do **not** open a public issue.

---

## Ground Rules

- **Discuss before you build.** For anything beyond a trivial bug fix, open an issue first. This avoids duplicated effort and ensures the change aligns with the project's direction.
- **One concern per PR.** Keep pull requests focused. A PR that fixes a bug and adds an unrelated feature is harder to review and slows everything down.
- **No build step required.** The extension is plain ES2020+ JavaScript with no bundler, no TypeScript, and no external npm dependencies. Keep it that way.
- **Minimal permissions.** Any change that would require adding a new entry to `permissions` or `host_permissions` in `manifest.json` needs strong justification and will be scrutinised carefully.
- **Local-first data.** No feature should transmit user data to an external server beyond what is already documented (AniList title lookups for Smart Search). New network targets require explicit discussion.
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
3. Click **Load unpacked** and select the cloned directory.

### Reloading after changes

After editing any file:

- **Firefox:** click the reload icon next to the extension on `about:debugging`.
- **Chrome/Edge:** click the refresh icon on the extension card at `chrome://extensions`.

Then reload any open animepahe tab.

---

## Project Structure

```
animepahe-enhancer/
├── manifest.json                 # Extension manifest (Manifest V3)
│
├── content/
│   ├── main.js                   # Entry point — loads settings, detects page, imports features
│   ├── iframe-player.js          # Injected into Kwik iframe; postMessage bridge for Continue Watching
│   │
│   ├── features/                 # One file per feature; each exports a class with init(pageType)
│   │   ├── continue-watching.js
│   │   ├── dub-detector.js
│   │   └── smart-search.js
│   │
│   └── helpers/                  # Shared utilities imported by any feature
│       ├── storage.js            # chrome.storage.local wrapper + DEFAULT_SETTINGS + key constants
│       ├── router.js             # Page-type detection from the current URL
│       ├── cache.js              # DUB cache read/write/garbage collection
│       └── throttler.js          # RequestThrottler — concurrency, jitter, retry, back-off
│
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
│
├── icons/
│   ├── icon16.{png,svg}
│   ├── icon48.{png,svg}
│   └── icon128.{png,svg}
│
└── .github/
    └── workflows/
        └── deploy.yml            # CI/CD: packages and publishes to Firefox AMO and Edge store
```

---

## Making Changes

### Bug Fixes

1. Confirm the bug is reproducible on the latest version.
2. Check that no existing open issue or PR already covers it.
3. Open an issue (or comment on the existing one) so work is tracked.
4. Fork the repository, create a branch named `fix/<short-description>`, make your change, and open a PR.

### New Features

Every feature in the extension follows a three-file contract:

**1. Create `content/features/my-feature.js`**

```js
export class MyFeature {
  constructor(storage) {
    this.storage = storage;
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
  cwEnabled: true,
  dubEnabled: true,
  smartSearchEnabled: true,
  myFeatureEnabled: true, // ← add here
};
```

**3. Register the feature in `content/main.js`**

```js
const FEATURES = [
  // … existing entries …
  {
    module: "content/features/my-feature.js",
    export: "MyFeature",
    enabled: settings.myFeatureEnabled,
  },
];
```

**4. Expose the module in `manifest.json`** (if it needs to be importable by the content script)

```json
"web_accessible_resources": [
  {
    "resources": ["content/features/*.js", "content/helpers/*.js"],
    "matches": ["*://*.animepahe.pw/*", "..."]
  }
]
```

No other files need to change. If you add a toggle to the popup, update `popup/popup.html` and `popup/popup.js` accordingly.

### Documentation

- Edit `README.md` or `PRIVACY.md` directly.
- Code comments are valued — explain _why_ something is done, not just _what_ it does.
- Architecture diagrams in the README use [Mermaid](https://mermaid.js.org/) syntax and render natively on GitHub.

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
| **DOM manipulation** | Prefer `createElement`/`appendChild` over `innerHTML` for any content that includes user-supplied or third-party data |
| **Error handling**   | Wrap feature initialisation in `try/catch` and log to `console.error` with the `[animepahe-enhancer]` prefix          |
| **Comments**         | JSDoc for exported classes and public methods; inline comments for non-obvious logic                                  |
| **Storage keys**     | All keys must use the established prefixes (`ape_`, `d2_`, `h2_`, `ape_ss_`) and be documented in `storage.js`        |

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
- [ ] No `innerHTML` used with untrusted/third-party data
- [ ] `DEFAULT_SETTINGS` updated if a new toggle was added
- [ ] `manifest.json` `version` field **not** bumped (maintainer handles versioning)
- [ ] `README.md` updated if user-facing behaviour changed

---

## Issue Guidelines

Good issues save everyone time. Please include:

**For bug reports:**

- Extension version (visible in the popup footer or `manifest.json`)
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

Use the existing issue labels to help triage:

| Label              | Meaning                              |
| ------------------ | ------------------------------------ |
| `bug`              | Confirmed misbehaviour               |
| `enhancement`      | New feature or improvement           |
| `documentation`    | Docs-only change                     |
| `question`         | Not yet triaged or unclear           |
| `good first issue` | Suitable for a first contribution    |
| `help wanted`      | Maintainer is open to a community PR |

---

## Release Process

Releases are handled by the maintainer. Contributors do **not** bump the version or create releases.

When a release is ready:

1. The `version` field in `manifest.json` is bumped following [Semantic Versioning](https://semver.org/).
2. A GitHub Release is published with a tag matching `v<version>`.
3. The [`deploy.yml`](.github/workflows/deploy.yml) workflow automatically:
   - Packages the extension into `Animepahe-Enhancer.zip`
   - Submits to the Firefox AMO review queue
   - Submits to the Microsoft Edge Add-ons dashboard
   - Attaches the zip to the GitHub Release

---

## Questions

For general questions about usage, open a [GitHub Discussion](https://github.com/abdullahkhfb/animepahe-enhancer/discussions) or an issue labelled `question`.

For security concerns, follow the process in [`SECURITY.md`](SECURITY.md).

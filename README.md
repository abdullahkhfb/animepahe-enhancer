<a name="top"></a>

# animepahe Enhancer

A free browser extension that makes watching anime on animepahe a bit nicer. It remembers where you left off, tells you which episodes are dubbed, helps you find shows even if you only know an alternative name for them, and can skip openings/endings for you.

<p align="center">
  <img src="icons/icon128.png" alt="animepahe Enhancer logo" width="96" />
</p>

<p align="center">
  <img alt="Manifest Version" src="https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-green" />
  <img alt="Version" src="https://img.shields.io/badge/version-0.2.0.0-blue" />
</p>

## Contents

- [What it does](#what-it-does)
- [Screenshots](#screenshots)
- [Install](#install)
- [Want more control?](#want-more-control)
- [Learn more](#learn-more)
- [Contributing, privacy & security](#contributing-privacy--security)

---

## What it does

- **▶ Continue Watching** — Picks up exactly where you stopped, every time. No more hunting for the right episode. [Details →](docs/FEATURES.md#-continue-watching)
- **🎙 DUB Detector** — Puts a badge on every episode that's dubbed, so you don't have to open it to find out. [Details →](docs/FEATURES.md#-dub-detector)
- **🔍 Smart Search** — Finds a show even if you search by a nickname or a title in a different language. [Details →](docs/FEATURES.md#-smart-search)
- **⏭ Intro / Outro Skip** — Skips the opening and ending automatically, or gives you a one-click Skip button. [Details →](docs/FEATURES.md#-intro--outro-skip)

Each feature can be turned on or off separately from the extension's popup, and everything runs locally in your browser — see [PRIVACY.md](PRIVACY.md) for exactly what leaves your device and why.

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## Screenshots

<img width="1411" height="1267" alt="Screenshot 2026-06-09 at 18-35-39 animepahe okay-ish anime website" src="https://github.com/user-attachments/assets/cc27f0d9-8305-40dd-9dcc-8631a563f57e" />
<img width="1407" height="866" alt="Screenshot 2026-06-09 at 18-36-57 Kill Blue Ep  1-9 animepahe" src="https://github.com/user-attachments/assets/9a642184-9172-4542-9b9f-6ad9f4c48940" />
<img width="1390" height="1052" alt="Screenshot 2026-06-09 at 18-39-12 Kill Blue Ep  6 animepahe" src="https://github.com/user-attachments/assets/fb2bc822-1724-4479-8bca-06a319944e11" />
<img width="1500" height="782" alt="Screenshot 2026-06-09 at 18-40-01 animepahe okay-ish anime website" src="https://github.com/user-attachments/assets/4b617ab2-b832-434c-89c5-94e68ada777e" />
<img width="1920" height="1020" alt="image" src="https://github.com/user-attachments/assets/0cdd844a-cce1-4e31-b537-3582084a9602" />

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## Install

<!-- Widget source: docs/widgets/firefox.md — edit there, then copy the block below -->

<p align="center">
  <a href="https://addons.mozilla.org/en-US/firefox/addon/animepahe-enhancer/">
    <img alt="Get animepahe Enhancer for Firefox" src="https://img.shields.io/badge/🦊 Get it on Firefox Add--ons-FF7139?style=for-the-badge&logo=firefox-browser&logoColor=white" />
  </a>
  <br />
  <sub>Free · takes about 10 seconds · no account needed</sub>
</p>

| Browser                                                                                                                                                      | Where to get it                                                                                    | Notes                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| <img src="https://upload.wikimedia.org/wikipedia/commons/a/a0/Firefox_logo%2C_2019.svg" width="16" height="16" valign="middle"> **Firefox**                  | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/animepahe-enhancer/)              | Ready to install right now                                                                                           |
| <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Chrome_icon_%28February_2022%29.svg" width="16" height="16" valign="middle"> **Chrome** | Chrome Web Store                                                                                   | **Release date: TBA** — not published yet                                                                            |
| <img src="https://upload.wikimedia.org/wikipedia/commons/9/98/Microsoft_Edge_logo_%282019%29.svg" width="16" height="16" valign="middle"> **Edge**           | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/omdenhapffjpbafkliiedijooomljbgd) | ⚠️ Store listing currently isn't working — see [docs/EDGE.md](docs/EDGE.md) for a manual install that takes a minute |
| Any other Chromium browser                                                                                                                                   | [GitHub Releases](https://github.com/abdullahkhfb/animepahe-enhancer/releases)                     | Manual install — see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#loading-the-extension-locally)                        |

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## Want more control?

If you like tinkering, the popup has an **Advanced Settings** tab where you can adjust things like cache duration, scan speed, and skip timing — all with plain-language descriptions, so you don't need to touch any code. Everything has a sensible default, so this is entirely optional. [See what's tunable →](docs/FEATURES.md#-advanced-settings)

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## Learn more

This README keeps things short on purpose. For anything more in-depth:

| Guide                                        | What's in it                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| [docs/FEATURES.md](docs/FEATURES.md)         | The full technical detail behind every feature                                   |
| [docs/USAGE.md](docs/USAGE.md)               | Step-by-step instructions for using each feature and the popup                   |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the code is organized, and how to add a new feature or setting               |
| [docs/PERMISSIONS.md](docs/PERMISSIONS.md)   | Exactly what the extension can access, and why                                   |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)   | Running the extension locally and how releases are published                     |
| [docs/EDGE.md](docs/EDGE.md)                 | The current situation with the Microsoft Edge listing, and how to install anyway |

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## Supported Domains

**animepahe (main content script):**

- `animepahe.pw`
- `animepahe.org`
- `animepahe.com`
- `animepahe.ru`

**Kwik video player (iframe script):**

- `kwik.cx`

**External services (API calls only, no content script injection):**

- `graphql.anilist.co` — AniList GraphQL API (Smart Search + Intro Skip ID resolution)
- `relations.yuna.moe` — AniDB ID resolution (Intro Skip)
- `raw.githubusercontent.com` (jonbarrow/open-anime-timestamps) — Timestamp database download (Intro Skip)
- `api.anime-skip.com` — AnimeSkip community timestamps fallback (Intro Skip)

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## Todo

Planned features and improvements that aren't implemented yet:

_(None currently — all planned features have been shipped.)_

<p align="right"><a href="#top">↑ Back to top</a></p>

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

| Secret               | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `AMO_JWT_ISSUER`     | AMO API key issuer (from addons.mozilla.org credentials) |
| `AMO_JWT_SECRET`     | AMO API key secret                                       |
| `EDGE_PRODUCT_ID`    | Microsoft Partner Center Application UUID                |
| `EDGE_CLIENT_ID`     | Microsoft Partner Center App API Client ID               |
| `EDGE_CLIENT_SECRET` | Microsoft Partner Center API client secret               |

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## Contributing

Contributions, bug reports, and feature suggestions are welcome! Please read [**CONTRIBUTING.md**](CONTRIBUTING.md) for the full guide. Here's the short version:

- **Discuss before you build.** For anything beyond a trivial fix, [open an issue](https://github.com/abdullahkhfb/animepahe-enhancer/issues/new) first to align on direction.
- **Fork and branch.** Create your branch from `main` (`fix/<description>` or `feat/<description>`).
- **No build step.** The extension is plain ES2020+ — no bundler, no TypeScript, no npm dependencies. Keep it that way.
- **One concern per PR.** Focused pull requests are reviewed faster.
- **Follow the feature contract.** New features go in `content/features/my-feature.js`, get a key in `DEFAULT_SETTINGS`, and register in the `FEATURES` array in `main.js`. See [Adding a New Feature](#adding-a-new-feature) (and [Adding an Advanced Setting](#adding-an-advanced-setting) if you're exposing a new tunable instead) and the full guide in [CONTRIBUTING.md](CONTRIBUTING.md).
- **Open a Pull Request** with a clear description of what changed and why, plus the browsers you tested on.

For security vulnerabilities, do **not** open a public issue — see [**SECURITY.md**](SECURITY.md) instead.

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## Privacy

User data such as Continue Watching progress and settings is stored locally in your browser. Some features make outbound network requests to specific APIs for functionality (e.g., Smart Search and Intro/Outro Skip). See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## Security

To report a security vulnerability, please **do not open a public GitHub issue**. Instead, use one of the private channels described in [**SECURITY.md**](SECURITY.md):

- **Email:** [rynvexa@proton.me](mailto:rynvexa@proton.me) with the subject `[SECURITY] animepahe-enhancer — <brief description>`
- **GitHub Security Advisory:** [Open a draft advisory](https://github.com/abdullahkhfb/animepahe-enhancer/security/advisories/new)

You will receive an acknowledgement within 48 hours. Fixes are coordinated privately and credited publicly after the patched version is live in the stores.

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct. By participating, you agree to uphold its standards. See [**CODE_OF_CONDUCT.md**](CODE_OF_CONDUCT.md) for details, including how to report unacceptable behaviour.

<p align="right"><a href="#top">↑ Back to top</a></p>

---

## License

[MIT](LICENSE) © [abdullahkhfb](https://github.com/abdullahkhfb)

<p align="right"><a href="#top">↑ Back to top</a></p>

<a name="top"></a>

# Development

> Everything you need to work on the extension locally and ship a release. For coding conventions, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Table of Contents

- [Getting Started](#getting-started)
- [Loading the Extension Locally](#loading-the-extension-locally)
- [Releasing a New Version](#releasing-a-new-version)
- [Roadmap](#roadmap)

---

## Getting Started

No build step is required. The extension is plain JavaScript (ES2020+) with no bundler, no TypeScript, and no external dependencies.

```bash
git clone https://github.com/abdullahkhfb/animepahe-enhancer.git
cd animepahe-enhancer
```

That's it — the directory is the extension.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Loading the Extension Locally

**Firefox:**

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` file inside the cloned directory.

The extension will be active until Firefox is restarted. To persist it across restarts, use a [Firefox developer profile](https://extensionworkshop.com/documentation/develop/debugging/).

**Chrome / Edge:**

1. Navigate to `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the cloned directory

<p align="right"><a href="#top">↑ Back to top</a></p>

## Releasing a New Version

The release pipeline is fully automated via GitHub Actions:

1. Bump the `version` field in `manifest.json`.
2. Create and publish a new **GitHub Release** (tag it `v0.x.x`).
3. The [`deploy.yml`](../.github/workflows/deploy.yml) workflow triggers automatically:
   - Packages the extension into `Animepahe-Enhancer.zip` and attaches it to the release (documentation files are stripped out first — see below).
   - Pushes to the Firefox AMO queue and the Microsoft Edge Add-ons dashboard simultaneously.

Every Markdown file — the READMEs, `docs/`, `docs/widgets/`, everything — is excluded from the store package automatically, along with the `screenshots/` folder. None of that is needed by the running extension, so it never ships. If you add a new `.md` file anywhere in the repo, you don't need to touch `deploy.yml` — the exclusion pattern already covers it.

**Required repository secrets:**

| Secret               | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `AMO_JWT_ISSUER`     | AMO API key issuer (from addons.mozilla.org credentials) |
| `AMO_JWT_SECRET`     | AMO API key secret                                       |
| `EDGE_PRODUCT_ID`    | Microsoft Partner Center Application UUID                |
| `EDGE_CLIENT_ID`     | Microsoft Partner Center App API Client ID               |
| `EDGE_CLIENT_SECRET` | Microsoft Partner Center API client secret               |

<p align="right"><a href="#top">↑ Back to top</a></p>

## Roadmap

Planned improvements that aren't implemented yet:

- A non-static JSON database
- Cleanup the codebase

<p align="right"><a href="#top">↑ Back to top</a></p>

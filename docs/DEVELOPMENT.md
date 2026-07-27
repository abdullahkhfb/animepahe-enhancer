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

Firefox and Edge deploy through **separate workflows** on purpose — Firefox publishes automatically, Edge requires a deliberate manual step. This split exists because publishing a release used to submit to both stores at once, which made it too easy to accidentally trigger an Edge submission (including while Edge's certification status is unresolved — see [docs/EDGE.md](EDGE.md)) just by tagging a routine release.

1. Bump the `version` field in `manifest.json`.
2. Add a `## v0.x.x.x — YYYY-MM-DD` section to [`RELEASE.md`](../RELEASE.md) describing what changed (see that file's own template).
3. Commit, then create and publish a **GitHub Release** tagged to match (`v0.x.x.x`).
4. **Firefox happens automatically** — [`deploy-firefox.yml`](../.github/workflows/deploy-firefox.yml) triggers on the release being published, builds the zip, submits to AMO using the release body as the release notes, and attaches the zip to the GitHub Release.
5. **Edge does not happen automatically.** When you're ready to submit to Edge specifically, go to the Actions tab → **Deploy — Edge (manual)** → **Run workflow**, and enter the tag you want to publish (e.g. `v0.2.0.1`). This runs [`deploy-edge.yml`](../.github/workflows/deploy-edge.yml) against that exact tag.

Both workflows build the zip the same way, via a shared composite action ([`build-zip`](../.github/actions/build-zip/action.yml)) — the exclusion list (every `.md` file, `docs/`, `screenshots/`) lives in exactly one place instead of being duplicated per workflow. If you add a new `.md` file anywhere in the repo, you don't need to touch either workflow — the `*.md` wildcard already covers it.

**Required repository secrets:**

| Secret               | Used by        | Description                                              |
| -------------------- | -------------- | -------------------------------------------------------- |
| `AMO_JWT_ISSUER`     | deploy-firefox | AMO API key issuer (from addons.mozilla.org credentials) |
| `AMO_JWT_SECRET`     | deploy-firefox | AMO API key secret                                       |
| `EDGE_PRODUCT_ID`    | deploy-edge    | Microsoft Partner Center Application UUID                |
| `EDGE_CLIENT_ID`     | deploy-edge    | Microsoft Partner Center App API Client ID               |
| `EDGE_CLIENT_SECRET` | deploy-edge    | Microsoft Partner Center API client secret               |

<p align="right"><a href="#top">↑ Back to top</a></p>

## Roadmap

Planned improvements that aren't implemented yet:

- A non-static JSON database
- Cleanup the codebase

<p align="right"><a href="#top">↑ Back to top</a></p>

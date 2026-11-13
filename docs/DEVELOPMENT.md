# Development

> Everything you need to work on the extension locally and ship a release. For
> coding conventions, see the [contributing guide](/CONTRIBUTING.md).

## Contents

*   [Getting started](#getting-started)
*   [Loading the extension locally](#loading-the-extension-locally)
*   [Releasing a new version](#releasing-a-new-version)
*   [Roadmap](#roadmap)

## Getting started

No build step is required. The extension is plain JavaScript (ES2020+) with no
bundler, no TypeScript, and no external dependencies.

```bash
git clone https://github.com/abdullahkhfb/animepahe-enhancer.git
cd animepahe-enhancer
```

That's it — the directory is the extension.

## Loading the extension locally

**Firefox:**

1.  Navigate to `about:debugging#/runtime/this-firefox`
2.  Click **Load Temporary Add-on…**
3.  Select the `manifest.json` file inside the cloned directory.
    (`manifest.json` is the Firefox manifest.)

The extension will be active until Firefox is restarted. To persist it across
restarts, use a [Firefox developer profile][firefox-developer-profile].

**Chrome / Edge:**

1.  Navigate to `chrome://extensions` or `edge://extensions`
2.  Enable **Developer mode**
3.  Chrome and Edge need the Chromium manifest because they reject Firefox's
    `background.scripts` key in Manifest V3. Before replacing `manifest.json`,
    make sure it has no uncommitted changes you need to keep. Copy
    `manifest.chromium.json` over it —
    `Copy-Item manifest.chromium.json manifest.json` (PowerShell),
    `copy /Y manifest.chromium.json manifest.json` (Command Prompt), or
    `cp manifest.chromium.json manifest.json` (macOS / Linux) — then click
    **Load unpacked** and select the cloned directory. Restore the original
    Firefox manifest afterwards; if you started from a clean checkout, use
    `git restore manifest.json`. Release builds select the appropriate manifest
    automatically; see below.

[firefox-developer-profile]: https://extensionworkshop.com/documentation/develop/debugging/

## Releasing a new version

Firefox and Edge deploy through **separate workflows** on purpose — Firefox
publishes automatically, Edge requires a deliberate manual step. This split
keeps routine releases from submitting to Edge without an explicit decision,
since Edge submissions require a separate review and release step (see
[Edge listing guide](EDGE.md)).

1.  Bump the `version` field in **both** `manifest.json` and
    `manifest.chromium.json`. They must stay identical except for the
    `background` key (Firefox: `scripts`; Chrome/Edge: `service_worker`).
1.  Add a `## v0.x.x.x — YYYY-MM-DD` section to [release notes](/RELEASE.md)
    describing what changed (see that file's own template).
1.  Commit, then create and publish a **GitHub Release** tagged to match
    (`v0.x.x.x`).
1.  **Firefox happens automatically** —
    [`deploy-firefox.yml`](/.github/workflows/deploy-firefox.yml) triggers on
    the release being published, builds the Firefox zip, submits to AMO using
    the release body as the release notes, and attaches that zip to the GitHub
    Release — along with a Chromium zip (`Animepahe-Enhancer-Chromium.zip`) for
    manual Chrome / Edge installs.
1.  **Edge does not happen automatically.** When you're ready to submit to Edge
    specifically, go to the Actions tab → **Deploy — Edge (manual)** → **Run
    workflow**, and enter the tag you want to publish (e.g. `v0.3.1.20`). This
    runs [`deploy-edge.yml`](/.github/workflows/deploy-edge.yml) against that
    exact tag.

Both workflows build the zip the same way, via a shared composite action
([`build-zip`](/.github/actions/build-zip/action.yml), which takes a `browser`
input — `firefox` packs `manifest.json`, `chromium` packs
`manifest.chromium.json` as `manifest.json`) — the exclusion list lives in
exactly one place instead of being duplicated per workflow. It covers every
`.md` file, `docs/`, `scripts/`, `screenshots/`, `.github/`, `LICENSE`, the
`.txt` licence files inside `popup/fonts/` (the `.woff2` font files themselves
are still packed), `manifest.chromium.json` (it's only ever packed *as*
`manifest.json` in the Chromium build), and any built archive (`*.zip`, `*.xpi`,
`*.crx`). If you add a new `.md` file anywhere in the repo, you don't need to
touch either workflow — the `*.md` wildcard already covers it.

**The two builds never mix.** Because built archives are excluded, a zip made
earlier in the same job (the Firefox zip in `deploy-firefox.yml`) can't be swept
into the Chromium zip. `deploy-edge.yml` also runs a **Verify the zip is
Chromium-only** step before uploading: it fails the job if the zip contains any
nested archive, `manifest.chromium.json`, or anything named Firefox, or if its
`manifest.json` has `background.scripts` instead of `background.service_worker`.

**Checks on every pull request.** [`check.yml`](/.github/workflows/check.yml)
runs on pull requests and pushes to `main`. It fails if the two manifests differ
in `version`, if any `.js` file does not parse, if a stylesheet uses
`!important` or an ID selector, or if a doc's **Contents** list no longer
matches its headings. Run `python3 scripts/update-toc.py` to fix the lists.

**Required repository secrets:**

| Secret               | Used by        | Description                                              |
| -------------------- | -------------- | -------------------------------------------------------- |
| `AMO_JWT_ISSUER`     | deploy-firefox | AMO API key issuer (from addons.mozilla.org credentials) |
| `AMO_JWT_SECRET`     | deploy-firefox | AMO API key secret                                       |
| `EDGE_PRODUCT_ID`    | deploy-edge    | Microsoft Partner Center Application UUID                |
| `EDGE_CLIENT_ID`     | deploy-edge    | Microsoft Partner Center App API Client ID               |
| `EDGE_CLIENT_SECRET` | deploy-edge    | Microsoft Partner Center API client secret               |

## Roadmap

Planned improvements that aren't implemented yet:

*   A non-static JSON database
*   Cleanup the codebase

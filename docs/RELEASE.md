<a name="top"></a>

# Release Notes

This file mirrors the notes published on the [GitHub Releases](https://github.com/abdullahkhfb/animepahe-enhancer/releases) page, so the history is browsable from inside the repo too — not everyone thinks to check the Releases tab. It's written by hand, not generated, and it's meant to stay short enough to skim in one sitting.

For the mechanics of actually cutting a release (bumping the version, tagging, what the CI pipeline does), see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#releasing-a-new-version). This file is just the human-readable "what changed and why."

## Contents

- [How to write a release entry](#how-to-write-a-release-entry)
- [Keeping this file manageable](#keeping-this-file-manageable)
- [Unreleased](#unreleased)

---

## How to write a release entry

When you publish a new GitHub Release, paste the same notes here under a new heading, newest at the top (right below `## Unreleased`, which should then be emptied out). Use this template:

```markdown
## v0.x.x — YYYY-MM-DD

One or two sentences on what this release is mainly about, in plain language.

### Added
- New user-facing capability, described the way a user would notice it

### Changed
- Existing behavior that's different now, and why

### Fixed
- Bug that's no longer happening

### Removed
- Something taken out, and what (if anything) replaced it

[Full changelog](https://github.com/abdullahkhfb/animepahe-enhancer/compare/vPREV...vNEW)
```

Skip any section that's empty for that release rather than leaving it blank — an entry doesn't need all four. Keep each bullet to what a user or contributor would actually care about; internal refactors with no observable effect belong in commit messages, not here.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Keeping this file manageable

This file should stay under **3,000 lines**. In practice, if you're following the template above, that's a lot of releases — but if it ever gets close:

1. Move everything except the most recent 5–10 versions into `RELEASE_ARCHIVE.md`.
2. Leave a one-line pointer at the bottom of this file: `Older releases: see RELEASE_ARCHIVE.md`.
3. The GitHub Releases page itself is unaffected either way — it keeps the full history regardless of what's mirrored here.

<p align="right"><a href="#top">↑ Back to top</a></p>

## Unreleased

Changes staged for the next version, not yet tagged as a GitHub Release.

_Nothing staged yet._

<p align="right"><a href="#top">↑ Back to top</a></p>

## v0.2.0.1 — 2026-07-20

This release is mostly about the popup — it's now organized into tabs instead of one long page — plus a fix for a Smart Search caching bug and the removal of the AnimeSkip fallback.

### Added
- **Quick Links tab** in the popup, with shortcuts to the GitHub repo, the issue tracker, the animepahe site, and a recommended companion tool ([MalSync](https://malsync.moe)) for syncing progress to MyAnimeList/AniList/Kitsu
- **`docs/` folder** with in-depth guides (Features, Usage, Architecture, Permissions, Development) split out of the README
- **`docs/EDGE.md`** explaining the current state of the Edge Add-ons listing, with a manual-install workaround
- **`docs/widgets/`** — reusable per-browser install-prompt snippets for README.md
- **`RELEASE.md`** — this file, mirroring GitHub Releases notes in-repo
- **`docs/STORE_LISTING.md`** — a ready-to-paste store listing description, with privacy called out as its own section rather than a trailing link

### Changed
- Popup rebuilt around **three tabs** — Features, Advanced Settings, Quick Links — instead of one long scrolling page
- Feature cards and Advanced Settings groups now **collapse by default** and expand on click, so the popup stays short
- Advanced Settings edits are now **staged and applied together** via an "Apply Changes" button, instead of saving instantly per field
- Popup code split into one CSS/JS file per tab (plus a shared `common.js`/`common.css`) instead of one large file each
- `README.md` rewritten in plain language, with technical detail moved to `docs/`
- CI release pipeline now strips **every** Markdown file (not a hardcoded list) from the store package, so new docs never accidentally ship

### Fixed
- Smart Search's cache counter and "Clear Cache" button in the popup were checking the wrong storage key prefix and never actually found the cached entries — fixed so the popup accurately reflects what's cached
- README "Details →" links would occasionally break across two lines, stranding the arrow on its own — fixed with a non-breaking space

### Removed
- **AnimeSkip API fallback** for Intro/Outro Skip — timestamps now come from the local open-anime-timestamps database only; an episode missing from that database simply isn't skippable, with no online fallback
- Redundant "Refresh DB" button in the popup (it did exactly what "Clear Cache" already does)

[Full changelog](https://github.com/abdullahkhfb/animepahe-enhancer/compare/v0.2.0.0...v0.2.0.1)

<p align="right"><a href="#top">↑ Back to top</a></p>

<p align="right"><a href="#top">↑ Back to top</a></p>

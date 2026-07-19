# README Widgets

Small, self-contained Markdown snippets used as install prompts in [README.md](../../README.md) and anywhere else a browser badge is needed (release notes, other docs, etc.).

GitHub doesn't support pulling one Markdown file into another at render time, so these aren't automatically transcluded — they're copied by hand into wherever they're needed. What this folder buys you is a **single source of truth per badge**: when a store link or status changes, update it here once, then copy the updated block to every place it's used, instead of hunting through the whole repo for stale copies.

| File                       | Purpose                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`firefox.md`](firefox.md) | Firefox install prompt. Firefox is the only fully working store listing, so this one actively encourages install. |
| [`chrome.md`](chrome.md)   | Chrome Web Store placeholder — shows "Release date: TBA" until the listing goes live.                     |
| [`edge.md`](edge.md)       | Edge Add-ons badge — points to [`docs/EDGE.md`](../EDGE.md) instead of prompting a direct install, since that listing currently doesn't work. |

Each widget file has a short HTML comment at the top explaining what it's for and where it's used — keep that comment up to date if you change what a widget does.

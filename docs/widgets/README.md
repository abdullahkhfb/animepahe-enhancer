# README Widgets

Small, self-contained Markdown snippets used as install prompts in [README.md](../../README.md) and anywhere else a browser badge is needed (release notes, other docs, etc.).

GitHub doesn't support pulling one Markdown file into another at render time, so these aren't automatically transcluded — they're copied by hand into wherever they're needed. What this folder buys you is a **single source of truth per badge**: when a store link or status changes, update it here once, then copy the updated block to every place it's used, instead of hunting through the whole repo for stale copies.

| File                       | Purpose                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`firefox.md`](firefox.md) | Firefox install prompt for the live Firefox Add-ons listing. |
| [`chrome.md`](chrome.md)   | Chrome Web Store placeholder — shows "Release date: TBA" because the listing has not been submitted. |
| [`edge.md`](edge.md)       | Edge Add-ons install prompt for the live listing. |

Each widget file has a short HTML comment at the top explaining what it's for and where it's used — keep that comment up to date if you change what a widget does.

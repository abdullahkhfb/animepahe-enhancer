<!--
Thanks for the PR! Fill in each section below — see CONTRIBUTING.md if
anything here is unclear: https://github.com/abdullahkhfb/animepahe-enhancer/blob/main/CONTRIBUTING.md
-->

## What does this change?

<!-- A concise summary of what this PR does. -->

## Why?

<!-- The problem it solves, or the improvement it makes. Link an issue if there is one (e.g. "Closes #42"). -->

## How was it tested?

<!-- Browsers tested, animepahe pages visited, edge cases checked. -->

## Screenshots or recordings

<!-- Strongly encouraged for any UI change. Delete this section if not applicable. -->

---

### Checklist

- [ ] Tested manually in at least one browser (Firefox or Chrome/Edge)
- [ ] No new `permissions` or `host_permissions` added without justification
- [ ] No `innerHTML` used with untrusted/third-party data (animepahe DOM, AniList responses)
- [ ] `DEFAULT_SETTINGS` updated if a new toggle was added
- [ ] `ADVANCED_SETTINGS_SCHEMA` updated (with a matching `default`) if a new tunable was added, instead of hand-rolling popup UI
- [ ] `manifest.json` `version` field **not** bumped (maintainer handles versioning)
- [ ] `README.md` updated if user-facing behaviour changed
- [ ] `PRIVACY.md` updated if new network targets or data flows were introduced
- [ ] `SECURITY.md` updated if new attack surface was introduced

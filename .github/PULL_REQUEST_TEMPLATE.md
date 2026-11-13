## What does this change?

## Why?

## How was it tested?

## Screenshots or recordings

## Checklist

*   [ ] Tested manually in at least one browser (Firefox or Chrome/Edge)
*   [ ] No new `permissions` or `host_permissions` added without justification
*   [ ] No `innerHTML` used with untrusted/third-party data (animepahe DOM,
    AniList responses)
*   [ ] `DEFAULT_SETTINGS` updated if a new toggle was added
*   [ ] `ADVANCED_SETTINGS_SCHEMA` updated (with a matching `default`) if a new
    tunable was added, instead of hand-rolling popup UI
*   [ ] `manifest.json` `version` field **not** bumped (maintainer handles
    versioning)
*   [ ] `README.md` and the affected `docs/` pages updated if user-facing
    behaviour changed, in this same pull request
*   [ ] Popup or pill changes follow the design: black base, one pink accent,
    Inter
*   [ ] `PRIVACY.md` updated if new network targets or data flows were
    introduced
*   [ ] `SECURITY.md` updated if new attack surface was introduced
*   [ ] HTML and CSS follow the Google style guide (no `!important`, no ID
    selectors, hyphenated class names)
*   [ ] `python3 scripts/update-toc.py` run if a heading in a doc changed
*   [ ] The popup still fits in 600px in every state (no scrolling)

# Security Policy

## Overview

animepahe Enhancer is a browser extension that operates **entirely client-side** with no backend infrastructure, no external servers, and no data collection. All user data lives exclusively in your browser's `chrome.storage.local`. This document describes how to responsibly disclose security vulnerabilities and what the project's security posture looks like.

---

## Supported Versions

Only the latest published version receives security patches. Older versions are **not** backported.

| Version   | Supported              |
| --------- | ---------------------- |
| `0.0.9.x` | ✅ Current release     |
| `< 0.0.9` | ❌ No longer supported |

If you are running an older version, please update via your browser's add-on store before filing a report.

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.** Doing so may expose users to risk before a fix is available.

Instead, report vulnerabilities through one of these private channels:

- **Email:** [rynvexa@proton.me](mailto:rynvexa@proton.me) — use the subject line `[SECURITY] animepahe-enhancer — <brief description>`
- **GitHub Private Security Advisory:** [Open a draft advisory](https://github.com/abdullahkhfb/animepahe-enhancer/security/advisories/new) directly on the repository

### What to include in your report

Please provide as much of the following as possible so the issue can be triaged quickly:

- A clear description of the vulnerability and what it could enable
- The affected version(s)
- Steps to reproduce, including any necessary setup (e.g., specific animepahe page, browser version)
- Proof-of-concept code or a screen recording, if applicable
- Your assessment of severity (see framework below)
- Whether you have a proposed fix or workaround

### Response timeline

| Milestone                              | Target timeframe                                                 |
| -------------------------------------- | ---------------------------------------------------------------- |
| Acknowledgement of report              | Within **48 hours**                                              |
| Initial triage and severity assessment | Within **5 business days**                                       |
| Patch or mitigation available          | Within **14 days** for high/critical; **30 days** for low/medium |
| Public disclosure                      | After patch is released to the store                             |

If a timeline cannot be met due to complexity, you will be notified with an updated estimate.

---

## Severity Framework

This project uses the following informal severity scale aligned with CVSS concepts:

| Severity          | Description                                                                                              | Examples in the context of this extension                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Critical**      | Remote code execution or full compromise of browser/OS                                                   | An exploitable code path reachable from a malicious animepahe page                       |
| **High**          | Exfiltration of user data, privilege escalation within the browser, or bypass of same-origin protections | `postMessage` handler accepting messages from untrusted origins and leaking storage data |
| **Medium**        | Unexpected behaviour that harms the user but requires user interaction or additional conditions          | Persistent XSS injected into the Continue Watching UI or search dropdown                 |
| **Low**           | Minor information disclosure or edge-case denial-of-service                                              | Cache key collision allowing one animepahe session to overwrite another's DUB result     |
| **Informational** | Best-practice suggestions with no direct user impact                                                     | Unnecessary wildcard in `host_permissions`                                               |

---

## Security Architecture & Known Scope

Understanding the extension's design helps set expectations about what is and is not in scope.

### What the extension does

| Component              | Behaviour                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Content scripts**    | Injected into `*.animepahe.{pw,org,com,ru}` and `*.kwik.cx`. Read and modify the DOM of those pages only.                                                                                   |
| **`iframe-player.js`** | Injected into the Kwik iframe. Communicates with the parent page exclusively via `postMessage` using named message types (`AP_CW_REQUEST_TIME`, `AP_CW_RESTORE_TIME`, `AP_CW_UPDATE_TIME`). |
| **Storage**            | All data written to `chrome.storage.local` only. No `IndexedDB`, no cookies, no `localStorage`. Keys are prefixed (`ape_settings`, `ape_cw_v1`, `d2_`, `h2_`, `ape_ss_`).                   |
| **Network**            | Outbound requests go only to `graphql.anilist.co` (Smart Search) and the animepahe origin itself (DUB detection). All requests pass through the `RequestThrottler` rate-limiter.            |
| **Permissions**        | `storage` + host permissions scoped to animepahe domains, Kwik, and AniList. No `tabs`, `webRequest`, `cookies`, `identity`, or `downloads`.                                                |

### Attack surface

The realistic attack surface is small but not zero:

- **`postMessage` origin validation** — the `iframe-player.js` bridge must only trust messages from the expected animepahe origin.
- **DOM injection** — DUB badges, the Continue Watching row, and Smart Search dropdown entries are built from extension-controlled data. Any path where animepahe-supplied content (e.g., an anime title) flows into `.innerHTML` without sanitisation is a potential XSS vector.
- **Cache poisoning** — DUB cache keys are derived from animepahe session identifiers. Unusual characters in session IDs should not be able to produce collisions or escape into storage operations.
- **AniList response handling** — titles returned from `graphql.anilist.co` are injected into the search UI. Malformed or adversarial titles must not execute script.

### Out of scope

The following are **not** considered security vulnerabilities for this project:

- Vulnerabilities in animepahe, Kwik, or AniList themselves
- Browser-level security issues (report those to the relevant browser vendor)
- Self-XSS (attacks that require the user to run script in the DevTools console)
- Theoretical risks with no demonstrated impact
- Issues only reproducible with a modified extension or tampered storage

---

## Responsible Disclosure Policy

This project follows **coordinated disclosure**:

1. You report privately using the channels above.
2. The maintainer triages, develops a fix, and releases it to the browser stores.
3. After the fix is live (or after 90 days, whichever comes first), you may publish details publicly.
4. You will be credited in the release notes unless you prefer anonymity.

There is currently no bug bounty programme. Reporters receive public credit and the maintainer's genuine gratitude.

---

## Security Best Practices for Contributors

When contributing code, keep the following in mind:

- **Never use `innerHTML` with untrusted data.** Use `textContent` for plain text or `createElement`/`appendChild` for structured UI. The only exception is static, developer-authored HTML strings with no user-supplied content.
- **Validate `postMessage` origins.** Any `message` event listener must check `event.origin` against an explicit allowlist of expected animepahe domains before acting on the payload.
- **Keep network requests minimal and scoped.** New features must not introduce host permissions beyond what is strictly necessary.
- **Do not expand `web_accessible_resources`.** Exposing additional files to external origins increases the attack surface unnecessarily.
- **Sanitise before inserting AniList or animepahe data into the DOM.** Treat all API and third-party data as untrusted.
- **Cache keys must be deterministic and bounded.** Avoid constructing storage keys from raw user input without normalisation.

---

## Contact

Security reports: [rynvexa@proton.me](mailto:rynvexa@proton.me)  
GitHub Security Advisories: [github.com/abdullahkhfb/animepahe-enhancer/security/advisories](https://github.com/abdullahkhfb/animepahe-enhancer/security/advisories)

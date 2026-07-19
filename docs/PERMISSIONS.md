<a name="top"></a>

# Permissions & Supported Domains

> Why the extension asks for what it asks for. For the full data-handling policy, see [PRIVACY.md](../PRIVACY.md).

## Permissions

The extension requests the minimum permissions necessary:

| Permission                                         | Reason                                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `storage`                                          | Save settings, Continue Watching progress, and various caches to `chrome.storage.local` and IndexedDB             |
| Host permissions for `*.animepahe.{pw,org,com,ru}` | Inject the main content script into animepahe pages                                                               |
| Host permissions for `*.kwik.cx`                   | Inject the iframe player script into the embedded Kwik video player                                               |
| Host permissions for `graphql.anilist.co`          | Fetch alternative anime titles for Smart Search and resolve IDs for Intro/Outro Skip (no account data exchanged) |
| Host permissions for `relations.yuna.moe`          | Resolve AniList/MAL IDs to AniDB IDs for the Intro/Outro Skip timestamp database lookup                            |
| Host permissions for `raw.githubusercontent.com`   | Download the open-anime-timestamps database (~27 MB, cached in IndexedDB with conditional GET refresh)             |

All network requests to external services (AniList, relations.yuna.moe, open-anime-timestamps) carry no personal identifiers or browsing history. See [PRIVACY.md](../PRIVACY.md) for the full privacy policy.

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

<p align="right"><a href="#top">↑ Back to top</a></p>

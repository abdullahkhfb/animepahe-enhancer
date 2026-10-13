/**
 * skip-wait.js - skips the pahe.win countdown page.
 */

import { PAGE, getPageType } from "../../helpers/router.js";
import { showPill } from "../../helpers/pill.js";

const MSG_SKIP_WAIT = "AP_SKIP_WAIT";

export class SkipWait {
  /** @param {import("../../helpers/storage.js").storage} storage */
  constructor(storage, _settings = {}) {
    this._storage = storage;
    this._busy = false;
    this._onClick = this._onClick.bind(this);
  }

  async init(_initialPageType) {
    // Capture phase: runs before animepahe's own handlers and before the
    // browser follows the link's target="_blank".
    document.addEventListener("click", this._onClick, true);
  }

  /** @returns {{label: string, url: string} | null} */
  _findPaheLink(event) {
    if (!(event.target instanceof Element)) return null;
    const a = event.target.closest("a[href]");
    if (!a) return null;

    let url;
    try {
      url = new URL(a.href, location.href);
    } catch {
      return null;
    }
    const isPahe =
      url.hostname === "pahe.win" || url.hostname.endsWith(".pahe.win");
    return isPahe && url.protocol === "https:"
      ? { label: a.textContent.trim(), url: url.href }
      : null;
  }

  _onClick(event) {
    if (getPageType() !== PAGE.PLAYER) return;
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return; // user wants the original behaviour
    }

    const hit = this._findPaheLink(event);
    if (!hit) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (this._busy) {
      showPill("⏩ Skip Wait: already working on one…", 2500);
      return;
    }
    this._open(hit.url, hit.label);
  }

  async _open(paheUrl, label) {
    this._busy = true;
    showPill(`⏩ Skip Wait: getting link${label ? ` (${label})` : ""}…`);

    try {
      const res = await chrome.runtime.sendMessage({
        type: MSG_SKIP_WAIT,
        url: paheUrl,
      });

      if (res?.ok) {
        showPill("✓ Skip Wait: opened kwik", 2500);
      } else if (res?.fellBack) {
        showPill(
          "⏩ Skip Wait: couldn't find the link, opened the normal page",
          5000,
        );
      } else {
        showPill(`⏩ Skip Wait failed: ${res?.error ?? "unknown error"}`, 5000);
      }
    } catch (err) {
      console.error("[SkipWait]", err);
      showPill("⏩ Skip Wait failed (extension not responding)", 5000);
    } finally {
      this._busy = false;
    }
  }
}

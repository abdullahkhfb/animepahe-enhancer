import { PAGE, getPageType } from "../../helpers/router.js";
import { showAction } from "../../helpers/pill.js";

const MSG_SKIP_WAIT = "AP_SKIP_WAIT";

export class SkipWait {
  constructor(storage, _settings = {}) {
    this._storage = storage;
    this._busy = false;
    this._onClick = this._onClick.bind(this);
  }

  async init(_initialPageType) {
    document.addEventListener("click", this._onClick, true);
  }

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
      return;
    }

    const hit = this._findPaheLink(event);
    if (!hit) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (this._busy) {
      showAction({ icon: "spinner", text: "Already working on a link", autohideMs: 2500 });
      return;
    }
    this._open(hit.url, hit.label);
  }

  async _open(paheUrl, label) {
    this._busy = true;
    showAction({ icon: "spinner", text: "Getting link", detail: label });

    try {
      const res = await chrome.runtime.sendMessage({
        type: MSG_SKIP_WAIT,
        url: paheUrl,
      });

      if (res?.ok) {
        showAction({ icon: "check", tone: "brand", text: "Opened kwik", autohideMs: 2500 });
      } else if (res?.fellBack) {
        showAction({
          icon: "dot",
          text: "Opened the normal page",
          detail: "link not found",
          autohideMs: 5000,
        });
      } else {
        showAction({
          icon: "dot",
          text: "Skip Wait failed",
          detail: res?.error ?? "unknown error",
          autohideMs: 5000,
        });
      }
    } catch (err) {
      console.error("[SkipWait]", err);
      showAction({
        icon: "dot",
        text: "Skip Wait failed",
        detail: "extension not responding",
        autohideMs: 5000,
      });
    } finally {
      this._busy = false;
    }
  }
}

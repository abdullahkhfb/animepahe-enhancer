const MSG = {
  // Existing Continue Watching messages.
  REQUEST_TIME: "AP_CW_REQUEST_TIME",
  RESTORE_TIME: "AP_CW_RESTORE_TIME",
  UPDATE_TIME: "AP_CW_UPDATE_TIME",
  // Intro/Outro Skip messages (paired with content/features/intro-skip.js).
  IS_SET_RANGES: "AP_IS_SET_RANGES",
  IS_SEEK: "AP_IS_SEEK",
  IS_READY: "AP_IS_READY",
};

const DEFAULT_UPDATE_INTERVAL = 2_000;
const SKIP_BTN_ID = "ape-is-skip-btn";

(async function init() {
  let updateInterval = DEFAULT_UPDATE_INTERVAL;
  try {
    const { ape_settings } = await chrome.storage.local.get("ape_settings");
    if (ape_settings?.playerUpdateInterval) {
      updateInterval = ape_settings.playerUpdateInterval;
    }
  } catch {}

  const video = findVideo();
  if (video) {
    setup(video, updateInterval);
  } else {
    const observer = new MutationObserver(() => {
      const v = findVideo();
      if (v) {
        observer.disconnect();
        setup(v, updateInterval);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();

function findVideo() {
  return document.querySelector("video") ?? null;
}

function setup(video, updateInterval) {
  // ── Continue Watching: ask the parent for the saved time and start
  // reporting playback progress. ────────────────────────────────────────
  window.parent.postMessage({ type: MSG.REQUEST_TIME }, "*");

  // ── Intro / Outro Skip controller (created early so it's available
  // to the message listener below). ────────────────────────────────────
  const introSkip = createIntroSkipController(video);

  window.addEventListener("message", (event) => {
    if (event.data?.type === MSG.RESTORE_TIME) {
      const savedTime = Number(event.data.time);
      if (savedTime > 0 && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        video.currentTime = savedTime;
      } else if (savedTime > 0) {
        video.addEventListener(
          "loadedmetadata",
          () => {
            video.currentTime = savedTime;
          },
          { once: true },
        );
      }
      return;
    }

    if (event.data?.type === MSG.IS_SEEK) {
      const target = Number(event.data.time);
      if (Number.isFinite(target) && target >= 0) {
        try {
          video.currentTime = target;
        } catch {}
      }
      return;
    }

    if (event.data?.type === MSG.IS_SET_RANGES) {
      introSkip.setRanges(event.data);
    }
  });

  let updateTimer = null;

  video.addEventListener("play", () => {
    if (updateTimer) return;
    updateTimer = setInterval(reportProgress, updateInterval);
    introSkip.onPlay();
  });

  video.addEventListener("pause", () => {
    clearInterval(updateTimer);
    updateTimer = null;
    reportProgress();
    introSkip.onPause();
  });

  video.addEventListener("ended", () => {
    clearInterval(updateTimer);
    updateTimer = null;
    reportProgress();
    introSkip.onStop();
  });

  // `timeupdate` is the standard video event for cheap playback-position
  // tracking. It fires roughly every ~250ms during normal playback, which
  // is the same ballpark as our poll interval — so we lean on it for the
  // skip-range check instead of running a separate high-frequency timer.
  video.addEventListener("timeupdate", () => {
    introSkip.onTimeUpdate(video.currentTime);
  });

  video.addEventListener("seeking", () => {
    introSkip.onSeeking(video.currentTime);
  });

  function reportProgress() {
    if (!video.duration || isNaN(video.duration)) return;
    window.parent.postMessage(
      {
        type: MSG.UPDATE_TIME,
        time: video.currentTime,
        duration: video.duration,
      },
      "*",
    );
  }

  // Tell the parent we're ready to receive skip ranges. The parent may
  // have already tried to send them before this iframe finished loading,
  // so we fire IS_READY on a short delay too.
  const fireReady = () => {
    try {
      window.parent.postMessage({ type: MSG.IS_READY }, "*");
    } catch {}
  };
  fireReady();
  setTimeout(fireReady, 800);
  setTimeout(fireReady, 2500);
}

// ────────────────────────────────────────────────────────────────────────
// Intro / Outro Skip controller
// ────────────────────────────────────────────────────────────────────────

/**
 * Skip-range controller. Runs inside the kwik iframe so it has direct
 * access to the <video> element. Responsibilities:
 *   - Store the ranges received from the parent.
 *   - On each timeupdate, check whether currentTime is inside a range.
 *   - If autoSkip is on, seek to the end of the range automatically.
 *   - Otherwise, show a Skip button ON TOP of the video; clicking it
 *     seeks the video past the current range.
 *   - Avoid re-firing for the same range; respect manual seeks.
 */
function createIntroSkipController(video) {
  const state = {
    intro: null, // { start, end } or null
    outro: null,
    recap: null,
    autoSkip: false,
    pollMs: 250,
    buttonAutoHideMs: 8000,
    showHighlights: true,
    currentRangeType: null, // 'intro' | 'outro' | null
    lastSeekTime: -1,
    pollTimer: null,
    autoHideTimer: null,
    btn: null,
    scrubber: null, // the kwik progress-bar track element we inject into
    scrubberObserver: null,
  };

  injectButtonStyles();
  state.btn = createButton();
  state.btn.addEventListener("click", () => {
    const range =
      state.currentRangeType === "intro" ? state.intro : state.outro;
    const end = rangeEnd(range);
    if (end != null) {
      try {
        video.currentTime = end;
        state.lastSeekTime = end;
      } catch {}
    }
    hideButton();
  });

  // Reparent the button whenever the player enters/exits fullscreen so it
  // stays visible on top of the fullscreen video.
  attachFullscreenWatcher(state.btn, video);

  // Re-show the button if the user moves the mouse after it auto-hid.
  document.addEventListener("mousemove", () => {
    if (state.currentRangeType && !state.btn.classList.contains("visible")) {
      showButton();
    }
  });

  // Highlight segments are injected DIRECTLY INTO the kwik player's
  // scrubber element once we find it. We use a MutationObserver to
  // catch the scrubber being created (kwik renders its controls lazily
  // after the video loads).
  startScrubberWatcher();

  function setRanges(payload) {
    if (!payload) return;
    state.intro = payload.ranges?.intro ?? null;
    state.outro = payload.ranges?.outro ?? null;
    state.recap = payload.ranges?.recap ?? null;
    state.autoSkip = !!payload.autoSkip;
    state.pollMs = Number(payload.pollMs) || 250;
    state.buttonAutoHideMs = Number(payload.buttonAutoHideMs) || 8000;
    state.showHighlights = payload.showHighlights !== false;
    state.currentRangeType = null;

    // Restart the poll timer with the new interval as a fallback for the
    // timeupdate event (which can pause on some browsers when the tab is
    // backgrounded or the user is scrubbing).
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    if (state.intro || state.outro) {
      state.pollTimer = setInterval(() => {
        if (!video.paused && !video.ended) {
          check(video.currentTime);
        }
      }, state.pollMs);
      // Run an immediate check so the status is correct without waiting
      // for the next timeupdate.
      check(video.currentTime);
    } else {
      hideButton();
    }

    updateHighlights();
  }

  function onPlay() {
    if (state.pollTimer || (!state.intro && !state.outro)) return;
    state.pollTimer = setInterval(() => {
      if (!video.paused && !video.ended) {
        check(video.currentTime);
      }
    }, state.pollMs);
    check(video.currentTime);
  }

  function onPause() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function onStop() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
    hideButton();
  }

  function onTimeUpdate(t) {
    check(t);
  }

  function onSeeking(t) {
    // Track the user's manual seeks so we don't immediately yank them back.
    state.lastSeekTime = t;
    // Re-check the new position so the button updates promptly.
    check(t);
  }

  function inRange(range, t) {
    if (!range) return false;
    const start = Number(range.start);
    let end = Number(range.end);
    if (!Number.isFinite(start) || start < 0) return false;
    if (!Number.isFinite(end) || end < 0) {
      // Start-only range — treat the active window as start..start+30s.
      end = start + 30;
    }
    return t >= start && t < end;
  }

  function rangeEnd(range) {
    const start = Number(range?.start);
    let end = Number(range?.end);
    if (!Number.isFinite(end) || end < 0) {
      if (!Number.isFinite(start) || start < 0) return null;
      end = start + 90; // default fallback (mirrors parent's default)
    }
    return end;
  }

  function check(t) {
    const inIntro = inRange(state.intro, t);
    const inOutro = inRange(state.outro, t);
    const newRangeType = inIntro ? "intro" : inOutro ? "outro" : null;

    // Update button visibility when the range type changes.
    if (newRangeType !== state.currentRangeType) {
      state.currentRangeType = newRangeType;
      if (newRangeType && !state.autoSkip) {
        updateButtonLabel(newRangeType);
        showButton();
      } else {
        hideButton();
      }
    }

    if (state.autoSkip) {
      // Don't fight the user — if they just manual seeked, give them a
      // brief grace period before auto-skipping again.
      if (
        state.lastSeekTime >= 0 &&
        Math.abs(t - state.lastSeekTime) < 1.0
      ) {
        return;
      }

      if (inIntro) {
        const end = rangeEnd(state.intro);
        if (end != null && t < end) {
          try {
            video.currentTime = end;
            state.lastSeekTime = end;
          } catch {}
        }
      } else if (inOutro) {
        const end = rangeEnd(state.outro);
        if (end != null && t < end) {
          try {
            video.currentTime = end;
            state.lastSeekTime = end;
          } catch {}
        }
      }
    }
  }

  function updateButtonLabel(rangeType) {
    const label = state.btn.querySelector(".ape-is-skip-label");
    if (label) {
      label.textContent =
        rangeType === "intro" ? "Skip Intro" : "Skip Outro";
    }
  }

  /**
   * Watch for the kwik scrubber element to appear in the DOM, then keep
   * watching for it to be replaced (kwik sometimes rebuilds its controls
   * on fullscreen toggle / source change).
   *
   * Once found, the scrubber is stored in `state.scrubber` and
   * `updateHighlights()` is called to inject the colored segments.
   */
  function startScrubberWatcher() {
    const tryFind = () => {
      const scrubber = findScrubber();
      if (scrubber && scrubber !== state.scrubber) {
        state.scrubber = scrubber;
        updateHighlights();
      }
    };

    tryFind();
    state.scrubberObserver = new MutationObserver(tryFind);
    state.scrubberObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also retry on fullscreen change (kwik rebuilds controls) and on
    // metadata load.
    document.addEventListener("fullscreenchange", () =>
      setTimeout(tryFind, 100),
    );
    document.addEventListener("webkitfullscreenchange", () =>
      setTimeout(tryFind, 100),
    );
    video.addEventListener("loadedmetadata", () => setTimeout(tryFind, 100));
  }

  /**
   * Find the kwik player's progress-bar track element.
   *
   * Kwik uses various class names across versions. We try the most common
   * ones, then fall back to looking for any element that looks like a
   * seek bar (has a "played" fill child + handles click/drag for seeking).
   *
   * Returns the TRACK element (the one whose children include the played
   * fill and the scrubber handle), or null.
   */
  function findScrubber() {
    // Direct class selectors (kwik.cx variants).
    const candidates = [
      ".vjs-progress-holder",
      ".vjs-progress-control",
      ".vjs-load-progress",
      ".jp-progress",
      ".progress-bar",
      ".progress",
      '[class*="progress"]',
      '[class*="seek"]',
      '[class*="scrub"]',
    ];

    for (const sel of candidates) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        // Skip our own elements.
        if (el.id?.startsWith("ape-is-")) continue;
        // Skip tiny/hidden elements.
        const rect = el.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 2) continue;
        // The scrubber should be near the bottom of the player.
        if (rect.top < window.innerHeight * 0.5) continue;
        return el;
      }
    }
    return null;
  }

  /**
   * Re-render the colored highlight segments INSIDE the kwik scrubber.
   *
   * Each segment is a child <div> with `position: absolute`,
   * `left`/`width` as percentages of the scrubber's width (which maps
   * 1:1 to the video duration). Because we inject into the actual
   * scrubber element, the segments inherit its exact position, size,
   * and stacking context — no manual positioning needed, and they
   * follow the scrubber into fullscreen automatically.
   */
  function updateHighlights() {
    const scrubber = state.scrubber;
    if (!scrubber) return;

    // Remove any previously-injected segments.
    scrubber
      .querySelectorAll(".ape-is-hl-segment")
      .forEach((el) => el.remove());

    if (
      !state.showHighlights ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      return;
    }

    // Make sure the scrubber can host absolutely-positioned children.
    const computedPos = getComputedStyle(scrubber).position;
    if (computedPos === "static") {
      scrubber.style.position = "relative";
    }

    const duration = video.duration;
    const segments = [];

    if (state.recap) {
      const seg = segmentStyle(state.recap, duration);
      if (seg)
        segments.push({ ...seg, className: "ape-is-hl-recap", label: "Recap" });
    }
    if (state.intro) {
      const seg = segmentStyle(state.intro, duration);
      if (seg)
        segments.push({ ...seg, className: "ape-is-hl-intro", label: "Intro" });
    }
    if (state.outro) {
      const seg = segmentStyle(state.outro, duration);
      if (seg)
        segments.push({ ...seg, className: "ape-is-hl-outro", label: "Outro" });
    }

    for (const seg of segments) {
      const div = document.createElement("div");
      div.className = `ape-is-hl-segment ${seg.className}`;
      div.style.left = `${seg.leftPct}%`;
      div.style.width = `${seg.widthPct}%`;
      div.title = seg.label;
      scrubber.appendChild(div);
    }
  }

  function segmentStyle(range, duration) {
    const start = Number(range?.start);
    let end = Number(range?.end);
    if (!Number.isFinite(start) || start < 0) return null;
    if (!Number.isFinite(end) || end < 0) end = start + 90;
    if (end <= start) return null;
    // Clamp to video bounds so we don't draw past the right edge.
    const s = Math.max(0, Math.min(start, duration));
    const e = Math.max(s, Math.min(end, duration));
    if (e <= s) return null;
    return {
      leftPct: (s / duration) * 100,
      widthPct: ((e - s) / duration) * 100,
    };
  }

  function showButton() {
    const btn = state.btn;
    if (!btn) return;
    btn.style.display = "flex";
    // Force reflow so the transition plays.
    void btn.offsetWidth;
    btn.classList.add("visible");

    clearTimeout(state.autoHideTimer);
    if (state.buttonAutoHideMs > 0) {
      state.autoHideTimer = setTimeout(() => {
        btn.classList.remove("visible");
        setTimeout(() => {
          if (state.currentRangeType) {
            // Still in range — keep display:flex so mousemove can re-show.
            btn.style.display = "flex";
          } else {
            btn.style.display = "none";
          }
        }, 250);
      }, state.buttonAutoHideMs);
    }
  }

  function hideButton() {
    const btn = state.btn;
    if (!btn) return;
    btn.classList.remove("visible");
    clearTimeout(state.autoHideTimer);
    setTimeout(() => {
      btn.style.display = "none";
    }, 250);
  }

  return {
    setRanges,
    onPlay,
    onPause,
    onStop,
    onTimeUpdate,
    onSeeking,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Skip button DOM + CSS (injected into the kwik iframe)
// ────────────────────────────────────────────────────────────────────────

function injectButtonStyles() {
  if (document.getElementById("ape-is-styles")) return;
  const s = document.createElement("style");
  s.id = "ape-is-styles";
  s.textContent = `
    #${SKIP_BTN_ID} {
      position: fixed;
      bottom: 64px;
      right: 18px;
      z-index: 2147483647;
      display: none;
      align-items: center;
      gap: 7px;
      background: rgba(8, 8, 22, 0.85);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 8px;
      padding: 8px 16px 8px 11px;
      font: 700 13px/1 system-ui, -apple-system, sans-serif;
      cursor: pointer;
      letter-spacing: 0.02em;
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition:
        transform 0.18s ease,
        background 0.18s ease,
        border-color 0.18s ease,
        opacity 0.25s ease;
      opacity: 0;
      transform: translateY(10px);
      user-select: none;
      -webkit-user-select: none;
    }
    #${SKIP_BTN_ID}.visible {
      opacity: 1;
      transform: translateY(0);
    }
    #${SKIP_BTN_ID}:hover {
      background: rgba(59, 130, 246, 0.95);
      border-color: rgba(255, 255, 255, 0.5);
      transform: translateY(0) scale(1.05);
    }
    #${SKIP_BTN_ID}:active {
      transform: translateY(0) scale(0.97);
    }
    #${SKIP_BTN_ID} .ape-is-skip-icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    #${SKIP_BTN_ID} .ape-is-skip-icon svg {
      width: 100%;
      height: 100%;
    }
    #${SKIP_BTN_ID} .ape-is-skip-label {
      white-space: nowrap;
    }
    /* When a fullscreen element is active, the button lives INSIDE that
       element (which is in the top layer). Absolute positioning relative
       to the fullscreen element keeps it pinned to the bottom-right of
       the video instead of being left behind in the normal layout. */
    :fullscreen #${SKIP_BTN_ID},
    :-webkit-full-screen #${SKIP_BTN_ID} {
      position: absolute;
    }

    /* ── Progress-bar highlight segments ──────────────────────────────
       These are injected DIRECTLY INTO the kwik player's scrubber
       element as absolutely-positioned children. They inherit the
       scrubber's position, size, and stacking context, so they:
         - sit exactly on top of the scrubber track (not floating above)
         - follow the scrubber into fullscreen automatically
         - resize with the scrubber when the player resizes

       z-index is set high so they render above the kwik "played" fill
       but below the scrubber handle (which is typically z-index 2-3
       in video.js-based players).
    */
    .ape-is-hl-segment {
      position: absolute !important;
      top: 0 !important;
      height: 100% !important;
      border-radius: 3px !important;
      opacity: 0.85 !important;
      pointer-events: none !important;
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.6) !important;
      z-index: 1 !important;
      mix-blend-mode: screen !important;
    }
    .ape-is-hl-intro {
      background: #3b82f6 !important;
    }
    .ape-is-hl-outro {
      background: #e8710a !important;
    }
    .ape-is-hl-recap {
      background: #a855f7 !important;
    }
  `;
  document.head.appendChild(s);
}

function createButton() {
  let btn = document.getElementById(SKIP_BTN_ID);
  if (btn) return btn;
  btn = document.createElement("button");
  btn.id = SKIP_BTN_ID;
  btn.type = "button";
  btn.innerHTML = `
    <span class="ape-is-skip-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 5 L14 12 L5 19 Z" />
        <rect x="15" y="5" width="2.5" height="14" rx="0.6" />
        <rect x="20" y="5" width="2.5" height="14" rx="0.6" />
      </svg>
    </span>
    <span class="ape-is-skip-label">Skip Intro</span>
  `;
  document.body.appendChild(btn);
  return btn;
}

/**
 * Returns the element that is currently in fullscreen inside this
 * document, or null. Works across vendor prefixes.
 */
function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.webkitCurrentFullScreenElement ||
    null
  );
}

/**
 * Returns the element the skip button should be parented to:
 *   - the fullscreen element if one is active (so the button stays
 *     visible on top of the fullscreen video)
 *   - document.body otherwise
 */
function getButtonHost(video) {
  return getFullscreenElement() || document.body;
}

/**
 * Tracks fullscreen enter/exit on this iframe's document and reparents
 * the skip button so it always stays on top of the video.
 *
 * Why we need this: when the player goes fullscreen, the browser
 * promotes the fullscreen element to the "top layer" — a special
 * rendering context above ALL other content in the document. Any
 * sibling of the fullscreen element (including our button, when it's
 * parented to document.body) gets hidden behind the fullscreen layer.
 * By moving the button INTO the fullscreen element, it rides along
 * into the top layer and stays visible.
 *
 * Returns a cleanup function (unused in practice — the controller lives
 * for the lifetime of the page — but kept for symmetry).
 */
function attachFullscreenWatcher(btn, video) {
  const onFsChange = () => {
    const host = getButtonHost(video);
    if (btn.parentNode !== host) {
      host.appendChild(btn);
    }
    // Force a fresh style recalculation in case the :fullscreen rule
    // didn't apply yet at the moment of reparenting.
    void btn.offsetWidth;
  };

  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);
  // Safari sometimes fires `mozfullscreenchange` even on modern builds;
  // listening costs nothing and covers the edge case.
  document.addEventListener("mozfullscreenchange", onFsChange);

  // Also catch the case where the player wraps the video in a container
  // and fullscreens THAT container — the button should follow the
  // container, not just the <video>. We watch for size/position changes
  // on the video's parent as a fallback.
  const videoParent = video.parentElement;
  let resizeObs = null;
  if (videoParent && typeof ResizeObserver !== "undefined") {
    resizeObs = new ResizeObserver(() => {
      // Only act if we're NOT in fullscreen — fullscreen is handled by
      // the fullscreenchange listener above.
      if (!getFullscreenElement()) {
        const host = getButtonHost(video);
        if (btn.parentNode !== host) {
          host.appendChild(btn);
        }
      }
    });
    resizeObs.observe(videoParent);
  }

  return () => {
    document.removeEventListener("fullscreenchange", onFsChange);
    document.removeEventListener("webkitfullscreenchange", onFsChange);
    document.removeEventListener("mozfullscreenchange", onFsChange);
    if (resizeObs) resizeObs.disconnect();
  };
}


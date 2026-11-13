const MSG = {
  REQUEST_TIME: "AP_CW_REQUEST_TIME",
  RESTORE_TIME: "AP_CW_RESTORE_TIME",
  UPDATE_TIME: "AP_CW_UPDATE_TIME",
  IS_SET_RANGES: "AP_IS_SET_RANGES",
  IS_SEEK: "AP_IS_SEEK",
  IS_READY: "AP_IS_READY",
  BW_ENDED: "AP_BW_ENDED",
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

  // kwik can rebuild <video> while initializing; re-wire whenever a different element appears.
  let currentVideo = null;

  const tryAttach = () => {
    const v = findVideo();
    if (v && v !== currentVideo) {
      currentVideo = v;
      setup(v, updateInterval);
    }
  };

  tryAttach();

  const observer = new MutationObserver(tryAttach);
  observer.observe(document.body, { childList: true, subtree: true });
})();

function findVideo() {
  return document.querySelector("video") ?? null;
}

function ensurePlayback(video) {
  const MAX_ATTEMPTS = 30;
  let attempts = 0;
  let clickInterval = null;

  // Only unmute a video we muted ourselves, and take one free automatic attempt
  // before requiring a real gesture (retrying on every event loops pause/resume).
  let autoMuted = false;
  let triedAutoUnmute = false;

  const attemptNativePlay = () => {
    video.play()?.catch(() => {
      if (!video.muted) {
        autoMuted = true;
        video.muted = true;
      }
      video.play()?.catch(() => {});
    });
  };

  // Unmuting can silently re-pause the video; restore muted playback if it does.
  const tryUnmute = (isGesture) => {
    if (!autoMuted || !video.muted) return;
    if (!isGesture) {
      if (triedAutoUnmute) return;
      triedAutoUnmute = true;
    }
    video.muted = false;
    autoMuted = false;
    setTimeout(() => {
      if (video.paused && !video.ended) {
        autoMuted = true;
        video.muted = true;
        video.play()?.catch(() => {});
      }
    }, 60);
  };

  video.addEventListener("playing", () => tryUnmute(false));

  document.addEventListener("pointerdown", () => tryUnmute(true), {
    capture: true,
  });
  document.addEventListener("keydown", () => tryUnmute(true), {
    capture: true,
  });

  attemptNativePlay();
  video.addEventListener("loadeddata", attemptNativePlay, { once: true });
  video.addEventListener("canplay", attemptNativePlay, { once: true });

  clickInterval = setInterval(() => {
    attempts++;
    if (!video.paused) {
      clearInterval(clickInterval);
      return;
    }
    if (attempts > MAX_ATTEMPTS) {
      clearInterval(clickInterval);
      console.warn(
        "[animepahe-enhancer] Could not auto-start playback — the player may need a different selector for its play button. Please report this with your browser + video host in the console.",
      );
      return;
    }
    clickPlayOverlay();
    attemptNativePlay();
  }, 500);
}

function clickPlayOverlay() {
  const btn = document.querySelector(
    ".vjs-big-play-button, .vjs-play-control, .jw-icon-display, .plyr__control--overlaid",
  );
  btn?.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, view: window }),
  );
}

function setup(video, updateInterval) {
  ensurePlayback(video);

  window.parent.postMessage({ type: MSG.REQUEST_TIME }, "*");

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
    try {
      window.parent.postMessage({ type: MSG.BW_ENDED }, "*");
    } catch {}
  });

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

  const fireReady = () => {
    try {
      window.parent.postMessage({ type: MSG.IS_READY }, "*");
    } catch {}
  };
  fireReady();
  setTimeout(fireReady, 800);
  setTimeout(fireReady, 2500);
}

function createIntroSkipController(video) {
  const state = {
    intro: null,
    outro: null,
    recap: null,
    autoSkip: false,
    pollMs: 250,
    buttonAutoHideMs: 8000,
    showHighlights: true,
    currentRangeType: null,
    lastSeekTime: -1,
    pollTimer: null,
    autoHideTimer: null,
    btn: null,
    scrubber: null,
    segments: [],
    tip: null,
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

  // Reparent into the fullscreen element so the button stays on top of the video.
  attachFullscreenWatcher(state.btn, video);

  document.addEventListener("mousemove", () => {
    if (state.currentRangeType && !state.btn.classList.contains("visible")) {
      showButton();
    }
  });

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
    state.lastSeekTime = t;
    check(t);
  }

  function inRange(range, t) {
    if (!range) return false;
    const start = Number(range.start);
    let end = Number(range.end);
    if (!Number.isFinite(start) || start < 0) return false;
    if (!Number.isFinite(end) || end < 0) {
      end = start + 30;
    }
    return t >= start && t < end;
  }

  function rangeEnd(range) {
    const start = Number(range?.start);
    let end = Number(range?.end);
    if (!Number.isFinite(end) || end < 0) {
      if (!Number.isFinite(start) || start < 0) return null;
      end = start + 90;
    }
    return end;
  }

  function check(t) {
    const inIntro = inRange(state.intro, t);
    const inOutro = inRange(state.outro, t);
    const newRangeType = inIntro ? "intro" : inOutro ? "outro" : null;

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
      // Grace period after a manual seek so we do not skip straight back.
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

  // kwik rebuilds its controls on fullscreen and source changes; keep watching.
  function startScrubberWatcher() {
    const tryFind = () => {
      const scrubber = findScrubber();
      if (scrubber && scrubber !== state.scrubber) {
        state.scrubber = scrubber;
        bindTip(scrubber);
        updateHighlights();
      }
    };

    tryFind();
    state.scrubberObserver = new MutationObserver(tryFind);
    state.scrubberObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    document.addEventListener("fullscreenchange", () =>
      setTimeout(tryFind, 100),
    );
    document.addEventListener("webkitfullscreenchange", () =>
      setTimeout(tryFind, 100),
    );
    video.addEventListener("loadedmetadata", () => setTimeout(tryFind, 100));
  }

  // kwik class names vary by version: known selectors first, then size/position heuristics.
  function findScrubber() {
    const candidates = [
      // Plyr: .plyr__progress wraps the seek input, so its width maps 1:1 to
      // the timeline. The outer __container is taller and must not be used.
      ".plyr__progress",
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
        if (el.id?.startsWith("ape-is-")) continue;
        if (el.classList.contains("plyr__progress__container")) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 2) continue;
        if (rect.top < window.innerHeight * 0.5) continue;
        return el;
      }
    }
    return null;
  }

  function updateHighlights() {
    const scrubber = state.scrubber;
    if (!scrubber) return;

    scrubber
      .querySelectorAll(".ape-is-hl-segment, .ape-is-hl-tip")
      .forEach((el) => el.remove());
    scrubber.classList.remove("ape-is-scrubber");
    state.segments = [];
    state.tip = null;

    if (
      !state.showHighlights ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      return;
    }

    if (getComputedStyle(scrubber).position === "static") {
      scrubber.style.position = "relative";
    }
    scrubber.classList.add("ape-is-scrubber");

    const duration = video.duration;
    const ranges = [
      ["recap", "Recap", state.recap],
      ["intro", "Intro", state.intro],
      ["outro", "Outro", state.outro],
    ];

    for (const [type, name, range] of ranges) {
      const seg = segmentStyle(range, duration);
      if (!seg) continue;
      const div = document.createElement("div");
      div.className = `ape-is-hl-segment ape-is-hl-${type}`;
      div.style.left = `${seg.leftPct}%`;
      div.style.width = `${seg.widthPct}%`;
      scrubber.appendChild(div);
      state.segments.push({
        startPct: seg.leftPct,
        endPct: seg.leftPct + seg.widthPct,
        text: `${name} ${formatTime(seg.start)} to ${formatTime(seg.end)}`,
      });
    }

    const tip = document.createElement("div");
    tip.className = "ape-is-hl-tip";
    scrubber.appendChild(tip);
    state.tip = tip;
  }

  // Segments ignore the pointer so seeking keeps working; hit-test them here.
  function bindTip(scrubber) {
    if (scrubber.dataset.apeTip) return;
    scrubber.dataset.apeTip = "1";
    scrubber.addEventListener("mousemove", (e) => {
      const rect = scrubber.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      showTip(state.segments.find((s) => pct >= s.startPct && pct <= s.endPct));
    });
    scrubber.addEventListener("mouseleave", () => showTip(null));
  }

  function showTip(hit) {
    if (!state.tip) return;
    if (hit) {
      state.tip.textContent = hit.text;
      state.tip.style.left = `${hit.startPct}%`;
    }
    state.tip.classList.toggle("is-on", !!hit);
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function segmentStyle(range, duration) {
    const start = Number(range?.start);
    let end = Number(range?.end);
    if (!Number.isFinite(start) || start < 0) return null;
    if (!Number.isFinite(end) || end < 0) end = start + 90;
    if (end <= start) return null;
    const s = Math.max(0, Math.min(start, duration));
    const e = Math.max(s, Math.min(end, duration));
    if (e <= s) return null;
    return {
      start: s,
      end: e,
      leftPct: (s / duration) * 100,
      widthPct: ((e - s) / duration) * 100,
    };
  }

  function showButton() {
    const btn = state.btn;
    if (!btn) return;
    btn.style.display = "flex";
    void btn.offsetWidth;
    btn.classList.add("visible");

    clearTimeout(state.autoHideTimer);
    if (state.buttonAutoHideMs > 0) {
      state.autoHideTimer = setTimeout(() => {
        btn.classList.remove("visible");
        setTimeout(() => {
          if (state.currentRangeType) {
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

function injectButtonStyles() {
  import(chrome.runtime.getURL("content/helpers/styles.js")).then(
    ({ injectStylesheet }) => {
      injectStylesheet("ape-is-styles", "content/features/css/intro-skip.css");
    },
  );
}

function createButton() {
  let btn = document.getElementById(SKIP_BTN_ID);
  if (btn) return btn;
  btn = document.createElement("button");
  btn.id = SKIP_BTN_ID;
  btn.classList.add("ape-is-skip-btn");
  btn.type = "button";
  btn.innerHTML = `
    <span class="ape-is-skip-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 5l10 7-10 7z" />
        <path d="M19 5v14" fill="none" />
      </svg>
    </span>
    <span class="ape-is-skip-label">Skip Intro</span>
  `;
  document.body.appendChild(btn);
  return btn;
}

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.webkitCurrentFullScreenElement ||
    null
  );
}

function getButtonHost(video) {
  return getFullscreenElement() || document.body;
}

function attachFullscreenWatcher(btn, video) {
  const onFsChange = () => {
    const host = getButtonHost(video);
    if (btn.parentNode !== host) {
      host.appendChild(btn);
    }
    void btn.offsetWidth;
  };

  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);
  document.addEventListener("mozfullscreenchange", onFsChange);

  const videoParent = video.parentElement;
  let resizeObs = null;
  if (videoParent && typeof ResizeObserver !== "undefined") {
    resizeObs = new ResizeObserver(() => {
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


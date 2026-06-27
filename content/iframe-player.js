const MSG = {
  REQUEST_TIME: "AP_CW_REQUEST_TIME",
  RESTORE_TIME: "AP_CW_RESTORE_TIME",
  UPDATE_TIME: "AP_CW_UPDATE_TIME",
};

const DEFAULT_UPDATE_INTERVAL = 2_000;

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
  window.parent.postMessage({ type: MSG.REQUEST_TIME }, "*");

  window.addEventListener("message", (event) => {
    if (event.data?.type !== MSG.RESTORE_TIME) return;
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
  });

  let updateTimer = null;

  video.addEventListener("play", () => {
    if (updateTimer) return;
    updateTimer = setInterval(reportProgress, updateInterval);
  });

  video.addEventListener("pause", () => {
    clearInterval(updateTimer);
    updateTimer = null;
    reportProgress();
  });

  video.addEventListener("ended", () => {
    clearInterval(updateTimer);
    updateTimer = null;
    reportProgress();
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
}

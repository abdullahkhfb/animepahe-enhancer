/* ═══════════════════════════════════════════════════════════════════════════
   AnimePahe Enhancer — Iframe Player Content Script  v1.0.0
   Runs on: kwik.cx / kwik.sh / kwik.si / kwik.bz / yaneura.top / yaneura.com
   Purpose: Detect the embedded <video>, restore saved progress,
            and report playback position back to the AnimePahe parent frame.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // Only do anything when this page is embedded inside AnimePahe
  if (window.self === window.top) return;

  let _video   = null;
  let _restored = false;

  // ── Poll for the <video> element ──────────────────────────────────────────
  const findVideoInterval = setInterval(() => {
    const video = document.querySelector('video');
    if (!video) return;

    clearInterval(findVideoInterval);
    _video = video;

    // 1. Ask the parent (AnimePahe) for our saved timestamp
    window.parent.postMessage({ type: 'AP_CW_REQUEST_TIME' }, '*');

    // 2. Receive the timestamp and seek the video
    window.addEventListener('message', (e) => {
      if (
        e.data &&
        e.data.type === 'AP_CW_RESTORE_TIME' &&
        typeof e.data.time === 'number' &&
        e.data.time > 5 &&
        !_restored
      ) {
        // Only jump if the user hasn't already watched past that point
        // and hasn't intentionally rewound near the start
        if (_video.currentTime < 10) {
          _video.currentTime = e.data.time;
        }
        _restored = true;
      }
    });

    // 3. Send playback position back to parent every 2 s (on even seconds)
    _video.addEventListener('timeupdate', () => {
      if (
        _video.duration &&
        !isNaN(_video.duration) &&
        Math.floor(_video.currentTime) % 2 === 0
      ) {
        window.parent.postMessage(
          {
            type:     'AP_CW_UPDATE_TIME',
            time:     _video.currentTime,
            duration: _video.duration,
          },
          '*'
        );
      }
    });

    // 4. Mark as complete when the episode finishes (helps reset progress display)
    _video.addEventListener('ended', () => {
      window.parent.postMessage(
        {
          type:     'AP_CW_UPDATE_TIME',
          time:     _video.duration,
          duration: _video.duration,
        },
        '*'
      );
    });

  }, 400);

  // Stop polling after 12 s to avoid wasting resources
  setTimeout(() => clearInterval(findVideoInterval), 12000);

})();

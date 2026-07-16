/**
 * main.js — animepahe Enhancer entry point
 *
 * Responsibilities:
 *   1. Load user settings from storage
 *   2. Detect which animepahe page we are on
 *   3. Dynamically import each enabled feature module
 *   4. Run per-feature initialization
 *   5. Run cache garbage-collection in the background
 *
 * Adding a new feature:
 *   - Create content/features/my-feature.js that exports a class with an init(pageType) method
 *   - Add a settings key for it in helpers/storage.js  ->  DEFAULT_SETTINGS
 *   - Register it in the FEATURES array below
 */

(async () => {
  function extUrl(path) {
    return chrome.runtime.getURL(path);
  }

  const [{ getPageType }, { storage }, { gcDubCache }, { throttler }] =
    await Promise.all([
      import(extUrl("content/helpers/router.js")),
      import(extUrl("content/helpers/storage.js")),
      import(extUrl("content/helpers/cache.js")),
      import(extUrl("content/helpers/throttler.js")),
    ]);

  const pageType = getPageType();
  const settings = await storage.getSettings();

  throttler.updateOptions({
    minInterval: settings.throttleMinInterval,
    jitter: settings.throttleJitter,
    maxConcurrent: settings.throttleMaxConcurrent,
    maxRetries: settings.throttleMaxRetries,
    baseBackoff: settings.throttleBaseBackoff,
  });

  const cacheTtlMs = (settings.cacheTtlHours ?? 24) * 60 * 60 * 1_000;

  if (!document.getElementById("ape-dub-styles")) {
    const s = document.createElement("style");
    s.id = "ape-dub-styles";
    s.textContent = `
      @keyframes ape-dub-spin { to { transform: rotate(360deg); } }

      .ape-dub-badge,
      .ape-dub-badge-home {
        position:       absolute !important;
        top:            5px      !important;
        right:          5px      !important;
        left:           auto     !important;
        z-index:        9999     !important;
        color:          #fff     !important;
        font:           700 10px/1 system-ui, sans-serif !important;
        padding:        3px 7px  !important;
        border-radius:  3px      !important;
        letter-spacing: .5px     !important;
        pointer-events: none     !important;
        box-shadow:     0 1px 5px rgba(0,0,0,.65) !important;
        display:        inline-block !important;
        text-indent:    0        !important;
        white-space:    nowrap   !important;
      }
      .ape-dub-badge      { background: #d92558 !important; }
      .ape-dub-badge-home { background: #d92558 !important; }

      .ape-dub-spin {
        position:       absolute !important;
        top:            7px !important;
        right:          7px !important;
        z-index:        9999 !important;
        width:          10px !important;
        height:         10px !important;
        border-radius:  50%  !important;
        pointer-events: none !important;
        border:         2px solid rgba(255,255,255,.25) !important;
        border-top-color: #fff !important;
        animation:      ape-dub-spin .7s linear infinite !important;
      }
    `;
    document.head.appendChild(s);
  }

  if (!document.getElementById("ape-cw-styles")) {
    const s = document.createElement("style");
    s.id = "ape-cw-styles";
    s.textContent = `
      #ape-cw-section {
        padding: 32px 15px 10px;
        box-sizing: border-box;
        max-width: 1200px;
        width: 100%;
        margin: 0 auto 6px;
      }
      .ape-cw-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .ape-cw-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.35rem;
        font-weight: 700;
        color: #f2f2f2;
        margin: 0;
        letter-spacing: .01em;
      }
      .ape-cw-heading-icon {
        width: 20px;
        height: 20px;
        color: #d92558;
        flex-shrink: 0;
      }
      .ape-cw-controls {
        display: flex;
        gap: 8px;
      }
      .ape-cw-util-btn {
        background: rgba(255,255,255,.07);
        color: #c0c0d8;
        border: 1px solid rgba(255,255,255,.1);
        padding: 5px 13px;
        border-radius: 5px;
        font-size: .82rem;
        font-weight: 600;
        cursor: pointer;
        transition: all .2s;
      }
      .ape-cw-util-btn:hover       { background: rgba(255,255,255,.15); color: #fff; }
      .ape-cw-util-btn.danger:hover { background: #d92558; border-color: transparent; }
      .ape-cw-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .ape-cw-grid.collapsed {
        max-height: 320px;
        overflow: hidden;
        mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
        -webkit-mask-image: linear-gradient(to bottom, black 70%, transparent 100%);
      }
      .ape-cw-card {
        position: relative;
        width: 140px;
        border-radius: 7px;
        overflow: hidden;
        background: #0c0c1e;
        transition: transform .22s ease, box-shadow .22s ease;
        will-change: transform;
      }
      .ape-cw-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 32px rgba(0,0,0,.75);
        z-index: 3;
      }
      .ape-cw-link {
        display: block;
        text-decoration: none;
        color: inherit;
        outline-offset: 3px;
      }
      .ape-cw-thumb-wrap {
        position: relative;
        aspect-ratio: 2 / 3;
        overflow: hidden;
        background: #111128;
      }
      .ape-cw-thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top center;
        display: block;
        transition: transform .35s ease;
      }
      .ape-cw-card:hover .ape-cw-thumb { transform: scale(1.07); }
      .ape-cw-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.15);
        opacity: 0;
        transition: opacity .2s;
      }
      .ape-cw-card:hover .ape-cw-overlay { opacity: 1; }
      .ape-cw-play-icon {
        width: 52px;
        height: 52px;
        filter: drop-shadow(0 2px 10px rgba(0,0,0,.8));
        transition: transform .2s;
      }
      .ape-cw-card:hover .ape-cw-play-icon { transform: scale(1.13); }
      .ape-cw-ep-badge {
        position: absolute;
        bottom: 8px;
        right: 8px;
        background: rgba(0,0,0,.8);
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        padding: 3px 7px;
        border-radius: 4px;
        letter-spacing: .05em;
        line-height: 1;
        pointer-events: none;
        user-select: none;
        z-index: 6;
      }
      .ape-cw-prog-bg {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: rgba(0,0,0,.45);
        z-index: 5;
      }
      .ape-cw-prog-bar {
        height: 100%;
        background: #d92558;
        box-shadow: 0 0 6px rgba(231,76,60,.45);
        transition: width .3s ease;
      }
      .ape-cw-info { padding: 7px 9px 9px; }
      .ape-cw-title {
        display: block;
        font-size: 11.5px;
        color: #a8a8c0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.5;
        transition: color .15s;
      }
      .ape-cw-card:hover .ape-cw-title { color: #e8e8f8; }
      .ape-cw-remove-btn {
        position: absolute;
        top: 7px;
        right: 7px;
        z-index: 10;
        width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 50%;
        border: none;
        background: rgba(12,12,28,.85);
        color: #d0d0e8;
        font-size: 12px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transform: scale(.7);
        transition: opacity .18s, transform .18s, background .15s, color .15s;
      }
      .ape-cw-card:hover .ape-cw-remove-btn { opacity: 1; transform: scale(1); }
      .ape-cw-remove-btn:hover {
        background: #d92558  !important;
        color: #fff !important;
        transform: scale(1.1) !important;
      }
      @keyframes ape-cw-pop-out {
        to { opacity: 0; transform: scale(.78); }
      }
      @keyframes ape-cw-section-out {
        to { opacity: 0; transform: translateY(-12px); }
      }
      .ape-cw-pop-out {
        animation: ape-cw-pop-out .26s ease forwards;
        pointer-events: none;
      }
      .ape-cw-remove-anim {
        animation: ape-cw-section-out .3s ease forwards;
        pointer-events: none;
      }
    `;
    document.head.appendChild(s);
  }

  setTimeout(() => gcDubCache(cacheTtlMs), 3_000);

  // feature registry
  //
  // each entry:
  //   module  – path to the feature module (relative to extension root)
  //   export  – named export that is the feature class
  //   enabled – whether the user has this feature switched on
  //
  // the feature class must implement:
  //   constructor(storage)
  //   async init(pageType: string): Promise<void>

  const FEATURES = [
    {
      module: "content/features/continue-watching.js",
      export: "ContinueWatching",
      enabled: settings.cwEnabled,
    },
    {
      module: "content/features/dub-detector.js",
      export: "DubDetector",
      enabled: settings.dubEnabled,
    },
    {
      module: "content/features/smart-search.js",
      export: "SmartSearch",
      enabled: settings.smartSearchEnabled,
    },
    {
      module: "content/features/intro-skip.js",
      export: "IntroSkip",
      enabled: settings.introSkipEnabled,
    },
    //  to add a new feature, append an entry here
    // {
    //   module:  "content/features/my-feature.js",
    //   export:  "MyFeature",
    //   enabled: settings.myFeatureEnabled,
    // },
  ];

  // init enabled features

  await Promise.all(
    FEATURES.filter((f) => f.enabled).map(async (f) => {
      try {
        const mod = await import(extUrl(f.module));
        const FeatureClass = mod[f.export];
        const instance = new FeatureClass(storage, settings);
        await instance.init(pageType);
      } catch (err) {
        console.error(
          `[animepahe-enhancer] Failed to initialize ${f.export}:`,
          err,
        );
      }
    }),
  );
})();

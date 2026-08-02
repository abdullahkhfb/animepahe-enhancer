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

  const [
    { getPageType },
    { storage },
    { gcDubCache },
    { throttler },
    { injectStylesheet },
  ] = await Promise.all([
    import(extUrl("content/helpers/router.js")),
    import(extUrl("content/helpers/storage.js")),
    import(extUrl("content/helpers/cache.js")),
    import(extUrl("content/helpers/throttler.js")),
    import(extUrl("content/helpers/styles.js")),
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

  // main.js only needs its shared base CSS now; each feature injects
  // its own stylesheet when it initializes (see helpers/styles.js).
  injectStylesheet("ape-main-styles", "content/main.css");

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
    {
      module: "content/features/binge-watch.js",
      export: "BingeWatch",
      enabled: settings.bingeWatchEnabled,
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

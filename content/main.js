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

  // Stay idle on Cloudflare challenge pages so we never compete with the site's own load.
  const { whenSiteReady } = await import(extUrl("content/helpers/challenge.js"));
  if (!(await whenSiteReady())) return;

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

  injectStylesheet("ape-main-styles", "content/main.css");

  setTimeout(() => gcDubCache(cacheTtlMs), 3_000);

  const FEATURES = [
    {
      module: "content/features/js/continue-watching.js",
      export: "ContinueWatching",
      enabled: settings.cwEnabled,
    },
    {
      module: "content/features/js/dub-detector.js",
      export: "DubDetector",
      enabled: settings.dubEnabled,
    },
    {
      module: "content/features/js/smart-search.js",
      export: "SmartSearch",
      enabled: settings.smartSearchEnabled,
    },
    {
      module: "content/features/js/intro-skip.js",
      export: "IntroSkip",
      enabled: settings.introSkipEnabled,
    },
    {
      module: "content/features/js/binge-watch.js",
      export: "BingeWatch",
      enabled: settings.bingeWatchEnabled,
    },
    {
      module: "content/features/js/skip-wait.js",
      export: "SkipWait",
      enabled: settings.skipWaitEnabled,
    },
  ];

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

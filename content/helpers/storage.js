export const KEYS = {
  SETTINGS: "ape_settings",
  CONTINUE_WATCHING: "ape_cw_v1",
};

export const CW_MAX_ENTRIES = 24;

export const ADVANCED_SETTINGS_SCHEMA = [
  {
    group: "Continue Watching",
    items: [
      {
        key: "cwMaxEntries",
        label: "Max saved entries",
        desc: "How many shows are kept in your Continue Watching list before the oldest is dropped.",
        min: 5,
        max: 100,
        step: 1,
        default: 24,
      },
      {
        key: "cwCardsPerPage",
        label: 'Cards before "Show More"',
        desc: "How many cards are visible on the homepage before the list collapses.",
        min: 2,
        max: 20,
        step: 1,
        default: 6,
      },
    ],
  },
  {
    group: "DUB Detector",
    items: [
      {
        key: "cacheTtlHours",
        label: "Cache duration (hours)",
        desc: "How long detected DUB/SUB results (and Smart Search lookups) stay cached before being re-checked.",
        min: 1,
        max: 168,
        step: 1,
        default: 24,
      },
      {
        key: "dubParallelProbes",
        label: "Binary-search probes",
        desc: "How many points are probed per step when narrowing down which episodes are dubbed. Higher finds the answer in fewer rounds but fires more requests at once.",
        min: 2,
        max: 30,
        step: 1,
        default: 12,
      },
      {
        key: "dubBatchDelay",
        label: "Delay between batches (ms)",
        desc: "Pause inserted between scan batches/rounds so the site isn't hammered.",
        min: 0,
        max: 10000,
        step: 100,
        default: 2000,
      },
      {
        key: "dubHomeBatchSize",
        label: "Homepage scan batch size",
        desc: "How many homepage cards are checked for dubs at the same time.",
        min: 1,
        max: 10,
        step: 1,
        default: 2,
      },
    ],
  },
  {
    group: "Network Throttler",
    items: [
      {
        key: "throttleMinInterval",
        label: "Min interval between requests (ms)",
        desc: "Minimum spacing enforced between outgoing requests to animepahe.",
        min: 0,
        max: 2000,
        step: 10,
        default: 120,
      },
      {
        key: "throttleJitter",
        label: "Jitter (ms)",
        desc: "Random variation added on top of the minimum interval, so requests don't go out at a perfectly robotic cadence.",
        min: 0,
        max: 1000,
        step: 10,
        default: 50,
      },
      {
        key: "throttleMaxConcurrent",
        label: "Max concurrent requests",
        desc: "How many requests may be in flight at the same time.",
        min: 1,
        max: 20,
        step: 1,
        default: 6,
      },
      {
        key: "throttleMaxRetries",
        label: "Max retries on rate limit",
        desc: "How many times a throttled (429/503) request is retried before giving up.",
        min: 0,
        max: 10,
        step: 1,
        default: 4,
      },
      {
        key: "throttleBaseBackoff",
        label: "Base backoff (ms)",
        desc: "Starting wait time before retrying after a rate-limit response. Doubles with each retry.",
        min: 500,
        max: 30000,
        step: 500,
        default: 3000,
      },
    ],
  },
  {
    group: "Smart Search",
    items: [
      {
        key: "ssMinQueryLen",
        label: "Minimum query length",
        desc: "Smallest number of typed characters before Smart Search starts looking things up.",
        min: 1,
        max: 10,
        step: 1,
        default: 2,
      },
      {
        key: "ssDebounceMs",
        label: "Debounce delay (ms)",
        desc: "How long to wait after you stop typing before searching.",
        min: 0,
        max: 1000,
        step: 10,
        default: 100,
      },
      {
        key: "ssMaxSynonyms",
        label: "Max alternate titles queried",
        desc: "How many AniList synonyms/alt-titles are searched per query.",
        min: 0,
        max: 10,
        step: 1,
        default: 3,
      },
      {
        key: "ssSynonymDelay",
        label: "Delay between synonym queries (ms)",
        desc: "Pause between each alternate-title lookup against animepahe's search.",
        min: 0,
        max: 2000,
        step: 50,
        default: 250,
      },
    ],
  },
  {
    group: "Player",
    items: [
      {
        key: "playerUpdateInterval",
        label: "Progress save interval (ms)",
        desc: "How often your playback position is saved while a video is playing.",
        min: 500,
        max: 10000,
        step: 250,
        default: 2000,
      },
    ],
  },
  {
    group: "Intro / Outro Skip",
    items: [
      {
        key: "introSkipAutoSkip",
        label: "Auto-skip intros & outros",
        desc: "If on, the player jumps past the opening/ending automatically. If off, a Skip button is shown instead and you choose when to jump.",
        min: 0,
        max: 1,
        step: 1,
        default: 0,
      },
      {
        key: "introSkipUseApiFallback",
        label: "Use online API fallback",
        desc: "If the anime isn't in the local timestamps database, query the AnimeSkip API (https://animeskip.org) for community-submitted intro/outro times. Adds one network request per episode on cache miss.",
        min: 0,
        max: 1,
        step: 1,
        default: 1,
      },
      {
        key: "introSkipShowHighlights",
        label: "Highlight intro/outro on progress bar",
        desc: "Draws colored segments on the player's scrubber: blue = intro, orange = outro, purple = recap. Turn off if it clashes with the player UI.",
        min: 0,
        max: 1,
        step: 1,
        default: 1,
      },
      {
        key: "introSkipButtonAutoHideMs",
        label: "Skip button auto-hide (ms)",
        desc: "How long the manual Skip button stays visible after it appears. 0 keeps it on screen for the whole intro/outro.",
        min: 0,
        max: 30000,
        step: 500,
        default: 8000,
      },
      {
        key: "introSkipPollMs",
        label: "Skip-range poll interval (ms)",
        desc: "How often the video position is checked against the intro/outro timestamps. Lower = snappier skipping but slightly more CPU.",
        min: 100,
        max: 2000,
        step: 50,
        default: 250,
      },
      {
        key: "introSkipDefaultOpDuration",
        label: "Default OP duration (s)",
        desc: "Fallback length used when the database only provides an opening start. Most anime openings are around 90 seconds.",
        min: 0,
        max: 300,
        step: 5,
        default: 90,
      },
      {
        key: "introSkipDefaultEdDuration",
        label: "Default ED duration (s)",
        desc: "Fallback length used when the database only provides an ending start.",
        min: 0,
        max: 300,
        step: 5,
        default: 90,
      },
      {
        key: "introSkipDbRefreshHours",
        label: "Timestamp DB refresh (hours)",
        desc: "How often the open-anime-timestamps database is re-downloaded from GitHub. 168 hours = 1 week.",
        min: 1,
        max: 720,
        step: 1,
        default: 168,
      },
      {
        key: "introSkipIdCacheHours",
        label: "ID lookup cache (hours)",
        desc: "How long AniList -> AniDB ID mappings stay cached before being re-resolved.",
        min: 1,
        max: 720,
        step: 1,
        default: 168,
      },
    ],
  },
];

const ADVANCED_DEFAULTS = Object.fromEntries(
  ADVANCED_SETTINGS_SCHEMA.flatMap((group) =>
    group.items.map((item) => [item.key, item.default]),
  ),
);

export const DEFAULT_SETTINGS = {
  cwEnabled: true,
  dubEnabled: true,
  smartSearchEnabled: true,
  introSkipEnabled: true,
  ...ADVANCED_DEFAULTS,
};

export const storage = {
  async get(key) {
    return (await chrome.storage.local.get(key))[key];
  },

  async set(key, value) {
    return chrome.storage.local.set({ [key]: value });
  },

  async remove(key) {
    return chrome.storage.local.remove(key);
  },

  async keysWithPrefix(prefix) {
    const all = await chrome.storage.local.get(null);
    return Object.keys(all).filter((k) => k.startsWith(prefix));
  },

  async getWithPrefix(prefix) {
    const all = await chrome.storage.local.get(null);
    return Object.fromEntries(
      Object.entries(all).filter(([k]) => k.startsWith(prefix)),
    );
  },

  async getSettings() {
    const saved = await this.get(KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
  },

  async setSettings(patch) {
    const current = await this.getSettings();
    const next = { ...current, ...patch };
    await this.set(KEYS.SETTINGS, next);
    return next;
  },

  async getCwList() {
    const raw = await this.get(KEYS.CONTINUE_WATCHING);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async setCwList(list) {
    return this.set(KEYS.CONTINUE_WATCHING, JSON.stringify(list));
  },

  async clearCwList() {
    return this.remove(KEYS.CONTINUE_WATCHING);
  },
};

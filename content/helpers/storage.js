export const KEYS = {
  SETTINGS: "ape_settings",
  CONTINUE_WATCHING: "ape_cw_v1",
};

export const CW_MAX_ENTRIES = 24;

export const DEFAULT_SETTINGS = {
  cwEnabled: true,
  dubEnabled: true,
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
    return this.set(KEYS.SETTINGS, { ...current, ...patch });
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

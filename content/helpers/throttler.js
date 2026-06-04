const _sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

export class RequestThrottler {
  /**
   * @param {{
   *   minInterval?:   number,  // ms between consecutive request launches (default 280)
   *   jitter?:        number,  // ± ms random variation (default 80)
   *   maxConcurrent?: number,  // max simultaneous in-flight fetches (default 2)
   *   maxRetries?:    number,  // retries on rate-limit hit (default 3)
   *   baseBackoff?:   number,  // initial back-off ms; doubles each retry (default 2000)
   * }} opts
   */
  constructor(opts = {}) {
    this._minInterval = opts.minInterval ?? 0;
    this._jitter = opts.jitter ?? 0;
    this._maxConcurrent = opts.maxConcurrent ?? 32;
    this._maxRetries = opts.maxRetries ?? 3;
    this._baseBackoff = opts.baseBackoff ?? 2_000;

    this._queue = [];
    this._active = 0;
    this._lastLaunch = 0;
    this._backoffUntil = 0;
    this._draining = false;
  }

  /**
   * Queue a fetch and return the parsed response (JSON or text).
   * @param {string}  url
   * @param {boolean} [wantJson=true]
   * @returns {Promise<any>}
   */
  fetch(url, wantJson = true) {
    return new Promise((resolve, reject) => {
      this._queue.push({ url, wantJson, resolve, reject, retries: 0 });
      if (!this._draining) this._drain();
    });
  }

  get pendingCount() {
    return this._queue.length + this._active;
  }
  get minInterval() {
    return this._minInterval;
  }
  get maxConcurrent() {
    return this._maxConcurrent;
  }

  async _drain() {
    this._draining = true;

    while (this._queue.length > 0 || this._active > 0) {
      const backoffRemaining = this._backoffUntil - Date.now();
      if (backoffRemaining > 0) {
        await _sleep(backoffRemaining);
        continue;
      }
      if (this._queue.length > 0 && this._active < this._maxConcurrent) {
        const jitter =
          Math.floor(Math.random() * this._jitter * 2) - this._jitter;
        const gap = this._minInterval + jitter;
        const since = Date.now() - this._lastLaunch;

        if (since < gap) {
          await _sleep(gap - since);
          continue;
        }

        const task = this._queue.shift();
        this._active++;
        this._lastLaunch = Date.now();
        this._execute(task);
        continue;
      }

      await _sleep(30);
    }

    this._draining = false;
  }

  async _execute(task) {
    try {
      const result = await this._attempt(task.url, task.wantJson);
      task.resolve(result);
    } catch (err) {
      if (err.rateLimited && task.retries < this._maxRetries) {
        const delay = this._baseBackoff * Math.pow(2, task.retries);
        this._backoffUntil = Date.now() + delay;
        task.retries++;
        this._queue.unshift(task);
      } else {
        task.reject(err);
      }
    } finally {
      this._active--;
      if (!this._draining && (this._queue.length > 0 || this._active > 0)) {
        this._drain();
      }
    }
  }

  async _attempt(url, wantJson) {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: wantJson ? "application/json" : "text/html,*/*",
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    if (res.status === 429 || res.status === 503 || res.status === 403) {
      throw Object.assign(new Error(`HTTP ${res.status}`), {
        rateLimited: true,
      });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (wantJson) {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        const text = await res.text();
        if (/rate.?limit|error\s+1015|cloudflare/i.test(text)) {
          throw Object.assign(
            new Error("Cloudflare rate-limit (HTML response)"),
            { rateLimited: true },
          );
        }
        throw new Error(`Expected JSON but got content-type: ${ct}`);
      }
      return res.json();
    }

    return res.text();
  }
}

export const throttler = new RequestThrottler();

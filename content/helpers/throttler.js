const _sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

export class RequestThrottler {
  constructor(opts = {}) {
    this._minInterval = opts.minInterval ?? 120;
    this._jitter = opts.jitter ?? 50;
    this._maxConcurrent = opts.maxConcurrent ?? 6;
    this._maxRetries = opts.maxRetries ?? 4;
    this._baseBackoff = opts.baseBackoff ?? 3_000;

    this._queue = [];
    this._active = 0;
    this._lastLaunch = 0;
    this._backoffUntil = 0;
    this._draining = false;
  }

  fetch(url, wantJson = true) {
    return new Promise((resolve, reject) => {
      this._queue.push({ url, wantJson, resolve, reject, retries: 0 });
      if (!this._draining) this._drain();
    });
  }

  get pendingCount() {
    return this._queue.length + this._active;
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

      await _sleep(20);
    }

    this._draining = false;
  }

  async _execute(task) {
    try {
      const result = await this._attempt(task.url, task.wantJson);
      task.resolve(result);
    } catch (err) {
      if (err.rateLimited && task.retries < this._maxRetries) {
        const serverHint = err.retryAfterMs ?? 0;
        const expBackoff = this._baseBackoff * Math.pow(2, task.retries);
        const jitter = Math.random() * expBackoff * 0.5;
        const delay = Math.max(serverHint, expBackoff + jitter);

        this._backoffUntil = Date.now() + delay;
        task.retries++;
        this._queue.push(task);
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
        Accept: wantJson ? "application/json" : "text/html,*/*;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (res.status === 429 || res.status === 503 || res.status === 403) {
      let retryAfterMs = 0;
      const ra = res.headers.get("retry-after");
      if (ra) {
        const secs = Number(ra);
        retryAfterMs =
          Number.isFinite(secs) && secs > 0
            ? secs * 1_000
            : Date.parse(ra) - Date.now();
        retryAfterMs = Math.max(0, retryAfterMs);
      }

      if (res.status === 503) {
        const body = await res.text().catch(() => "");
        const isCf =
          /cloudflare|checking your browser|just a moment|cf-browser-verification/i.test(
            body,
          );
        if (!isCf) {
          throw new Error(`HTTP 503 (server error, not CF)`);
        }
        throw Object.assign(new Error("Cloudflare challenge (503)"), {
          rateLimited: true,
          retryAfterMs,
          isCfChallenge: true,
        });
      }

      throw Object.assign(new Error(`HTTP ${res.status}`), {
        rateLimited: true,
        retryAfterMs,
      });
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (wantJson) {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        const text = await res.text();
        const isCf =
          /cloudflare|checking your browser|just a moment|error\s+1015/i.test(
            text,
          );
        if (isCf) {
          throw Object.assign(
            new Error("Cloudflare interception (200 with HTML)"),
            { rateLimited: true, isCfChallenge: true },
          );
        }
        throw new Error(`Expected JSON but got content-type: ${ct}`);
      }
      return res.json();
    }

    return res.text();
  }
}

export const throttler = new RequestThrottler({
  minInterval: 120,
  jitter: 50,
  maxConcurrent: 6,
  maxRetries: 4,
  baseBackoff: 3_000,
});

/**
 * Per-(tabId, command) sliding-window rate limiter.
 *
 * Synchronous `allow()` reads/writes an in-memory Map; writes are mirrored to
 * `chrome.storage.session` fire-and-forget so counters survive a service-worker
 * termination (per invariant §2.6). At construction the limiter hydrates from
 * session storage asynchronously — a brief warm-up after SW restart will allow
 * requests that prior counters would have dropped. That window is bounded by the
 * storage round-trip latency and is the price of a sync decision API.
 */

const STORAGE_KEY = "autofill-security:rate-limiter";

export interface RateLimitConfig {
  windowMs: number;
  maxInWindow: number;
}

type Counter = number[]; // sorted ascending list of timestamps within the active window

const bucketKey = (tabId: number, command: string): string => `${tabId}:${command}`;

export class RateLimiter {
  private readonly buckets = new Map<string, Counter>();

  constructor(
    private readonly configs: Record<string, RateLimitConfig>,
    private readonly defaultConfig: RateLimitConfig,
    private readonly clock: () => number = () => Date.now(),
    private readonly storage: chrome.storage.StorageArea | undefined = chrome.storage?.session,
  ) {
    this.hydrate();
  }

  /**
   * Returns true if the request fits within the window for (tabId, command).
   * False if the bucket is full — caller drops the request.
   */
  allow(tabId: number, command: string): boolean {
    const config = this.configs[command] ?? this.defaultConfig;
    const now = this.clock();
    const cutoff = now - config.windowMs;
    const key = bucketKey(tabId, command);
    const bucket = this.buckets.get(key) ?? [];

    // Prune expired timestamps — this is the only place we drop them, so it has
    // to happen on every call to keep memory bounded under bursty patterns.
    let pruneFrom = 0;
    while (pruneFrom < bucket.length && bucket[pruneFrom] <= cutoff) {
      pruneFrom++;
    }
    const fresh = pruneFrom === 0 ? bucket : bucket.slice(pruneFrom);

    if (fresh.length >= config.maxInWindow) {
      // Still write back the pruned bucket so memory doesn't grow unbounded
      // when callers spam over the limit.
      this.buckets.set(key, fresh);
      this.persist();
      return false;
    }

    fresh.push(now);
    this.buckets.set(key, fresh);
    this.persist();
    return true;
  }

  /** Test seam. */
  __snapshot(): Record<string, Counter> {
    const out: Record<string, Counter> = {};
    for (const [k, v] of this.buckets) {
      out[k] = [...v];
    }
    return out;
  }

  private hydrate(): void {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.get(STORAGE_KEY, (result?: Record<string, unknown>) => {
        const stored = result?.[STORAGE_KEY] as Record<string, Counter> | undefined;
        if (!stored) {
          return;
        }
        for (const [key, timestamps] of Object.entries(stored)) {
          // Drop persisted state for unknown commands or non-array values.
          if (!Array.isArray(timestamps)) {
            continue;
          }
          this.buckets.set(key, timestamps);
        }
      });
    } catch {
      // chrome.storage.session may be unavailable in some test environments;
      // proceed with empty in-memory state.
    }
  }

  private persist(): void {
    if (!this.storage) {
      return;
    }
    const out: Record<string, Counter> = {};
    for (const [k, v] of this.buckets) {
      // Skip empty buckets so storage doesn't accumulate dead keys.
      if (v.length > 0) {
        out[k] = v;
      }
    }
    try {
      // Fire-and-forget. In-memory state remains authoritative for the synchronous
      // decision; a failed persist only weakens cross-SW-lifetime durability.
      void Promise.resolve(this.storage.set({ [STORAGE_KEY]: out })).catch(() => {
        /* swallow — persistence is best-effort */
      });
    } catch {
      // Some MV3 storage areas throw synchronously on unsupported writes; ignore.
    }
  }
}

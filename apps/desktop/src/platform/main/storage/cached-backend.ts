import { StorageBackend } from "./storage-backend";

const DEBOUNCE_DELAY_MS = 200;
const MAX_WAIT_MS = 5000;

/**
 * Wrapper that adds an in-memory cache and debounced writes to any {@link StorageBackend}.
 * - Reads are always served from cache, initialized during construction.
 * - Writes update the cache immediately but debounce the write to the inner backend:
 *   each write resets a short delay timer ({@link DEBOUNCE_DELAY_MS}), and a separate
 *   max-wait timer ({@link MAX_WAIT_MS}) ensures continuous writes can't defer the
 *   flush indefinitely.
 * - Call {@link flush} before shutdown to persist any pending writes (e.g. in Electron's
 *   `will-quit`).
 */
export class CachedBackend implements StorageBackend {
  private cache: Record<string, unknown>;
  private delayTimer: ReturnType<typeof setTimeout> | null = null;
  private maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  constructor(private inner: StorageBackend) {
    this.cache = inner.read();
  }

  read(): Record<string, unknown> {
    return this.cache;
  }

  update(updater: (store: Record<string, unknown>) => Record<string, unknown>): void {
    this.cache = updater({ ...this.cache });
    this.dirty = true;
    this.scheduleFlush();
  }

  flush(): void {
    this.clearTimers();
    if (this.dirty) {
      const snapshot = { ...this.cache };
      this.inner.update(() => snapshot);
      this.dirty = false;
    }
  }

  private scheduleFlush(): void {
    // Reset the debounce delay timer on every write
    if (this.delayTimer != null) {
      clearTimeout(this.delayTimer);
    }
    this.delayTimer = setTimeout(() => this.flush(), DEBOUNCE_DELAY_MS);

    // Start a max-wait timer on the first write after a flush,
    // so continuous writes can't defer the flush forever
    if (this.maxWaitTimer == null) {
      this.maxWaitTimer = setTimeout(() => this.flush(), MAX_WAIT_MS);
    }
  }

  private clearTimers(): void {
    if (this.delayTimer != null) {
      clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }
    if (this.maxWaitTimer != null) {
      clearTimeout(this.maxWaitTimer);
      this.maxWaitTimer = null;
    }
  }
}

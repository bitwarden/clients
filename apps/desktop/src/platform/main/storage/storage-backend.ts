/**
 * Low-level storage backend that reads and writes the entire store as a single blob.
 * Designed to be composable so that implementations can wrap other backends to add
 * behavior like caching.
 */
export interface StorageBackend {
  /** Read the entire store as a single blob. */
  read(): Record<string, unknown>;
  /** Update the store with the provided function, which receives the current store and returns the updated store. */
  update(updater: (store: Record<string, unknown>) => Record<string, unknown>): void;
  /** Persist any pending changes immediately. No-op if nothing is pending. */
  flush(): void;
}

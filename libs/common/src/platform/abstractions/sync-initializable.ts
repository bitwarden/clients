declare const SyncDependency: FunctionConstructor;
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export interface SyncDependency extends Function {
  prototype: SyncInitializable;
}

/**
 * Services implementing SyncInitializable participate in synchronous initialization.
 * Used for event listener registration and other synchronous setup that must happen
 * before async initialization begins.
 *
 * Use cases:
 * - Chrome API event listener registration (alarms, runtime, commands, tabs, etc.)
 * - Context menu setup
 * - Message listener registration
 *
 * Important:
 * - init() is synchronous (returns void, not Promise)
 * - Dependencies are optional - services are topologically sorted if provided
 * - Should be idempotent (safe to call multiple times)
 */
export interface SyncInitializable {
  /**
   * List of sync service classes that must be initialized before this service.
   * Only reference other SyncInitializable services.
   *
   * Example:
   * syncDependencies = [BrowserApiService, LogService];
   */
  syncDependencies?: SyncDependency[];

  /**
   * Initialize this service synchronously.
   * Called once during application startup before async initialization.
   * Should register event listeners, set up handlers, etc.
   */
  init(): void;
}

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
 * - No dependencies - all sync init runs in registration order
 * - Should be idempotent (safe to call multiple times)
 */
export interface SyncInitializable {
  /**
   * Initialize this service synchronously.
   * Called once during application startup before async initialization.
   * Should register event listeners, set up handlers, etc.
   */
  init(): void;
}

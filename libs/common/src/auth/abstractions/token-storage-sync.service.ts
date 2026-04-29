/**
 * Owns all token disk persistence decisions for the application.
 *
 * `TokenService` writes tokens exclusively to memory. This service is the sidecar
 * responsible for deciding whether (and when) those tokens should also reach the
 * persistent tier (disk / OS secure storage), based on the user's vault timeout
 * settings.
 *
 * On startup, `init()` must be awaited before any token reads are served. It:
 *  1. Hydrates memory from the persistent tier for every known account, so that
 *     token reads are available immediately after the app starts.
 *  2. Starts per-user reactive subscriptions that keep the persistent tier in sync
 *     with memory whenever tokens or vault timeout settings change.
 *
 * Security invariant enforced by this service:
 *  - LogOut + non-Never timeout  →  tokens are wiped from all persistent storage.
 *  - Lock (any timeout) or LogOut + Never  →  tokens are written to persistent storage.
 *
 * This design eliminates the circular dependency that would arise from `TokenService`
 * or `ApiService` needing to know about vault timeout settings at write time.
 */
export abstract class TokenStorageSyncService {
  /**
   * Initializes the service. Must be called once at app startup before any token reads are served.
   *
   * 1. Hydrates memory from the persistent tier (disk / OS secure storage) for all currently
   *    known accounts, so that token reads are available immediately on startup.
   * 2. Starts per-user reactive subscriptions that keep the persistent tier in sync with
   *    memory state whenever tokens or vault timeout settings change.
   */
  abstract init(): Promise<void>;
}

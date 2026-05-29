import { UserId } from "../../types/guid";

/**
 * Sidecar service that owns all token disk persistence decisions. `TokenService` writes
 * tokens to memory only; this service decides whether (and when) those tokens reach the
 * persistent tier (disk / OS secure storage) based on the user's vault timeout settings.
 *
 * Security invariant:
 *  - LogOut + non-Never timeout  →  tokens are wiped from all persistent storage.
 *  - Lock (any timeout) or LogOut + Never  →  tokens are written to persistent storage.
 */
export abstract class TokenStorageSyncService {
  /**
   * Owning-context entry point. Hydrates memory from the persistent tier and starts
   * the per-user disk-sync subscriptions. Must be awaited before any token reads are
   * served. Non-owning contexts call {@link waitForHydration} instead.
   *
   * Idempotent across MV3 service-worker respawns: hydration is sentinel-guarded so a
   * respawn doesn't overwrite shared memory with stale disk values.
   */
  abstract init(): Promise<void>;

  /**
   * Awaits completion of hydration in the owning context. Used by non-owning contexts
   * in place of {@link init}.
   *
   * Why this exists: in MV3 the popup and background each instantiate their own
   * `TokenStorageSyncService` via Angular DI but share the same memory tier
   * (`chrome.storage.session`). If both contexts ran `init()`, the popup's hydrate
   * could overwrite a token the background just refreshed but had not yet flushed to
   * disk, forcing the user to re-login.
   */
  abstract waitForHydration(): Promise<void>;

  /**
   * Clears every persistent copy of the user's authentication tokens — access token,
   * refresh token, API key client ID, and API key client secret — for the given user.
   *
   * On all platforms, this clears the disk-backed state for each of those four tokens.
   * On platforms that support OS secure storage (Keychain, DPAPI, etc.), it additionally
   * removes the refresh token and the access token's encryption key from secure storage.
   * Secure storage remove failures are logged, not thrown.
   *
   * Intended to be called from logout paths and awaited before the rest of the logout
   * flow runs. Memory-side cleanup is handled separately by the state event runner —
   * the four token memory state keys use `clearOn: ["logout"]` and are wiped by
   * `stateEventRunnerService.handleEvent("logout", userId)`, which every logout path
   * already awaits.
   *
   * Why this exists alongside the reactive subscription: the per-user subscription also
   * observes the memory clear and emits a wipe, but that wipe is fire-and-forget inside
   * `subscribe()`. App close, browser tab close, CLI exit, or MV3 service worker
   * termination between the memory clear and the async wipe can leave tokens on disk.
   * An explicit awaited call closes that window.
   *
   * Idempotent — safe when disk is already clear.
   */
  abstract clearTokensFromDisk(userId: UserId): Promise<void>;
}

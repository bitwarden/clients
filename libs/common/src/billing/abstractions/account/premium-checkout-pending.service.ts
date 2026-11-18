import { UserId } from "../../../types/guid";

/** Context recorded when external checkout launches */
export type PremiumCheckoutPending = { featureNameKey?: string };

/**
 * Tracks whether the active user was sent to an external Stripe checkout flow
 * (browser tab / desktop default browser window) so the client can recover the
 * one-time `PremiumStatusChanged` push by syncing when it regains focus.
 *
 * State is memory-scoped: it clears on app restart and on logout.
 */
export abstract class PremiumCheckoutPendingService {
  /** Records that the user was sent to external checkout, with optional feature context. */
  abstract markCheckoutLaunched(userId: UserId, context?: PremiumCheckoutPending): Promise<void>;

  /** Reads the pending checkout record without clearing it; `null` when none is pending. */
  abstract getCheckoutPending(userId: UserId): Promise<PremiumCheckoutPending | null>;

  /** Clears any pending checkout. */
  abstract clearCheckoutPending(userId: UserId): Promise<void>;

  /**
   * Reads and clears the pending checkout atomically; `null` when none is pending.
   * Transitional: removed once PM-44278 moves its callers to get + clear.
   */
  abstract consumeCheckoutPending(userId: UserId): Promise<PremiumCheckoutPending | null>;
}

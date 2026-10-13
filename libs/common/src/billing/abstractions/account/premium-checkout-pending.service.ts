import { UserId } from "../../../types/guid";

/**
 * Tracks whether the active user was sent to an external Stripe checkout flow
 * (browser tab / desktop default browser window) so the client can recover the
 * one-time `PremiumStatusChanged` push by syncing when it regains focus.
 *
 * State is memory-scoped: it clears on app restart and on logout.
 */
export abstract class PremiumCheckoutPendingService {
  /** Records that the user was sent to external checkout. */
  abstract markCheckoutLaunched(userId: UserId): Promise<void>;

  /**
   * Reads and clears the pending flag atomically.
   * @returns `true` if a checkout was pending (caller should sync), otherwise `false`.
   */
  abstract consumeCheckoutPending(userId: UserId): Promise<boolean>;
}

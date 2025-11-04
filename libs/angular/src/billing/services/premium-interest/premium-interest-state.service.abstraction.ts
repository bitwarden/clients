import { UserId } from "@bitwarden/user-core";

/**
 * A service that manages state which conveys whether a user has expressed interest
 * in setting up a premium subscription. This applies for users who began the registration
 * process on https://bitwarden.com/go/start-premium/, which is a marketing page designed
 * to streamline users who intend to set up a premium subscription after registration.
 * - Implemented in Web only. No-op for other clients.
 */
export abstract class PremiumInterestStateService {
  abstract getPremiumInterest(userId: UserId): Promise<boolean | null>;
  abstract setPremiumInterest(userId: UserId, premiumInterest: boolean): Promise<void>;
  abstract clearPremiumInterest(userId: UserId): Promise<void>;
}

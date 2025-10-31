import { UserId } from "@bitwarden/user-core";

/**
 * A service that manages state which conveys whether or not a user intends to setup
 * a premium subscription. This applies for users who began the registration process
 * on https://bitwarden.com/go/start-premium/, which is a marketing page designed to
 * streamline users who intend to setup a premium subscription after registration.
 * - Implemented in Web only. No-op for other clients.
 */
export abstract class PremiumSetupIntentStateService {
  abstract getPremiumSetupIntent(userId: UserId): Promise<boolean | null>;
  abstract setPremiumSetupIntent(userId: UserId, premiumSetupIntent: boolean): Promise<void>;
  abstract clearPremiumSetupIntent(userId: UserId): Promise<void>;
}

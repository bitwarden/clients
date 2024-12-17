import { UserId } from "@bitwarden/common/types/guid";

export abstract class UserAsymmetricKeysRegenerationService {
  /**
   * Attempts to regenerate the user's asymmetric keys if they are invalid.
   * Requires the PrivateKeyRegeneration feature flag to be enabled if not the method will do nothing.
   * @param userId The user id.
   */
  abstract regenerateIfNeeded(userId: UserId): Promise<void>;
}

import { UserId } from "@bitwarden/common/types/guid";

export abstract class UserAsymmetricKeysRegenerationService {
  /**
   * Attempts to regenerate the user's asymmetric keys if they are invalid.
   * Requires the PrivateKeyRegeneration feature flag to be enabled if not the method will do nothing.
   * @param userId The user id.
   */
  abstract regenerateIfNeeded(userId: UserId): Promise<void>;

  /**
   * Performs the regeneration of the user's public/private key pair without checking any preconditions.
   * This should only be used for V1 encryption accounts
   * @param userId The user id.
   * @returns True if regeneration was performed, false otherwise.
   * @throws An error if the regeneration could not be attempted due to missing state
   */
  abstract regenerateUserPublicKeyEncryptionKeyPair(userId: UserId): Promise<boolean>;
}

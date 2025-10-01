import { UserId } from "@bitwarden/user-core";

/**
 * Service for unlocking vault using WebAuthn PRF.
 * Provides offline vault unlock capabilities by deriving unlock keys from PRF outputs.
 */
export abstract class WebAuthnPrfUnlockServiceAbstraction {
  /**
   * Check if PRF unlock is available for the current user
   * @param userId The user ID to check PRF unlock availability for
   * @returns Promise<boolean> true if PRF unlock is available
   */
  abstract isPrfUnlockAvailable(userId: UserId): Promise<boolean>;

  /**
   * Attempt to unlock the vault using WebAuthn PRF
   * @param userId The user ID to unlock vault for
   * @returns Promise<boolean> true if unlock was successful
   */
  abstract unlockVaultWithPrf(userId: UserId): Promise<boolean>;
}

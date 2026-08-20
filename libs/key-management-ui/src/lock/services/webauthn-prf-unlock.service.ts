import { UserKey } from "@bitwarden/common/types/key";
import { UserId } from "@bitwarden/user-core";

/**
 * Service for unlocking vault using WebAuthn PRF.
 * Provides offline vault unlock capabilities by deriving unlock keys from PRF outputs.
 */
export abstract class WebAuthnPrfUnlockService {
  /**
   * Check if PRF unlock is available for the current user
   * @param userId The user ID to check PRF unlock availability for
   * @returns Promise<boolean> true if PRF unlock is available
   */
  abstract isPrfUnlockAvailable(userId: UserId): Promise<boolean>;

  /**
   * Attempt to unlock the vault using WebAuthn PRF
   * @param userId The user ID to unlock vault for
   * @returns Promise<UserKey> the decrypted user key
   * @throws Error if no PRF credentials are available
   * @throws Error if the authenticator returns no PRF result
   * @throws Error if the user cancels the WebAuthn operation
   * @throws Error if decryption of the user key fails
   * @throws Error if no matching PRF option is found for the credential
   */
  abstract unlockVaultWithPrf(userId: UserId): Promise<UserKey>;
}

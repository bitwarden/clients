import { PublicKey } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

/**
 * Result of the trust verification process.
 */
export type TrustVerificationResult = {
  wasTrustDenied: boolean;
  trustedOrganizationPublicKeys: PublicKey[];
  trustedEmergencyAccessUserPublicKeys: PublicKey[];
};

/**
 * Abstraction for the user key rotation service.
 * Provides functionality to rotate user keys and verify trust for organizations
 * and emergency access users.
 */
export abstract class UserKeyRotationService {
  /**
   * Rotates the user key using the SDK, re-encrypting all required data with the new key.
   * @param currentMasterPassword The current master password
   * @param newMasterPassword The new master password
   * @param hint Optional hint for the new master password
   * @param userId The user account ID
   */
  abstract changePasswordAndRotateUserKey(
    currentMasterPassword: string,
    newMasterPassword: string,
    hint: string | undefined,
    userId: UserId,
  ): Promise<void>;

  /**
   * Verifies the trust of organizations and emergency access users by prompting the user.
   * Since organizations and emergency access grantees are not signed, manual trust prompts
   * are required to verify that the server does not inject public keys.
   * @param user The user account
   * @returns TrustVerificationResult containing whether trust was denied and the trusted public keys
   */
  abstract verifyTrust(userId: UserId): Promise<TrustVerificationResult>;
}

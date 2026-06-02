import { V1EmergencyAccessMembership, V1OrganizationMembership } from "@bitwarden/sdk-internal";

import { TrustVerificationResult } from "./user-key-rotation.service.abstraction";

/**
 * Abstraction for the UI layer that prompts the user to verify trust of organizations
 * and emergency access grantees during user key rotation.
 */
export abstract class UserCryptoDialogService {
  /**
   * Prompts the user to verify trust for the given organization and emergency access
   * memberships.
   * @param organizationV1Memberships Untrusted V1 organization memberships from the SDK.
   * @param emergencyAccessV1Memberships Untrusted V1 emergency access memberships from the SDK.
   * @returns A TrustVerificationResult indicating whether trust was denied and the
   * public keys the user has confirmed trust for.
   */
  abstract verifyTrust(
    organizationV1Memberships: V1OrganizationMembership[],
    emergencyAccessV1Memberships: V1EmergencyAccessMembership[],
  ): Promise<TrustVerificationResult>;
}

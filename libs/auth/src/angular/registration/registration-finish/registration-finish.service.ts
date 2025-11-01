import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { UserId } from "@bitwarden/user-core";

import { PasswordInputResult } from "../../input-password/password-input-result";

export abstract class RegistrationFinishService {
  /**
   * Retrieves the organization name from an organization invite if it exists.
   * Organization invites can currently only be accepted on the web.
   * @returns a promise which resolves to the organization name string or null if no invite exists.
   */
  abstract getOrgNameFromOrgInvite(): Promise<string | null>;

  /**
   * Gets the master password policy options from an organization invite if it exits.
   * Organization invites can currently only be accepted on the web.
   */
  abstract getMasterPasswordPolicyOptsFromOrgInvite(): Promise<MasterPasswordPolicyOptions | null>;

  /**
   * Finishes the registration process by creating a new user account.
   *
   * @param email The email address of the user.
   * @param passwordInputResult The password input result.
   * @param emailVerificationToken The optional email verification token. Not present in emailed invite scenarios (ex: org invite).
   * @param orgSponsoredFreeFamilyPlanToken The optional org sponsored free family plan token.
   * @param acceptEmergencyAccessInviteToken The optional accept emergency access invite token.
   * @param emergencyAccessId The optional emergency access id which is required to validate the emergency access invite token.
   * @param providerInviteToken The optional provider invite token.
   * @param providerUserId The optional provider user id which is required to validate the provider invite token.
   * @returns a promise which resolves upon a successful account creation.
   */
  abstract finishRegistration(
    email: string,
    passwordInputResult: PasswordInputResult,
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string,
    acceptEmergencyAccessInviteToken?: string,
    emergencyAccessId?: string,
    providerInviteToken?: string,
    providerUserId?: string,
  ): Promise<void>;

  abstract establishIntentToSetupPremium(userId: UserId): Promise<void>;
}

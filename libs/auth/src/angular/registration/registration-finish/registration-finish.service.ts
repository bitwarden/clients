import { PasswordInputResult } from "../../input-password/password-input-result";

export abstract class RegistrationFinishService {
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
   * @param salesAssistedToken The optional sales-assisted trial token. Only present in sales-assisted scenarios.
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
    salesAssistedToken?: string,
  ): Promise<void>;
}

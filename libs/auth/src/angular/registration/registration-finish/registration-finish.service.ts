import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";

import { PasswordInputResult } from "../../input-password/password-input-result";

export abstract class RegistrationFinishService {
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
   * @param emailVerificationToken The optional email verification token. Not present in org invite scenarios.
   * Returns a promise which resolves to the captcha bypass token string upon a successful account creation.
   */
  abstract finishRegistration(
    email: string,
    passwordInputResult: PasswordInputResult,
    emailVerificationToken?: string,
  ): Promise<string>;
}

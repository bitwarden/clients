// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

export abstract class ChangePasswordService {
  /**
   * Creates a new user key and re-encrypts all required data with it.
   * - does so by calling the underlying method on the `UserKeyRotationService`
   * - implemented in Web only
   *
   * @param currentPassword the current password
   * @param newPassword the new password
   * @param user the user account
   * @param newPasswordHint the new password hint
   * @throws if called from a non-Web client
   */
  abstract rotateUserKeyMasterPasswordAndEncryptedData(
    currentPassword: string,
    newPassword: string,
    user: Account,
    newPasswordHint: string,
  ): Promise<void>;

  /**
   * Changes the user's password and re-encrypts the user key with the `newMasterKey`.
   * - Specifically, this method uses credentials from the `passwordInputResult` to:
   *   1. Decrypt the user key with the `currentMasterKey`
   *   2. Re-encrypt that user key with the `newMasterKey`, resulting in a `newMasterKeyEncryptedUserKey`
   *   3. Build a `PasswordRequest` object that gets POSTed to `"/accounts/password"`
   *
   * @param passwordInputResult credentials object received from the `InputPasswordComponent`
   * @param userId the `userId`
   * @throws if the `userId`, `currentMasterKey`, or `currentServerMasterKeyHash` is not found
   */
  abstract changePassword(
    passwordInputResult: PasswordInputResult,
    userId: UserId | null,
  ): Promise<void>;

  /**
   * Changes the user's password and re-encrypts the user key with the `newMasterKey`.
   * - Specifically, this method uses credentials from the `passwordInputResult` to:
   *   1. Decrypt the user key with the `currentMasterKey`
   *   2. Re-encrypt that user key with the `newMasterKey`, resulting in a `newMasterKeyEncryptedUserKey`
   *   3. Build a `PasswordRequest` object that gets PUTed to `"/accounts/update-temp-password"` so that the
   *        ForcePasswordReset gets set to false.
   * @param passwordInputResult
   * @param userId
   */
  abstract changePasswordForAccountRecovery(
    passwordInputResult: PasswordInputResult,
    userId: UserId,
  ): Promise<void>;

  /**
   * Optional method that will clear up any deep link state.
   * - Currently only used on the web change password service.
   */
  clearDeeplinkState?: () => Promise<void>;
}

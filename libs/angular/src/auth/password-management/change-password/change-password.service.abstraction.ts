// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

export class InvalidCurrentPasswordError extends Error {
  constructor() {
    super("The current password is invalid.");
  }
}

export abstract class ChangePasswordService {
  /**
   * Verifies that the current password is correct via `proofOfDecryption` before
   * calling change password & user key rotation logic.
   *
   * @param passwordInputResult credentials object received from the `InputPasswordComponent`
   * @param user the user account
   * @throws if called from a non-Web client
   * @throws if required values are not found on the `PasswordInputResult`
   * @throws `InvalidCurrentPasswordError` if `proofOfDecryption` fails (i.e. the current
   *          password is incorrect)
   */
  abstract changePasswordAndRotateUserKey(
    passwordInputResult: PasswordInputResult,
    user: Account,
  ): Promise<void>;

  /**
   * Changes the user's password by building a `PasswordRequest` object that gets POSTed to the server.
   *
   * @param passwordInputResult credentials object received from the `InputPasswordComponent`
   * @param userId the active user's `userId`
   * @throws if required values are not found on the `PasswordInputResult`
   * @throws an `InvalidCurrentPasswordError` if `proofOfDecryption` fails (i.e. if the current password is incorrect)
   * @throws if there is an error during the API call
   */
  abstract changePassword(passwordInputResult: PasswordInputResult, userId: UserId): Promise<void>;

  /**
   * Changes the user's password during Account Recovery by building an `UpdateTempPasswordRequest`
   * object that gets PUT to the server.
   *
   * Note that this method pertains to the "follow-up" stage of account recovery. That is, this user
   * is now changing their own password AFTER it was recently set/changed for them by another org member
   * who has the "Manage Account Recovery" permission.
   *
   * @param passwordInputResult credentials object received from the `InputPasswordComponent`
   * @param userId the active user's `userId`
   * @throws if required values are not found on the `PasswordInputResult`
   * @throws an `InvalidCurrentPasswordError` if `proofOfDecryption` fails (i.e. if the current password is incorrect)
   * @throws if there is an error during the API call
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

  /**
   * Optional method that closes the browser extension popout if in a popout
   * If not in a popout, does nothing.
   */
  abstract closeBrowserExtensionPopout?(): void;

  /**
   * Optional method that indicates if we should navigate to the root page of the app after a password change.
   */
  abstract shouldNavigateToRoot(): boolean;

  /**
   * Resolves the master-password policy options that must be enforced for this user's
   * password change. Combines policies for orgs the user has joined (Accepted/Confirmed
   * members, sourced from synced state) with any in-flight organization invite the user
   * has not yet accepted (fetched via the invite token).
   * @param userId the active user's `userId`
   * @returns the combined MP requirements, or undefined when no policy applies.
   */
  abstract resolveMasterPasswordPolicyOptions(
    userId: UserId,
  ): Promise<MasterPasswordPolicyOptions | undefined>;
}

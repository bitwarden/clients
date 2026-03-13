// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { firstValueFromOrThrow } from "@bitwarden/common/key-management/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KdfConfig, KeyService } from "@bitwarden/key-management";

import {
  ChangePasswordService,
  InvalidCurrentPasswordError,
} from "./change-password.service.abstraction";

export class DefaultChangePasswordService implements ChangePasswordService {
  constructor(
    protected keyService: KeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected masterPasswordUnlockService: MasterPasswordUnlockService,
  ) {}

  async changePasswordAndRotateUserKey(
    passwordInputResult: PasswordInputResult,
    user: Account,
  ): Promise<void> {
    throw new Error("changePasswordAndRotateUserKey() is only implemented in Web");
  }

  async rotateUserKeyMasterPasswordAndEncryptedData(
    currentPassword: string,
    newPassword: string,
    user: Account,
    hint: string,
  ): Promise<void> {
    throw new Error("rotateUserKeyMasterPasswordAndEncryptedData() is only implemented in Web");
  }

  /**
   * @deprecated To be removed in PM-28143.
   */
  private async preparePasswordChange(
    passwordInputResult: PasswordInputResult,
    userId: UserId | null,
    request: PasswordRequest | UpdateTempPasswordRequest,
  ): Promise<[UserKey, EncString]> {
    if (!userId) {
      throw new Error("userId not found");
    }
    if (
      !passwordInputResult.currentMasterKey ||
      !passwordInputResult.currentServerMasterKeyHash ||
      !passwordInputResult.newMasterKey ||
      !passwordInputResult.newServerMasterKeyHash ||
      passwordInputResult.newPasswordHint == null
    ) {
      throw new Error("invalid PasswordInputResult credentials, could not change password");
    }

    const decryptedUserKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      passwordInputResult.currentMasterKey,
      userId,
    );

    if (decryptedUserKey == null) {
      throw new Error("Could not decrypt user key");
    }

    const newKeyValue = await this.keyService.encryptUserKeyWithMasterKey(
      passwordInputResult.newMasterKey,
      decryptedUserKey,
    );

    if (request instanceof PasswordRequest) {
      request.masterPasswordHash = passwordInputResult.currentServerMasterKeyHash;
      request.newMasterPasswordHash = passwordInputResult.newServerMasterKeyHash;
      request.masterPasswordHint = passwordInputResult.newPasswordHint;
    } else if (request instanceof UpdateTempPasswordRequest) {
      request.newMasterPasswordHash = passwordInputResult.newServerMasterKeyHash;
      request.masterPasswordHint = passwordInputResult.newPasswordHint;
    }

    return newKeyValue;
  }

  async changePassword(passwordInputResult: PasswordInputResult, userId: UserId) {
    if (passwordInputResult.newApisWithInputPasswordFlagEnabled) {
      const context = "Could not change password.";
      assertTruthy(passwordInputResult.currentPassword, "currentPassword", context);
      assertTruthy(passwordInputResult.newPassword, "newPassword", context);
      assertNonNullish(passwordInputResult.kdfConfig, "kdfConfig", context);
      assertTruthy(passwordInputResult.salt, "salt", context);
      assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", context); // can have an empty string as a meaningful value, so check non-nullish

      // Verify that the current password is correct
      const currentPasswordVerified = await this.masterPasswordUnlockService.proofOfDecryption(
        passwordInputResult.currentPassword,
        userId,
      );

      if (!currentPasswordVerified) {
        throw new InvalidCurrentPasswordError();
      }

      // Current password has been verified, so get the user key from state
      const userKey = await firstValueFromOrThrow(this.keyService.userKey$(userId), "userKey");

      // Use current password to make current auth data so we can send the current auth hash to the server
      const currentAuthenticationData =
        await this.masterPasswordService.makeMasterPasswordAuthenticationData(
          passwordInputResult.currentPassword,
          passwordInputResult.kdfConfig,
          passwordInputResult.salt,
        );

      // Use new password to make new auth and unlock data that we can send to the server
      const { newAuthenticationData, newUnlockData } = await this.makeNewAuthAndUnlockData(
        passwordInputResult.newPassword,
        passwordInputResult.kdfConfig,
        passwordInputResult.salt,
        userKey,
      );

      const request = PasswordRequest.newConstructor(
        currentAuthenticationData.masterPasswordAuthenticationHash,
        newAuthenticationData,
        newUnlockData,
        passwordInputResult.newPasswordHint,
      );

      await this.masterPasswordApiService.postPassword(request);

      return; // EARLY RETURN for flagged logic
    }

    const request = new PasswordRequest();

    const newMasterKeyEncryptedUserKey = await this.preparePasswordChange(
      passwordInputResult,
      userId,
      request,
    );

    request.key = newMasterKeyEncryptedUserKey[1].encryptedString as string;

    try {
      await this.masterPasswordApiService.postPassword(request);
    } catch {
      throw new Error("Could not change password");
    }
  }

  async changePasswordForAccountRecovery(passwordInputResult: PasswordInputResult, userId: UserId) {
    if (passwordInputResult.newApisWithInputPasswordFlagEnabled) {
      const context = "Could not change password for account recovery.";
      assertTruthy(passwordInputResult.currentPassword, "currentPassword", context);
      assertTruthy(passwordInputResult.newPassword, "newPassword", context);
      assertNonNullish(passwordInputResult.kdfConfig, "kdfConfig", context);
      assertTruthy(passwordInputResult.salt, "salt", context);
      assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", context); // can have an empty string as a meaningful value, so check non-nullish

      // Verify that the current password is correct
      const currentPasswordVerified = await this.masterPasswordUnlockService.proofOfDecryption(
        passwordInputResult.currentPassword,
        userId,
      );

      if (!currentPasswordVerified) {
        throw new InvalidCurrentPasswordError();
      }

      // Current password has been verified, so get the user key from state
      const userKey = await firstValueFromOrThrow(this.keyService.userKey$(userId), "userKey");

      // Use new password to make new auth and unlock data that we can send to the server
      const { newAuthenticationData, newUnlockData } = await this.makeNewAuthAndUnlockData(
        passwordInputResult.newPassword,
        passwordInputResult.kdfConfig,
        passwordInputResult.salt,
        userKey,
      );

      const request = UpdateTempPasswordRequest.newConstructorWithHint(
        newAuthenticationData,
        newUnlockData,
        passwordInputResult.newPasswordHint,
      );

      // TODO: PM-23047 will look to consolidate this into the change password endpoint.
      await this.masterPasswordApiService.putUpdateTempPassword(request);

      return; // EARLY RETURN for flagged logic
    }

    const request = new UpdateTempPasswordRequest();

    const newMasterKeyEncryptedUserKey = await this.preparePasswordChange(
      passwordInputResult,
      userId,
      request,
    );

    request.key = newMasterKeyEncryptedUserKey[1].encryptedString as string;

    try {
      // TODO: PM-23047 will look to consolidate this into the change password endpoint.
      await this.masterPasswordApiService.putUpdateTempPassword(request);
    } catch {
      throw new Error("Could not change password");
    }
  }

  private async makeNewAuthAndUnlockData(
    newPassword: string,
    kdfConfig: KdfConfig,
    salt: MasterPasswordSalt,
    userKey: UserKey,
  ): Promise<{
    newAuthenticationData: MasterPasswordAuthenticationData;
    newUnlockData: MasterPasswordUnlockData;
  }> {
    const newAuthenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        newPassword,
        kdfConfig,
        salt,
      );

    const newUnlockData = await this.masterPasswordService.makeMasterPasswordUnlockData(
      newPassword,
      kdfConfig,
      salt,
      userKey,
    );

    return { newAuthenticationData, newUnlockData };
  }

  /**
   * Don't navigate for most clients.
   *
   * For example, on web, routing to root would break org invite email acceptance flows for the change password
   * flow where a user is subject to MP policy requirements (i.e. has ForceSetPasswordReason.WeakMasterPassword).
   * This is because routing to root would call the redirectGuard, which routes to /vault (as the user is still
   * unlocked), which would clear the deepLinkRedirectUrl prematurely via deepLinkGuard. [Note: LogoutService
   * behavior and routing will be investigated in https://bitwarden.atlassian.net/browse/PM-32660]
   *
   * @returns false
   */
  shouldNavigateToRoot(): boolean {
    return false;
  }
}

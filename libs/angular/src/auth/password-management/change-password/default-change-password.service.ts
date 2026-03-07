import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
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
import { SyncService } from "@bitwarden/common/platform/sync";
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
    protected syncService: SyncService,
  ) {}

  async changePasswordAndRotateUserKey(
    passwordInputResult: PasswordInputResult,
    user: Account,
  ): Promise<void> {
    const context = "Could not change password and rotate user key.";
    assertTruthy(passwordInputResult.currentPassword, "currentPassword", context);
    assertTruthy(passwordInputResult.newPassword, "newPassword", context);
    assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", context); // can have an empty string as a meaningful value, so check non-nullish

    const currentPasswordVerified = await this.masterPasswordUnlockService.proofOfDecryption(
      passwordInputResult.currentPassword,
      user.id,
    );
    if (!currentPasswordVerified) {
      throw new InvalidCurrentPasswordError();
    }

    await this.syncService.fullSync(true);

    await this.rotateUserKeyMasterPasswordAndEncryptedData(
      passwordInputResult.currentPassword,
      passwordInputResult.newPassword,
      user,
      passwordInputResult.newPasswordHint,
    );
  }

  protected async rotateUserKeyMasterPasswordAndEncryptedData(
    currentPassword: string,
    newPassword: string,
    user: Account,
    newPasswordHint: string,
  ) {
    throw new Error("rotateUserKeyMasterPasswordAndEncryptedData() is only implemented in Web");
  }

  async rotateUserKeyMasterPasswordAndEncryptedDataOld(
    currentPassword: string,
    newPassword: string,
    user: Account,
    hint: string,
  ): Promise<void> {
    throw new Error("rotateUserKeyMasterPasswordAndEncryptedDataOld() is only implemented in Web");
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

      const userKey = await this.verifyCurrentPasswordAndGetUserKey(
        passwordInputResult.currentPassword,
        userId,
      );

      const currentAuthenticationData =
        await this.masterPasswordService.makeMasterPasswordAuthenticationData(
          passwordInputResult.currentPassword,
          passwordInputResult.kdfConfig,
          passwordInputResult.salt,
        );

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

      try {
        await this.masterPasswordApiService.postPassword(request);
      } catch {
        throw new Error("Error during change password attempt. Could not change password.");
      }

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

      const userKey = await this.verifyCurrentPasswordAndGetUserKey(
        passwordInputResult.currentPassword,
        userId,
      );

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

      try {
        // TODO: PM-23047 will look to consolidate this into the change password endpoint.
        await this.masterPasswordApiService.putUpdateTempPassword(request);
      } catch {
        throw new Error(
          "Error during change password attempt. Could not change password for account recovery.",
        );
      }

      // TODO: investigate removing this call to clear forceSetPasswordReason in https://bitwarden.atlassian.net/browse/PM-32660
      // Clear force set password reason to allow navigation back to vault.
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.None,
        userId,
      );

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

  /**
   * Verifies that the current password is correct via `proofOfDecryption` and then
   * returns the user key from state.
   *
   * @param currentPassword the entered current password
   * @param userId the active user's `userId`
   * @throws an `InvalidCurrentPasswordError` if `proofOfDecryption` fails (i.e. if the current password is incorrect)
   * @throws if the user key could not be retrieved from state
   * @returns the user key from state
   */
  private async verifyCurrentPasswordAndGetUserKey(currentPassword: string, userId: UserId) {
    const currentPasswordVerified = await this.masterPasswordUnlockService.proofOfDecryption(
      currentPassword,
      userId,
    );
    if (!currentPasswordVerified) {
      throw new InvalidCurrentPasswordError();
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (!userKey) {
      throw new Error("userKey not found. Could not change password.");
    }

    return userKey;
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
}

import { firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { ChangePasswordService } from "./change-password.service.abstraction";

export class DefaultChangePasswordService implements ChangePasswordService {
  constructor(
    protected keyService: KeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
  ) {}

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
      const ctx = "Could not change password.";
      assertTruthy(passwordInputResult.currentPassword, "currentPassword", ctx);
      assertNonNullish(passwordInputResult.kdfConfig, "kdfConfig", ctx);
      assertTruthy(passwordInputResult.salt, "salt", ctx);

      // We always update the hint along with a password change. This is because a new password
      // implies that the old hint is now outdated. So, if the user entered a new hint, we set that
      // as the new hint. If the user left the hint field blank, the field defaults to an empty string
      // which gets set as the new hint.
      assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", ctx); // can have an empty string as a meaningful value, so check non-nullish

      const currentAuthenticationData =
        await this.masterPasswordService.makeMasterPasswordAuthenticationData(
          passwordInputResult.currentPassword,
          passwordInputResult.kdfConfig,
          passwordInputResult.salt,
        );

      const { newAuthenticationData, newUnlockData } = await this.makeNewAuthAndUnlockData(
        passwordInputResult,
        userId,
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
      const ctx = "Could not change password.";
      assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", ctx); // can have an empty string as a meaningful value, so check non-nullish

      const { newAuthenticationData, newUnlockData } = await this.makeNewAuthAndUnlockData(
        passwordInputResult,
        userId,
      );
      const request = UpdateTempPasswordRequest.newConstructorWithHint(
        newAuthenticationData,
        newUnlockData,
        passwordInputResult.newPasswordHint,
      );

      try {
        await this.masterPasswordApiService.putUpdateTempPassword(request);
      } catch {
        throw new Error("Error during change password attempt. Could not change password.");
      }

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
    passwordInputResult: PasswordInputResult,
    userId: UserId,
  ): Promise<{
    newAuthenticationData: MasterPasswordAuthenticationData;
    newUnlockData: MasterPasswordUnlockData;
  }> {
    const ctx = "Could not change password.";
    assertTruthy(passwordInputResult.newPassword, "newPassword", ctx);
    assertTruthy(passwordInputResult.salt, "salt", ctx);
    assertNonNullish(passwordInputResult.kdfConfig, "kdfConfig", ctx);

    // We don't need to verify the currentPassword here because by this point it has already
    // been verified via proofOfDecryption before being emitted from the InputPasswordComponent.
    // We can simply get the user key from state and use it.
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (!userKey) {
      throw new Error("userKey not found. Could not change password.");
    }

    // Create new authentication data with the new password (includes a new masterPasswordAuthenticationHash)
    const newAuthenticationData =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        passwordInputResult.newPassword,
        passwordInputResult.kdfConfig,
        passwordInputResult.salt,
      );

    // Create new unlock data with the new password (includes a new masterKeyWrappedUserKey)
    const newUnlockData = await this.masterPasswordService.makeMasterPasswordUnlockData(
      passwordInputResult.newPassword,
      passwordInputResult.kdfConfig,
      passwordInputResult.salt,
      userKey,
    );

    return { newAuthenticationData, newUnlockData };
  }
}

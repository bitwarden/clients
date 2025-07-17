// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
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

  async changePassword(passwordInputResult: PasswordInputResult, userId: UserId | null) {
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
}

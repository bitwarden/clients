import { ChangePasswordService, PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

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
    userId: UserId,
  ): Promise<[UserKey, EncString]> {
    if (!userId) {
      throw new Error("userId not found");
    }
    if (!passwordInputResult.currentMasterKey || !passwordInputResult.currentServerMasterKeyHash) {
      throw new Error("currentMasterKey or currentServerMasterKeyHash not found");
    }

    const decryptedUserKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      passwordInputResult.currentMasterKey,
      userId,
    );

    if (decryptedUserKey == null) {
      throw new Error("Could not decrypt user key");
    }

    return await this.keyService.encryptUserKeyWithMasterKey(
      passwordInputResult.newMasterKey,
      decryptedUserKey,
    );
  }

  async changePassword(passwordInputResult: PasswordInputResult, userId: UserId) {
    const newMasterKeyEncryptedUserKey = await this.preparePasswordChange(
      passwordInputResult,
      userId,
    );

    const request = new PasswordRequest();
    request.masterPasswordHash = passwordInputResult.currentServerMasterKeyHash ?? "";
    request.newMasterPasswordHash = passwordInputResult.newServerMasterKeyHash;
    request.masterPasswordHint = passwordInputResult.newPasswordHint;
    request.key = newMasterKeyEncryptedUserKey[1].encryptedString as string;

    try {
      await this.masterPasswordApiService.postPassword(request);
    } catch {
      throw new Error("Could not change password");
    }
  }

  async changePasswordForAccountRecovery(passwordInputResult: PasswordInputResult, userId: UserId) {
    const newMasterKeyEncryptedUserKey = await this.preparePasswordChange(
      passwordInputResult,
      userId,
    );

    const request = new UpdateTempPasswordRequest();
    request.newMasterPasswordHash = passwordInputResult.newServerMasterKeyHash;
    request.masterPasswordHint = passwordInputResult.newPasswordHint;
    request.key = newMasterKeyEncryptedUserKey[1].encryptedString as string;

    try {
      await this.masterPasswordApiService.putUpdateTempPassword(request);
    } catch {
      throw new Error("Could not change password");
    }
  }
}

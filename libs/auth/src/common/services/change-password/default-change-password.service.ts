import { firstValueFrom } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MasterKey } from "@bitwarden/common/types/key";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { ChangePasswordService } from "../../abstractions";

export class DefaultChangePasswordService implements ChangePasswordService {
  constructor(
    private accountService: AccountService,
    private i18nService: I18nService,
    private keyService: KeyService,
    private masterPasswordApiService: MasterPasswordApiService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private toastService: ToastService,
  ) {}

  async rotateUserKeyMasterPasswordAndEncryptedData(
    currentPassword: string,
    newPassword: string,
    user: Account,
    hint: string,
  ): Promise<void | null> {
    return null; // implemented in Web
  }

  async rotateUserKeyAndEncryptedDataLegacy(
    newPassword: string,
    user: Account,
  ): Promise<void | null> {
    return null; // implemented in Web
  }

  async changePassword(
    currentMasterKey: MasterKey,
    currentServerMasterKeyHash: string,
    newPasswordHint: string,
    newMasterKey: MasterKey,
    newServerMasterKeyHash: string,
  ) {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

    const decryptedUserKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      currentMasterKey,
      userId,
    );

    if (decryptedUserKey == null) {
      throw new Error("Could not decrypt user key");
    }

    // TODO-rr-bw: do we still need this check/toast if it is handled in InputPasswordComponent?
    if (decryptedUserKey == null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("invalidMasterPassword"),
      });
      return;
    }

    const newMasterKeyEncryptedUserKey = await this.keyService.encryptUserKeyWithMasterKey(
      newMasterKey,
      decryptedUserKey,
    );

    const request = new PasswordRequest();
    request.masterPasswordHash = currentServerMasterKeyHash;
    request.masterPasswordHint = newPasswordHint;
    request.newMasterPasswordHash = newServerMasterKeyHash;
    request.key = newMasterKeyEncryptedUserKey[1].encryptedString;

    try {
      await this.masterPasswordApiService.postPassword(request);
    } catch (e) {
      throw new Error(e);
    }
  }
}

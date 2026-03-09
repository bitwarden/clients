import {
  ChangePasswordService,
  DefaultChangePasswordService,
  InvalidCurrentPasswordError,
} from "@bitwarden/angular/auth/password-management/change-password";
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { SyncService } from "@bitwarden/common/platform/sync";
import { KeyService } from "@bitwarden/key-management";
import { RouterService } from "@bitwarden/web-vault/app/core";
import { UserKeyRotationService } from "@bitwarden/web-vault/app/key-management/key-rotation/user-key-rotation.service";

export class WebChangePasswordService
  extends DefaultChangePasswordService
  implements ChangePasswordService
{
  constructor(
    protected keyService: KeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected masterPasswordUnlockService: MasterPasswordUnlockService,
    private syncService: SyncService,
    private userKeyRotationService: UserKeyRotationService,
    private routerService: RouterService,
  ) {
    super(keyService, masterPasswordApiService, masterPasswordService, masterPasswordUnlockService);
  }

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

    await this.userKeyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
      passwordInputResult.currentPassword,
      passwordInputResult.newPassword,
      user,
      passwordInputResult.newPasswordHint,
    );
  }

  /**
   * @deprecated To be removed in PM-28143
   */
  override async rotateUserKeyMasterPasswordAndEncryptedData(
    currentPassword: string,
    newPassword: string,
    user: Account,
    newPasswordHint: string,
  ): Promise<void> {
    await this.userKeyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
      currentPassword,
      newPassword,
      user,
      newPasswordHint,
    );
  }

  async clearDeeplinkState() {
    await this.routerService.getAndClearLoginRedirectUrl();
  }
}

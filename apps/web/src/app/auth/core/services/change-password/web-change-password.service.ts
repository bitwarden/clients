import {
  ChangePasswordService,
  DefaultChangePasswordService,
} from "@bitwarden/angular/auth/password-management/change-password";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
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
    private userKeyRotationService: UserKeyRotationService,
    private routerService: RouterService,
  ) {
    super(keyService, masterPasswordApiService, masterPasswordService);
  }

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

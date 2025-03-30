import { inject } from "@angular/core";

import { ChangePasswordService, DefaultChangePasswordService } from "@bitwarden/auth/common";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { UserKeyRotationService } from "@bitwarden/web-vault/app/key-management/key-rotation/user-key-rotation.service";

export class WebChangePasswordComponent
  extends DefaultChangePasswordService
  implements ChangePasswordService
{
  userKeyRotationService = inject(UserKeyRotationService);

  async rotateUserKeyMasterPasswordAndEncryptedData(
    currentPassword: string,
    newPassword: string,
    user: Account,
    hint: string,
  ): Promise<void | null> {
    await this.userKeyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
      currentPassword,
      newPassword,
      user,
      hint,
    );
  }
}

import { Account } from "@bitwarden/common/auth/abstractions/account.service";

import { ChangePasswordService } from "../../abstractions";

export class DefaultChangePasswordService implements ChangePasswordService {
  async rotateUserKeyMasterPasswordAndEncryptedData(
    currentPassword: string,
    newPassword: string,
    user: Account,
    hint: string,
  ): Promise<void | null> {
    return null;
  }
}

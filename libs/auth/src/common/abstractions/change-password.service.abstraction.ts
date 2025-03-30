import { Account } from "@bitwarden/common/auth/abstractions/account.service";

export abstract class ChangePasswordService {
  abstract rotateUserKeyMasterPasswordAndEncryptedData(
    currentPassword: string,
    newPassword: string,
    user: Account,
    hint: string,
  ): Promise<void | null>;

  abstract rotateUserKeyAndEncryptedDataLegacy(
    newPassword: string,
    user: Account,
  ): Promise<void | null>;
}

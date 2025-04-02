import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterKey } from "@bitwarden/common/types/key";

export abstract class ChangePasswordService {
  abstract rotateUserKeyMasterPasswordAndEncryptedData(
    currentPassword: string,
    newPassword: string,
    user: Account,
    newPasswordHint: string,
  ): Promise<void | null>;

  abstract rotateUserKeyAndEncryptedDataLegacy(
    newPassword: string,
    user: Account,
  ): Promise<void | null>;

  abstract changePassword(
    currentMasterKey: MasterKey,
    currentServerMasterKeyHash: string,
    newPasswordHint: string,
    newMasterKey: MasterKey,
    newServerMasterKeyHash: string,
  ): Promise<void>;
}

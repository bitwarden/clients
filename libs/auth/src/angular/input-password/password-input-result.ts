import { MasterPasswordSalt } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { MasterKey } from "@bitwarden/common/types/key";
import { KdfConfig } from "@bitwarden/key-management";

export interface PasswordInputResult {
  currentPassword?: string;
  newPassword: string;
  kdfConfig?: KdfConfig;
  salt?: MasterPasswordSalt;
  newPasswordHint?: string;
  rotateUserKey?: boolean;

  // The deprecated properties below will be removed in PM-28143: https://bitwarden.atlassian.net/browse/PM-28143

  /** @deprecated This low-level cryptographic state will be removed. It will be replaced by high level calls to masterpassword service, in the consumers of this interface. */
  currentMasterKey?: MasterKey;
  /** @deprecated */
  currentServerMasterKeyHash?: string;
  /** @deprecated */
  currentLocalMasterKeyHash?: string;

  /** @deprecated */
  newMasterKey?: MasterKey;
  /** @deprecated */
  newServerMasterKeyHash?: string;
  /** @deprecated */
  newLocalMasterKeyHash?: string;
}

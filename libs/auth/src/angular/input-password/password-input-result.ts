import { MasterKey } from "@bitwarden/common/types/key";
import { PBKDF2KdfConfig } from "@bitwarden/key-management";

export interface PasswordInputResult {
  newPassword: string;
  hint: string;
  kdfConfig: PBKDF2KdfConfig;
  masterKey: MasterKey;
  serverMasterKeyHash: string;
  localMasterKeyHash: string;
  currentPassword?: string;
  rotateUserKey?: boolean;
}

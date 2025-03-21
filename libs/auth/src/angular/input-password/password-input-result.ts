import { MasterKey } from "@bitwarden/common/types/key";
import { PBKDF2KdfConfig } from "@bitwarden/key-management";

export interface PasswordInputResult {
  newPassword: string;
  hint: string;
  kdfConfig: PBKDF2KdfConfig;
  masterKey: MasterKey;
  masterKeyHash: string;
  localMasterKeyHash: string;
  currentPassword?: string;
  rotateAccountEncryptionKey?: boolean;
}

import { MasterKey } from "@bitwarden/common/types/key";
import { PBKDF2KdfConfig } from "@bitwarden/key-management";

export interface PasswordInputResult {
  currentPassword?: string;
  newPassword: string;
  hint: string;
  rotateAccountEncryptionKey?: boolean;
  kdfConfig: PBKDF2KdfConfig;
  masterKey: MasterKey;
  masterKeyHash: string;
  localMasterKeyHash: string;
}

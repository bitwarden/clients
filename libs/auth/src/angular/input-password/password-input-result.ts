import { PBKDF2KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { MasterKey } from "@bitwarden/common/types/key";

export interface PasswordInputResult {
  masterKey: MasterKey;
  masterKeyHash: string;
  localMasterKeyHash: string;
  kdfConfig: PBKDF2KdfConfig;
  hint: string;
}

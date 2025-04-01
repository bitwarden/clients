import { MasterKey } from "@bitwarden/common/types/key";
import { KdfConfig } from "@bitwarden/key-management";

export interface PasswordInputResult {
  newPassword: string;
  hint: string;
  kdfConfig: KdfConfig;
  newMasterKey: MasterKey;
  serverMasterKeyHash: string;
  localMasterKeyHash: string;
  currentPassword?: string;
  rotateUserKey?: boolean;
}

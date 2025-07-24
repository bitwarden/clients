import { MasterKey } from "@bitwarden/common/types/key";
import { KdfConfig } from "@bitwarden/key-management";

export interface PasswordInputResult {
  currentPassword?: string;
  currentMasterKey?: MasterKey;
  currentServerMasterKeyHash?: string;
  currentLocalMasterKeyHash?: string;

  newPassword: string;
  newPasswordHint?: string;
  newMasterKey?: MasterKey;
  newServerMasterKeyHash?: string;
  newLocalMasterKeyHash?: string;

  kdfConfig?: KdfConfig;
  rotateUserKey?: boolean;
}

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

  /** @deprecated Transitional legacy field during master-key migration. */
  currentMasterKey?: MasterKey;
  /** @deprecated Transitional legacy field during master-key migration. */
  currentServerMasterKeyHash?: string;
  /** @deprecated Transitional legacy field during master-key migration. */
  newMasterKey?: MasterKey;
  /** @deprecated Transitional legacy field during master-key migration. */
  newServerMasterKeyHash?: string;
  /** @deprecated Transitional legacy field during master-key migration. */
  newLocalMasterKeyHash?: string;

  /**
   * Temporary property that persists the flag state through the entire set/change password process.
   * This allows flows to consume this value instead of re-checking the flag state via ConfigService themselves.
   *
   * The ChangePasswordDelegation flows (Emergency Access Takeover and Account Recovery), however, only ever
   * require a raw newPassword from the InputPasswordComponent regardless of whether the flag is on or off.
   * Flagging for those 2 flows will be done via the ConfigService in their respective services.
   *
   * To be removed in PM-28143
   */
  newApisWithInputPasswordFlagEnabled?: boolean;
}

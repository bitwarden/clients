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

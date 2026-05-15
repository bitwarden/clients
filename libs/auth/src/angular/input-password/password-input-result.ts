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
   * @deprecated Still required by the JIT_PROVISIONED_MP_ORG_USER flow in SetInitialPasswordComponent.
   * Will be removed when that flow is updated to use MasterPasswordAuthenticationData and
   * MasterPasswordUnlockData as part of https://bitwarden.atlassian.net/browse/PM-32526
   */
  newMasterKey?: MasterKey;
  /**
   * @deprecated Still required by the JIT_PROVISIONED_MP_ORG_USER flow in SetInitialPasswordComponent.
   * Will be removed when that flow is updated to use MasterPasswordAuthenticationData and
   * MasterPasswordUnlockData as part of https://bitwarden.atlassian.net/browse/PM-32526
   */
  newServerMasterKeyHash?: string;
}

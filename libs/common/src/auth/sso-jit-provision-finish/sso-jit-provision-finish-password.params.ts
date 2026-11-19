import { MasterPasswordSalt } from "../../key-management/master-password/types/master-password.types";
import { OrganizationId, UserId } from "../../types/guid";

export interface SsoJitProvisionFinishPasswordParams {
  userId: UserId;
  orgId: OrganizationId;
  /** The organization public key (B64). The SDK uses it to make the account recovery key. */
  orgPublicKey: string;
  orgSsoIdentifier: string;
  newPassword: string;
  newPasswordHint: string;
  salt: MasterPasswordSalt;
  /**
   * Whether the SDK enrolls the user in account recovery. The SDK skips enrollment when the
   * service does not accept the invite, because enrollment accepts the invite.
   */
  resetPasswordAutoEnroll: boolean;
}

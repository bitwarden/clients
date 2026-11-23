import { OrganizationId, UserId } from "../../types/guid";

export interface SsoJitProvisionFinishTrustedDeviceParams {
  userId: UserId;
  orgId: OrganizationId;
  /** The organization public key (B64). The SDK uses it to make the account recovery key. */
  orgPublicKey: string;
  /** The identifier of the current device. */
  deviceIdentifier: string;
  /** Whether the user chose to trust the current device. */
  trustDevice: boolean;
}

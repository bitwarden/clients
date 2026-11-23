import {
  JitMasterPasswordRegistrationResponse,
  KeyConnectorRegistrationResult,
  TdeRegistrationResponse,
} from "@bitwarden/sdk-internal";

import { OrganizationId } from "../../types/guid";

import { SsoJitProvisionFinishKeyConnectorParams } from "./sso-jit-provision-finish-key-connector.params";
import { SsoJitProvisionFinishPasswordParams } from "./sso-jit-provision-finish-password.params";
import { SsoJitProvisionFinishResult } from "./sso-jit-provision-finish-result.type";
import { SsoJitProvisionFinishTrustedDeviceParams } from "./sso-jit-provision-finish-trusted-device.params";

/**
 * Finishes SSO JIT provisioning for a new organization member through the SDK. Each finish
 * method covers one member decryption type.
 *
 * The service decides whether the server accepts the organization invite. See
 * {@link shouldAcceptOrganizationInvite}. The SDK makes the keys and chooses the server endpoint
 * from the `pm-34429-invite-link-auto-confirm` flag. The caller gets the organization data,
 * writes local state from the result, and unlocks.
 */
export abstract class SsoJitProvisionFinishService {
  /**
   * Decides whether the server moves the organization membership from Invited to Accepted.
   * - `false` when the `pm-34429-invite-link-auto-confirm` flag is on and the stored open invite
   *   is for `orgId`. The membership stays Invited, so the Admin Console checks run when the open
   *   invite link is replayed.
   * - `true` in all other cases. An open invite for a different organization does not apply.
   *   When the flag is off, the SDK uses the legacy endpoints, which always accept.
   *
   * The finish methods call this method. Call it directly only for the V1 Key Connector path,
   * which posts through `SsoJitProvisionFinishApiService`.
   *
   * TODO: Remove from the public API with https://bitwarden.atlassian.net/browse/PM-27328 (V1 Key
   * Connector registration).
   *
   * @param orgId The organization that provisions the user.
   */
  abstract shouldAcceptOrganizationInvite(orgId: OrganizationId): Promise<boolean>;

  /**
   * Makes the account keys for a master password user, and sends them with the new master
   * password to the server. When the invite is accepted and `resetPasswordAutoEnroll` is `true`,
   * the SDK also enrolls the user in account recovery.
   *
   * This method does not write local state. The caller writes local state from the result.
   */
  abstract finishPassword(
    params: SsoJitProvisionFinishPasswordParams,
  ): Promise<SsoJitProvisionFinishResult<JitMasterPasswordRegistrationResponse>>;

  /**
   * Makes the account keys for a trusted device encryption user, and sends them to the server.
   * When the invite is accepted, the SDK also enrolls the user in account recovery.
   *
   * This method does not write local state or store the device key. The caller does that from
   * the result.
   */
  abstract finishTrustedDevice(
    params: SsoJitProvisionFinishTrustedDeviceParams,
  ): Promise<SsoJitProvisionFinishResult<TdeRegistrationResponse>>;

  /**
   * Makes the account keys for a Key Connector user, posts the Key Connector key to the Key
   * Connector server, and sends the account keys to the server.
   *
   * This method does not write local state. The caller writes local state from the result.
   */
  abstract finishKeyConnector(
    params: SsoJitProvisionFinishKeyConnectorParams,
  ): Promise<SsoJitProvisionFinishResult<KeyConnectorRegistrationResult>>;
}

import { KeysRequest } from "../../models/request/keys.request";
import { TrustedDeviceKeysRequest } from "../services/devices/requests/trusted-device-keys.request";

/**
 * Request for `POST /sso-jit-provision-finish/trusted-device`. Finishes SSO JIT provisioning for a
 * user in an organization that uses trusted device encryption. Combines the bodies of
 * `POST /accounts/keys`, `PUT /organizations/{orgId}/users/{userId}/reset-password-enrollment`, and
 * `PUT /devices/{identifier}/keys`. The server reads the device from the access token.
 *
 * TODO: Remove with https://bitwarden.atlassian.net/browse/PM-27329 (V1 TDE registration).
 */
export class SsoJitProvisionFinishTrustedDeviceRequest {
  /**
   * @param keys The account keys of the new user.
   * @param organizationId The organization that the user joins.
   * @param acceptOrganizationInvite `true` moves the membership to Accepted and enrolls the user in
   *   account recovery. `false` leaves the membership Invited (open invite links).
   * @param accountRecoveryKey The user key encapsulated with the organization public key. Required
   *   when `acceptOrganizationInvite` is `true`. The server ignores it otherwise.
   * @param deviceKeys The keys that trust the current device. Omit when the user does not trust
   *   the device.
   */
  constructor(
    readonly keys: KeysRequest,
    readonly organizationId: string,
    readonly acceptOrganizationInvite: boolean,
    readonly accountRecoveryKey?: string,
    readonly deviceKeys?: TrustedDeviceKeysRequest,
  ) {}
}

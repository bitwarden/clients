import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "../../../key-management/master-password/types/master-password.types";
import { KeysRequest } from "../../../models/request/keys.request";

/**
 * Request for `POST /sso-jit-provision-finish/password`. Finishes SSO JIT provisioning for a user
 * in an organization that uses master password decryption.
 *
 * `acceptOrganizationInvite` controls whether the server moves the organization membership from
 * Invited to Accepted.
 */
export class SsoJitProvisionFinishPasswordRequest {
  constructor(
    readonly masterPasswordAuthentication: MasterPasswordAuthenticationData,
    readonly masterPasswordUnlock: MasterPasswordUnlockData,
    readonly masterPasswordHint: string,
    readonly orgIdentifier: string,
    readonly keys: KeysRequest,
    readonly acceptOrganizationInvite: boolean,
  ) {}
}

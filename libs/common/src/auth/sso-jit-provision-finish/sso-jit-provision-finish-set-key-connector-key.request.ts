import { SetKeyConnectorKeyRequest } from "../../key-management/key-connector/models/set-key-connector-key.request";

/**
 * Request for `POST /sso-jit-provision-finish/key-connector`. Finishes SSO JIT provisioning for a
 * user in an organization that uses Key Connector decryption. Wraps the
 * {@link SetKeyConnectorKeyRequest} body of `POST /accounts/set-key-connector-key`.
 *
 * `acceptOrganizationInvite` controls whether the server moves the organization membership from
 * Invited to Accepted.
 */
export class SsoJitProvisionFinishSetKeyConnectorKeyRequest {
  constructor(
    readonly keyConnectorKeys: SetKeyConnectorKeyRequest,
    readonly acceptOrganizationInvite: boolean,
  ) {}
}

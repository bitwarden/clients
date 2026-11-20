import { ApiService } from "../../abstractions/api.service";
import { LogService } from "../../platform/abstractions/log.service";

import { SsoJitProvisionFinishSetKeyConnectorKeyRequest } from "./sso-jit-provision-finish-set-key-connector-key.request";

/**
 * Sends the client-made keys that finish SSO JIT provisioning for a V1 encryption Key Connector
 * user. Master password and trusted device users register through the SDK, so they do not use
 * this service.
 *
 * TODO: Remove this class with https://bitwarden.atlassian.net/browse/PM-27328 (V1 Key Connector
 * registration).
 */
export class SsoJitProvisionFinishApiService {
  constructor(
    private apiService: ApiService,
    private logService: LogService,
  ) {}

  /**
   * POSTs the request to `/sso-jit-provision-finish/key-connector`. The server uses
   * `acceptOrganizationInvite`. The caller posts the Key Connector key to the Key Connector server
   * before this call.
   */
  async postKeyConnector(request: SsoJitProvisionFinishSetKeyConnectorKeyRequest): Promise<void> {
    try {
      await this.apiService.send(
        "POST",
        "/sso-jit-provision-finish/key-connector",
        request,
        true,
        false,
      );
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }
}

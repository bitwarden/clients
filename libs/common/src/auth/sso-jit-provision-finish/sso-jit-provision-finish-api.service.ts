import { ApiService } from "../../abstractions/api.service";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { LogService } from "../../platform/abstractions/log.service";
import { SetPasswordRequest } from "../models/request/set-password.request";

import { SsoJitProvisionFinishPasswordRequest } from "./sso-jit-provision-finish-password.request";

/**
 * Sends the client-made keys that finish SSO JIT provisioning for a V1 encryption user. Each
 * method covers one member decryption type. Can be removed when we move to v2 encryption.
 */
export class SsoJitProvisionFinishApiService {
  constructor(
    private apiService: ApiService,
    private configService: ConfigService,
    private logService: LogService,
  ) {}

  /**
   * Finishes SSO JIT master password provisioning.
   * - `pm-34429-invite-link-auto-confirm` on: POSTs the request to
   *   `/sso-jit-provision-finish/password`. The server uses `acceptOrganizationInvite`.
   * - Flag off: converts the request to the legacy shape and POSTs it to `/accounts/set-password`.
   *   The server always accepts the organization invite.
   */
  async postPassword(request: SsoJitProvisionFinishPasswordRequest): Promise<void> {
    const inviteLinkAutoConfirm = await this.configService.getFeatureFlag(
      FeatureFlag.InviteLinkAutoConfirm,
    );

    try {
      if (inviteLinkAutoConfirm) {
        await this.apiService.send(
          "POST",
          "/sso-jit-provision-finish/password",
          request,
          true,
          false,
        );
        return;
      }

      // TODO PM-34429: Remove this legacy path when the pm-34429-invite-link-auto-confirm flag is removed.
      const legacyRequest = SetPasswordRequest.newConstructor(
        request.masterPasswordAuthentication,
        request.masterPasswordUnlock,
        request.masterPasswordHint,
        request.orgIdentifier,
        request.keys,
      );
      await this.apiService.send("POST", "/accounts/set-password", legacyRequest, true, false);
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }
}

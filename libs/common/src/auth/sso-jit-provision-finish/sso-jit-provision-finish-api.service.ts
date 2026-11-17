import { ApiService } from "../../abstractions/api.service";
import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { LogService } from "../../platform/abstractions/log.service";
import { UserId } from "../../types/guid";
import { SetPasswordRequest } from "../models/request/set-password.request";
import { assertNonNullish } from "../utils";

import { SsoJitProvisionFinishPasswordRequest } from "./sso-jit-provision-finish-password.request";
import { SsoJitProvisionFinishSetKeyConnectorKeyRequest } from "./sso-jit-provision-finish-set-key-connector-key.request";
import { SsoJitProvisionFinishTrustedDeviceRequest } from "./sso-jit-provision-finish-trusted-device.request";

/**
 * Data that only the legacy trusted device requests use. The new endpoint reads the user and the
 * device from the access token.
 *
 * TODO PM-34429: Remove when the pm-34429-invite-link-auto-confirm flag is removed.
 */
export interface SsoJitProvisionFinishTrustedDeviceLegacyContext {
  userId: UserId;
  deviceIdentifier: string;
}

/**
 * Sends the client-made keys that finish SSO JIT provisioning for a V1 encryption user. Each
 * method covers one member decryption type. Can be removed when we move to v2 encryption.
 *
 * Each method reads the `pm-34429-invite-link-auto-confirm` flag. When the flag is on, the method
 * posts to the `/sso-jit-provision-finish/*` endpoint, and the server uses
 * `acceptOrganizationInvite`. When the flag is off, the method sends the legacy request(s), and
 * the server always accepts the organization invite.
 */
export class SsoJitProvisionFinishApiService {
  constructor(
    private apiService: ApiService,
    private configService: ConfigService,
    private logService: LogService,
  ) {}

  /**
   * Finishes SSO JIT master password provisioning.
   * - Flag on: POSTs the request to `/sso-jit-provision-finish/password`.
   * - Flag off: converts the request to the legacy shape and POSTs it to `/accounts/set-password`.
   */
  async postPassword(request: SsoJitProvisionFinishPasswordRequest): Promise<void> {
    await this.sendWithInviteLinkAutoConfirm(
      () =>
        this.apiService.send("POST", "/sso-jit-provision-finish/password", request, true, false),
      () => {
        const legacyRequest = SetPasswordRequest.newConstructor(
          request.masterPasswordAuthentication,
          request.masterPasswordUnlock,
          request.masterPasswordHint,
          request.orgIdentifier,
          request.keys,
        );
        return this.apiService.send("POST", "/accounts/set-password", legacyRequest, true, false);
      },
    );
  }

  /**
   * Finishes SSO JIT Key Connector provisioning. The caller posts the Key Connector key to the Key
   * Connector server before this call.
   * - Flag on: POSTs the request to `/sso-jit-provision-finish/key-connector`.
   * - Flag off: POSTs `request.keyConnectorKeys` to `/accounts/set-key-connector-key`.
   */
  async postKeyConnector(request: SsoJitProvisionFinishSetKeyConnectorKeyRequest): Promise<void> {
    await this.sendWithInviteLinkAutoConfirm(
      () =>
        this.apiService.send(
          "POST",
          "/sso-jit-provision-finish/key-connector",
          request,
          true,
          false,
        ),
      () =>
        this.apiService.send(
          "POST",
          "/accounts/set-key-connector-key",
          request.keyConnectorKeys,
          true,
          false,
        ),
    );
  }

  /**
   * Finishes SSO JIT trusted device provisioning.
   * - Flag on: POSTs the request to `/sso-jit-provision-finish/trusted-device`.
   * - Flag off: sends the legacy requests in this order, and stops at the first failure:
   *   1. `POST /accounts/keys`
   *   2. `PUT /organizations/{orgId}/users/{userId}/reset-password-enrollment`
   *   3. `PUT /devices/{deviceIdentifier}/keys`, only when `request.deviceKeys` is set
   *
   *   The legacy requests always enroll the user in account recovery, so they require
   *   `request.accountRecoveryKey`. This method checks it before it sends any request.
   */
  async postTrustedDevice(
    request: SsoJitProvisionFinishTrustedDeviceRequest,
    legacy: SsoJitProvisionFinishTrustedDeviceLegacyContext,
  ): Promise<void> {
    await this.sendWithInviteLinkAutoConfirm(
      () =>
        this.apiService.send(
          "POST",
          "/sso-jit-provision-finish/trusted-device",
          request,
          true,
          false,
        ),
      async () => {
        const accountRecoveryKey = request.accountRecoveryKey;
        assertNonNullish(
          accountRecoveryKey,
          "accountRecoveryKey",
          "The legacy trusted device requests always enroll the user in account recovery. Could not finish SSO JIT provisioning.",
        );

        await this.apiService.send("POST", "/accounts/keys", request.keys, true, false);
        await this.apiService.send(
          "PUT",
          `/organizations/${request.organizationId}/users/${legacy.userId}/reset-password-enrollment`,
          { resetPasswordKey: accountRecoveryKey },
          true,
          false,
        );
        if (request.deviceKeys != null) {
          await this.apiService.send(
            "PUT",
            `/devices/${legacy.deviceIdentifier}/keys`,
            request.deviceKeys,
            true,
            true,
          );
        }
      },
    );
  }

  /**
   * Runs `send` when the `pm-34429-invite-link-auto-confirm` flag is on, else `sendLegacy`. Logs
   * and rethrows any error.
   */
  private async sendWithInviteLinkAutoConfirm(
    send: () => Promise<unknown>,
    // TODO PM-34429: Remove the legacy path when the pm-34429-invite-link-auto-confirm flag is removed.
    sendLegacy: () => Promise<unknown>,
  ): Promise<void> {
    const inviteLinkAutoConfirm = await this.configService.getFeatureFlag(
      FeatureFlag.InviteLinkAutoConfirm,
    );

    try {
      await (inviteLinkAutoConfirm ? send() : sendLegacy());
    } catch (e: unknown) {
      this.logService.error(e);
      throw e;
    }
  }
}

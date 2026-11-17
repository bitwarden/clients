import { concatMap, firstValueFrom } from "rxjs";

import {
  JitMasterPasswordRegistrationResponse,
  KeyConnectorRegistrationResult,
  OrganizationId as SdkOrganizationId,
  RegistrationClient,
  UserId as SdkUserId,
} from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { RegisterSdkService } from "../../platform/abstractions/sdk/register-sdk.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { assertNonNullish } from "../utils";

import { SsoJitProvisionFinishApiService } from "./sso-jit-provision-finish-api.service";
import { SsoJitProvisionFinishPasswordRequest } from "./sso-jit-provision-finish-password.request";
import { SsoJitProvisionFinishSetKeyConnectorKeyRequest } from "./sso-jit-provision-finish-set-key-connector-key.request";
import {
  SsoJitProvisionFinishKeyConnectorData,
  SsoJitProvisionFinishKeyConnectorResult,
  SsoJitProvisionFinishPasswordData,
  SsoJitProvisionFinishPasswordResult,
  SsoJitProvisionFinishService,
} from "./sso-jit-provision-finish.service";

const ERROR_CONTEXT = "Could not finish SSO JIT provisioning.";

export class DefaultSsoJitProvisionFinishService implements SsoJitProvisionFinishService {
  constructor(
    private ssoJitProvisionFinishApiService: SsoJitProvisionFinishApiService,
    private registerSdkService: RegisterSdkService,
    private configService: ConfigService,
  ) {}

  async finishPassword(
    data: SsoJitProvisionFinishPasswordData,
  ): Promise<SsoJitProvisionFinishPasswordResult> {
    if (await this.isV2(FeatureFlag.EnableAccountEncryptionV2JitPasswordRegistration, data)) {
      return { encryptionVersion: "V2", registration: await this.finishPasswordV2(data) };
    }

    await this.finishPasswordV1(data);
    return { encryptionVersion: "V1" };
  }

  async finishKeyConnector(
    data: SsoJitProvisionFinishKeyConnectorData,
  ): Promise<SsoJitProvisionFinishKeyConnectorResult> {
    if (await this.isV2(FeatureFlag.EnableAccountEncryptionV2KeyConnectorRegistration, data)) {
      return { encryptionVersion: "V2", registration: await this.finishKeyConnectorV2(data) };
    }

    await this.finishKeyConnectorV1(data);
    return { encryptionVersion: "V1" };
  }

  /**
   * Reads the V2 encryption flag for one decryption type.
   *
   * The caller read the same flag earlier, and did V1 work if it was off. When the flag is on but
   * the caller sent V1 keys, this method throws before any network call. Then the server does not
   * get V2 keys while the client holds V1 keys.
   */
  private async isV2(
    flag:
      | FeatureFlag.EnableAccountEncryptionV2JitPasswordRegistration
      | FeatureFlag.EnableAccountEncryptionV2KeyConnectorRegistration,
    data: { v1Keys?: unknown },
  ): Promise<boolean> {
    const v2 = await this.configService.getFeatureFlag(flag);
    if (v2 && data.v1Keys != null) {
      throw new Error(`v1Keys must not be set when V2 encryption is on. ${ERROR_CONTEXT}`);
    }
    return v2;
  }

  /**
   * Takes the SDK registration client for the user, and runs one registration call with it.
   */
  private async withRegistrationClient<T>(
    userId: UserId,
    register: (registrationClient: RegistrationClient) => Promise<T>,
  ): Promise<T> {
    return await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          return await register(ref.value.auth().registration());
        }),
      ),
    );
  }

  private async finishPasswordV1(data: SsoJitProvisionFinishPasswordData): Promise<void> {
    assertNonNullish(data.v1Keys, "v1Keys", ERROR_CONTEXT);

    const request = new SsoJitProvisionFinishPasswordRequest(
      data.v1Keys.masterPasswordAuthentication,
      data.v1Keys.masterPasswordUnlock,
      data.newPasswordHint,
      data.orgSsoIdentifier,
      data.v1Keys.keys,
      // Matches the SDK, which accepts the invite when no value is given.
      data.acceptOrganizationInvite ?? true,
    );

    await this.ssoJitProvisionFinishApiService.postPassword(request);
  }

  /**
   * The SDK chooses the endpoint from the `pm-34429-invite-link-auto-confirm` flag. When the
   * invite is accepted and `resetPasswordAutoEnroll` is true, the SDK also enrolls the user in
   * account recovery.
   */
  private async finishPasswordV2(
    data: SsoJitProvisionFinishPasswordData,
  ): Promise<JitMasterPasswordRegistrationResponse> {
    const orgPublicKey = data.orgPublicKey;
    assertNonNullish(orgPublicKey, "orgPublicKey", ERROR_CONTEXT);

    return await this.withRegistrationClient(data.userId, (registrationClient) =>
      registrationClient.post_keys_for_jit_password_registration({
        org_id: asUuid<SdkOrganizationId>(data.orgId),
        org_public_key: orgPublicKey,
        master_password: data.newPassword,
        master_password_hint: data.newPasswordHint,
        salt: data.salt,
        organization_sso_identifier: data.orgSsoIdentifier,
        user_id: asUuid<SdkUserId>(data.userId),
        reset_password_enroll: data.resetPasswordAutoEnroll,
        accept_organization_invite: data.acceptOrganizationInvite,
      }),
    );
  }

  private async finishKeyConnectorV1(data: SsoJitProvisionFinishKeyConnectorData): Promise<void> {
    assertNonNullish(data.v1Keys, "v1Keys", ERROR_CONTEXT);

    const request = new SsoJitProvisionFinishSetKeyConnectorKeyRequest(
      data.v1Keys.keyConnectorKeys,
      // Matches the SDK, which accepts the invite when no value is given.
      data.acceptOrganizationInvite ?? true,
    );

    await this.ssoJitProvisionFinishApiService.postKeyConnector(request);
  }

  /**
   * The SDK posts the Key Connector key to the Key Connector server, and then chooses the server
   * endpoint from the `pm-34429-invite-link-auto-confirm` flag.
   */
  private async finishKeyConnectorV2(
    data: SsoJitProvisionFinishKeyConnectorData,
  ): Promise<KeyConnectorRegistrationResult> {
    return await this.withRegistrationClient(data.userId, (registrationClient) =>
      registrationClient.post_keys_for_key_connector_registration(
        data.keyConnectorUrl,
        data.orgSsoIdentifier,
        data.acceptOrganizationInvite,
      ),
    );
  }
}

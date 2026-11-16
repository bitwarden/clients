import { concatMap, firstValueFrom } from "rxjs";

import {
  JitMasterPasswordRegistrationResponse,
  OrganizationId as SdkOrganizationId,
  UserId as SdkUserId,
} from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { RegisterSdkService } from "../../platform/abstractions/sdk/register-sdk.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { assertNonNullish } from "../utils";

import { SsoJitProvisionFinishApiService } from "./sso-jit-provision-finish-api.service";
import { SsoJitProvisionFinishPasswordRequest } from "./sso-jit-provision-finish-password.request";
import {
  SsoJitProvisionFinishPasswordData,
  SsoJitProvisionFinishPasswordResult,
  SsoJitProvisionFinishService,
} from "./sso-jit-provision-finish.service";

export class DefaultSsoJitProvisionFinishService implements SsoJitProvisionFinishService {
  constructor(
    private ssoJitProvisionFinishApiService: SsoJitProvisionFinishApiService,
    private registerSdkService: RegisterSdkService,
    private configService: ConfigService,
  ) {}

  async finishPassword(
    data: SsoJitProvisionFinishPasswordData,
  ): Promise<SsoJitProvisionFinishPasswordResult> {
    const accountEncryptionV2 = await this.configService.getFeatureFlag(
      FeatureFlag.EnableAccountEncryptionV2JitPasswordRegistration,
    );

    if (accountEncryptionV2) {
      // The caller read the same flag earlier and did V1 work if it was off. Stop before any
      // network call, so the server does not get V2 keys while the client holds V1 keys.
      if (data.v1Keys != null) {
        throw new Error(
          "v1Keys must not be set when V2 encryption is on. Could not finish SSO JIT provisioning.",
        );
      }
      const registration = await this.finishPasswordV2(data);
      return { encryptionVersion: "V2", registration };
    }

    await this.finishPasswordV1(data);
    return { encryptionVersion: "V1" };
  }

  private async finishPasswordV1(data: SsoJitProvisionFinishPasswordData): Promise<void> {
    assertNonNullish(data.v1Keys, "v1Keys", "Could not finish SSO JIT provisioning.");

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
    assertNonNullish(orgPublicKey, "orgPublicKey", "Could not finish SSO JIT provisioning.");

    return await firstValueFrom(
      this.registerSdkService.registerClient$(data.userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          return await ref.value
            .auth()
            .registration()
            .post_keys_for_jit_password_registration({
              org_id: asUuid<SdkOrganizationId>(data.orgId),
              org_public_key: orgPublicKey,
              master_password: data.newPassword,
              master_password_hint: data.newPasswordHint,
              salt: data.salt,
              organization_sso_identifier: data.orgSsoIdentifier,
              user_id: asUuid<SdkUserId>(data.userId),
              reset_password_enroll: data.resetPasswordAutoEnroll,
              accept_organization_invite: data.acceptOrganizationInvite,
            });
        }),
      ),
    );
  }
}

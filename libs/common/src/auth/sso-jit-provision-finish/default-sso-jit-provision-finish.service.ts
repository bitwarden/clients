import { concatMap, firstValueFrom } from "rxjs";

import {
  JitMasterPasswordRegistrationResponse,
  KeyConnectorRegistrationResult,
  OrganizationId as SdkOrganizationId,
  RegistrationClient,
  TdeRegistrationResponse,
  UserId as SdkUserId,
} from "@bitwarden/sdk-internal";

import { RegisterSdkService } from "../../platform/abstractions/sdk/register-sdk.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";

import {
  SsoJitProvisionFinishKeyConnectorParams,
  SsoJitProvisionFinishPasswordParams,
  SsoJitProvisionFinishService,
  SsoJitProvisionFinishTrustedDeviceParams,
} from "./sso-jit-provision-finish.service";

export class DefaultSsoJitProvisionFinishService implements SsoJitProvisionFinishService {
  constructor(private registerSdkService: RegisterSdkService) {}

  async finishPassword(
    params: SsoJitProvisionFinishPasswordParams,
  ): Promise<JitMasterPasswordRegistrationResponse> {
    return await this.withRegistrationClient(params.userId, (registrationClient) =>
      registrationClient.post_keys_for_jit_password_registration({
        org_id: asUuid<SdkOrganizationId>(params.orgId),
        org_public_key: params.orgPublicKey,
        master_password: params.newPassword,
        master_password_hint: params.newPasswordHint,
        salt: params.salt,
        organization_sso_identifier: params.orgSsoIdentifier,
        user_id: asUuid<SdkUserId>(params.userId),
        reset_password_enroll: params.resetPasswordAutoEnroll,
        accept_organization_invite: params.acceptOrganizationInvite,
      }),
    );
  }

  async finishTrustedDevice(
    params: SsoJitProvisionFinishTrustedDeviceParams,
  ): Promise<TdeRegistrationResponse> {
    return await this.withRegistrationClient(params.userId, (registrationClient) =>
      registrationClient.post_keys_for_tde_registration({
        org_id: asUuid<SdkOrganizationId>(params.orgId),
        org_public_key: params.orgPublicKey,
        user_id: asUuid<SdkUserId>(params.userId),
        device_identifier: params.deviceIdentifier,
        trust_device: params.trustDevice,
        accept_organization_invite: params.acceptOrganizationInvite,
      }),
    );
  }

  async finishKeyConnector(
    params: SsoJitProvisionFinishKeyConnectorParams,
  ): Promise<KeyConnectorRegistrationResult> {
    return await this.withRegistrationClient(params.userId, (registrationClient) =>
      registrationClient.post_keys_for_key_connector_registration(
        params.keyConnectorUrl,
        params.orgSsoIdentifier,
        params.acceptOrganizationInvite,
      ),
    );
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
}

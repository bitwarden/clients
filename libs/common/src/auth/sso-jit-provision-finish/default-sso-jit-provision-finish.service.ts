import { concatMap, firstValueFrom } from "rxjs";

import {
  JitMasterPasswordRegistrationResponse,
  KeyConnectorRegistrationResult,
  OrganizationId as SdkOrganizationId,
  RegistrationClient,
  TdeRegistrationResponse,
  UserId as SdkUserId,
} from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { RegisterSdkService } from "../../platform/abstractions/sdk/register-sdk.service";
import { asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { GlobalStateProvider } from "../../platform/state";
import { OrganizationId, UserId } from "../../types/guid";
import { OPEN_ORGANIZATION_INVITE } from "../organization-invite/services/implementations/organization-invite.state";

import { SsoJitProvisionFinishKeyConnectorParams } from "./sso-jit-provision-finish-key-connector.params";
import { SsoJitProvisionFinishPasswordParams } from "./sso-jit-provision-finish-password.params";
import { SsoJitProvisionFinishResult } from "./sso-jit-provision-finish-result.type";
import { SsoJitProvisionFinishTrustedDeviceParams } from "./sso-jit-provision-finish-trusted-device.params";
import { SsoJitProvisionFinishService } from "./sso-jit-provision-finish.service";

export class DefaultSsoJitProvisionFinishService implements SsoJitProvisionFinishService {
  constructor(
    private registerSdkService: RegisterSdkService,
    private configService: ConfigService,
    /**
     * Reads the stored open invite. This service does not use `OrganizationInviteService` for
     * this read. On web, that service depends on `OrganizationApiService` → `SyncService` →
     * `KeyConnectorService` → this service, which is a construction cycle.
     *
     * TODO: Reassess a read-only organization invite state service that owns this read, so
     * this service does not need to know the invite state key.
     */
    private globalStateProvider: GlobalStateProvider,
  ) {}

  async shouldAcceptOrganizationInvite(orgId: OrganizationId): Promise<boolean> {
    const inviteLinkAutoConfirm = await this.configService.getFeatureFlag(
      FeatureFlag.InviteLinkAutoConfirm,
    );
    if (!inviteLinkAutoConfirm) {
      return true;
    }

    const openOrgInvite = await firstValueFrom(
      this.globalStateProvider.get(OPEN_ORGANIZATION_INVITE).state$,
    );
    if (openOrgInvite == null) {
      return true;
    }

    // An open invite for a different organization does not apply to this provisioning.
    return !openOrgInvite.isForOrganization(orgId);
  }

  async finishPassword(
    params: SsoJitProvisionFinishPasswordParams,
  ): Promise<SsoJitProvisionFinishResult<JitMasterPasswordRegistrationResponse>> {
    return await this.finish(
      params.userId,
      params.orgId,
      (registrationClient, acceptOrganizationInvite) =>
        registrationClient.post_keys_for_jit_password_registration({
          org_id: asUuid<SdkOrganizationId>(params.orgId),
          org_public_key: params.orgPublicKey,
          master_password: params.newPassword,
          master_password_hint: params.newPasswordHint,
          salt: params.salt,
          organization_sso_identifier: params.orgSsoIdentifier,
          user_id: asUuid<SdkUserId>(params.userId),
          reset_password_enroll: params.resetPasswordAutoEnroll,
          accept_organization_invite: acceptOrganizationInvite,
        }),
    );
  }

  async finishTrustedDevice(
    params: SsoJitProvisionFinishTrustedDeviceParams,
  ): Promise<SsoJitProvisionFinishResult<TdeRegistrationResponse>> {
    return await this.finish(
      params.userId,
      params.orgId,
      (registrationClient, acceptOrganizationInvite) =>
        registrationClient.post_keys_for_tde_registration({
          org_id: asUuid<SdkOrganizationId>(params.orgId),
          org_public_key: params.orgPublicKey,
          user_id: asUuid<SdkUserId>(params.userId),
          device_identifier: params.deviceIdentifier,
          trust_device: params.trustDevice,
          accept_organization_invite: acceptOrganizationInvite,
        }),
    );
  }

  async finishKeyConnector(
    params: SsoJitProvisionFinishKeyConnectorParams,
  ): Promise<SsoJitProvisionFinishResult<KeyConnectorRegistrationResult>> {
    return await this.finish(
      params.userId,
      params.orgId,
      (registrationClient, acceptOrganizationInvite) =>
        registrationClient.post_keys_for_key_connector_registration(
          params.keyConnectorUrl,
          params.orgSsoIdentifier,
          acceptOrganizationInvite,
        ),
    );
  }

  /**
   * Decides whether the server accepts the invite to the organization, then runs one registration
   * call with the SDK registration client for the user.
   */
  private async finish<T>(
    userId: UserId,
    orgId: OrganizationId,
    register: (
      registrationClient: RegistrationClient,
      acceptOrganizationInvite: boolean,
    ) => Promise<T>,
  ): Promise<SsoJitProvisionFinishResult<T>> {
    const organizationInviteAccepted = await this.shouldAcceptOrganizationInvite(orgId);

    const registration = await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          return await register(ref.value.auth().registration(), organizationInviteAccepted);
        }),
      ),
    );

    return { registration, organizationInviteAccepted };
  }
}

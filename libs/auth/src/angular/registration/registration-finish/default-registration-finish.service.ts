// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import {
  OrganizationId as SdkOrganizationId,
  UserId as SdkUserId,
  UserMasterPasswordRegistrationRequest,
} from "@bitwarden/sdk-internal";

import { PasswordInputResult } from "../../input-password/password-input-result";

import { RegistrationFinishService } from "./registration-finish.service";

export class DefaultRegistrationFinishService implements RegistrationFinishService {
  constructor(protected sdkService: SdkService) {}

  async finishRegistration(
    email: string,
    passwordInputResult: PasswordInputResult,
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string,
    acceptEmergencyAccessInviteToken?: string,
    emergencyAccessId?: string,
    providerInviteToken?: string,
    providerUserId?: string,
    salesAssistedToken?: string,
  ): Promise<void> {
    const ctx = "Could not finish registration.";
    assertTruthy(passwordInputResult.newPassword, "newPassword", ctx);
    assertNonNullish(passwordInputResult.kdfConfig, "kdfConfig", ctx);
    assertTruthy(passwordInputResult.salt, "salt", ctx);

    const sdkClient = await firstValueFrom(this.sdkService.client$);
    if (!sdkClient) {
      throw new Error("SDK not available");
    }

    const registerRequest = await this.buildSdkRegisterRequest(
      email,
      passwordInputResult.salt,
      passwordInputResult.newPassword, // String,
      passwordInputResult.newPasswordHint, // Option<String>,
      emailVerificationToken, // Option<String>,
      orgSponsoredFreeFamilyPlanToken,
      acceptEmergencyAccessInviteToken,
      emergencyAccessId,
      providerInviteToken,
      providerUserId,
      salesAssistedToken, // Option<String>,
    );

    // The SDK call returns the
    // - account_cryptographic_state
    // - master_password_unlock
    // - user_key
    // we discard this as all finishRegistration flows immediately log in
    // after a successful return.
    await sdkClient.auth().registration().post_keys_for_user_password_registration(registerRequest);
  }

  protected async buildSdkRegisterRequest(
    email: string,
    salt: string,
    masterPassword: string,
    masterPasswordHint?: string,
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string, // web only
    acceptEmergencyAccessInviteToken?: string, // web only
    emergencyAccessId?: string, // web only
    providerInviteToken?: string, // web only
    providerUserId?: string, // web only
    salesAssistedToken?: string, // web only
  ): Promise<UserMasterPasswordRegistrationRequest> {
    const registerFinishRequest: UserMasterPasswordRegistrationRequest = {
      email: email,
      salt: salt,
      master_password: masterPassword,
      master_password_hint: masterPasswordHint,
      email_verification_token: emailVerificationToken,
      organization_user_id: undefined,
      org_invite_token: undefined,
      org_sponsored_free_family_plan_token: undefined,
      accept_emergency_access_invite_token: undefined,
      accept_emergency_access_id: undefined,
      provider_invite_token: undefined,
      provider_user_id: undefined,
      sales_assisted_token: undefined,
      open_org_invite: undefined,
    };

    return registerFinishRequest;
  }

  protected toOptionalSdkUserId(value?: string): SdkUserId | undefined {
    return value ? asUuid<SdkUserId>(value) : undefined;
  }

  protected toOptionalSdkOrganizationId(value?: string): SdkOrganizationId | undefined {
    return value ? asUuid<SdkOrganizationId>(value) : undefined;
  }
}

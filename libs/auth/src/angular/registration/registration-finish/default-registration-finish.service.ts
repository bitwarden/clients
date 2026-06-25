// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { KeysRequest } from "@bitwarden/common/models/request/keys.request";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import {
  OrganizationId as SdkOrganizationId,
  UserId as SdkUserId,
  UserMasterPasswordRegistrationRequest,
} from "@bitwarden/sdk-internal";

import { PasswordInputResult } from "../../input-password/password-input-result";

import { RegistrationFinishService } from "./registration-finish.service";

export class DefaultRegistrationFinishService implements RegistrationFinishService {
  constructor(
    protected keyService: KeyService,
    protected accountApiService: AccountApiService,
    protected masterPasswordService: MasterPasswordServiceAbstraction,
    protected configService: ConfigService,
    protected sdkService: SdkService,
  ) {}

  getOrgNameFromOrgInvite(): Promise<string | null> {
    return null;
  }

  getMasterPasswordPolicyOptsFromOrgInvite(): Promise<MasterPasswordPolicyOptions | null> {
    return null;
  }

  async finishRegistration(
    email: string,
    passwordInputResult: PasswordInputResult,
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string,
    acceptEmergencyAccessInviteToken?: string,
    emergencyAccessId?: string,
    providerInviteToken?: string,
    providerUserId?: string,
  ): Promise<void> {
    const ctx = "Could not finish registration.";
    assertTruthy(passwordInputResult.newPassword, "newPassword", ctx);
    assertNonNullish(passwordInputResult.kdfConfig, "kdfConfig", ctx);
    assertTruthy(passwordInputResult.salt, "salt", ctx);

    const useV2RegistrationViaSdk = await this.configService.getFeatureFlag(
      FeatureFlag.EnableAccountEncryptionV2UserPasswordRegistration,
    );

    if (useV2RegistrationViaSdk) {
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
      );

      // The SDK call returns the
      // - account_cryptographic_state
      // - master_password_unlock
      // - user_key
      // we discard this as all finishRegistration flows immediately log in
      // after a successful return.
      await sdkClient
        .auth()
        .registration()
        .post_keys_for_user_password_registration(registerRequest);

      return;
    }

    const newMasterKey = await this.keyService.makeMasterKey(
      passwordInputResult.newPassword,
      passwordInputResult.salt,
      passwordInputResult.kdfConfig,
    );

    const [newUserKey, newEncUserKey] = await this.keyService.makeUserKey(newMasterKey);

    if (!newUserKey || !newEncUserKey) {
      throw new Error("User key could not be created");
    }
    const userAsymmetricKeys = await this.keyService.makeKeyPair(newUserKey);

    const registerRequest = await this.buildRegisterRequest(
      newUserKey,
      email,
      passwordInputResult,
      userAsymmetricKeys,
      emailVerificationToken,
      orgSponsoredFreeFamilyPlanToken,
      acceptEmergencyAccessInviteToken,
      emergencyAccessId,
      providerInviteToken,
      providerUserId,
    );

    return await this.accountApiService.registerFinish(registerRequest);
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
    };

    return registerFinishRequest;
  }

  protected async buildRegisterRequest(
    newUserKey: UserKey,
    email: string,
    passwordInputResult: PasswordInputResult,
    userAsymmetricKeys: [string, EncString],
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string, // web only
    acceptEmergencyAccessInviteToken?: string, // web only
    emergencyAccessId?: string, // web only
    providerInviteToken?: string, // web only
    providerUserId?: string, // web only
  ): Promise<RegisterFinishRequest> {
    const userAsymmetricKeysRequest = new KeysRequest(
      userAsymmetricKeys[0],
      userAsymmetricKeys[1].encryptedString,
    );

    const masterPasswordAuthentication =
      await this.masterPasswordService.makeMasterPasswordAuthenticationData(
        passwordInputResult.newPassword,
        passwordInputResult.kdfConfig,
        passwordInputResult.salt,
      );

    const masterPasswordUnlock = await this.masterPasswordService.makeMasterPasswordUnlockData(
      passwordInputResult.newPassword,
      passwordInputResult.kdfConfig,
      passwordInputResult.salt,
      newUserKey,
    );

    const registerFinishRequest = new RegisterFinishRequest(
      email,
      passwordInputResult.newPasswordHint,
      userAsymmetricKeysRequest,
      masterPasswordAuthentication,
      masterPasswordUnlock,
    );

    if (emailVerificationToken) {
      registerFinishRequest.emailVerificationToken = emailVerificationToken;
    }

    return registerFinishRequest;
  }

  protected toOptionalSdkUserId(value?: string): SdkUserId | undefined {
    return value ? asUuid<SdkUserId>(value) : undefined;
  }

  protected toOptionalSdkOrganizationId(value?: string): SdkOrganizationId | undefined {
    return value ? asUuid<SdkOrganizationId>(value) : undefined;
  }
}

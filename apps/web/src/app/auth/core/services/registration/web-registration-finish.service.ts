// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import {
  DefaultRegistrationFinishService,
  PasswordInputResult,
  RegistrationFinishService,
} from "@bitwarden/auth/angular";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { KeyService } from "@bitwarden/key-management";

export class WebRegistrationFinishService
  extends DefaultRegistrationFinishService
  implements RegistrationFinishService
{
  constructor(
    protected keyService: KeyService,
    protected accountApiService: AccountApiService,
    private organizationInviteService: OrganizationInviteService,
    private policyApiService: PolicyApiServiceAbstraction,
    private logService: LogService,
    private policyService: PolicyService,
    private configService: ConfigService,
  ) {
    super(keyService, accountApiService);
  }

  override async getOrgNameFromOrgInvite(): Promise<string | null> {
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();
    if (orgInvite == null) {
      return null;
    }

    return orgInvite.organizationName;
  }

  override async getMasterPasswordPolicyOptsFromOrgInvite(): Promise<MasterPasswordPolicyOptions | null> {
    // If there's a deep linked org invite, use it to get the password policies
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();

    if (orgInvite == null) {
      return null;
    }

    let policies: Policy[] | null = null;
    try {
      policies = await this.policyApiService.getPoliciesByToken(
        orgInvite.organizationId,
        orgInvite.token,
        orgInvite.email,
        orgInvite.organizationUserId,
      );
    } catch (e) {
      this.logService.error(e);
    }

    if (policies == null) {
      return null;
    }

    const masterPasswordPolicyOpts: MasterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(null, policies),
    );

    return masterPasswordPolicyOpts;
  }

  override async determineLoginSuccessRoute(): Promise<string> {
    const endUserActivationFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM19315EndUserActivationMvp,
    );

    if (endUserActivationFlagEnabled) {
      return "/setup-extension";
    } else {
      return super.determineLoginSuccessRoute();
    }
  }

  // Note: the org invite token and email verification are mutually exclusive. Only one will be present.
  override async buildRegisterRequest(
    email: string,
    passwordInputResult: PasswordInputResult,
    encryptedUserKey: EncryptedString,
    userAsymmetricKeys: [string, EncString],
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string,
    acceptEmergencyAccessInviteToken?: string,
    emergencyAccessId?: string,
    providerInviteToken?: string,
    providerUserId?: string,
  ): Promise<RegisterFinishRequest> {
    const registerRequest = await super.buildRegisterRequest(
      email,
      passwordInputResult,
      encryptedUserKey,
      userAsymmetricKeys,
      emailVerificationToken,
    );

    // web specific logic
    // Org invites are deep linked. Non-existent accounts are redirected to the register page.
    // Org user id and token are included here only for validation and two factor purposes.
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();
    if (orgInvite != null) {
      registerRequest.organizationUserId = orgInvite.organizationUserId;
      registerRequest.orgInviteToken = orgInvite.token;
    }
    // Invite is accepted after login (on deep link redirect).

    if (orgSponsoredFreeFamilyPlanToken) {
      registerRequest.orgSponsoredFreeFamilyPlanToken = orgSponsoredFreeFamilyPlanToken;
    }

    if (acceptEmergencyAccessInviteToken && emergencyAccessId) {
      registerRequest.acceptEmergencyAccessInviteToken = acceptEmergencyAccessInviteToken;
      registerRequest.acceptEmergencyAccessId = emergencyAccessId;
    }

    if (providerInviteToken && providerUserId) {
      registerRequest.providerInviteToken = providerInviteToken;
      registerRequest.providerUserId = providerUserId;
    }

    return registerRequest;
  }
}

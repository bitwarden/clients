// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import {
  DefaultRegistrationFinishService,
  PasswordInputResult,
  RegistrationFinishService,
} from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
import { UserMasterPasswordRegistrationRequest } from "@bitwarden/sdk-internal";

export class WebRegistrationFinishService
  extends DefaultRegistrationFinishService
  implements RegistrationFinishService
{
  constructor(
    protected keyService: KeyService,
    protected accountApiService: AccountApiService,
    protected masterPasswordService: MasterPasswordServiceAbstraction,
    protected configService: ConfigService,
    protected sdkService: SdkService,
    private organizationInviteService: OrganizationInviteService,
    private policyService: PolicyService,
  ) {
    super(keyService, accountApiService, masterPasswordService, configService, sdkService);
  }

  override async getOrgNameFromOrgInvite(): Promise<string | null> {
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();
    if (orgInvite == null) {
      return null;
    }

    return orgInvite.organizationName;
  }

  // TODO: when invite acceptance becomes cross-client (the upcoming extension work),
  // drop `getMasterPasswordPolicyOptsFromOrgInvite` from `RegistrationFinishService` entirely.
  // `OrganizationInviteService.getMasterPasswordPolicyOptionsForInvite(orgInvite)` (introduced
  // for PM-35783) is cross-platform and produces the same result, so the registration-finish
  // component can do the stash-read + projection inline against the org-invite service. The
  // service contract method here exists only to abstract "MP requirements come from invite vs.
  // nowhere," which collapses once every client supports invite registration.
  override async getMasterPasswordPolicyOptsFromOrgInvite(): Promise<MasterPasswordPolicyOptions | null> {
    // If there's a deep linked org invite, use it to get the password policies
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();

    if (orgInvite == null) {
      return null;
    }

    const policies = await this.organizationInviteService.getOrgPoliciesForInvite(orgInvite);

    if (policies == null) {
      return null;
    }

    const masterPasswordPolicyOpts: MasterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(null, policies),
    );

    return masterPasswordPolicyOpts;
  }

  override async buildSdkRegisterRequest(
    email: string,
    salt: string,
    masterPassword: string,
    masterPasswordHint?: string,
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string,
    acceptEmergencyAccessInviteToken?: string,
    emergencyAccessId?: string,
    providerInviteToken?: string,
    providerUserId?: string,
  ): Promise<UserMasterPasswordRegistrationRequest> {
    const registerRequest = await super.buildSdkRegisterRequest(
      email,
      salt,
      masterPassword,
      masterPasswordHint,
      emailVerificationToken,
    );

    // web specific logic
    // Org invites are deep linked. Non-existent accounts are redirected to the register page.
    // Org user id and token are included here only for validation and two factor purposes.
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();
    if (orgInvite != null) {
      registerRequest.organization_user_id = this.toOptionalSdkOrganizationId(
        orgInvite.organizationUserId,
      );
      registerRequest.org_invite_token = orgInvite.token;
    }
    // Invite is accepted after login (on deep link redirect).

    if (orgSponsoredFreeFamilyPlanToken) {
      registerRequest.org_sponsored_free_family_plan_token = orgSponsoredFreeFamilyPlanToken;
    }

    if (acceptEmergencyAccessInviteToken && emergencyAccessId) {
      registerRequest.accept_emergency_access_invite_token = acceptEmergencyAccessInviteToken;
      registerRequest.accept_emergency_access_id = super.toOptionalSdkUserId(emergencyAccessId);
    }

    if (providerInviteToken && providerUserId) {
      registerRequest.provider_invite_token = providerInviteToken;
      registerRequest.provider_user_id = super.toOptionalSdkUserId(providerUserId);
    }

    // Alternative invite/acceptance tokens (org invite, org-sponsored
    // family plan, emergency access, provider) are mutually exclusive with
    // emailVerificationToken — presence of any one of them proves email ownership
    // via the server-issued invite link, so the standalone email verification
    // token is not required and would not be present.
    if (
      emailVerificationToken &&
      (registerRequest.org_invite_token ||
        registerRequest.org_sponsored_free_family_plan_token ||
        registerRequest.accept_emergency_access_invite_token ||
        registerRequest.provider_invite_token)
    ) {
      throw new Error(
        `emailVerificationToken and alternative invite token simultaneously detected. Could not finish registration.`,
      );
    }

    return registerRequest;
  }

  override async buildRegisterRequest(
    newUserKey: UserKey,
    email: string,
    passwordInputResult: PasswordInputResult,
    userAsymmetricKeys: [string, EncString],
    emailVerificationToken?: string,
    orgSponsoredFreeFamilyPlanToken?: string,
    acceptEmergencyAccessInviteToken?: string,
    emergencyAccessId?: string,
    providerInviteToken?: string,
    providerUserId?: string,
  ): Promise<RegisterFinishRequest> {
    const registerRequest = await super.buildRegisterRequest(
      newUserKey,
      email,
      passwordInputResult,
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

    // Alternative invite/acceptance tokens (org invite, org-sponsored
    // family plan, emergency access, provider) are mutually exclusive with
    // emailVerificationToken — presence of any one of them proves email ownership
    // via the server-issued invite link, so the standalone email verification
    // token is not required and would not be present.
    if (
      emailVerificationToken &&
      (registerRequest.orgInviteToken ||
        registerRequest.orgSponsoredFreeFamilyPlanToken ||
        registerRequest.acceptEmergencyAccessInviteToken ||
        registerRequest.providerInviteToken)
    ) {
      throw new Error(
        `emailVerificationToken and alternative invite token simultaneously detected. Could not finish registration.`,
      );
    }

    return registerRequest;
  }
}

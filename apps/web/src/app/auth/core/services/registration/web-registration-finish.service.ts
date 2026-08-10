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
import {
  OrganizationInviteService,
  OrgInviteKind,
} from "@bitwarden/common/auth/organization-invite";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import { LegacyCompatKeyService } from "@bitwarden/legacy-crypto";
import { UserMasterPasswordRegistrationRequest } from "@bitwarden/sdk-internal";

export class WebRegistrationFinishService
  extends DefaultRegistrationFinishService
  implements RegistrationFinishService
{
  constructor(
    protected legacyCompatKeyService: LegacyCompatKeyService,
    protected accountApiService: AccountApiService,
    protected masterPasswordService: MasterPasswordServiceAbstraction,
    protected configService: ConfigService,
    protected sdkService: SdkService,
    private organizationInviteService: OrganizationInviteService,
    private policyService: PolicyService,
  ) {
    super(
      legacyCompatKeyService,
      accountApiService,
      masterPasswordService,
      configService,
      sdkService,
    );
  }

  // TODO PM-41523: delete this method + inline `OrganizationInviteService` usage in
  // `RegistrationFinishComponent`. Required DI landscape change:
  // (1) create a no-op `OrganizationInviteService` implementation in libs/angular and
  //     register it in `jslib-services.module.ts`, replacing the current global binding
  //     to `DefaultOrganizationInviteService`;
  // (2) register `DefaultOrganizationInviteService` in web's core module only.
  // Applies equally to `getMasterPasswordPolicyOptsFromOrgInvite` below.
  override async getOrgNameFromOrgInvite(): Promise<string | null> {
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();
    if (orgInvite == null) {
      return null;
    }

    return orgInvite.organizationName;
  }

  // TODO PM-41523: delete this method too — see the plan on `getOrgNameFromOrgInvite` above.
  // `OrganizationInviteService.getMasterPasswordPolicyOptionsForInvite(orgInvite)` is
  // already cross-platform, so the component can do this read inline.
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
    salesAssistedToken?: string,
  ): Promise<UserMasterPasswordRegistrationRequest> {
    const registerRequest = await super.buildSdkRegisterRequest(
      email,
      salt,
      masterPassword,
      masterPasswordHint,
      emailVerificationToken,
    );

    // web specific logic

    // Sales-assisted invites are deep-linked to trial initiation.
    // It does not grant an org, family, emergency-access, or provider relationship; it
    // authorizes registration on instances where open self-registration is disabled.
    // No linking/validation needed here, only forward the token.
    if (salesAssistedToken) {
      registerRequest.sales_assisted_token = salesAssistedToken;
    }

    // Org invites are deep linked. Non-existent accounts are redirected to the register page.
    // Org user id and token are included here only for validation and two factor purposes.
    // Open invites carry no direct-invite fields; they are accepted via a separate flow after
    // login (deepLinkGuard replays /join/{code}?key={key}, authedHandler fires accept).
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();
    if (orgInvite?.kind === OrgInviteKind.Direct) {
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
    // family plan, emergency access, provider, sales-assisted) are mutually exclusive with
    // emailVerificationToken — presence of any one of them proves email ownership
    // via the server-issued invite link, so the standalone email verification
    // token is not required and would not be present.
    if (
      emailVerificationToken &&
      (registerRequest.org_invite_token ||
        registerRequest.org_sponsored_free_family_plan_token ||
        registerRequest.accept_emergency_access_invite_token ||
        registerRequest.provider_invite_token ||
        registerRequest.sales_assisted_token)
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
    salesAssistedToken?: string,
  ): Promise<RegisterFinishRequest> {
    const registerRequest = await super.buildRegisterRequest(
      newUserKey,
      email,
      passwordInputResult,
      userAsymmetricKeys,
      emailVerificationToken,
    );

    // web specific logic

    // Sales-assisted invites are deep-linked to trial initiation.
    // It does not grant an org, family, emergency-access, or provider relationship; it
    // authorizes registration on instances where open self-registration is disabled.
    // No linking/validation needed here, only forward the token.
    if (salesAssistedToken) {
      registerRequest.salesAssistedToken = salesAssistedToken;
    }

    // Org invites are deep linked. Non-existent accounts are redirected to the register page.
    // Org user id and token are included here only for validation and two factor purposes.
    // Open invites carry no direct-invite fields; they are accepted via a separate flow after
    // login (deepLinkGuard replays /join/{code}?key={key}, authedHandler fires accept).
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();
    if (orgInvite?.kind === OrgInviteKind.Direct) {
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

    // Alternative invite/acceptance tokens (direct org invite, org-sponsored
    // family plan, emergency access, provider, sales-assisted) are mutually exclusive with
    // emailVerificationToken — presence of any one of them proves email ownership
    // via the server-issued invite link, so the standalone email verification
    // token is not required and would not be present.
    if (
      emailVerificationToken &&
      (registerRequest.orgInviteToken ||
        registerRequest.orgSponsoredFreeFamilyPlanToken ||
        registerRequest.acceptEmergencyAccessInviteToken ||
        registerRequest.providerInviteToken ||
        registerRequest.salesAssistedToken)
    ) {
      throw new Error(
        `emailVerificationToken and alternative invite token simultaneously detected. Could not finish registration.`,
      );
    }

    return registerRequest;
  }
}

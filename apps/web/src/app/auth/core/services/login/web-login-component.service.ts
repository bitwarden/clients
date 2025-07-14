// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";

import {
  DefaultLoginComponentService,
  LoginComponentService,
  PasswordPolicies,
} from "@bitwarden/auth/angular";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { RouterService } from "../../../../core/router.service";

@Injectable()
export class WebLoginComponentService
  extends DefaultLoginComponentService
  implements LoginComponentService
{
  constructor(
    protected organizationInviteService: OrganizationInviteService,
    protected logService: LogService,
    protected policyApiService: PolicyApiServiceAbstraction,
    protected policyService: InternalPolicyService,
    protected routerService: RouterService,
    cryptoFunctionService: CryptoFunctionService,
    environmentService: EnvironmentService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    platformUtilsService: PlatformUtilsService,
    ssoLoginService: SsoLoginServiceAbstraction,
    private router: Router,
    private accountService: AccountService,
    private configService: ConfigService,
  ) {
    super(
      cryptoFunctionService,
      environmentService,
      passwordGenerationService,
      platformUtilsService,
      ssoLoginService,
    );
  }

  /**
   * For the web client, redirecting to the SSO component is done via the router.
   * We do not need to provide email, state, or code challenge since those are set in state
   * or generated on the SSO component.
   */
  protected override async redirectToSso(
    email: string,
    state: string,
    codeChallenge: string,
  ): Promise<void> {
    await this.router.navigate(["/sso"]);
    return;
  }

  async getOrgPoliciesFromOrgInvite(): Promise<PasswordPolicies | undefined> {
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();

    if (orgInvite != null) {
      let policies: Policy[];

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
        return undefined;
      }

      const resetPasswordPolicy = this.policyService.getResetPasswordPolicyOptions(
        policies,
        orgInvite.organizationId,
      );

      const isPolicyAndAutoEnrollEnabled =
        resetPasswordPolicy[1] && resetPasswordPolicy[0].autoEnrollEnabled;

      const enforcedPasswordPolicyOptions =
        this.policyService.combinePoliciesIntoMasterPasswordPolicyOptions(policies);

      return {
        policies,
        isPolicyAndAutoEnrollEnabled,
        enforcedPasswordPolicyOptions,
      };
    }
  }
}

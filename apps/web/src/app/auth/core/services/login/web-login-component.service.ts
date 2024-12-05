// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import {
  DefaultLoginComponentService,
  LoginComponentService,
  PasswordPolicies,
} from "@bitwarden/auth/angular";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { RouterService } from "../../../../core/router.service";
import { AcceptOrganizationInviteService } from "../../../organization-invite/accept-organization.service";

@Injectable()
export class WebLoginComponentService
  extends DefaultLoginComponentService
  implements LoginComponentService
{
  constructor(
    protected acceptOrganizationInviteService: AcceptOrganizationInviteService,
    protected logService: LogService,
    protected policyApiService: PolicyApiServiceAbstraction,
    protected policyService: InternalPolicyService,
    protected routerService: RouterService,
    cryptoFunctionService: CryptoFunctionService,
    environmentService: EnvironmentService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    platformUtilsService: PlatformUtilsService,
    ssoLoginService: SsoLoginServiceAbstraction,
  ) {
    super(
      cryptoFunctionService,
      environmentService,
      passwordGenerationService,
      platformUtilsService,
      ssoLoginService,
    );
    this.clientType = this.platformUtilsService.getClientType();
  }

  async getOrgPolicies(): Promise<PasswordPolicies | null> {
    const orgInvite = await this.acceptOrganizationInviteService.getOrganizationInvite();

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
        return;
      }

      const resetPasswordPolicy = this.policyService.getResetPasswordPolicyOptions(
        policies,
        orgInvite.organizationId,
      );

      const isPolicyAndAutoEnrollEnabled =
        resetPasswordPolicy[1] && resetPasswordPolicy[0].autoEnrollEnabled;

      const enforcedPasswordPolicyOptions = await firstValueFrom(
        this.policyService.masterPasswordPolicyOptions$(policies),
      );

      return {
        policies,
        isPolicyAndAutoEnrollEnabled,
        enforcedPasswordPolicyOptions,
      };
    }
  }
}

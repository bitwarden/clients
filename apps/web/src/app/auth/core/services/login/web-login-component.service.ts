import { inject } from "@angular/core";
import { Router, UrlTree } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  DefaultLoginComponentService,
  LoginComponentService,
  PasswordPolicies,
} from "@bitwarden/auth/angular";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { flagEnabled } from "../../../../../utils/flags";
import { RouterService } from "../../../../core/router.service";
import { AcceptOrganizationInviteService } from "../../../organization-invite/accept-organization.service";

export class WebLoginComponentService
  extends DefaultLoginComponentService
  implements LoginComponentService
{
  acceptOrganizationInviteService = inject(AcceptOrganizationInviteService);
  logService = inject(LogService);
  policyApiService = inject(PolicyApiServiceAbstraction);
  policyService = inject(InternalPolicyService);
  router = inject(Router);
  routerService = inject(RouterService);

  isLoginViaAuthRequestSupported(): boolean {
    return flagEnabled("showPasswordless");
  }

  setPreviousUrl(route: UrlTree): void | null {
    this.routerService.setPreviousUrl(route.toString());
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

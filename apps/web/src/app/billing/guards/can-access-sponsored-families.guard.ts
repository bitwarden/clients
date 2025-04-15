import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { getById } from "@bitwarden/common/platform/misc";

import { FreeFamiliesPolicyService } from "../services/free-families-policy.service";

export const canAccessSponsoredFamilies: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const freeFamiliesPolicyService = inject(FreeFamiliesPolicyService);
  const organizationService = inject(OrganizationService);
  const accountService = inject(AccountService);

  const org = accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => organizationService.organizations$(userId)),
    getById(route.params.organizationId),
  );

  return await firstValueFrom(freeFamiliesPolicyService.showSponsoredFamiliesDropdown$(org));
};

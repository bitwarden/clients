import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderStatusType } from "@bitwarden/common/admin-console/enums";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

export const organizationIsUnmanaged: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const organizationService = inject(OrganizationService);
  const providerService = inject(ProviderService);
  const accountService = inject(AccountService);

  const userId = await firstValueFrom(accountService.activeAccount$.pipe(map((a) => a?.id)));

  if (!userId) {
    throw new Error("No user found.");
  }

  const organization = await firstValueFrom(
    organizationService
      .organizations$(userId)
      .pipe(getOrganizationById(route.params.organizationId)),
  );

  if (!organization) {
    throw new Error("No organization found.");
  }

  if (!organization.hasProvider) {
    return true;
  }

  const provider = await firstValueFrom(providerService.get$(organization.providerId, userId));

  if (!provider) {
    return true;
  }

  return provider.providerStatus !== ProviderStatusType.Billable;
};

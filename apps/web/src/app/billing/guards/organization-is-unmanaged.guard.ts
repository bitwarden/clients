import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn } from "@angular/router";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderStatusType } from "@bitwarden/common/admin-console/enums";

export const organizationIsUnmanaged: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const organizationService = inject(OrganizationService);
  const providerService = inject(ProviderService);

  const organization = await organizationService.get(route.params.organizationId);

  if (!organization.hasProvider) {
    return true;
  }

  const provider = await providerService.get(organization.providerId);

  if (!provider) {
    return true;
  }

  return provider.providerStatus !== ProviderStatusType.Billable;
};

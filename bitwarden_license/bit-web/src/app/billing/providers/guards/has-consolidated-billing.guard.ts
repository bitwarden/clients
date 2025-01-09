import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, createUrlTreeFromSnapshot } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { ProviderService } from "@bitwarden/common/admin-console/abstractions/provider.service";
import { ProviderStatusType } from "@bitwarden/common/admin-console/enums";

export const hasConsolidatedBilling: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const providerService = inject(ProviderService);

  const provider = await firstValueFrom(providerService.get$(route.params.providerId));

  if (!provider || provider.providerStatus !== ProviderStatusType.Billable) {
    return createUrlTreeFromSnapshot(route, ["/providers", route.params.providerId]);
  }

  return true;
};

import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  createUrlTreeFromSnapshot,
  RouterStateSnapshot,
} from "@angular/router";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

/**
 * Redirects from root `/sm` to first organization with access to SM
 */
export const canActivateSM: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
) => {
  const syncService = inject(SyncService);
  const orgService = inject(OrganizationService);

  /** Workaround to avoid service initialization race condition. */
  if ((await syncService.getLastSync()) == null) {
    await syncService.fullSync(false);
  }

  const orgs = await orgService.getAll();
  const smOrg = orgs.find((o) => o.canAccessSecretsManager);
  if (smOrg) {
    return createUrlTreeFromSnapshot(route, ["/sm", smOrg.id]);
  }
  return createUrlTreeFromSnapshot(route, ["/vault"]);
};

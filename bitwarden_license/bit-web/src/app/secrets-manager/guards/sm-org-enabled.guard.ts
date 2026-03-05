import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, createUrlTreeFromSnapshot } from "@angular/router";
import { firstValueFrom } from "rxjs";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

/**
 * Redirects from root `/sm` to first organization with access to SM
 */
export const organizationEnabledGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const syncService = inject(SyncService);
  const orgService = inject(OrganizationService);
  const accountService = inject(AccountService);

  /** Workaround to avoid service initialization race condition. */
  if ((await syncService.getLastSync()) == null) {
    await syncService.fullSync(false);
  }

  const userId = await firstValueFrom(getUserId(accountService.activeAccount$));
  const org = await firstValueFrom(
    orgService.organizations$(userId).pipe(getOrganizationById(route.params.organizationId)),
  );
  if (org == null || !org.canAccessSecretsManager) {
    return createUrlTreeFromSnapshot(route, ["/"]);
  }

  if (!org.enabled) {
    return createUrlTreeFromSnapshot(route, ["/sm", org.id, "organization-suspended"]);
  }

  return true;
};

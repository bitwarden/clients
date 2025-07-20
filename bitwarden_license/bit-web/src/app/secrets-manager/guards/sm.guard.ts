import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  createUrlTreeFromSnapshot,
  RouterStateSnapshot,
} from "@angular/router";
import { firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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
  const accountService = inject(AccountService);

  /** Workaround to avoid service initialization race condition. */
  if ((await syncService.getLastSync()) == null) {
    await syncService.fullSync(false);
  }

  const userId = await firstValueFrom(getUserId(accountService.activeAccount$));
  const orgs = await firstValueFrom(orgService.organizations$(userId));
  const smOrg = orgs.find((o) => o.canAccessSecretsManager);
  if (smOrg) {
    return createUrlTreeFromSnapshot(route, ["/sm", smOrg.id]);
  }
  return createUrlTreeFromSnapshot(route, ["/vault"]);
};

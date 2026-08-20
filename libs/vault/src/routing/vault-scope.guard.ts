import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

import { parseVaultScope, VaultScopeType } from "../models/vault-scope";

/**
 * Guards the `:vaultId` vault routes, redirecting to the unscoped vault when the segment names no
 * vault the user has — a typo, or a bookmark to an organization they have since left. Without it
 * those URLs render an empty vault, which reads as data loss.
 *
 * Resolving membership here also lets the page trust the segment, so it can scope its rows the
 * moment it loads rather than waiting on the organization list.
 */
export const vaultScopeGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const organizationService = inject(OrganizationService);

  const allItems = () => router.createUrlTree(["/vault"]);

  const scope = parseVaultScope(route.paramMap.get("vaultId"));
  if (scope == null) {
    return allItems();
  }

  if (scope.type !== VaultScopeType.Organization) {
    return true;
  }

  const userId = await firstValueFrom(accountService.activeAccount$.pipe(getUserId));
  const organizations = await firstValueFrom(organizationService.organizations$(userId));

  return organizations.some(({ id }) => id === scope.organizationId) ? true : allItems();
};

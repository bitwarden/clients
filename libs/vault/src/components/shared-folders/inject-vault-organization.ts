import { computed, inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { parseVaultScope, VaultScopeType } from "../../models/vault-scope";

/**
 * The organization the route's `:vaultId` segment names, or `undefined` for a segment that names
 * no organization vault. `organizationVaultGuard` has already turned away any other segment, so
 * `undefined` means the guard was bypassed — a caller then shows nothing rather than falling back
 * to a vault the URL did not ask for.
 *
 * Must be called in an injection context.
 */
export function injectVaultOrganizationId(): Signal<OrganizationId | undefined> {
  const routeParams = toSignal(inject(ActivatedRoute).paramMap);

  return computed(() => {
    const scope = parseVaultScope(routeParams()?.get("vaultId"));
    return scope?.type === VaultScopeType.Organization ? scope.organizationId : undefined;
  });
}

/**
 * {@link injectVaultOrganizationId}, resolved against the account's organizations. `undefined`
 * until the organization list loads, and for a `:vaultId` that names none of them.
 *
 * Must be called in an injection context.
 */
export function injectVaultOrganization(): Signal<Organization | undefined> {
  const accountService = inject(AccountService);
  const organizationService = inject(OrganizationService);
  const organizationId = injectVaultOrganizationId();

  const organizations = toSignal(
    accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => organizationService.organizations$(userId)),
    ),
  );

  return computed(() =>
    organizations()?.find((organization) => organization.id === organizationId()),
  );
}

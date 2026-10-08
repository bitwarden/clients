import { Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";

/**
 * Uses `getOptionalUserId`, since `getUserId` throws on a signed-out account, and emits an empty
 * list when there's no active account.
 */
export function callerOrganizations$(
  accountService: AccountService,
  organizationService: OrganizationService,
): Observable<Organization[]> {
  return accountService.activeAccount$.pipe(
    getOptionalUserId,
    switchMap((userId) => (userId == null ? of([]) : organizationService.organizations$(userId))),
  );
}

/**
 * Presentation policy, not entitlement. Skips a disabled organization (the wrong reason), an
 * un-synced membership (`accessPam` not yet `false`) and providers, whose `AccessPam` is hardcoded.
 */
export function unlicensedForPam(organization: Organization | undefined): boolean {
  return (
    organization != null &&
    organization.enabled &&
    organization.usePam &&
    organization.accessPam === false &&
    !organization.isProviderUser
  );
}

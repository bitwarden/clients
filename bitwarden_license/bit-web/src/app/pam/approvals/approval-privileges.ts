import { distinctUntilChanged, map, Observable, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

/**
 * Emits `true` while the active user can act on other members' access requests. The privilege is
 * `Organization.canManageAccessRules` (Admin/Owner), the same one that gates the access-rules admin
 * UI — an approver decides against rules they can also configure.
 *
 * The check is "can manage access rules in SOME organization", not a per-organization check, because
 * the Access requests page is user-global: it spans every organization the user belongs to rather
 * than one named in the URL.
 *
 * A plain function taking its dependencies as arguments rather than an injectable, so the tab (which
 * decides whether to render the inbox) and the route guard (which decides whether the route is
 * reachable) derive from one expression and cannot drift apart.
 */
export function hasApprovalPrivileges$(
  accountService: AccountService,
  organizationService: OrganizationService,
): Observable<boolean> {
  return accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => organizationService.organizations$(userId)),
    map((organizations) => organizations.some((organization) => organization.canManageAccessRules)),
    distinctUntilChanged(),
  );
}

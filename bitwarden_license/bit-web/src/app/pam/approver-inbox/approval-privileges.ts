import { Observable, distinctUntilChanged, map, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

/**
 * Emits `true` while the active user has approval privileges — i.e. can act on other members'
 * access requests. The privilege is {@link Organization.canManageAccessRules} (Admin/Owner).
 *
 * The approver inbox shell and its tabs are user-global (they span every organization the user
 * belongs to, not a single org in the URL), so the privilege check is "can manage access rules in
 * *some* organization", not a per-org check. Both the shell (to show the Approvals tab) and the
 * {@link canViewApprovalsGuard} (to gate the approvals route) derive from this one stream so the
 * rule cannot drift between them.
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

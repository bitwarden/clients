import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";
import { map, take } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { hasApprovalPrivileges$ } from "./approval-privileges";

/**
 * Gates the Access requests page's `approvals` tab: users with approval privileges
 * ({@link hasApprovalPrivileges$}) pass, everyone else is redirected to the sibling `my-requests`
 * tab.
 *
 * The redirect matters beyond blocking a deep link. The shell's empty-path route lands on
 * `my-requests`, but a non-approver who types or bookmarks `/pam/approvals` would otherwise reach a
 * tab that is hidden from their own tab bar. Redirecting rather than returning `false` keeps them on
 * a page that has something for them instead of a dead end.
 *
 * The URL tree is rebuilt from the matched path rather than hardcoded, so the guard still works if
 * these routes are ever mounted somewhere other than `/pam`.
 */
export const canViewApprovalsGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const organizationService = inject(OrganizationService);

  return hasApprovalPrivileges$(accountService, organizationService).pipe(
    take(1),
    map((privileged) => {
      if (privileged) {
        return true;
      }
      const segments = route.pathFromRoot.flatMap((snapshot) =>
        snapshot.url.map((segment) => segment.path),
      );
      segments[segments.length - 1] = "my-requests";
      return router.createUrlTree(["/", ...segments]);
    }),
  );
};

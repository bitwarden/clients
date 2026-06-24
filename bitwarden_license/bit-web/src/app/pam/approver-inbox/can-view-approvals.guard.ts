import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";
import { map, take } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { hasApprovalPrivileges$ } from "./approval-privileges";

/**
 * Gates the approver inbox's `approvals` route. Users with approval privileges
 * ({@link hasApprovalPrivileges$}) are allowed through; everyone else is redirected to the sibling
 * `my-requests` tab. Because the inbox's empty-path route redirects to `approvals`, this guard also
 * corrects the default landing for non-privileged users — and blocks a direct deep-link to the
 * approvals route — so a hidden tab is never reachable.
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
      // Redirect to the sibling `my-requests` tab. Built from the matched path so it works for both
      // the end-user (`/pam/approver-inbox`) and admin (`/organizations/:id/pam/approver-inbox`)
      // mounts of the shared inbox routes.
      const segments = route.pathFromRoot.flatMap((snapshot) =>
        snapshot.url.map((segment) => segment.path),
      );
      segments[segments.length - 1] = "my-requests";
      return router.createUrlTree(["/", ...segments]);
    }),
  );
};

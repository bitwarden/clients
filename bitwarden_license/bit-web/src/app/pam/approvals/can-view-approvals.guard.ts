import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { SyncService } from "@bitwarden/common/platform/sync";

import { ApprovalPrivilegeService } from "./approval-privilege.service";

/**
 * Gates the Access requests page's `approvals` tab: users with approval privileges
 * ({@link ApprovalPrivilegeService}) pass, everyone else is redirected to the sibling
 * `my-requests` tab.
 *
 * Redirecting, not returning `false`, keeps a non-approver who deep-links `/pam/approvals` on
 * a page with something for them instead of a dead end.
 *
 * The first sync is awaited before deciding: the privilege derives from synced collection
 * state, and a cold-load guard reading it immediately would bounce a genuine approver by
 * seeing "no collections yet" — the same reason `organizationPermissionsGuard` waits.
 *
 * The URL tree is rebuilt from the matched path, not hardcoded, so the guard still works if
 * these routes mount elsewhere.
 */
export const canViewApprovalsGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const syncService = inject(SyncService);
  const approvalPrivileges = inject(ApprovalPrivilegeService);

  if ((await syncService.getLastSync()) == null) {
    await syncService.fullSync(false);
  }

  if (await firstValueFrom(approvalPrivileges.canApprove$)) {
    return true;
  }

  const segments = route.pathFromRoot.flatMap((snapshot) =>
    snapshot.url.map((segment) => segment.path),
  );
  segments[segments.length - 1] = "my-requests";
  return router.createUrlTree(["/", ...segments]);
};

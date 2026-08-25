import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { SyncService } from "@bitwarden/common/platform/sync";

import { ApprovalPrivilegeService } from "./approval-privilege.service";

/**
 * Gates the Access requests page's `approvals` tab: users with approval privileges
 * ({@link ApprovalPrivilegeService}) pass, everyone else is redirected to the sibling `my-requests`
 * tab.
 *
 * The redirect matters beyond blocking a deep link. The shell's empty-path route lands on
 * `my-requests`, but a non-approver who types or bookmarks `/pam/approvals` would otherwise reach a
 * tab that is hidden from their own tab bar. Redirecting rather than returning `false` keeps them on
 * a page that has something for them instead of a dead end.
 *
 * The first sync is awaited before deciding. The privilege is derived from synced collection state,
 * and on a cold load (a bookmark, a hard refresh, a link from a notification) a guard reading it
 * straight away sees "no collections yet" and bounces a genuine approver to `my-requests` — the very
 * symptom this guard was fixed to stop producing. `organizationPermissionsGuard` waits the same way
 * for the same reason, which is why the sibling `access-rules` route never had this problem.
 *
 * The URL tree is rebuilt from the matched path rather than hardcoded, so the guard still works if
 * these routes are ever mounted somewhere other than `/pam`.
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

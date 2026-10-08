import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { SyncService } from "@bitwarden/common/platform/sync";

import { ApprovalPrivilegeService } from "./approval-privilege.service";

/**
 * Redirects a non-approver to the sibling `my-requests` tab, so a deep link isn't a dead end.
 * Waits for the first sync, since a cold load would see no collections and bounce an approver.
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

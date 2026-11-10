import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/platform/sync";

import { ApprovalPrivilegeService } from "./approval-privilege.service";

/**
 * Redirects a non-approver to the sibling `my-requests` tab, so a deep link isn't a dead end.
 * Waits for the first sync, since a cold load would see no collections and bounce an approver.
 *
 * `/pam` itself redirects through here, so this guard is the front door for every caller, not
 * just someone opening the Approvals tab. It therefore never rejects: a failed sync or privilege
 * read falls back to My requests, which needs neither, rather than leaving the whole section
 * unreachable.
 */
export const canViewApprovalsGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const syncService = inject(SyncService);
  const approvalPrivileges = inject(ApprovalPrivilegeService);
  const logService = inject(LogService);

  try {
    if ((await syncService.getLastSync()) == null) {
      await syncService.fullSync(false);
    }
  } catch (e) {
    // A sync that did not land is not an answer either way, so read whatever state is cached
    // rather than deciding on it. Kept separate so it cannot bounce an approver on its own.
    logService.error(e);
  }

  try {
    if (await firstValueFrom(approvalPrivileges.canApprove$)) {
      return true;
    }
  } catch (e) {
    logService.error(e);
  }

  return myRequestsSibling(route, router);
};

/** The `my-requests` tab beside whatever path matched, so the guard survives being remounted. */
function myRequestsSibling(route: ActivatedRouteSnapshot, router: Router): UrlTree {
  const segments = route.pathFromRoot.flatMap((snapshot) =>
    snapshot.url.map((segment) => segment.path),
  );
  segments[segments.length - 1] = "my-requests";
  return router.createUrlTree(["/", ...segments]);
}

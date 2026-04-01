import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { PendingSendService } from "./pending-send.service";

/**
 * Route guard that redirects from `/vault` to `/send` when there are
 * pending file paths from the Windows Explorer "Create Send" context menu.
 *
 * After unlock the lock component navigates to `/vault`. This guard
 * intercepts that navigation and redirects to `/send` with the pending
 * paths as query params, so the Send creation dialog opens automatically.
 */
export const pendingSendGuard: CanActivateFn = () => {
  const pendingSendService = inject(PendingSendService);
  const router = inject(Router);

  if (!pendingSendService.hasPending()) {
    return true;
  }

  const paths = pendingSendService.takePaths();
  return router.createUrlTree(["/send"], {
    queryParams: {
      sendPaths: JSON.stringify(paths),
    },
  });
};

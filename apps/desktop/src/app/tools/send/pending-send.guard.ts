import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { PendingDragDropFilesService } from "@bitwarden/send-ui";

import { PendingSendService } from "./pending-send.service";

/**
 * Route guard that redirects from `/vault` to `/send` when there are
 * pending file paths from the Windows Explorer "Create Send" context menu
 * or pending File objects from drag-and-drop.
 *
 * On cold start, pulls any --send-path arguments from the main process
 * via IPC (the push-based deep link may not have arrived yet).
 * When the app is already running, paths are pushed into PendingSendService
 * by processDeepLink before this guard runs.
 */
export const pendingSendGuard: CanActivateFn = async () => {
  const pendingSendService = inject(PendingSendService);
  const pendingDragDropService = inject(PendingDragDropFilesService);
  const router = inject(Router);

  // Pull any paths the main process collected from --send-path arguments.
  // This handles cold start where the push-based deep link message may
  // arrive after routing has already started.
  const mainProcessPaths = await ipc.platform.contextMenu.takePendingSendPaths();
  if (mainProcessPaths.length > 0) {
    pendingSendService.addPaths(mainProcessPaths);
  }

  // Check for drag-and-drop files first (in-memory File objects)
  if (pendingDragDropService.hasPending()) {
    return router.createUrlTree(["/send"], {
      queryParams: {
        dragDropFiles: "true",
      },
    });
  }

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

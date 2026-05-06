import { Injectable, NgZone } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService, DirtyFormService } from "@bitwarden/components";

/**
 * Handles the update-restart flow by checking for unsaved changes
 * and prompting the user before allowing the app to restart.
 */
@Injectable({ providedIn: "root" })
export class UpdateRestartService {
  constructor(
    private ngZone: NgZone,
    private dialogService: DialogService,
    private dirtyFormService: DirtyFormService,
    private logService: LogService,
  ) {}

  init(): void {
    ipc.platform.registerUpdateRestartHandler((resolve) => {
      try {
        if (!this.dirtyFormService.hasDirtyForm()) {
          resolve(true);
          return;
        }
      } catch (e) {
        this.logService.error("Error checking for dirty forms", e);
        resolve(true);
        return;
      }

      void this.ngZone.run(async () => {
        try {
          const installLater = await this.dialogService.openSimpleDialog({
            title: { key: "unsavedChangesTitle" },
            content: { key: "unsavedChangesUpdateBody" },
            acceptButtonText: { key: "installLater" },
            cancelButtonText: { key: "continueWithInstall" },
            type: "warning",
          });

          resolve(!installLater);
        } catch (e) {
          this.logService.error("Error showing unsaved changes dialog", e);
          resolve(true);
        }
      });
    });
  }
}

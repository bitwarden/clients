import { Injectable, NgZone } from "@angular/core";

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
  ) {}

  init(): void {
    ipc.platform.registerUpdateRestartHandler((resolve) => {
      if (!this.dirtyFormService.hasDirtyForm()) {
        resolve(true);
        return;
      }

      void this.ngZone.run(async () => {
        const installLater = await this.dialogService.openSimpleDialog({
          title: { key: "unsavedChangesTitle" },
          content: { key: "unsavedChangesUpdateBody" },
          acceptButtonText: { key: "installLater" },
          cancelButtonText: { key: "continueWithInstall" },
          type: "warning",
        });

        resolve(!installLater);
      });
    });
  }
}

import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DIALOG_DATA, ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

export type BrowserSyncVerificationDialogParams = {
  fingerprint: string[];
};

@Component({
  templateUrl: "browser-sync-verification-dialog.component.html",
  imports: [JslibModule, ButtonModule, DialogModule],
})
export class BrowserSyncVerificationDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected params: BrowserSyncVerificationDialogParams) {}

  static open(dialogService: DialogService, data: BrowserSyncVerificationDialogParams) {
    return dialogService.open(BrowserSyncVerificationDialogComponent, {
      data,
    });
  }
}

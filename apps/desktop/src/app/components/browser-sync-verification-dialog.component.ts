import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

export type BrowserSyncVerificationDialogParams = {
  fingerprint: string[];
};

@Component({
  templateUrl: "browser-sync-verification-dialog.component.html",
  standalone: true,
  imports: [JslibModule, ButtonModule, DialogModule],
})
export class BrowserSyncVerificationDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected params: BrowserSyncVerificationDialogParams) {}

  static open(dialogService: DialogService, data: BrowserSyncVerificationDialogParams) {
    return dialogService.open(BrowserSyncVerificationDialogComponent, {
      data,
      disableClose: true,
    });
  }
}

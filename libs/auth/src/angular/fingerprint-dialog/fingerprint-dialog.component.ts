import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { DIALOG_DATA, ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

export type FingerprintDialogData = {
  fingerprint: string[];
};

@Component({
  templateUrl: "fingerprint-dialog.component.html",
  imports: [JslibModule, ButtonModule, DialogModule],
})
export class FingerprintDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected data: FingerprintDialogData) {}

  static open(dialogService: DialogService, data: FingerprintDialogData) {
    return dialogService.open(FingerprintDialogComponent, { data });
  }
}

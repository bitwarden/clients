import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

export type FingerprintDialogData = {
  fingerprint: string[];
};

@Component({
  templateUrl: "fingerprint-dialog.component.html",
  standalone: true,
  imports: [JslibModule, ButtonModule, DialogModule],
})
export class FingerprintDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected data: FingerprintDialogData) {}

  static open(dialogService: DialogService, data: FingerprintDialogData) {
    return dialogService.open(FingerprintDialogComponent, { data });
  }
}

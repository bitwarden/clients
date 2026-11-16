import { Component, Inject } from "@angular/core";

import {
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  DialogService,
  CenterPositionStrategy,
  IconModule,
} from "@bitwarden/components";

import { JslibModule } from "../../jslib.module";

export type FingerprintDialogData = {
  fingerprint: string[];
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "fingerprint-dialog.component.html",
  imports: [JslibModule, ButtonModule, DialogModule, IconModule],
})
export class FingerprintDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected data: FingerprintDialogData) {}

  static open(dialogService: DialogService, data: FingerprintDialogData) {
    return dialogService.open(FingerprintDialogComponent, {
      data,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}

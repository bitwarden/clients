import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DIALOG_DATA, ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

export type VerifyNativeMessagingDialogData = {
  applicationName: string;
};

@Component({
  templateUrl: "verify-native-messaging-dialog.component.html",
  imports: [JslibModule, ButtonModule, DialogModule],
})
export class VerifyNativeMessagingDialogComponent {
  constructor(@Inject(DIALOG_DATA) protected data: VerifyNativeMessagingDialogData) {}

  static open(dialogService: DialogService, data: VerifyNativeMessagingDialogData) {
    return dialogService.open<boolean>(VerifyNativeMessagingDialogComponent, {
      data,
    });
  }
}

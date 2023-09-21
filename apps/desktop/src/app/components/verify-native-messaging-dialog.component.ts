import { DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

export type VerifyNativeMessagingDialogData = {
  applicationName: string;
};

@Component({
  templateUrl: "verify-native-messaging-dialog.component.html",
  standalone: true,
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

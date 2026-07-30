import { Component, Inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DIALOG_DATA, ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

export type VerifyNativeMessagingDialogData = {
  applicationName: string;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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

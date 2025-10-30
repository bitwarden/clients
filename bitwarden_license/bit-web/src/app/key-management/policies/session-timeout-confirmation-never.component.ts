import { Component } from "@angular/core";

import { DialogRef, DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  imports: [SharedModule],
  templateUrl: "./session-timeout-confirmation-never.component.html",
})
export class SessionTimeoutConfirmationNeverComponent {
  constructor(public dialogRef: DialogRef) {}

  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(SessionTimeoutConfirmationNeverComponent, {
      disableClose: true,
    });
  }
}

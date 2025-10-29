import { Component } from "@angular/core";

import { DialogRef, DialogService } from "@bitwarden/components";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

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

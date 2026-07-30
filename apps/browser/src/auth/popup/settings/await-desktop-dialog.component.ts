import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "await-desktop-dialog.component.html",
  imports: [JslibModule, ButtonModule, DialogModule],
})
export class AwaitDesktopDialogComponent {
  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(AwaitDesktopDialogComponent);
  }
}

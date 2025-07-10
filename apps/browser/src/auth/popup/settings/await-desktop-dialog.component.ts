import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

@Component({
  templateUrl: "await-desktop-dialog.component.html",
  imports: [JslibModule, ButtonModule, DialogModule],
})
export class AwaitDesktopDialogComponent {
  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(AwaitDesktopDialogComponent);
  }
}

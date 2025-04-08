import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogService } from "@bitwarden/components";

@Component({
  templateUrl: "add-sponsorship-dialog.component.html",
  standalone: true,
  imports: [JslibModule, ButtonModule, DialogModule],
})
export class AddSponsorShipDialogComponent {
  static open(dialogService: DialogService) {
    return dialogService.open<boolean>(AddSponsorShipDialogComponent);
  }
}

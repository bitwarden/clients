import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogService, TypographyModule } from "@bitwarden/components";

import BrowserPopupUtils from "../../../../platform/browser/browser-popup-utils";

@Component({
  selector: "send-file-popout-dialog",
  templateUrl: "./send-file-popout-dialog.component.html",
  imports: [JslibModule, CommonModule, DialogModule, ButtonModule, TypographyModule],
})
export class SendFilePopoutDialogComponent {
  constructor(private dialogService: DialogService) {}

  async popOutWindow() {
    await BrowserPopupUtils.openCurrentPagePopout(window);
  }

  close() {
    this.dialogService.closeAll();
  }
}

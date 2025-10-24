import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogService, TypographyModule } from "@bitwarden/components";

import BrowserPopupUtils from "../../../../platform/browser/browser-popup-utils";
import { PopupRouterCacheService } from "../../../../platform/popup/view-cache/popup-router-cache.service";

@Component({
  selector: "import-file-popout-dialog",
  templateUrl: "./import-file-popout-dialog.component.html",
  imports: [JslibModule, CommonModule, DialogModule, ButtonModule, TypographyModule],
})
export class ImportFilePopoutDialogComponent {
  constructor(
    private dialogService: DialogService,
    private popupRouterCacheService: PopupRouterCacheService,
  ) {}

  async popOutWindow() {
    await BrowserPopupUtils.openCurrentPagePopout(window);
  }

  async close() {
    this.dialogService.closeAll();
    // the current view exposes a file selector, ensure the view is popped to avoid using it outside of a popout
    await this.popupRouterCacheService.back();
  }
}

import { CommonModule } from "@angular/common";
import { Component, ChangeDetectionStrategy } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogService, TypographyModule } from "@bitwarden/components";

import BrowserPopupUtils from "../../../../platform/browser/browser-popup-utils";
import { PopupRouterCacheService } from "../../../../platform/popup/view-cache/popup-router-cache.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  // If the user selects "cancel" when presented the dialog, navigate back to the main Send tab
  async close() {
    this.dialogService.closeAll();
    await this.popupRouterCacheService.back();
  }
}

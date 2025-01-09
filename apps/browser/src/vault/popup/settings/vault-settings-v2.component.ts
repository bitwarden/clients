import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { Router, RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ItemModule, ToastOptions, ToastService } from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/popup/browser-popup-utils";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "vault-settings-v2.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupFooterComponent,
    PopupHeaderComponent,
    PopOutComponent,
    ItemModule,
  ],
})
export class VaultSettingsV2Component implements OnInit {
  lastSync = "--";

  constructor(
    private router: Router,
    private syncService: SyncService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  async ngOnInit() {
    await this.setLastSync();
  }

  async import() {
    await this.router.navigate(["/import"]);
    if (await BrowserApi.isPopupOpen()) {
      await BrowserPopupUtils.openCurrentPagePopout(window);
    }
  }

  async sync() {
    let toastConfig: ToastOptions;
    const success = await this.syncService.fullSync(true);
    if (success) {
      await this.setLastSync();
      toastConfig = {
        variant: "success",
        title: "",
        message: this.i18nService.t("syncingComplete"),
      };
    } else {
      toastConfig = { variant: "error", title: "", message: this.i18nService.t("syncingFailed") };
    }
    this.toastService.showToast(toastConfig);
  }

  private async setLastSync() {
    const last = await this.syncService.getLastSync();
    if (last != null) {
      this.lastSync = last.toLocaleDateString() + " " + last.toLocaleTimeString();
    } else {
      this.lastSync = this.i18nService.t("never");
    }
  }
}

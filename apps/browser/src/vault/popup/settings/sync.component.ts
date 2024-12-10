// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";

@Component({
  selector: "app-sync",
  templateUrl: "sync.component.html",
})
export class SyncComponent implements OnInit {
  lastSync = "--";
  syncPromise: Promise<any>;

  constructor(
    private syncService: SyncService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
  ) {}

  async ngOnInit() {
    await this.setLastSync();
  }

  async sync() {
    this.syncPromise = this.syncService.fullSync(true);
    const success = await this.syncPromise;
    if (success) {
      await this.setLastSync();
      this.platformUtilsService.showToast("success", null, this.i18nService.t("syncingComplete"));
    } else {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("syncingFailed"));
    }
  }

  async setLastSync() {
    const last = await this.syncService.getLastSync();
    if (last != null) {
      this.lastSync = last.toLocaleDateString() + " " + last.toLocaleTimeString();
    } else {
      this.lastSync = this.i18nService.t("never");
    }
  }
}

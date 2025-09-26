import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router, RouterModule } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { BadgeComponent, ItemModule, ToastOptions, ToastService } from "@bitwarden/components";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "vault-settings-v2.component.html",
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    ItemModule,
    BadgeComponent,
  ],
})
export class VaultSettingsV2Component implements OnInit, OnDestroy {
  lastSync = "--";
  private userId$ = this.accountService.activeAccount$.pipe(getUserId);

  // Check if user is premium user, they will be able to archive items
  protected userCanArchive = toSignal(
    this.userId$.pipe(switchMap((userId) => this.cipherArchiveService.userCanArchive$(userId))),
  );

  // Check if user has archived items (does not check if user is premium)
  protected showArchiveFilter = toSignal(
    this.userId$.pipe(switchMap((userId) => this.cipherArchiveService.showArchiveVault$(userId))),
  );

  protected emptyVaultImportBadge$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) =>
      this.nudgeService.showNudgeBadge$(NudgeType.VaultSettingsImportNudge, userId),
    ),
  );

  constructor(
    private router: Router,
    private syncService: SyncService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private nudgeService: NudgesService,
    private accountService: AccountService,
    private cipherArchiveService: CipherArchiveService,
  ) {}

  async ngOnInit() {
    await this.setLastSync();
  }

  async ngOnDestroy(): Promise<void> {
    // When a user navigates away from the page, dismiss the empty vault import nudge
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.nudgeService.dismissNudge(NudgeType.VaultSettingsImportNudge, userId);
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

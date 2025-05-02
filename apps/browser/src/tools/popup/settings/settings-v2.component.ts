import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { combineLatest, firstValueFrom, map, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";
import { BrowserClientVendor } from "@bitwarden/common/autofill/types";
import { UserId } from "@bitwarden/common/types/guid";
import { BadgeComponent, ItemModule } from "@bitwarden/components";
import { NudgeStatus, VaultNudgesService, VaultNudgeType } from "@bitwarden/vault";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { AutofillBrowserSettingsService } from "../../../autofill/services/autofill-browser-settings.service";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "settings-v2.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    ItemModule,
    CurrentAccountComponent,
    BadgeComponent,
  ],
})
export class SettingsV2Component implements OnInit {
  VaultNudgeType = VaultNudgeType;
  showVaultBadge$: Observable<NudgeStatus> = new Observable();
  showAutofillBadge$: Observable<boolean> = new Observable();
  activeUserId: UserId | null = null;
  protected browserClientVendor: BrowserClientVendor = BrowserClientVendors.Unknown;

  constructor(
    private readonly vaultNudgesService: VaultNudgesService,
    private readonly accountService: AccountService,
    private readonly autofillBrowserSettingsService: AutofillBrowserSettingsService,
  ) {}
  async ngOnInit() {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.showVaultBadge$ = this.vaultNudgesService.showNudge$(
      VaultNudgeType.EmptyVaultNudge,
      this.activeUserId,
    );
    this.browserClientVendor = BrowserApi.getBrowserClientVendor(window);
    this.showAutofillBadge$ = combineLatest([
      this.vaultNudgesService.showNudge$(VaultNudgeType.AutofillNudge, this.activeUserId),
      this.autofillBrowserSettingsService.browserAutofillSettingOverridden$(
        this.browserClientVendor,
      ),
    ]).pipe(
      map(([nudgeStatus, isOverridden]) => {
        if (isOverridden) {
          return false;
        }
        return nudgeStatus.hasBadgeDismissed === false;
      }),
    );
  }

  async dismissBadge(type: VaultNudgeType) {
    if (!(await firstValueFrom(this.showVaultBadge$)).hasBadgeDismissed) {
      await this.vaultNudgesService.dismissNudge(type, this.activeUserId as UserId, true);
    }
  }
}

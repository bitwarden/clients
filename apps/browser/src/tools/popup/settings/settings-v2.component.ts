import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import {
  combineLatest,
  filter,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
} from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BadgeComponent, ItemModule } from "@bitwarden/components";

import { CurrentAccountComponent } from "../../../auth/popup/account-switching/current-account.component";
import { AutofillBrowserSettingsService } from "../../../autofill/services/autofill-browser-settings.service";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "settings-v2.component.html",
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
  NudgeType = NudgeType;
  activeUserId: UserId | null = null;
  protected isBrowserAutofillSettingOverridden = false;

  private authenticatedAccount$: Observable<Account> = this.accountService.activeAccount$.pipe(
    filter((account): account is Account => account !== null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  showDownloadBitwardenNudge$: Observable<boolean> = this.authenticatedAccount$.pipe(
    switchMap((account) =>
      this.nudgesService.showNudgeBadge$(NudgeType.DownloadBitwarden, account.id),
    ),
  );

  showVaultBadge$: Observable<boolean> = this.authenticatedAccount$.pipe(
    switchMap((account) =>
      this.nudgesService.showNudgeBadge$(NudgeType.EmptyVaultNudge, account.id),
    ),
  );

  showAutofillBadge$: Observable<boolean> = combineLatest([
    this.autofillBrowserSettingsService.defaultBrowserAutofillDisabled$,
    this.authenticatedAccount$,
  ]).pipe(
    switchMap(([defaultBrowserAutofillDisabled, account]) =>
      this.nudgesService.showNudgeBadge$(NudgeType.AutofillNudge, account.id).pipe(
        map((badgeStatus) => {
          return !defaultBrowserAutofillDisabled && badgeStatus;
        }),
      ),
    ),
  );

  protected isNudgeFeatureEnabled$ = this.configService.getFeatureFlag$(
    FeatureFlag.PM8851_BrowserOnboardingNudge,
  );

  constructor(
    private readonly nudgesService: NudgesService,
    private readonly accountService: AccountService,
    private readonly autofillBrowserSettingsService: AutofillBrowserSettingsService,
    private readonly configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.isBrowserAutofillSettingOverridden =
      await this.autofillBrowserSettingsService.isBrowserAutofillSettingOverridden(
        BrowserApi.getBrowserClientVendor(window),
      );
  }

  async dismissBadge(type: NudgeType) {
    if (await firstValueFrom(this.showVaultBadge$)) {
      const account = await firstValueFrom(this.authenticatedAccount$);
      await this.nudgesService.dismissNudge(type, account.id as UserId, true);
    }
  }
}

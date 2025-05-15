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
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
  activeUserId: UserId | null = null;
  protected isBrowserAutofillSettingOverridden = false;

  private authenticatedAccount$: Observable<Account> = this.accountService.activeAccount$.pipe(
    filter((account): account is Account => account !== null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  downloadBitwardenNudgeStatus$: Observable<NudgeStatus> = this.authenticatedAccount$.pipe(
    switchMap((account) =>
      this.vaultNudgesService.showNudge$(VaultNudgeType.DownloadBitwarden, account.id),
    ),
  );

  showVaultBadge$: Observable<NudgeStatus> = this.authenticatedAccount$.pipe(
    switchMap((account) =>
      this.vaultNudgesService.showNudge$(VaultNudgeType.EmptyVaultNudge, account.id),
    ),
  );

  showAutofillBadge$: Observable<boolean> = combineLatest([
    this.autofillBrowserSettingsService.defaultBrowserAutofillDisabled$,
    this.authenticatedAccount$,
  ]).pipe(
    switchMap(([defaultBrowserAutofillDisabled, account]) =>
      this.vaultNudgesService.showNudge$(VaultNudgeType.AutofillNudge, account.id).pipe(
        map((nudgeStatus) => {
          return !defaultBrowserAutofillDisabled && nudgeStatus.hasBadgeDismissed === false;
        }),
      ),
    ),
  );

  protected isNudgeFeatureEnabled$ = this.configService.getFeatureFlag$(
    FeatureFlag.PM8851_BrowserOnboardingNudge,
  );

  constructor(
    private readonly vaultNudgesService: VaultNudgesService,
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

  async dismissBadge(type: VaultNudgeType) {
    if (!(await firstValueFrom(this.showVaultBadge$)).hasBadgeDismissed) {
      const account = await firstValueFrom(this.authenticatedAccount$);
      await this.vaultNudgesService.dismissNudge(type, account.id as UserId, true);
    }
  }
}

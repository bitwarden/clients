import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import {
  combineLatest,
  filter,
  firstValueFrom,
  from,
  map,
  Observable,
  shareReplay,
  switchMap,
} from "rxjs";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { SpotlightComponent } from "@bitwarden/angular/vault/components/spotlight/spotlight.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { UserId } from "@bitwarden/common/types/guid";
import {
  BadgeComponent,
  DialogService,
  ItemModule,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";

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
    SpotlightComponent,
    TypographyModule,
    LinkModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsV2Component {
  NudgeType = NudgeType;

  protected isBrowserAutofillSettingOverridden$ = from(
    this.autofillBrowserSettingsService.isBrowserAutofillSettingOverridden(
      BrowserApi.getBrowserClientVendor(window),
    ),
  );

  private authenticatedAccount$: Observable<Account> = this.accountService.activeAccount$.pipe(
    filter((account): account is Account => account !== null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  protected hasPremium$ = this.authenticatedAccount$.pipe(
    switchMap((account) => this.accountProfileStateService.hasPremiumFromAnySource$(account.id)),
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

  constructor(
    private readonly nudgesService: NudgesService,
    private readonly accountService: AccountService,
    private readonly autofillBrowserSettingsService: AutofillBrowserSettingsService,
    private readonly accountProfileStateService: BillingAccountProfileStateService,
    private readonly dialogService: DialogService,
  ) {}

  protected openUpgradeDialog() {
    PremiumUpgradeDialogComponent.open(this.dialogService);
  }

  async dismissBadge(type: NudgeType) {
    if (await firstValueFrom(this.showVaultBadge$)) {
      const account = await firstValueFrom(this.authenticatedAccount$);
      await this.nudgesService.dismissNudge(type, account.id as UserId, true);
    }
  }
}

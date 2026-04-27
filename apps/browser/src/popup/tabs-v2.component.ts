import { Component } from "@angular/core";
import { combineLatest, map, Observable, startWith, switchMap } from "rxjs";


import { NudgesService } from "@bitwarden/angular/vault";
import {
  VaultInactive,
  VaultActive,
  GeneratorInactive,
  GeneratorActive,
  SendInactive,
  SendActive,
  SettingsInactive,
  SettingsActive,
  AlertsInactive,
  AlertsActive,
} from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { NavButton } from "../platform/popup/layout/popup-tab-navigation.component";
import { PersonalVaultAlertService } from "../vault/popup/services/personal-vault-alert.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-tabs-v2",
  templateUrl: "./tabs-v2.component.html",
  standalone: false,
  providers: [PersonalVaultAlertService],
})
export class TabsV2Component {
  private hasActiveBadges$ = this.accountService.activeAccount$
    .pipe(getUserId)
    .pipe(switchMap((userId) => this.nudgesService.hasActiveBadges$(userId)));

  private showSettingsBerry$ = combineLatest([
    this.hasActiveBadges$,
    this.autofillSettingsService.showClipboardSettingUpdateNotification$,
  ]).pipe(map(([hasBadges, showClipboard]) => hasBadges || showClipboard));

  private reportsEnabled$ = this.configService
    .getFeatureFlag$(FeatureFlag.EnableBrowserReportsTab)
    .pipe(startWith(false));

  private alertsBerry$ = this.alertService.totalCount$.pipe(
    map((count) => count > 0),
    startWith(false),
  );

  protected navButtons$: Observable<NavButton[]> = combineLatest([
    this.showSettingsBerry$,
    this.reportsEnabled$,
    this.alertsBerry$,
  ]).pipe(
    startWith([false, false, false] as [boolean, boolean, boolean]),
    map(([showSettingsBerry, reportsEnabled, alertsBerry]) => {
      const buttons: NavButton[] = [
        {
          label: "vault",
          page: "/tabs/vault",
          icon: VaultInactive,
          iconActive: VaultActive,
        },
        {
          label: "generator",
          page: "/tabs/generator",
          icon: GeneratorInactive,
          iconActive: GeneratorActive,
        },
        {
          label: "send",
          page: "/tabs/send",
          icon: SendInactive,
          iconActive: SendActive,
        },
      ];

      if (reportsEnabled) {
        buttons.push({
          label: "reports",
          page: "/tabs/reports",
          icon: AlertsInactive,
          iconActive: AlertsActive,
          showBerry: alertsBerry,
        });
      }

      buttons.push({
        label: "settings",
        page: "/tabs/settings",
        icon: SettingsInactive,
        iconActive: SettingsActive,
        showBerry: showSettingsBerry,
      });

      return buttons;
    }),
  );

  constructor(
    private nudgesService: NudgesService,
    private accountService: AccountService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private configService: ConfigService,
    private alertService: PersonalVaultAlertService,
  ) {}
}

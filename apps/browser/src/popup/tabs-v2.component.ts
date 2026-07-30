import { Component, inject } from "@angular/core";
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
  HealthInactive,
  HealthActive,
} from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { BottomNavigationButton } from "@bitwarden/components";
import { SendPolicyService } from "@bitwarden/send-ui";

import { HealthAccessService } from "../dirt/health/popup/services/health-access.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-tabs-v2",
  templateUrl: "./tabs-v2.component.html",
  standalone: false,
})
export class TabsV2Component {
  private sendPolicyService = inject(SendPolicyService);
  private healthAccessService = inject(HealthAccessService);

  private userId$ = this.accountService.activeAccount$.pipe(getUserId);
  private hasActiveBadges$ = this.userId$.pipe(
    switchMap((userId) => this.nudgesService.hasActiveBadges$(userId)),
  );

  private showSettingsBerry$ = combineLatest([
    this.hasActiveBadges$,
    this.autofillSettingsService.showClipboardSettingUpdateNotification$,
  ]).pipe(map(([hasBadges, showClipboard]) => hasBadges || showClipboard));

  private sendEnabled$ = this.sendPolicyService.disableSend$.pipe(
    map((disableSend) => !disableSend),
  );

  private healthEnabled$ = this.userId$.pipe(
    switchMap((userId) => this.healthAccessService.healthEnabled$(userId)),
  );

  protected navButtons$: Observable<BottomNavigationButton[]> = combineLatest([
    this.showSettingsBerry$.pipe(startWith(false)),
    this.sendEnabled$.pipe(startWith(true)),
    this.healthEnabled$.pipe(startWith(false)),
  ]).pipe(
    map(([showBerry, sendEnabled, healthEnabled]) => {
      const buttons: BottomNavigationButton[] = [
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
        ...(sendEnabled
          ? [
              {
                label: "send",
                page: "/tabs/send",
                icon: SendInactive,
                iconActive: SendActive,
              } as BottomNavigationButton,
            ]
          : []),
        ...(healthEnabled
          ? [
              {
                label: "health",
                page: "/tabs/health",
                icon: HealthInactive,
                iconActive: HealthActive,
                showBerry: true, // TODO: only show berry when the User has not yet run a health report (PM-39075)
              } as BottomNavigationButton,
            ]
          : []),
        {
          label: "settings",
          page: "/tabs/settings",
          icon: SettingsInactive,
          iconActive: SettingsActive,
          showBerry,
        },
      ];
      return buttons;
    }),
  );

  constructor(
    private nudgesService: NudgesService,
    private accountService: AccountService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
  ) {}
}

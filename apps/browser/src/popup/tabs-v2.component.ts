import { Component } from "@angular/core";
import { map, Observable, startWith, switchMap } from "rxjs";

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
} from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

import { NavButton } from "../platform/popup/layout/popup-tab-navigation.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-tabs-v2",
  templateUrl: "./tabs-v2.component.html",
  standalone: false,
})
export class TabsV2Component {
  private hasActiveBadges$ = this.accountService.activeAccount$
    .pipe(getUserId)
    .pipe(switchMap((userId) => this.nudgesService.hasActiveBadges$(userId)));
  protected navButtons$: Observable<NavButton[]> = this.hasActiveBadges$.pipe(
    startWith(false),
    map((hasBadges) => {
      return [
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
        {
          label: "settings",
          page: "/tabs/settings",
          icon: SettingsInactive,
          iconActive: SettingsActive,
          showBerry: hasBadges,
        },
      ];
    }),
  );
  constructor(
    private nudgesService: NudgesService,
    private accountService: AccountService,
  ) {}
}

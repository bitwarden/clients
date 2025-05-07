import { Component, OnInit } from "@angular/core";
import { combineLatest, firstValueFrom, map, Observable } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { UserId } from "@bitwarden/common/types/guid";
import { VaultNudgesService } from "@bitwarden/vault";

@Component({
  selector: "app-tabs-v2",
  templateUrl: "./tabs-v2.component.html",
})
export class TabsV2Component implements OnInit {
  private activeUserId: UserId | null = null;
  protected navButtons$: Observable<
    {
      label: string;
      page: string;
      iconKey: string;
      iconKeyActive: string;
      showBerry?: boolean;
    }[]
  > = new Observable();
  constructor(
    private vaultNudgesService: VaultNudgesService,
    private accountService: AccountService,
    private readonly configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    this.navButtons$ = combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.PM8851_BrowserOnboardingNudge),
      this.vaultNudgesService.hasActiveBadges$(this.activeUserId),
    ]).pipe(
      map(([onboardingFeatureEnabled, hasBadges]) => {
        return [
          {
            label: "vault",
            page: "/tabs/vault",
            iconKey: "lock",
            iconKeyActive: "lock-f",
          },
          {
            label: "generator",
            page: "/tabs/generator",
            iconKey: "generate",
            iconKeyActive: "generate-f",
          },
          {
            label: "send",
            page: "/tabs/send",
            iconKey: "send",
            iconKeyActive: "send-f",
          },
          {
            label: "settings",
            page: "/tabs/settings",
            iconKey: "cog",
            iconKeyActive: "cog-f",
            showBerry: onboardingFeatureEnabled && hasBadges,
          },
        ];
      }),
    );
  }
}

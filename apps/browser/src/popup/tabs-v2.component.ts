import { Component } from "@angular/core";
import { combineLatest, map, Observable } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Icons } from "@bitwarden/components";
import { HasNudgeService } from "@bitwarden/vault";

import { NavButton } from "../platform/popup/layout/popup-tab-navigation.component";

@Component({
  selector: "app-tabs-v2",
  templateUrl: "./tabs-v2.component.html",
  providers: [HasNudgeService],
})
export class TabsV2Component {
  constructor(
    private readonly hasNudgeService: HasNudgeService,
    private readonly configService: ConfigService,
  ) {}

  protected navButtons$: Observable<NavButton[]> = combineLatest([
    this.configService.getFeatureFlag$(FeatureFlag.PM8851_BrowserOnboardingNudge),
    this.hasNudgeService.shouldShowNudge$(),
  ]).pipe(
    map(([onboardingFeatureEnabled, showNudge]) => {
      return [
        {
          label: "vault",
          page: "/tabs/vault",
          icon: Icons.VaultInactive,
          iconActive: Icons.VaultActive,
        },
        {
          label: "generator",
          page: "/tabs/generator",
          icon: Icons.GeneratorInactive,
          iconActive: Icons.GeneratorActive,
        },
        {
          label: "send",
          page: "/tabs/send",
          icon: Icons.SendInactive,
          iconActive: Icons.SendActive,
        },
        {
          label: "settings",
          page: "/tabs/settings",
          icon: Icons.SettingsInactive,
          iconActive: Icons.SettingsActive,
          showBerry: onboardingFeatureEnabled && showNudge,
        },
      ];
    }),
  );
}

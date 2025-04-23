import { Component } from "@angular/core";
import { combineLatest, map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { HasNudgeService } from "@bitwarden/vault";

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

  protected navButtons$ = combineLatest([
    this.configService.getFeatureFlag$(FeatureFlag.PM8851_BrowserOnboardingNudge),
    this.hasNudgeService.shouldShowNudge$(),
  ]).pipe(
    map(([onboardingFeatureEnabled, showNudge]) => {
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
          showBerry: onboardingFeatureEnabled && showNudge,
        },
      ];
    }),
  );
}

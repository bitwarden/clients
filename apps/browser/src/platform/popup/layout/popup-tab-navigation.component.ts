import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LinkModule } from "@bitwarden/components";
import { VaultBerryComponent } from "@bitwarden/vault";

@Component({
  selector: "popup-tab-navigation",
  templateUrl: "popup-tab-navigation.component.html",
  standalone: true,
  imports: [CommonModule, LinkModule, RouterModule, JslibModule, VaultBerryComponent],
  host: {
    class: "tw-block tw-h-full tw-w-full tw-flex tw-flex-col",
  },
})
export class PopupTabNavigationComponent {
  @Input() showBerry = false;
  isNudgeFeatureEnabled = false;

  showNotification(label: string) {
    return this.isNudgeFeatureEnabled && this.showBerry && label === "settings";
  }

  buttonTitle(label: string) {
    return this.showNotification(label) ? "settingsWithNotification" : label;
  }

  navButtons = [
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
    },
  ];

  constructor(private readonly configService: ConfigService) {
    firstValueFrom(this.configService.getFeatureFlag$(FeatureFlag.PM8851_BrowserOnboardingNudge))
      .then((isEnabled) => {
        this.isNudgeFeatureEnabled = isEnabled;
      })
      .catch(() => {});
  }
}

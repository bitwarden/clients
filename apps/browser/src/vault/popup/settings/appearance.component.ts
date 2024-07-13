import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { AnimationControlService } from "@bitwarden/common/platform/abstractions/animation-control.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { enableAccountSwitching } from "../../../platform/flags";

@Component({
  selector: "vault-appearance",
  templateUrl: "appearance.component.html",
})
export class AppearanceComponent implements OnInit {
  enableFavicon = false;
  enableBadgeCounter = true;
  theme: ThemeType;
  themeOptions: any[];
  accountSwitcherEnabled = false;
  enableRoutingAnimation: boolean;

  constructor(
    private messagingService: MessagingService,
    private domainSettingsService: DomainSettingsService,
    private badgeSettingsService: BadgeSettingsServiceAbstraction,
    i18nService: I18nService,
    private themeStateService: ThemeStateService,
    private animationControlService: AnimationControlService,
  ) {
    this.themeOptions = [
      { name: i18nService.t("default"), value: ThemeType.System },
      { name: i18nService.t("light"), value: ThemeType.Light },
      { name: i18nService.t("dark"), value: ThemeType.Dark },
      { name: "Nord", value: ThemeType.Nord },
      { name: i18nService.t("solarizedDark"), value: ThemeType.SolarizedDark },
    ];

    this.accountSwitcherEnabled = enableAccountSwitching();
  }

  async ngOnInit() {
    this.enableRoutingAnimation = await firstValueFrom(
      this.animationControlService.enableRoutingAnimation$,
    );

    this.enableFavicon = await firstValueFrom(this.domainSettingsService.showFavicons$);

    this.enableBadgeCounter = await firstValueFrom(this.badgeSettingsService.enableBadgeCounter$);

    this.theme = await firstValueFrom(this.themeStateService.selectedTheme$);
  }

  async updateRoutingAnimation() {
    await this.animationControlService.setEnableRoutingAnimation(this.enableRoutingAnimation);
  }

  async updateFavicon() {
    await this.domainSettingsService.setShowFavicons(this.enableFavicon);
  }

  async updateBadgeCounter() {
    await this.badgeSettingsService.setEnableBadgeCounter(this.enableBadgeCounter);
    this.messagingService.send("bgUpdateContextMenu");
  }

  async saveTheme() {
    await this.themeStateService.setSelectedTheme(this.theme);
  }
}

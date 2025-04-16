import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LinkModule } from "@bitwarden/components";

export type NavButton = {
  label: string;
  page: string;
  iconKey: string;
  iconKeyActive: string;
  showBerry?: boolean;
};

@Component({
  selector: "popup-tab-navigation",
  templateUrl: "popup-tab-navigation.component.html",
  standalone: true,
  imports: [CommonModule, LinkModule, RouterModule, JslibModule],
  host: {
    class: "tw-block tw-h-full tw-w-full tw-flex tw-flex-col",
  },
})
export class PopupTabNavigationComponent {
  @Input() showBerry = false;

  constructor(private i18nService: I18nService) {}

  get navButtons() {
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
        showBerry: this.showBerry,
      },
    ];
  }

  buttonTitle(navButton: NavButton) {
    const labelText = this.i18nService.t(navButton.label);
    return navButton.showBerry ? this.i18nService.t("labelWithNotification", labelText) : labelText;
  }
}

import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Icon, IconModule, LinkModule } from "@bitwarden/components";

export type NavButton = {
  label: string;
  page: string;
  icon: Icon;
  iconActive: Icon;
  showBerry?: boolean;
};

@Component({
  selector: "popup-tab-navigation",
  templateUrl: "popup-tab-navigation.component.html",
  imports: [CommonModule, LinkModule, RouterModule, JslibModule, IconModule],
  host: {
    class: "tw-block tw-h-full tw-w-full tw-flex tw-flex-col",
  },
})
export class PopupTabNavigationComponent {
  @Input() navButtons: NavButton[] = [];

  constructor(private i18nService: I18nService) {}

  buttonTitle(navButton: NavButton) {
    const labelText = this.i18nService.t(navButton.label);
    return navButton.showBerry ? this.i18nService.t("labelWithNotification", labelText) : labelText;
  }
}

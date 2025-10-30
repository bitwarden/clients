import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Icon } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IconModule, LinkModule } from "@bitwarden/components";

export type NavButton = {
  label: string;
  page: string;
  icon: Icon;
  iconActive: Icon;
  showBerry?: boolean;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "popup-tab-navigation",
  templateUrl: "popup-tab-navigation.component.html",
  imports: [CommonModule, LinkModule, RouterModule, JslibModule, IconModule],
  host: {
    class: "tw-block tw-h-screen tw-w-screen tw-flex tw-flex-col",
  },
})
export class PopupTabNavigationComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() navButtons: NavButton[] = [];

  constructor(private i18nService: I18nService) {}

  buttonTitle(navButton: NavButton) {
    const labelText = this.i18nService.t(navButton.label);
    return navButton.showBerry ? this.i18nService.t("labelWithNotification", labelText) : labelText;
  }
}

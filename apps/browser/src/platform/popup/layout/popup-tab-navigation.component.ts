import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { RouterModule } from "@angular/router";

import { BitSvg } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { A11yTitleDirective, SvgModule, BerryComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type NavButton = {
  label: string;
  page: string;
  icon: BitSvg;
  iconActive: BitSvg;
  showBerry?: boolean;
};

@Component({
  selector: "popup-tab-navigation",
  templateUrl: "popup-tab-navigation.component.html",
  imports: [RouterModule, SvgModule, BerryComponent, A11yTitleDirective, I18nPipe],
  host: {
    class: "tw-size-full tw-flex tw-flex-col",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopupTabNavigationComponent {
  private readonly i18nService = inject(I18nService);

  readonly navButtons = input<NavButton[]>([]);

  protected buttonTitle(navButton: NavButton) {
    const labelText = this.i18nService.t(navButton.label);
    return navButton.showBerry ? this.i18nService.t("labelWithNotification", labelText) : labelText;
  }
}

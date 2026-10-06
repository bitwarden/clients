import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { RouterModule } from "@angular/router";

import { BitSvg } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { A11yTitleDirective } from "../a11y";
import { BerryComponent } from "../berry";
import { SvgModule } from "../svg";

export type BottomNavigationButton = {
  label: string;
  page: string;
  icon: BitSvg;
  iconActive: BitSvg;
  showBerry?: boolean;
};

@Component({
  selector: "bit-bottom-navigation",
  templateUrl: "bottom-navigation.component.html",
  imports: [RouterModule, SvgModule, BerryComponent, A11yTitleDirective, I18nPipe],
  host: {
    class: "tw-block",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNavigationComponent {
  private readonly i18nService = inject(I18nService);

  readonly navButtons = input<BottomNavigationButton[]>([]);

  protected buttonTitle(navButton: BottomNavigationButton) {
    const labelText = this.i18nService.t(navButton.label);
    return navButton.showBerry ? this.i18nService.t("labelWithNotification", labelText) : labelText;
  }
}

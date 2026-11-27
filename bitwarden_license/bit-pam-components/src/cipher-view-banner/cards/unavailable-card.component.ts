import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import { CardComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BannerCardHeaderComponent } from "./banner-card-header.component";

/** No request right now: the rule refuses it, or another member holds its only lease. */
@Component({
  selector: "app-pam-unavailable-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [CardComponent, BannerCardHeaderComponent, I18nPipe],
  templateUrl: "./unavailable-card.component.html",
})
export class UnavailableCardComponent {
  readonly slotTaken = input(false);

  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}

import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import { CardComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BannerCardHeaderComponent } from "./banner-card-header.component";

/**
 * Explains why the item went back to masked after a lease ran out on its own, with any projected
 * action.
 */
@Component({
  selector: "app-pam-access-ended-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [CardComponent, BannerCardHeaderComponent, I18nPipe],
  templateUrl: "./access-ended-card.component.html",
})
export class AccessEndedCardComponent {
  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}

import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import { CardComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BannerCardHeaderComponent } from "./banner-card-header.component";

/** The rule refuses a new request right now, for example outside its IP allowlist; no action. */
@Component({
  selector: "app-pam-unavailable-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [CardComponent, BannerCardHeaderComponent, I18nPipe],
  templateUrl: "./unavailable-card.component.html",
})
export class UnavailableCardComponent {
  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}

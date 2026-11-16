import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import { CardComponent, IconModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { DurationLongPipe } from "../../date/duration-long.pipe";
import type { RequestTerms } from "../request-terms";

import { BannerCardHeaderComponent } from "./banner-card-header.component";

/**
 * The resting state of an item the user can request, with the rule's cap when it is known. Projected
 * content, such as the host's action, follows the cap.
 */
@Component({
  selector: "app-pam-request-access-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [
    CardComponent,
    BannerCardHeaderComponent,
    IconModule,
    TypographyModule,
    DurationLongPipe,
    I18nPipe,
  ],
  templateUrl: "./request-access-card.component.html",
})
export class RequestAccessCardComponent {
  readonly terms = input<RequestTerms | null>(null);

  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}

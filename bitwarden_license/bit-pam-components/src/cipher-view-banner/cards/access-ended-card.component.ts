import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import { CardComponent, IconTileComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** Explains why the item went back to masked after a lease ran out on its own. */
@Component({
  selector: "app-pam-access-ended-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [CardComponent, IconTileComponent, TypographyModule, I18nPipe],
  templateUrl: "./access-ended-card.component.html",
})
export class AccessEndedCardComponent {
  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}

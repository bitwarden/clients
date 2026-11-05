import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ACCESS_BADGE_LOOK } from "@bitwarden/bit-pam";
import { CardComponent, IconTileComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** The licensing block, which replaces every other state. */
@Component({
  selector: "app-pam-unlicensed-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [CardComponent, IconTileComponent, TypographyModule, I18nPipe],
  templateUrl: "./unlicensed-card.component.html",
})
export class UnlicensedCardComponent {
  protected readonly badgeLook = ACCESS_BADGE_LOOK;
}

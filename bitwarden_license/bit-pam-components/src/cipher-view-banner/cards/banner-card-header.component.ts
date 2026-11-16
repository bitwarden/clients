import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import {
  BitwardenIcon,
  IconTileComponent,
  IconTileVariant,
  TypographyModule,
} from "@bitwarden/components";

/** A banner card's icon tile beside its title and an optional description. */
@Component({
  selector: "app-pam-banner-card-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-block" },
  imports: [IconTileComponent, TypographyModule],
  templateUrl: "./banner-card-header.component.html",
})
export class BannerCardHeaderComponent {
  readonly icon = input.required<BitwardenIcon>();
  readonly variant = input.required<IconTileVariant>();
}

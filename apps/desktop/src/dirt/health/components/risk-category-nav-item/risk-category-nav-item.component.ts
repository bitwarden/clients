import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { RouterModule } from "@angular/router";

import {
  BitwardenIcon,
  IconComponent,
  IconTileComponent,
  IconTileVariant,
  ItemModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** A Health Overview row for one risk category, linking to its detail list. */
@Component({
  selector: "dirt-risk-category-nav-item",
  templateUrl: "./risk-category-nav-item.component.html",
  // display: contents so bit-item-content, not this wrapper, is the flex child and spans the row.
  host: { class: "tw-contents" },
  imports: [RouterModule, ItemModule, IconTileComponent, IconComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskCategoryNavItemComponent {
  /** i18n key for the title when the count is 0; takes no placeholder. */
  readonly labelKeyNone = input.required<string>();
  /** i18n key for the title when the count is 1; the string hard-codes the "1". */
  readonly labelKeySingular = input.required<string>();
  /** i18n key for the title at higher counts; takes the count as its placeholder. */
  readonly labelKeyPlural = input.required<string>();
  readonly descriptionKey = input.required<string>();
  readonly descriptionKeyNone = input.required<string>();
  readonly count = input.required<number>();
  readonly icon = input.required<BitwardenIcon>();
  readonly variant = input<IconTileVariant>("primary");
  readonly locked = input(false);
  readonly route = input.required<string>();

  protected readonly isHealthy = computed(() => this.count() === 0);

  // No plural helper exists and one English string can't read correctly at 0, 1 and N.
  protected readonly labelKey = computed(() => {
    switch (this.count()) {
      case 0:
        return this.labelKeyNone();
      case 1:
        return this.labelKeySingular();
      default:
        return this.labelKeyPlural();
    }
  });

  protected readonly activeDescriptionKey = computed(() =>
    this.isHealthy() ? this.descriptionKeyNone() : this.descriptionKey(),
  );

  protected readonly tileIcon = computed<BitwardenIcon>(() =>
    this.isHealthy() ? "bwi-check" : this.icon(),
  );

  protected readonly tileVariant = computed<IconTileVariant>(() =>
    this.isHealthy() ? "success" : this.variant(),
  );
}

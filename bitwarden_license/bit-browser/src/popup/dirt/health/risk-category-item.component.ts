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

/**
 * A single row on the Health Overview: one vault-health risk category with its
 * deduplicated at-risk count and a link to that category's detail list.
 *
 * Presentational — it derives everything from its inputs and emits no events.
 *
 * Renders the `<a bit-item-content>` only. The surrounding `<bit-item>` is
 * supplied by the consumer so that sibling rows are true siblings, which
 * `bit-item-group`'s compact-mode corner rounding depends on.
 */
@Component({
  selector: "dirt-risk-category-item",
  templateUrl: "./risk-category-item.component.html",
  imports: [RouterModule, ItemModule, IconTileComponent, IconComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskCategoryItemComponent {
  /** Localization key for the category name, e.g. "exposedPasswords". */
  readonly labelKey = input.required<string>();
  /** Localization key for the one-line description under the name. */
  readonly descriptionKey = input.required<string>();
  /** Number of at-risk logins counted under this category. */
  readonly count = input.required<number>();
  /** BWI icon shown in the leading icon tile. */
  readonly icon = input.required<BitwardenIcon>();
  /** Icon tile theme. */
  readonly variant = input<IconTileVariant>("primary");
  /** Router path for this category's Risk Category Detail. */
  readonly route = input.required<string>();

  /**
   * A category with no at-risk items is healthy. It still renders, showing a
   * count of zero and a checkmark, so the state never depends on colour alone.
   */
  protected readonly isHealthy = computed(() => this.count() === 0);
}

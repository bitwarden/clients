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
 * deduplicated at-risk count, navigating to that category's detail list. Named
 * for the navigation so it stays distinct from the rows inside a category,
 * which list individual logins.
 */
@Component({
  selector: "dirt-risk-category-nav-item",
  templateUrl: "./risk-category-nav-item.component.html",
  // display: contents so bit-item-content, not this wrapper, is the flex child
  // of bit-item-action and can span the full row width.
  host: { class: "tw-contents" },
  imports: [RouterModule, ItemModule, IconTileComponent, IconComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskCategoryNavItemComponent {
  /**
   * Localization key for the title when the count is 0, e.g.
   * "exposedPasswordsNone". Takes no placeholder.
   */
  readonly labelKeyNone = input.required<string>();
  /**
   * Localization key for the title when the count is exactly 1, e.g.
   * "exposedPassword". The string hard-codes the "1" and takes no placeholder,
   * matching the reviewXAtRiskPassword convention.
   */
  readonly labelKeySingular = input.required<string>();
  /**
   * Localization key for the title at any higher count, e.g.
   * "exposedPasswordsPlural". Takes the count as its one placeholder.
   */
  readonly labelKeyPlural = input.required<string>();
  /** Localization key for the one-line description under the name. */
  readonly descriptionKey = input.required<string>();
  /** Localization key for the description when the count is 0. */
  readonly descriptionKeyNone = input.required<string>();
  /** Number of at-risk logins counted under this category. */
  readonly count = input.required<number>();
  /** BWI icon shown in the leading icon tile while the category has items. */
  readonly icon = input.required<BitwardenIcon>();
  /** Icon tile theme while the category has items. */
  readonly variant = input<IconTileVariant>("primary");
  /** Router path for this category's Risk Category Detail. */
  readonly route = input.required<string>();

  /**
   * A category with no at-risk items is healthy. It still renders, so the list
   * of categories is the same length whatever the vault looks like.
   */
  protected readonly isHealthy = computed(() => this.count() === 0);

  /**
   * The title carries the count, per the design. English has no single form
   * that reads correctly at 0, 1 and N, and the repo has no plural helper, so
   * the three strings are separate keys chosen here.
   */
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

  /** Healthy rows describe the absence of risk rather than what the risk is. */
  protected readonly activeDescriptionKey = computed(() =>
    this.isHealthy() ? this.descriptionKeyNone() : this.descriptionKey(),
  );

  /** The healthy state replaces the category icon with a check, per the design. */
  protected readonly tileIcon = computed<BitwardenIcon>(() =>
    this.isHealthy() ? "bwi-check" : this.icon(),
  );

  protected readonly tileVariant = computed<IconTileVariant>(() =>
    this.isHealthy() ? "success" : this.variant(),
  );
}

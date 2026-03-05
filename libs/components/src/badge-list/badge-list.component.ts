import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BadgeModule, BadgeVariant } from "../badge";

function transformMaxItems(value: number | undefined) {
  return value == null ? undefined : Math.max(1, value);
}

/**
 * Displays a collection of badges in a horizontal, wrapping layout.
 *
 * The component automatically handles overflow by showing a limited number of badges
 * followed by a "+N more" badge when `maxItems` is specified and exceeded.
 *
 * Each badge inherits the `variant` and `truncate` settings, ensuring visual consistency
 * across the list. Badges are separated by commas for screen readers to improve accessibility.
 */
@Component({
  selector: "bit-badge-list",
  templateUrl: "badge-list.component.html",
  imports: [BadgeModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeListComponent {
  /**
   * The visual variant to apply to all badges in the list.
   */
  readonly variant = input<BadgeVariant>("primary");

  /**
   * Items to display as badges.
   */
  readonly items = input<string[]>([]);

  /**
   * Whether to truncate long badge text with ellipsis.
   */
  readonly truncate = input(true);

  /**
   * Maximum number of badges to display before showing a "+N more" badge.
   */
  readonly maxItems = input(undefined, { transform: transformMaxItems });

  protected readonly filteredItems = computed(() => {
    const maxItems = this.maxItems();
    const items = this.items();

    if (maxItems == null || items.length <= maxItems) {
      return items;
    }
    return items.slice(0, maxItems - 1);
  });

  protected readonly isFiltered = computed(() => {
    return this.items().length > this.filteredItems().length;
  });
}

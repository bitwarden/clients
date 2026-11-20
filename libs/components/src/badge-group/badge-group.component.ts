import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BadgeComponent, BadgeModule } from "../badge";
import { ChipActionComponent } from "../chips";
import { OverflowItemDirective } from "../overflow-list/overflow-item.directive";
import { OverflowListDirective } from "../overflow-list/overflow-list.directive";
import { OverflowTriggerDirective } from "../overflow-list/overflow-trigger.directive";
import { PopoverModule } from "../popover";
import { PopoverPanelComponent } from "../popover/popover-panel.component";

/** A single badge rendered by {@link BadgeGroupComponent}. */
export type BadgeGroupItem = {
  /** Text shown inside the badge. */
  label: string;
} & {
  [K in "variant" | "startIcon"]?: ReturnType<BadgeComponent[K]>;
};

/**
 * Displays a collection of badges in a horizontal row that doesn't wrap. Badges
 * that don't fit the container width are hidden via `bitOverflowList`, and a
 * "+N" action chip is rendered at the end. Clicking the chip opens a popover
 * that lists the hidden badges.
 *
 * Badges are passed as data through the `badges` input; the group renders both
 * the row and the popover from that data, so variant, icon, and label are
 * described per-item rather than authored as markup. The first badge is pinned,
 * so at least one badge is always visible regardless of available width.
 *
 * Sizing is fully measurement-driven; the group does not take a `maxItems`
 * input. Resize the container and more or fewer badges become visible.
 */
@Component({
  selector: "bit-badge-group",
  templateUrl: "badge-group.component.html",
  imports: [
    BadgeModule,
    ChipActionComponent,
    PopoverModule,
    PopoverPanelComponent,
    OverflowItemDirective,
    OverflowListDirective,
    OverflowTriggerDirective,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeGroupComponent {
  readonly badges = input<BadgeGroupItem[]>([]);

  private readonly list = viewChild.required(OverflowListDirective);

  protected readonly overflow = computed(() => this.list().overflow());

  /** The hidden badges, in original order, rendered inside the popover. */
  protected readonly overflowBadges = computed(() => {
    const badges = this.badges();
    return this.overflow()
      .map((i) => badges[i])
      .filter((badge) => badge != null);
  });

  constructor() {
    // Labels/variants change in place under `track $index`, so the item instances stay
    // the same and the list won't remeasure on its own.
    effect(() => {
      this.badges();
      this.list().remeasure({ reset: true });
    });
  }
}

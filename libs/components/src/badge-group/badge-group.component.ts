import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  viewChild,
} from "@angular/core";

import { BadgeModule } from "../badge";
import { OverflowItemDirective } from "../overflow-list/overflow-item.directive";
import { OverflowListDirective } from "../overflow-list/overflow-list.directive";
import { OverflowTriggerDirective } from "../overflow-list/overflow-trigger.directive";
import { TooltipDirective } from "../tooltip/tooltip.directive";

/**
 * Displays a collection of projected badges in a horizontal row that doesn't
 * wrap. Badges that don't fit the container width are hidden via
 * `bitOverflowList`, and a "+N" overflow badge is rendered at the end with a
 * tooltip listing the hidden badges' text.
 *
 * The consumer authors each `<bit-badge>` directly — variant, icon, label,
 * truncation, etc. are owned per-badge. The first badge is pinned, so at
 * least one badge is always visible regardless of available width (matches
 * the "one full chip" minimum-width rule from the chip column spec).
 *
 * Sizing is fully measurement-driven; the group does not take a `maxItems`
 * input. Resize the container and more or fewer badges become visible.
 */
@Component({
  selector: "bit-badge-group",
  templateUrl: "badge-group.component.html",
  imports: [BadgeModule, OverflowListDirective, OverflowTriggerDirective, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeGroupComponent {
  protected readonly items = contentChildren(OverflowItemDirective, { descendants: true });
  private readonly list = viewChild.required(OverflowListDirective);

  protected readonly overflow = computed(() => this.list().overflow());
  protected readonly hiddenLabels = computed(() => {
    const overflow = this.overflow();
    const items = this.items();
    return overflow
      .map((i) => items[i]?.elementRef.nativeElement.textContent?.trim() ?? "")
      .filter(Boolean)
      .join(", ");
  });

  constructor() {
    effect(() => {
      const items = this.items();
      items.forEach((item, i) => item.pinned.set(i === 0));
    });
  }
}

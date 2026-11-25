import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { BadgeComponent, BadgeVariant } from "@bitwarden/components";

/**
 * A member's status badge, with an optional tooltip that replaces the badge's default one.
 *
 * This lives in its own component because `BadgeComponent` applies `TooltipDirective` as a host
 * directive. The members table also imports `TooltipDirective` for its icons, so binding
 * `[bitTooltip]` on a badge there would match the directive twice (NG0309).
 */
@Component({
  selector: "app-member-status-badge",
  template: `<span
    bitBadge
    class="focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-border-focus"
    tabindex="0"
    [variant]="variant()"
    [bitTooltip]="tooltip()"
    [addTooltipToDescribedby]="tooltip().length > 0"
    >{{ label() }}</span
  >`,
  imports: [BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberStatusBadgeComponent {
  readonly label = input.required<string>();
  readonly variant = input.required<BadgeVariant>();
  /** An empty tooltip lets the badge fall back to showing its own text. */
  readonly tooltip = input("");
}

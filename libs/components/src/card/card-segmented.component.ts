import { ChangeDetectionStrategy, Component } from "@angular/core";

import { BaseCardDirective } from "./base-card/base-card.directive";

/**
 * A bordered, rounded card that draws a full-width horizontal divider between each of
 * its direct children. Makes no assumptions about segment content — project any
 * elements you like; each segment is responsible for its own padding and layout
 * (`<bit-card-content>` is a convenient choice for standard card padding).
 *
 * Note: dividers are drawn between *direct* children (Tailwind `divide-y`), so each
 * segment must be a direct child of `bit-card-segmented`. `@if` / `@for` blocks are fine;
 * wrapping segments in an intermediate element removes the dividers.
 */
@Component({
  selector: "bit-card-segmented",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-flex tw-flex-col tw-divide-y tw-divide-solid tw-divide-border-base",
  },
  hostDirectives: [BaseCardDirective],
})
export class SegmentedCardComponent {}

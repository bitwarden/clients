import { ChangeDetectionStrategy, Component } from "@angular/core";

import { BaseCardDirective } from "./base-card/base-card.directive";

/**
 * A basic bordered container with assumed padding. Use for grouping related content into a single
 * block.
 *
 * Reach for `bit-card-segmented` instead when the content is multiple rows or sections separated by
 * full-width dividers.
 */
@Component({
  selector: "bit-card",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-p-4 [@media(min-width:769px)]:tw-p-6",
  },
  hostDirectives: [BaseCardDirective],
})
export class CardComponent {}

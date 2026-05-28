import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { TypographyModule } from "../../typography";

/**
 * Layout helper for cells that need a leading icon, title, subtitle, and/or
 * trailing affordance. Mirrors the slot vocabulary of `<bit-item-content>`
 * (`slot=start`, default, `slot=secondary`, `slot=end`) so a single mental
 * model spans list items and table cells.
 *
 * Intended to live inside a `<bit-column>`'s cell template; the host adds no
 * padding because `bitCell` on the surrounding `<td>` already supplies it.
 */
@Component({
  selector: "bit-cell-content, [bit-cell-content]",
  imports: [TypographyModule, NgClass],
  template: `
    <ng-content select="[slot=start]"></ng-content>

    <div class="tw-flex tw-flex-col tw-min-w-0 tw-flex-grow">
      <div
        bitTypography="body2"
        class="tw-text-main"
        [ngClass]="truncate() ? 'tw-truncate' : 'tw-text-wrap tw-break-words'"
      >
        <ng-content></ng-content>
      </div>
      <div
        bitTypography="helper"
        class="tw-text-muted"
        [ngClass]="truncate() ? 'tw-truncate' : 'tw-text-wrap tw-break-words'"
      >
        <ng-content select="[slot=secondary]"></ng-content>
      </div>
    </div>

    <div class="tw-flex tw-gap-2 tw-items-center">
      <ng-content select="[slot=end]"></ng-content>
    </div>
  `,
  host: {
    class: "tw-flex tw-gap-2 tw-items-center tw-min-w-0 tw-w-full tw-text-main",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitCellContentComponent {
  /** Truncate title and subtitle on overflow. Default: true. */
  readonly truncate = input(true);
}

import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { TypographyModule } from "../../typography";

/**
 * A body cell. Renders a `<div role="cell">` internally with cell sizing
 * (height, padding) and the slot vocabulary for rich cells: `slot=start`,
 * default, `slot=secondary`, `slot=end`.
 *
 * The component host is `display: contents` so the inner cell div becomes
 * the direct grid item of the parent `<bit-row>`. Vertical centering is
 * handled by the inner div's flex layout (replacing the table-cell
 * `vertical-align: middle` of the previous `<td>`-based implementation).
 *
 * Plain cells use only the default slot — `<bit-cell>{{ value }}</bit-cell>` —
 * and the slot layout collapses around the single child.
 */
@Component({
  selector: "bit-cell",
  templateUrl: "./bit-cell.component.html",
  imports: [NgClass, TypographyModule],
  host: {
    class: "tw-contents",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitCellComponent {
  /** Truncate the default and secondary slots on overflow. Default `true`. */
  readonly truncate = input(true);
}

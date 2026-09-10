import { NgClass } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";

import { TypographyModule } from "../../typography";

import { TABLE_PRESENTATION } from "./table-presentation";

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
 *
 * Also available as an attribute (`<label bit-cell>`) when the cell needs to be
 * a specific element — e.g. a `label` so the whole cell toggles a checkbox
 * inside it.
 */
@Component({
  selector: "bit-cell, [bit-cell]",
  templateUrl: "./bit-cell.component.html",
  imports: [NgClass, TypographyModule],
  host: {
    class: "tw-contents",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitCellComponent {
  private readonly presentation = inject(TABLE_PRESENTATION, { optional: true });

  /**
   * `bit-item`'s global stylesheet spaces end-slot children by content type (text,
   * button, icon button). In `list` the cell opts into those tiers by tagging its own end
   * slot; `table` keeps the uniform gap.
   */
  protected readonly isItemEndSlot = computed(() => this.presentation?.() === "list");

  /** Truncate the default and secondary slots on overflow. Default `true`. */
  readonly truncate = input(true);
}

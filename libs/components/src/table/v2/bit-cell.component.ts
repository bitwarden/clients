import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

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
 *
 * Also available as an attribute (`<label bit-cell>`) when the cell needs to be
 * a specific element — e.g. a `label` so the whole cell toggles a checkbox
 * inside it.
 */
@Component({
  selector: "bit-cell, [bit-cell]",
  templateUrl: "./bit-cell.component.html",
  imports: [TypographyModule],
  host: {
    class: "tw-contents",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitCellComponent {
  /** Truncate the default and secondary slots on overflow. Default `true`. */
  readonly truncate = input(true);

  /**
   * Overflow behavior shared by the default and secondary slots.
   *
   * Not using `tw-truncate` because it applies `overflow-hidden`, but we need `overflow-clip` so
   * the clip region can be pushed out by `overflow-clip-margin`. That lets the focus ring of
   * interactive content paint instead of being clipped off; 4px covers the widest ring in the
   * library, and matches the clip margin `<bit-row>` uses for the same reason. Text still ellipses:
   * `text-overflow` applies to any non-`visible` overflow.
   */
  protected readonly contentClasses = computed(() =>
    this.truncate()
      ? "tw-overflow-clip [overflow-clip-margin:4px] tw-text-ellipsis tw-whitespace-nowrap"
      : "tw-text-wrap tw-break-words",
  );
}

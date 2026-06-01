import { NgClass } from "@angular/common";
import {
  AfterContentChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  signal,
  viewChild,
} from "@angular/core";

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
export class BitCellComponent implements AfterContentChecked {
  /** Truncate the default and secondary slots on overflow. Default `true`. */
  readonly truncate = input(true);

  protected readonly secondarySlot = viewChild<ElementRef<HTMLDivElement>>("secondarySlot");
  protected readonly endSlot = viewChild<ElementRef<HTMLDivElement>>("endSlot");

  protected readonly hasSecondary = signal(false);
  protected readonly hasEnd = signal(false);

  ngAfterContentChecked(): void {
    this.hasSecondary.set((this.secondarySlot()?.nativeElement.childElementCount ?? 0) > 0);
    this.hasEnd.set((this.endSlot()?.nativeElement.childElementCount ?? 0) > 0);
  }
}

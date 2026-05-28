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
 * Styles and lays out a body cell. Applies cell sizing (height, padding,
 * vertical centering) via its host on the `<td>` element, and provides the
 * slot vocabulary for rich cells: `slot=start`, default, `slot=secondary`,
 * `slot=end`.
 *
 * Plain cells use only the default slot — `<td bit-cell>{{ value }}</td>` —
 * and the slot layout collapses around the single child.
 */
@Component({
  selector: "td[bit-cell]",
  templateUrl: "./bit-cell.component.html",
  imports: [NgClass, TypographyModule],
  host: {
    class: "tw-h-16 tw-px-4 tw-py-0 tw-align-middle",
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

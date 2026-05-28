import { Directive } from "@angular/core";

/**
 * Applies cell styling (height, horizontal padding, vertical centering) to a
 * `<td>` inside a `*bitColumnFor` template. The corresponding header
 * directive is {@link BitHeaderCellComponent} on `<th bit-cell>`.
 */
@Directive({
  selector: "td[bit-cell]",
  host: {
    class: "tw-h-16 tw-px-4 tw-py-0 tw-align-middle",
  },
})
export class BitCellDirective {}

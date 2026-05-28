import { Directive, InjectionToken, input } from "@angular/core";

import { BitColumnComponent } from "./bit-column.component";

/**
 * Provides the active `<bit-column>` to descendants of a stamped header /
 * cell template. The table wraps every template-outlet with the column-
 * context directive so the bit-cell components can find their column via DI
 * — DI lookup from the stamped element walks the rendered DOM tree (not the
 * authoring tree), so this provider is the only way for the stamped cell to
 * reach back to its source column.
 */
export const BIT_COLUMN_CONTEXT = new InjectionToken<BitColumnContextDirective>(
  "BIT_COLUMN_CONTEXT",
);

@Directive({
  selector: "[bitColumnContext]",
  providers: [{ provide: BIT_COLUMN_CONTEXT, useExisting: BitColumnContextDirective }],
})
export class BitColumnContextDirective {
  readonly bitColumnContext = input.required<BitColumnComponent>();
}

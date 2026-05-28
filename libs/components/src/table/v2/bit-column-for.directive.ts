import { Directive, TemplateRef, computed, inject, input } from "@angular/core";

import { ColumnRef } from "../table-data-source";

/**
 * Structural directive that captures the per-row cell template for a column.
 * The required input is a typed {@link ColumnRef} (typically
 * `dataSource.columns.foo` or `dataSource.synthetic('actions')`) — the brand
 * carries the row type `T`, so `let-row` is narrowed to `T` via
 * {@link ngTemplateContextGuard}.
 *
 * Used inside `<bit-column>`; the column reads `template` and `name` to
 * register itself with the table.
 */
@Directive({
  selector: "[bitColumnFor]",
})
export class BitColumnForDirective<T = unknown, K extends string = string> {
  /** Column reference carrying the column key and the row type. */
  readonly bitColumnFor = input.required<ColumnRef<T, K>>();

  readonly template = inject<TemplateRef<{ $implicit: T }>>(TemplateRef);

  /** The runtime column key (the branded string unwrapped to a plain string). */
  readonly name = computed(() => this.bitColumnFor() as string);

  static ngTemplateContextGuard<T, K extends string>(
    _dir: BitColumnForDirective<T, K>,
    ctx: unknown,
  ): ctx is { $implicit: T } {
    return true;
  }
}

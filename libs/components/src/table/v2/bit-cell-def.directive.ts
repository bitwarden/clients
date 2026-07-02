import { Directive, TemplateRef, computed, inject, input } from "@angular/core";

import { ColumnRef } from "./column";

/**
 * Structural directive that captures the per-row cell template for a column.
 * The input is a typed {@link ColumnRef} (e.g. `table.columns.foo`) — the brand
 * carries the row type `T`, so
 * `let-row` is narrowed to `T` via {@link ngTemplateContextGuard}. The context's
 * `$implicit` is the whole row, so rich cells can read sibling fields and action
 * cells can read the row id.
 *
 * Used inside `<bit-column>`; the column reads `template` and `name` to register
 * itself with the table. The input is intentionally not `required`: when the
 * column lives inside a wrapper component, the table can read {@link name}
 * (during registration) before the wrapper's binding resolves, so the column key
 * is `undefined` for a tick rather than throwing `NG0950`. `<bit-column>` and the
 * table both tolerate a transiently-undefined name.
 */
@Directive({
  selector: "[bitCellDef]",
})
export class BitCellDefDirective<T = unknown, K extends string = string> {
  /** Column reference carrying the column key and the row type. */
  readonly bitCellDef = input<ColumnRef<T, K>>();

  readonly template = inject<TemplateRef<{ $implicit: T }>>(TemplateRef);

  /** The runtime column key (the branded string unwrapped to a plain string). */
  readonly name = computed(() => this.bitCellDef() as string | undefined);

  static ngTemplateContextGuard<T, K extends string>(
    _dir: BitCellDefDirective<T, K>,
    ctx: unknown,
  ): ctx is { $implicit: T } {
    return true;
  }
}

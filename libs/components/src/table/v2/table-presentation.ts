import { InjectionToken, Signal } from "@angular/core";

/**
 * How `<bit-table-v2>` draws its rows. `"table"` is the bordered column grid;
 * `"list"` wraps each row in a `bit-item` card.
 */
export type TablePresentation = "table" | "list";

/**
 * The enclosing table's {@link TablePresentation}, provided by `<bit-table-v2>`.
 *
 * Its own file so descendants don't import the table component, which would close an
 * import cycle and break the standalone `imports` metadata. Cells are declared in the
 * table's view, so their injector reaches the table but not the `bit-item` around them.
 */
export const TABLE_PRESENTATION = new InjectionToken<Signal<TablePresentation>>(
  "TABLE_PRESENTATION",
);

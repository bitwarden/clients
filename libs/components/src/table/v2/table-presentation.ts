import { InjectionToken, Signal } from "@angular/core";

/**
 * How `<bit-table-v2>` draws its rows. `"table"` is the bordered column grid;
 * `"list"` wraps each row in a `bit-item` card.
 */
export type TablePresentation = "table" | "list";

/**
 * The enclosing table's {@link TablePresentation}, provided by `<bit-table-v2>`.
 *
 * Lives in its own file so descendants can read the presentation without importing the
 * table component, which would close an import cycle and break the standalone `imports`
 * metadata. Cell templates are declared in the table's own view, so a descendant's node
 * injector reaches the table but not the `bit-row` or `bit-item` it's stamped into.
 */
export const TABLE_PRESENTATION = new InjectionToken<Signal<TablePresentation>>(
  "TABLE_PRESENTATION",
);

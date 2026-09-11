import { InjectionToken, Signal } from "@angular/core";

/** How `<bit-table-v2>` draws its rows. */
export type TablePresentation = "table" | "list";

/** The enclosing table's {@link TablePresentation}. */
export const TABLE_PRESENTATION = new InjectionToken<Signal<TablePresentation>>(
  "TABLE_PRESENTATION",
);

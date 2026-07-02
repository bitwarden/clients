import { Signal } from "@angular/core";

import { ColumnRefs, createColumnRefs } from "./column";

/**
 * The typed contract for a `bit-table-v2`, bound via `[tableDef]`. It carries the
 * row type `T` and declared synthetic column names `S` (see [Synthetic columns]),
 * plus the row {@link data} and the typed {@link columns} references. Everything
 * else (sort, displayed columns, loading, filter, selection, pagination) is
 * configured with inputs on the table and its helper components.
 *
 * It exists for the one thing inputs can't do: thread `T`/`S` across the
 * `<bit-table-v2>` ↔ `*bitCellDef` boundary so `let row` and the column keys are
 * strictly typed. Prefer the {@link defineTable} factory to construct one.
 *
 * @example
 * ```ts
 * const table = defineTable<Member, "actions">(members);
 * table.columns.email; // typed ColumnRef, drives `*bitCellDef`'s `let row`
 * ```
 */
export class TableDef<T, S extends string = never> {
  /**
   * Typed column references for `*bitCellDef` — `columns.email` is a branded
   * `ColumnRef`. Only declared columns are valid keys, so a typo fails to compile.
   */
  readonly columns: ColumnRefs<T, S> = createColumnRefs<T, S>();

  /**
   * @param data Row data as a signal — the table filters and sorts it for display.
   *   Pass a writable signal and update it to change rows reactively.
   */
  constructor(readonly data: Signal<T[]>) {}
}

/**
 * Creates a {@link TableDef}. `data` is the row signal; any future options will
 * come as a second argument.
 *
 * @example
 * ```ts
 * protected readonly table = defineTable<Member, "actions">(this.members);
 * ```
 */
export function defineTable<T, S extends string = never>(data: Signal<T[]>): TableDef<T, S> {
  return new TableDef<T, S>(data);
}

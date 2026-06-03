import { signal, WritableSignal } from "@angular/core";

/**
 * A column key paired with the row type it targets. Looks like a plain string
 * at runtime; carries the row type `T` at the type level so binding it to
 * `*bitCellDef` gives strict typing on `let row` and on the column key. Obtain
 * one from {@link ColumnModel.ref}.
 */
export type ColumnRef<T, K extends string = string> = K & {
  readonly __columnRef?: T;
};

/** A valid column name for a row type `T` plus declared synthetic columns `S`. */
export type ColumnName<T, S extends string = never> = (keyof T & string) | S;

type ColumnRefs<T, S extends string> = {
  readonly [K in keyof T & string]: ColumnRef<T, K>;
} & { readonly [K in S]: ColumnRef<T, K> };

/**
 * Column identity and display state for `bit-table-v2`. The row type `T` types
 * the field columns; declare synthetic columns (actions, select, etc.) via the
 * second type parameter `S`.
 *
 * `<bit-column>` / `*bitCellDef` declare what each column renders, matched back
 * to this model by name; {@link displayedColumns} decides which of them show
 * and in what order.
 *
 * @example
 * ```ts
 * const columns = new ColumnModel<Member, "actions">(["name", "email", "actions"]);
 * columns.ref.name;     // ColumnRef<Member, "name">
 * columns.displayedColumns.set(["email", "name"]); // reorder / hide
 * ```
 */
export class ColumnModel<T, S extends string = never> {
  /**
   * Typed column references for `*bitCellDef` — fields on `T` plus declared
   * synthetics `S`. Property access returns the name as a branded string.
   */
  readonly ref: ColumnRefs<T, S> = new Proxy({} as ColumnRefs<T, S>, {
    get: (_target, prop) => prop,
  });

  /**
   * The columns to display, in order. A column is shown iff it appears here, at
   * the position it appears; reorder or hide by setting a new array. Names with
   * no matching `<bit-column>` are ignored.
   */
  readonly displayedColumns: WritableSignal<readonly ColumnName<T, S>[]>;

  constructor(displayedColumns: readonly ColumnName<T, S>[]) {
    this.displayedColumns = signal(displayedColumns);
  }
}

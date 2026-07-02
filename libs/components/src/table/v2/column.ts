/**
 * A column key paired with the row type it targets. Looks like a plain string
 * at runtime; carries the row type `T` at the type level so binding it to
 * `*bitCellDef` gives strict typing on `let row` and on the column key. Obtain
 * one from {@link TableDef.columns}.
 */
export type ColumnRef<T, K extends string = string> = K & {
  readonly __columnRef?: T;
};

/** A valid column name for a row type `T` plus declared synthetic columns `S`. */
export type ColumnName<T, S extends string = never> = (keyof T & string) | S;

/**
 * Typed column references for a row type `T` plus declared synthetics `S`:
 * property access returns the column name as a branded {@link ColumnRef}. Only
 * declared columns exist as keys, so `table.columns.notAColumn` fails to compile.
 */
export type ColumnRefs<T, S extends string = never> = {
  readonly [K in keyof T & string]: ColumnRef<T, K>;
} & { readonly [K in S]: ColumnRef<T, K> };

/**
 * Builds the {@link ColumnRefs} proxy: every property access returns the
 * accessed key as a branded string, so `refs.email` is `ColumnRef<T, "email">`.
 */
export function createColumnRefs<T, S extends string = never>(): ColumnRefs<T, S> {
  return new Proxy({} as ColumnRefs<T, S>, {
    get: (_target, prop) => prop,
  });
}

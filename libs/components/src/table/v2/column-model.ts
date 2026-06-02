import { signal, Signal, WritableSignal } from "@angular/core";

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

export type ColumnModelConfig<T, S extends string> = {
  /** Explicit display order by name. Defaults to the order columns are declared. */
  order?: readonly ColumnName<T, S>[];
  /** Columns hidden initially. */
  hidden?: readonly ColumnName<T, S>[];
};

/**
 * Column identity, typed references, and layout state for `bit-table-v2` —
 * parallel to `TableDataSource` and `TableSelectionModel`, passed via
 * `[columns]`. The row type `T` types the field columns; declare synthetic
 * columns (actions, select, etc.) via the second type parameter `S`.
 *
 * It owns column *state* (order, visibility — width / reorder / pinning later),
 * not rendering: `<bit-column>` / `*bitCellDef` still declare what each column
 * renders, matched back to this model by name.
 *
 * @example
 * ```ts
 * const columns = new ColumnModel<Member, "actions">();
 * columns.ref.name;     // ColumnRef<Member, "name">
 * columns.ref.actions;  // ColumnRef<Member, "actions">
 * columns.hide("email");
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

  private readonly _order: WritableSignal<readonly string[] | undefined>;
  private readonly _hidden: WritableSignal<ReadonlySet<string>>;

  /** Explicit display order by name, or `undefined` to use declaration order. Read by the table. */
  readonly order: Signal<readonly string[] | undefined>;

  /** Currently hidden column names. Read by the table. */
  readonly hidden: Signal<ReadonlySet<string>>;

  constructor(config: ColumnModelConfig<T, S> = {}) {
    this._order = signal<readonly string[] | undefined>(config.order);
    this._hidden = signal<ReadonlySet<string>>(new Set(config.hidden ?? []));
    this.order = this._order.asReadonly();
    this.hidden = this._hidden.asReadonly();
  }

  isHidden(name: ColumnName<T, S>): boolean {
    return this._hidden().has(name);
  }

  /** Hides one or more columns. */
  hide(...names: ColumnName<T, S>[]): void {
    this._hidden.update((hidden) => new Set([...hidden, ...names]));
  }

  /** Shows one or more previously-hidden columns. */
  show(...names: ColumnName<T, S>[]): void {
    this._hidden.update((hidden) => {
      const next = new Set(hidden);
      names.forEach((name) => next.delete(name));
      return next;
    });
  }

  /** Shows all columns. */
  showAll(): void {
    this._hidden.set(new Set());
  }
}

import { Signal, signal } from "@angular/core";

import { ColumnModel, ColumnModelConfig } from "./column-model";
import { FilterModel, FilterModelConfig } from "./filter-model";
import { TableSelectionModel } from "./table-selection-model";

export type TableModelConfig<T, S extends string> = {
  /** Row data as a signal. Pass a writable signal and update it to change rows reactively. */
  data?: Signal<T[]>;
  /** Column identity, order, and visibility — see {@link ColumnModel}. */
  columns?: ColumnModelConfig<T, S>;
  /** Search and facet filtering — see {@link FilterModel}. */
  filter?: FilterModelConfig<T>;
  /** Row selection. Omit for a non-selectable table (no checkbox column). */
  selection?: { multiple?: boolean; initial?: T[]; canSelect?: (row: T) => boolean };
};

/**
 * The single construct a `bit-table-v2` is configured with, passed via
 * `[table]`. A thin facade composing the focused pieces — {@link data},
 * {@link columns}, {@link filter}, and optional {@link selection} — so a table
 * is built and bound once instead of wiring four inputs. They stay reachable
 * for typed refs and runtime ops; the table component reads them and owns the
 * runtime engine (filtering, sorting) and its reactive glue.
 *
 * @example
 * ```ts
 * const table = new TableModel<Member, "actions">({
 *   data: members, // Signal<Member[]>
 *   filter: { search: (r, t) => r.name.toLowerCase().includes(t.toLowerCase()) },
 *   selection: { multiple: true },
 * });
 * table.ref.name;            // typed column ref
 * table.filter.apply("...");
 * table.selection?.toggle(row);
 * ```
 */
export class TableModel<T, S extends string = never> {
  /** Current row data. The table filters and sorts it for display. */
  readonly data: Signal<T[]>;

  /** Column identity, typed references, order, and visibility. */
  readonly columns: ColumnModel<T, S>;

  /** Search term, facet definitions, applied state, and composed predicate. */
  readonly filter: FilterModel<T>;

  /** Selection state, present only when configured. */
  readonly selection?: TableSelectionModel<T>;

  constructor(config: TableModelConfig<T, S> = {}) {
    this.data = config.data ?? signal<T[]>([]);
    this.columns = new ColumnModel<T, S>(config.columns);
    this.filter = new FilterModel<T>(config.filter);
    if (config.selection) {
      this.selection = new TableSelectionModel<T>(
        config.selection.multiple ?? false,
        config.selection.initial ?? [],
        config.selection.canSelect ? { canSelect: config.selection.canSelect } : undefined,
      );
    }
  }

  /** Typed column references — shorthand for {@link columns}`.ref`. */
  get ref() {
    return this.columns.ref;
  }
}

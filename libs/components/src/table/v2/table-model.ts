import { TableDataSource } from "../table-data-source";

import { ColumnModel, ColumnModelConfig } from "./column-model";
import { FilterModel, FilterModelConfig } from "./filter-model";
import { TableSelectionModel } from "./table-selection-model";

export type TableModelConfig<T, S extends string> = {
  /** Initial row data. */
  data?: T[];
  /** Column identity, order, and visibility — see {@link ColumnModel}. */
  columns?: ColumnModelConfig<T, S>;
  /** Search and facet filtering — see {@link FilterModel}. */
  filter?: FilterModelConfig<T>;
  /** Row selection. Omit for a non-selectable table (no checkbox column). */
  selection?: { multiple?: boolean; initial?: T[]; canSelect?: (row: T) => boolean };
};

/**
 * The single construct a `bit-table-v2` is configured with, passed via
 * `[table]`. A thin facade that composes the focused sub-models — data
 * ({@link dataSource}), {@link columns}, {@link filter}, and optional
 * {@link selection}) — so a table is built and bound once instead of wiring
 * four inputs. The sub-models stay reachable for typed refs and runtime ops;
 * the table component reads them and owns the small reactive glue (applying
 * the filter predicate, scoping select-all to filtered rows).
 *
 * @example
 * ```ts
 * const table = new TableModel<Member, "actions">({
 *   data: members,
 *   columns: { synthetic: ["actions"] },
 *   filter: { search: (r, t) => r.name.toLowerCase().includes(t.toLowerCase()) },
 *   selection: { multiple: true },
 * });
 * table.ref.name;            // typed column ref
 * table.filter.apply("...");
 * table.selection?.toggle(row);
 * ```
 */
export class TableModel<T, S extends string = never> {
  /** Row data, sort state, and filter application. */
  readonly dataSource = new TableDataSource<T>();

  /** Column identity, typed references, order, and visibility. */
  readonly columns: ColumnModel<T, S>;

  /** Search term, facet definitions, applied state, and composed predicate. */
  readonly filter: FilterModel<T>;

  /** Selection state, present only when configured. */
  readonly selection?: TableSelectionModel<T>;

  constructor(config: TableModelConfig<T, S> = {}) {
    if (config.data) {
      this.dataSource.data = config.data;
    }
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

  /** Replaces the table data. */
  setData(data: T[]): void {
    this.dataSource.data = data;
  }
}

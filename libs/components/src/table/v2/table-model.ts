import { Signal, signal, WritableSignal } from "@angular/core";

import { Sort } from "../table-data-source";

import { ColumnModel, ColumnName } from "./column-model";
import { FilterDefinition, FiltersModel } from "./filters-model";
import { SearchModel } from "./search-model";
import { TableSelectionModel } from "./table-selection-model";

export type TableModelConfig<T, S extends string> = {
  /** Row data as a signal. Pass a writable signal and update it to change rows reactively. */
  data?: Signal<T[]>;
  /** Loading state. When `true`, the table shows skeleton rows. e.g. a resource's `isLoading`. */
  loading?: Signal<boolean>;
  /** Initial sort. Header clicks update it; read or set {@link TableModel.sort} programmatically. */
  sort?: Sort;
  /**
   * The columns to display, in order. A column is shown iff it appears here, at
   * the position it appears. Reorder or hide at runtime via
   * {@link TableModel.displayedColumns}.
   */
  displayedColumns: readonly ColumnName<T, S>[];
  /** How free-text search matches a row. Omit to disable search — see {@link SearchModel}. */
  search?: (row: T, term: string) => boolean;
  /** Available filter facets, applied by id — see {@link FiltersModel}. */
  filters?: FilterDefinition<T>[];
  /** Row selection. Omit for a non-selectable table (no checkbox column). */
  selection?: { multiple?: boolean; initial?: T[]; canSelect?: (row: T) => boolean };
};

/**
 * The single construct a `bit-table-v2` is configured with, passed via
 * `[table]`. A thin facade composing the focused pieces — {@link data},
 * {@link columns}, {@link search}, {@link filters}, and optional
 * {@link selection} — so a table is built and bound once instead of wiring
 * several inputs. They stay reachable for typed refs and runtime ops; the table
 * component reads them and owns the runtime engine (filtering, sorting) and its
 * reactive glue.
 *
 * @example
 * ```ts
 * const table = new TableModel<Member, "actions">({
 *   data: members, // Signal<Member[]>
 *   displayedColumns: ["name", "email", "actions"],
 *   search: (r, t) => r.name.toLowerCase().includes(t.toLowerCase()),
 *   selection: { multiple: true },
 * });
 * table.ref.name;            // typed column ref
 * table.filters.apply("...");
 * table.selection?.toggle(row);
 * ```
 */
export class TableModel<T, S extends string = never> {
  /** Current row data. The table filters and sorts it for display. */
  readonly data: Signal<T[]>;

  /** Whether the table is loading. When `true`, the table shows skeleton rows. */
  readonly loading: Signal<boolean>;

  /**
   * Active sort (`{ column, direction }`). Two-way: header clicks update it, and
   * you can read or set it programmatically (e.g. to persist/restore). The
   * comparator comes from the sorted column's `sortFn`, so this stays
   * serializable.
   */
  readonly sort: WritableSignal<Sort>;

  /** Column identity, typed references, and display order. */
  readonly columns: ColumnModel<T, S>;

  /** Free-text search state and matcher. */
  readonly search: SearchModel<T>;

  /** Facet-filter definitions, applied state, and matcher. */
  readonly filters: FiltersModel<T>;

  /** Selection state, present only when configured. */
  readonly selection?: TableSelectionModel<T>;

  constructor(config: TableModelConfig<T, S>) {
    this.data = config.data ?? signal<T[]>([]);
    this.loading = config.loading ?? signal(false);
    this.sort = signal<Sort>(config.sort ?? { direction: "asc" });
    this.columns = new ColumnModel<T, S>(config.displayedColumns);
    this.search = new SearchModel<T>(config.search);
    this.filters = new FiltersModel<T>(config.filters ?? []);
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

  /**
   * The columns shown, in order. Set a new array to reorder or hide. Shorthand
   * for {@link columns}`.displayedColumns`.
   */
  get displayedColumns() {
    return this.columns.displayedColumns;
  }
}

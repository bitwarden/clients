import { computed, Signal, signal, WritableSignal } from "@angular/core";

import { FilterControl } from "../../filter-menu/filter-tokens";

import { ColumnName, ColumnRefs, createColumnRefs } from "./column";
import { PaginationConfig, PaginationModel } from "./pagination-model";
import { SortModel, SortState } from "./sort-model";
import { TableSelectionModel } from "./table-selection-model";

export type TableModelConfig<T, S extends string = never, F = Record<string, unknown>> = {
  /** Row data as a signal. Pass a writable signal and update it to change rows reactively. */
  data?: Signal<T[]>;
  /** Loading state. When `true`, the table shows skeleton rows. e.g. a resource's `isLoading`. */
  loading?: Signal<boolean>;
  /** Initial sort. Header clicks update it; read or set {@link TableModel.sort} (a {@link SortModel}) programmatically. */
  sort?: SortState<ColumnName<T, S>>;
  /**
   * The columns to display, in order. A column is shown iff it appears here, at
   * the position it appears. Reorder or hide at runtime via
   * {@link TableModel.displayedColumns}.
   */
  displayedColumns: readonly ColumnName<T, S>[];
  /**
   * Client-side row test, given a row and the chips' combined value object
   * ({@link TableModel.filterValues}). Omit for server-side filtering — read
   * `filterValues` to build a query and feed pre-filtered rows to {@link data}.
   */
  filter?: (row: T, values: Partial<F>) => boolean;
  /** Initial filter values, keyed by chip `key`; seeds the matching chips on init. */
  filters?: Partial<F>;
  /** Row selection. Omit for a non-selectable table (no checkbox column). */
  selection?: { multiple?: boolean; initial?: T[]; canSelect?: (row: T) => boolean };
  /** Pagination. Omit for an unpaginated table (no paginator state) — see {@link PaginationModel}. */
  pagination?: PaginationConfig;
};

/**
 * The single construct a `bit-table-v2` is configured with, passed via
 * `[table]`. A thin facade composing the focused pieces — {@link data},
 * {@link columns}, optional {@link selection}, and optional {@link pagination} —
 * so a table is built and bound once instead of wiring several inputs. The model
 * owns sort state ({@link sort}) and the rendered set ({@link filtered}).
 *
 * Filtering follows a form-group model: filter chips (`bit-filter-chip` /
 * `bit-filter-toggle`) projected into the table register their keyed values, the
 * model collects them into {@link filterValues} (a `{ key: value }` object), and
 * applies the consumer's {@link TableModelConfig.filter} to derive {@link filtered}.
 * The consumer never wires per-chip state.
 *
 * @example
 * ```ts
 * type Filters = { type?: ItemType; favorites?: boolean };
 * const table = new TableModel<Member, "actions", Filters>({
 *   data: members, // Signal<Member[]>
 *   displayedColumns: ["name", "email", "actions"],
 *   filter: (row, f) => (!f.type || row.type === f.type) && (!f.favorites || row.favorite),
 *   filters: { type: "login" }, // initial
 *   selection: { multiple: true },
 * });
 * table.filterValues(); // { type: "login", ... }
 * ```
 */
export class TableModel<T, S extends string = never, F = Record<string, unknown>> {
  /** Current row data. The table filters and sorts it for display. */
  readonly data: Signal<T[]>;

  /** Whether the table is loading. When `true`, the table shows skeleton rows. */
  readonly loading: Signal<boolean>;

  /** Active sort state and transitions — read `sort.current`, call `sort.toggle`. */
  readonly sort: SortModel<ColumnName<T, S>>;

  /**
   * Typed column references for `*bitCellDef` — `table.columns.email` is a
   * branded `ColumnRef`. Only declared columns are valid keys, so a typo or a
   * non-column name fails to compile.
   */
  readonly columns: ColumnRefs<T, S>;

  /**
   * The columns to display, in order. A column is shown iff it appears here, at
   * the position it appears; set a new array to reorder or hide. Names with no
   * matching `<bit-column>` are ignored.
   */
  readonly displayedColumns: WritableSignal<readonly ColumnName<T, S>[]>;

  /** The consumer's client-side row test, applied with {@link filterValues}. */
  private readonly filterFn?: (row: T, values: Partial<F>) => boolean;

  /** Initial filter values to seed chips with; consumed once by the table component. */
  readonly initialFilters?: Partial<F>;

  /** Registered filter chips (from projection), the source of {@link filterValues}. */
  private readonly _filters = signal<readonly FilterControl[]>([]);

  /** Registered filter chips, exposed for the table component's initial-value seeding. */
  readonly filterControls = this._filters.asReadonly();

  /**
   * The chips' combined value, keyed by each chip's `key` — like a `FormGroup`'s
   * `.value`. Drives {@link filter} and is what you read for a server query.
   */
  readonly filterValues: Signal<Partial<F>> = computed(() => {
    const values: Record<string, unknown> = {};
    for (const control of this._filters()) {
      values[control.key()] = control.value();
    }
    return values as Partial<F>;
  });

  /**
   * Rows passing {@link TableModelConfig.filter} given {@link filterValues}
   * (pre-sort). The render set the table sorts and displays, and the scope for
   * select-all and the paginator count. With no `filter` configured this is
   * {@link data} unchanged.
   */
  readonly filtered: Signal<T[]> = computed(() => {
    const filter = this.filterFn;
    const data = this.data();
    if (!filter) {
      return data;
    }
    const values = this.filterValues();
    return data.filter((row) => filter(row, values));
  });

  /** How many chips currently have a selection — for an "N filters applied" affordance. */
  readonly appliedCount: Signal<number> = computed(
    () => this._filters().filter((f) => f.active()).length,
  );

  /** Selection state, present only when configured. */
  readonly selection?: TableSelectionModel<T>;

  /** Pagination state, present only when configured. */
  readonly pagination?: PaginationModel;

  constructor(config: TableModelConfig<T, S, F>) {
    this.data = config.data ?? signal<T[]>([]);
    this.loading = config.loading ?? signal(false);
    this.sort = new SortModel<ColumnName<T, S>>(config.sort);
    this.columns = createColumnRefs<T, S>();
    this.displayedColumns = signal(config.displayedColumns);
    this.filterFn = config.filter;
    this.initialFilters = config.filters;
    if (config.selection) {
      this.selection = new TableSelectionModel<T>({
        multiple: config.selection.multiple,
        initial: config.selection.initial,
        canSelect: config.selection.canSelect,
        rows: this.filtered,
      });
    }
    if (config.pagination) {
      // Server mode (a `length` is supplied) trusts the consumer's total; client
      // mode counts the filtered rows, which the model uses as the fallback.
      this.pagination = new PaginationModel(
        config.pagination,
        computed(() => this.filtered().length),
      );
    }
  }

  /**
   * Registers a filter chip. Called by {@link BitTableFilterDirective} when a chip
   * is projected into the table; its value lands in {@link filterValues}. Not a
   * stable external API.
   */
  registerFilter(control: FilterControl): void {
    this._filters.update((filters) => [...filters, control]);
  }

  /** @see {@link registerFilter} */
  unregisterFilter(control: FilterControl): void {
    this._filters.update((filters) => filters.filter((f) => f !== control));
  }
}

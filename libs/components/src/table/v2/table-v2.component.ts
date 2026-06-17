import { _isNumberValue } from "@angular/cdk/coercion";
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  TrackByFunction,
  booleanAttribute,
  computed,
  contentChild,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
} from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { FilterControl } from "../../filter-menu/filter-tokens";
import { NoItemsComponent } from "../../no-items/no-items.component";
import { SearchComponent } from "../../search/search.component";
import { SkeletonTextComponent } from "../../skeleton";
import { SortDirection, SortFn } from "../table-data-source";

import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderRowComponent } from "./bit-header-row.component";
import { BitRowComponent } from "./bit-row.component";
import { BitTablePaginatorComponent } from "./bit-table-paginator.component";
import { ColumnName } from "./column";
import { FILTER_HOST, FilterHost } from "./filter-host";
import { SortState, cycleSort } from "./sort-model";
import { TableDef } from "./table-def";
import { TableSelectionConfig, TableSelectionModel } from "./table-selection-model";

/** Grid track width for the internal selection (checkbox) column. */
const SELECTION_COLUMN_WIDTH = "40px";

/** The `filterValues` key a projected `bit-search`'s term is adopted under. */
const SEARCH_FILTER_KEY = "search";

/** Selection config a consumer supplies; the table provides the `rows` scope itself. */
export type SelectionConfig<T> = Omit<TableSelectionConfig<T>, "rows">;

/** Reads a column's value for default sorting, coercing numeric strings to numbers. */
function sortAccessor<T>(row: T, column: string): string | number {
  const value = (row as Record<string, unknown>)[column];
  if (_isNumberValue(value)) {
    const num = Number(value);
    return num < Number.MAX_SAFE_INTEGER ? num : (value as string);
  }
  return value as string | number;
}

/**
 * Returns a sorted copy of `data` by `column`/`direction`, using `fn` when the
 * column supplies one. The default comparison (number/string coercion, null
 * handling) is ported from Angular Material's `MatTableDataSource` (MIT,
 * Copyright (c) 2024 Google LLC). v1's `TableDataSource` carries its own copy;
 * the two are intentionally kept separate since v1 is on its way out.
 */
function sortRows<T>(
  data: readonly T[],
  column: string,
  direction: SortDirection,
  fn: SortFn | undefined,
): T[] {
  const dirMod = direction === "asc" ? 1 : -1;
  return [...data].sort((a, b) => {
    if (fn) {
      return fn(a, b, direction) * dirMod;
    }

    let valueA = sortAccessor(a, column);
    let valueB = sortAccessor(b, column);

    // Coerce mismatched types to strings so they order consistently.
    const typeA = typeof valueA;
    const typeB = typeof valueB;
    if (typeA !== typeB) {
      if (typeA === "number") {
        valueA += "";
      }
      if (typeB === "number") {
        valueB += "";
      }
    }

    if (typeof valueA === "string" && typeof valueB === "string") {
      return valueA.localeCompare(valueB) * dirMod;
    }

    // Existing values sort before missing ones; equal/both-missing stay put.
    let result = 0;
    if (valueA != null && valueB != null) {
      if (valueA > valueB) {
        result = 1;
      } else if (valueA < valueB) {
        result = -1;
      }
    } else if (valueA != null) {
      result = 1;
    } else if (valueB != null) {
      result = -1;
    }
    return result * dirMod;
  });
}

@Component({
  selector: "bit-table-v2",
  exportAs: "bitTableV2",
  templateUrl: "./table-v2.component.html",
  imports: [
    CommonModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    BitCellComponent,
    BitHeaderRowComponent,
    BitRowComponent,
    NoItemsComponent,
    SkeletonTextComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Filter chips projected into the table register against this host via the
  // `bitTableFilter` bridge; the table folds their values into `filtered`.
  providers: [{ provide: FILTER_HOST, useExisting: forwardRef(() => BitTableV2Component) }],
  host: {
    // In `fill` mode the host becomes a flex column that fills its parent's
    // height, so the table can hand a bounded height down to its scroll region.
    "[class.tw-flex]": "fill()",
    "[class.tw-flex-col]": "fill()",
    "[class.tw-flex-1]": "fill()",
    "[class.tw-min-h-0]": "fill()",
  },
})
export class BitTableV2Component<T = unknown, S extends string = never, F = Record<string, unknown>>
  implements AfterContentInit, FilterHost
{
  /**
   * The typed contract — row type `T`, synthetic columns `S`, filter shape `F` —
   * plus the row data and the typed `columns.*` references bound to `*bitCellDef`.
   * See {@link TableDef} / {@link defineTable}. Defaults to an empty definition, so
   * manual-mode tables need not bind it.
   */
  readonly tableDef = input(new TableDef<T, S>(signal<T[]>([])));

  /**
   * The columns to display, in order — a column shows iff it's listed, at the
   * position it's listed. Omit to show every projected `<bit-column>` in
   * declaration order. Set a new array to reorder or hide at runtime.
   */
  readonly displayedColumns = input<readonly ColumnName<T, S>[]>();

  /** Active sort (`{ column, direction }`). Two-way — header clicks cycle it; bind `[(sort)]` to persist. */
  readonly sort = model<SortState<ColumnName<T, S>>>({ direction: "asc" });

  /** When `true`, the table shows skeleton rows in place of data (e.g. a resource's `isLoading`). */
  readonly loading = input(false, { transform: booleanAttribute });

  /**
   * Client-side row test, given a row and the chips' combined value object
   * ({@link filterValues}). The table's filter-values type `F` is inferred from
   * this fn's `values` parameter — annotate it (`(row, f: Filters) => …`) to type
   * `filterValues()`. Omit for server-side filtering (read `filterValues` to build
   * a query and feed pre-filtered rows to the def's `data`).
   */
  readonly filter = input<(row: T, values: F) => boolean>();

  /** Initial filter values, keyed by chip `key`; seeds the matching chips once on init. */
  readonly filters = input<Partial<F>>();

  /** Row selection config. Omit for a non-selectable table (no checkbox column). */
  readonly selection = input<SelectionConfig<T>>();

  /** Emits the selected rows whenever the selection changes. */
  readonly selectedChange = output<readonly T[]>();

  /**
   * Fixed row height in pixels for virtual scrolling. Setting it turns the
   * table into a virtual scroll viewport — virtual scrolling needs predictable
   * row geometry, so give columns explicit widths. Needs a bounded height —
   * {@link maxHeight} or {@link fill}.
   */
  readonly virtualRowHeight = input<number>();

  /**
   * Max height of the table's scroll area, as any CSS length. When set, the body
   * scrolls within this bound and the header stays pinned; omit to grow to content.
   */
  readonly maxHeight = input<string>();

  /** Grow to fill the host's height and scroll the body within it (use in a bounded flex container). */
  readonly fill = input(false, { transform: booleanAttribute });

  /** Optional trackBy for the virtualized row list. */
  readonly trackBy = input<TrackByFunction<T>>();

  /** Number of skeleton rows to show while {@link loading} is true. */
  readonly loadingRows = input(3);

  /** A projected paginator, if any — owns the page state; the table reads it to slice. */
  private readonly paginator = contentChild(BitTablePaginatorComponent);

  /** Registered filter chips (from projection), the source of {@link filterValues}. */
  private readonly _filters = signal<readonly FilterControl[]>([]);

  /** Registered filter chips, exposed for initial-value seeding. */
  readonly filterControls = this._filters.asReadonly();

  /**
   * The chips' combined value, keyed by each chip's `key` — like a `FormGroup`'s
   * `.value`. Drives {@link filter} and is what you read for a server query.
   */
  readonly filterValues = computed<F>(() => {
    const values: Record<string, unknown> = {};
    for (const control of this._filters()) {
      values[control.key()] = control.value();
    }
    return values as F;
  });

  /**
   * Rows passing {@link filter} given {@link filterValues} (pre-sort). The render
   * set, the scope for select-all, and the paginator's total. With no `filter`
   * configured this is the model's data unchanged.
   */
  readonly filtered = computed<T[]>(() => {
    const filter = this.filter();
    const data = this.tableDef().data();
    if (!filter) {
      return data;
    }
    const values = this.filterValues();
    return data.filter((row) => filter(row, values));
  });

  /** The filtered row count — read by a projected `bit-table-paginator` for its total. */
  readonly filteredCount = computed(() => this.filtered().length);

  private readonly _selectionModel = signal<TableSelectionModel<T> | undefined>(undefined);

  /** Selection state, present only when {@link selection} is configured. */
  readonly selectionModel = this._selectionModel.asReadonly();

  /** Registers a projected filter chip. Called by the `bitTableFilter` bridge. */
  registerFilter(control: FilterControl): void {
    this._filters.update((filters) => [...filters, control]);
  }

  /** @see {@link registerFilter} */
  unregisterFilter(control: FilterControl): void {
    this._filters.update((filters) => filters.filter((f) => f !== control));
  }

  /** Chips already seeded from {@link filters}, so each is seeded at most once. */
  private readonly seeded = new WeakSet<FilterControl>();

  /**
   * A `bit-search` projected anywhere into the table (e.g. its toolbar). Adopted
   * automatically as a `search` filter — no bridge directive — so its term joins
   * {@link filterValues} under {@link SEARCH_FILTER_KEY}.
   */
  private readonly search = contentChild(SearchComponent, { descendants: true });

  constructor() {
    // Adopt a projected `bit-search` as a `search` filter control.
    effect((onCleanup) => {
      const search = this.search();
      if (!search) {
        return;
      }
      const control: FilterControl = {
        key: signal(SEARCH_FILTER_KEY),
        value: search.value,
        active: computed(() => (search.value() ?? "") !== ""),
        setValue: (value) => search.writeValue((value as string) ?? ""),
      };
      this.registerFilter(control);
      onCleanup(() => this.unregisterFilter(control));
    });

    // Seed chips from `filters` as they register and their keys resolve. Each chip
    // is seeded once; later user edits aren't undone.
    effect(() => {
      const initial = this.filters() as Record<string, unknown> | undefined;
      const controls = this._filters();
      if (!initial) {
        return;
      }
      for (const control of controls) {
        const key = control.key();
        if (key && key in initial && !this.seeded.has(control)) {
          this.seeded.add(control);
          control.setValue(initial[key]);
        }
      }
    });

    // (Re)build the selection model from config — in an effect, since the model's
    // constructor writes a signal (not allowed in a computed). Scoped over the
    // filtered rows for select-all.
    effect(() => {
      const config = this.selection();
      this._selectionModel.set(
        config ? new TableSelectionModel<T>({ ...config, rows: this.filtered }) : undefined,
      );
    });

    // Surface the selection to the consumer as it changes.
    effect(() => {
      const model = this.selectionModel();
      if (model) {
        this.selectedChange.emit(model.selected());
      }
    });
  }

  private readonly _columns = signal<BitColumnComponent[]>([]);

  /**
   * Whether any `<bit-column>` has been projected. When false, the table renders
   * in manual mode — the consumer's `<bit-header-row>` / `<bit-row>` render
   * directly with no column registry. Use column-def mode for sort, selection,
   * filter, or virtualization.
   */
  protected readonly hasColumns = computed(() => this._columns().length > 0);

  /**
   * Registered columns resolved against {@link displayedColumns}: shown in its
   * order, omitting any name with no registered `<bit-column>`. When
   * `displayedColumns` is omitted, every registered column shows in declaration order.
   */
  readonly effectiveColumns = computed(() => {
    const registered = this._columns();
    const displayed = this.displayedColumns();
    if (!displayed) {
      return registered;
    }
    const registry = new Map(registered.map((c) => [c.name(), c]));
    return displayed
      .map((name) => registry.get(name))
      .filter((c): c is BitColumnComponent => c !== undefined);
  });

  /**
   * Grid-template-columns string derived from the column registry, consumed by
   * `<bit-row>` and `<bit-header-row>`. `undefined` in manual mode.
   */
  readonly gridTemplateColumns = computed<string | undefined>(() => {
    const cols = this.effectiveColumns();
    if (cols.length === 0) {
      return undefined;
    }
    const parts: string[] = [];
    if (this.selectionModel()) {
      parts.push(SELECTION_COLUMN_WIDTH);
    }
    for (const col of cols) {
      parts.push(col.width() ?? "1fr");
    }
    return parts.join(" ");
  });

  /** Registers a column. Called by {@link BitColumnComponent} via DI. */
  register(col: BitColumnComponent): void {
    this._columns.update((cols) => [...cols, col]);
  }

  /** @see {@link register} */
  unregister(col: BitColumnComponent): void {
    this._columns.update((cols) => cols.filter((c) => c !== col));
  }

  protected readonly isVirtualized = computed(() => this.virtualRowHeight() !== undefined);

  /** Outer container chrome: border, rounded corners, subtle shadow. Becomes a fill flex column in {@link fill} mode. */
  protected readonly containerClass = computed(() => [
    "tw-bg-bg-primary",
    "tw-border",
    "tw-border-solid",
    "tw-border-border-base",
    "tw-rounded-xl",
    "tw-overflow-clip",
    "tw-shadow-[0px_1px_0.5px_0.05px_rgba(29,41,61,0.02)]",
    ...(this.fill() ? ["tw-flex", "tw-min-h-0", "tw-flex-1", "tw-flex-col"] : []),
  ]);

  /**
   * Rendered rows: {@link filtered} sorted by {@link sort} (using the column's
   * `sortFn` or the default), then sliced to a projected paginator's page (unless
   * it's in server-side mode, where the data already holds only the page).
   */
  protected readonly rows = computed(() => {
    const filtered = this.filtered();
    const sort = this.sort();
    let sorted = filtered;
    if (sort.column) {
      const col = this.effectiveColumns().find((c) => c.name() === sort.column);
      sorted = sortRows(filtered, sort.column, sort.direction, sort.fn ?? col?.sortFn());
    }
    const paginator = this.paginator();
    if (paginator && !paginator.manual()) {
      const start = paginator.currentPage() * paginator.pageSize();
      return sorted.slice(start, start + paginator.pageSize());
    }
    return sorted;
  });

  /** Index array for the skeleton rows shown while loading. */
  protected readonly skeletonRows = computed(() => [...Array(this.loadingRows()).keys()]);

  /** Column-def mode, not loading, with no rows to render (empty or fully filtered out). */
  protected readonly isEmpty = computed(
    () => this.hasColumns() && !this.loading() && this.rows().length === 0,
  );

  /** Empty because filters excluded everything (there is data) vs. genuinely no data. */
  protected readonly noMatches = computed(
    () => this.isEmpty() && this.tableDef().data().length > 0,
  );

  /**
   * Pixel height for the virtual-scroll viewport: the rows' natural height capped
   * at {@link maxHeight}. The viewport needs an explicit height because CDK
   * positions rows absolutely, so they contribute no in-flow height.
   */
  protected readonly viewportHeight = computed<string | undefined>(() => {
    const rowHeight = this.virtualRowHeight();
    if (rowHeight === undefined) {
      return undefined;
    }
    const contentHeight = `${this.rows().length * rowHeight}px`;
    const max = this.maxHeight();
    return max ? `min(${max}, ${contentHeight})` : contentHeight;
  });

  private readonly logService = inject(LogService, { optional: true });

  ngAfterContentInit(): void {
    if (!this.hasColumns()) {
      if (this.selection()) {
        this.logService?.warning(
          "bit-table-v2: `selection` is configured but no `<bit-column>` was projected. " +
            "Selection requires column-def mode; no checkbox column will render.",
        );
      }
      return;
    }
    if (this.isVirtualized() && !this.maxHeight() && !this.fill()) {
      this.logService?.warning(
        "bit-table-v2: virtualization (`virtualRowHeight`) needs a bounded height — set `maxHeight` " +
          "or `fill` (inside a bounded container). Without one the viewport collapses and no rows render.",
      );
    }
    if (this.isVirtualized() && this.paginator()) {
      this.logService?.warning(
        "bit-table-v2: a paginator and virtualization (`virtualRowHeight`) are mutually exclusive — " +
          "virtualization already renders large sets efficiently.",
      );
    }
    // Seed the initial sort from the first column declaring `defaultSort`, unless
    // a sort column is already set (e.g. via `[(sort)]`).
    if (!this.sort().column) {
      const defaultCol = this.effectiveColumns().find((c) => c.defaultSort());
      const name = defaultCol?.name();
      if (name) {
        this.sort.set({
          column: name as ColumnName<T, S>,
          direction: defaultCol!.defaultSort() ?? "asc",
        });
      }
    }
  }

  /**
   * Cycles the sort on a header click. The column name is a plain `string` (the
   * key is type-erased off the projected `<bit-column>`), so it's cast to the
   * typed sort state.
   */
  toggleSort(col: BitColumnComponent): void {
    const name = col.name();
    if (!name) {
      return;
    }
    this.sort.update(
      (current) =>
        cycleSort(current as SortState<string>, name, col.defaultSort() ?? "asc") as SortState<
          ColumnName<T, S>
        >,
    );
  }
}

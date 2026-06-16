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
import { FILTER_HOST, FilterHost } from "./filter-host";
import { SortModel } from "./sort-model";
import { TableModel } from "./table-model";

/** Grid track width for the internal selection (checkbox) column. */
const SELECTION_COLUMN_WIDTH = "40px";

/** The `filterValues` key a projected `bit-search`'s term is adopted under. */
const SEARCH_FILTER_KEY = "search";

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
  templateUrl: "./table-v2.component.html",
  imports: [
    CommonModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    BitCellComponent,
    BitHeaderRowComponent,
    BitRowComponent,
    BitTablePaginatorComponent,
    NoItemsComponent,
    SkeletonTextComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Filter chips projected into the table register against this host via the
  // `bitTableFilter` bridge; the table folds their predicates into `filtered`.
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
export class BitTableV2Component<T = unknown> implements AfterContentInit, FilterHost {
  /**
   * The single construct that configures the table — data, columns, and optional
   * selection / pagination — see {@link TableModel}. Also the source of the typed
   * `table.columns.*` references bound to `*bitCellDef`. Defaults to an empty
   * model, so manual-mode tables need not bind it.
   */
  readonly table = input(new TableModel<T>({ displayedColumns: [] }));

  /**
   * Fixed row height in pixels for virtual scrolling. Setting it turns the
   * table into a virtual scroll viewport — virtual scrolling needs predictable
   * row geometry, so give columns explicit widths. Omit it for a non-virtualized
   * table. Needs a bounded height to scroll — either {@link maxHeight} or
   * {@link fill}.
   */
  readonly virtualRowHeight = input<number>();

  /**
   * Max height of the table's scroll area, as any CSS length (e.g. `"400px"`,
   * `"60vh"`). When set, the body scrolls within this bound and the header row
   * stays pinned to the top; omit it to let the table grow to its content and
   * scroll with the page. See also {@link fill} to instead fill a parent's height.
   */
  readonly maxHeight = input<string>();

  /**
   * Grow to fill the host's height and scroll the body within it, instead of
   * sizing to content. Use inside a bounded flex container — e.g. the body of a
   * `bit-page` — which supplies the height to fill. An alternative to
   * {@link maxHeight} for bounding a virtualized table.
   */
  readonly fill = input(false, { transform: booleanAttribute });

  /** Optional trackBy for the virtualized row list. */
  readonly trackBy = input<TrackByFunction<T>>();

  /** Number of skeleton rows to show while {@link TableModel.loading} is true. */
  readonly loadingRows = input(3);

  /** The model's active sort (`{ column, direction }`). Read by header cells. */
  readonly sort = computed(() => this.table().sort.current());

  /** The model's selection model, if configured. Read by `bit-bulk-actions-bar` via DI. */
  readonly selection = computed(() => this.table().selection);

  /** Whether the model is loading — shows skeleton rows in place of data. */
  protected readonly loading = computed(() => this.table().loading());

  /** Registers a projected filter chip. Called by the `bitTableFilter` bridge. */
  registerFilter(control: FilterControl): void {
    this.table().registerFilter(control);
  }

  /** @see {@link registerFilter} */
  unregisterFilter(control: FilterControl): void {
    this.table().unregisterFilter(control);
  }

  /** Chips already seeded from `initialFilters`, so each is seeded at most once. */
  private readonly seeded = new WeakSet<FilterControl>();

  /**
   * A `bit-search` projected anywhere into the table (e.g. its toolbar). Adopted
   * automatically as a `search` filter — no bridge directive — so its term joins
   * {@link TableModel.filterValues} under {@link SEARCH_FILTER_KEY}.
   */
  private readonly search = contentChild(SearchComponent, { descendants: true });

  constructor() {
    // Adopt a projected `bit-search` as a `search` filter control. The search
    // owns its term (as a CVA); we only mirror it into `filterValues` and write
    // back for seeding/clear. Re-registers if the search or model changes.
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
      const model = this.table();
      model.registerFilter(control);
      onCleanup(() => model.unregisterFilter(control));
    });

    // Seed chips from the model's initial filter values as they register and
    // their keys resolve. Each chip is seeded once; later user edits aren't undone.
    effect(() => {
      const initial = this.table().initialFilters as Record<string, unknown> | undefined;
      const controls = this.table().filterControls();
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
  }

  private readonly _columns = signal<BitColumnComponent[]>([]);

  /**
   * Whether any `<bit-column>` has been projected. When false, the table
   * renders in manual mode — the consumer's `<bit-header-row>` / `<bit-row>`
   * markup is projected directly inside the v2 chrome with no datasource or
   * column registry. Use column-def mode if you need sort, selection, filter,
   * or virtualization.
   */
  protected readonly hasColumns = computed(() => this._columns().length > 0);

  /**
   * Registered columns resolved against the model's
   * {@link TableModel.displayedColumns}: shown in its order, omitting any name
   * with no registered `<bit-column>`.
   */
  readonly effectiveColumns = computed(() => {
    const registry = new Map(this._columns().map((c) => [c.name(), c]));
    return this.table()
      .displayedColumns()
      .map((name) => registry.get(name))
      .filter((c): c is BitColumnComponent => c !== undefined);
  });

  /**
   * Grid-template-columns string derived from the column registry, consumed
   * by `<bit-row>` and `<bit-header-row>`. Each `<bit-column width="...">`
   * contributes its width as a grid track; unset widths default to `1fr`.
   * `undefined` when no columns are registered (manual mode), in which case
   * rows fall back to `grid-auto-columns: 1fr`.
   */
  readonly gridTemplateColumns = computed<string | undefined>(() => {
    const cols = this.effectiveColumns();
    if (cols.length === 0) {
      return undefined;
    }
    const parts: string[] = [];
    if (this.selection()) {
      parts.push(SELECTION_COLUMN_WIDTH);
    }
    for (const col of cols) {
      parts.push(col.width() ?? "1fr");
    }
    return parts.join(" ");
  });

  /**
   * Registers a column with this table. Called by {@link BitColumnComponent}
   * during its construction via DI. Public for the column's use; not a stable
   * external API.
   */
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
   * Rendered rows: the model's `filtered` sorted by {@link sort} (using the
   * column's `sortFn` or the default), then sliced to the current page when
   * client-side pagination is configured. In `manual` pagination mode the data
   * already holds only the page, so no slice is applied.
   */
  protected readonly rows = computed(() => {
    const filtered = this.table().filtered();
    const sort = this.table().sort.current();
    let sorted = filtered;
    if (sort.column) {
      const col = this.effectiveColumns().find((c) => c.name() === sort.column);
      sorted = sortRows(filtered, sort.column, sort.direction, sort.fn ?? col?.sortFn());
    }
    const pagination = this.table().pagination;
    if (pagination && !pagination.manual) {
      const start = pagination.currentPage() * pagination.pageSize();
      return sorted.slice(start, start + pagination.pageSize());
    }
    return sorted;
  });

  /** Index array for the skeleton rows shown while loading. */
  protected readonly skeletonRows = computed(() => [...Array(this.loadingRows()).keys()]);

  /** Column-def mode, not loading, with no rows to render (empty or fully filtered out). */
  protected readonly isEmpty = computed(
    () => this.hasColumns() && !this.loading() && this.rows().length === 0,
  );

  /**
   * Whether the empty state is the result of filtering rather than there being
   * no data — there are rows, but active filters excluded them all. Lets the
   * default empty state show a "no matches" message distinct from "no items".
   */
  protected readonly noMatches = computed(() => this.isEmpty() && this.table().data().length > 0);

  /**
   * Pixel height for the virtual-scroll viewport: the rows' natural height
   * (`count * virtualRowHeight`) capped at {@link maxHeight}, so the table
   * shrinks to fit a few rows but scrolls once it would exceed the bound. The
   * viewport needs an explicit height because CDK positions rows absolutely, so
   * they contribute no in-flow height of their own.
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
      // Manual mode renders projected rows directly and has no column registry,
      // so a configured selection has nothing to attach its checkbox column to.
      if (this.table().selection) {
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
    if (this.isVirtualized() && this.table().pagination) {
      this.logService?.warning(
        "bit-table-v2: `pagination` and virtualization (`virtualRowHeight`) are mutually exclusive — " +
          "virtualization already renders large sets efficiently. The paginator will page the virtualized rows.",
      );
    }
    const defaultCol = this.effectiveColumns().find((c) => c.defaultSort());
    const name = defaultCol?.name();
    if (name) {
      this.sortModel().applyInitial(name, defaultCol!.defaultSort() ?? "asc");
    }
  }

  /**
   * Translates a header sort click into a `sort.toggle` call on the model,
   * supplying the column's name and default direction. Called by
   * `bit-header-cell` when its sort button is clicked.
   */
  toggleSort(col: BitColumnComponent): void {
    const name = col.name();
    if (!name) {
      return;
    }
    this.sortModel().toggle(name, col.defaultSort() ?? "asc");
  }

  /**
   * The model's sort model viewed with plain `string` columns. A column key
   * resolved from a projected `<bit-column>` is type-erased to `string` (see
   * {@link BitCellDefDirective}), so internal toggles bypass the typed
   * `SortModel<ColumnName<T, S>>` surface — which exists for typed imperative
   * use off `TableModel` by consumers.
   */
  private sortModel(): SortModel<string> {
    return this.table().sort as unknown as SortModel<string>;
  }
}

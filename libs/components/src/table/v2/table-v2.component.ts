import { _isNumberValue } from "@angular/cdk/coercion";
import {
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
  VIRTUAL_SCROLL_STRATEGY,
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

import { FILTER_HOST, FilterControl, FilterHost } from "../../filter-menu/filter-tokens";
import { IconComponent } from "../../icon/icon.component";
import { NoItemsComponent } from "../../no-items/no-items.component";
import { SearchComponent } from "../../search/search.component";
import { SkeletonTextComponent } from "../../skeleton";
import { ParamState, ParamValue, queryParamStore } from "../../utils";
import { SortDirection, SortFn } from "../table-data-source";

import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderRowComponent } from "./bit-header-row.component";
import { BitRowGroupComponent } from "./bit-row-group.component";
import { BitRowComponent } from "./bit-row.component";
import { BitTablePaginatorComponent } from "./bit-table-paginator.component";
import { ColumnName } from "./column";
import { SortState, cycleSort } from "./sort-model";
import { SyncScrollLeftDirective } from "./sync-scroll-left.directive";
import { TableDef } from "./table-def";
import { TableSelectionConfig, TableSelectionModel } from "./table-selection-model";
import { TableVirtualScrollStrategy } from "./table-virtual-scroll.strategy";

/** Grid track width for the internal selection (checkbox) column. */
const SELECTION_COLUMN_WIDTH = "40px";

/**
 * Fixed heights (px) of group headers when virtualized. The scroll strategy needs
 * known item heights, and the rendered header is pinned to these — so they must
 * match the header chrome defined in {@link BitTableV2Component.groupHeaderClass}.
 * The projected header content is a single-line label, so the height is the table's
 * to define, not the consumer's.
 */
const GROUP_HEADER_HEIGHT = 40;
const SUBGROUP_HEADER_HEIGHT = 28;

/** The `filterValues` key a projected `bit-search`'s term is adopted under. */
const SEARCH_FILTER_KEY = "search";

/** URL-sync param keys for the non-filter facets, alongside the filter keys in the namespace. */
const SORT_PARAM = "sort";
const DIRECTION_PARAM = "direction";
const PAGE_PARAM = "page";
const PAGE_SIZE_PARAM = "pageSize";

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

/**
 * A flattened body item: either a data row, or a group header (with its source
 * row-group and the number of rows in that group). Iterated by the non-virtualized
 * body so grouped and ungrouped rendering share one path.
 */
type RenderItem<T> =
  | { kind: "row"; row: T }
  | { kind: "group"; group: BitRowGroupComponent<T>; count: number; level: number };

@Component({
  selector: "bit-table-v2",
  exportAs: "bitTableV2",
  templateUrl: "./table-v2.component.html",
  // The header row scrolls horizontally in sync with the body; hide its own
  // scrollbar so the body owns the single visible one.
  styles: [
    `
      [data-hide-scrollbar] {
        scrollbar-width: none;
      }
      [data-hide-scrollbar]::-webkit-scrollbar {
        display: none;
      }
    `,
  ],
  imports: [
    CommonModule,
    CdkVirtualScrollViewport,
    CdkVirtualForOf,
    BitCellComponent,
    BitHeaderRowComponent,
    BitRowComponent,
    IconComponent,
    NoItemsComponent,
    SkeletonTextComponent,
    SyncScrollLeftDirective,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    // Filter chips projected into the table resolve this host by DI and
    // self-register; the table folds their values into `filtered`.
    { provide: FILTER_HOST, useExisting: forwardRef(() => BitTableV2Component) },
    // The virtual-scroll viewport in the template picks up the table's own strategy.
    {
      provide: VIRTUAL_SCROLL_STRATEGY,
      useFactory: (table: BitTableV2Component) => table.scrollStrategy,
      deps: [forwardRef(() => BitTableV2Component)],
    },
  ],
  host: {
    // In `fill` mode the host becomes a flex column that fills its parent's
    // height, so the table can hand a bounded height down to its scroll region.
    "[class.tw-flex]": "isFill()",
    "[class.tw-flex-col]": "isFill()",
    "[class.tw-flex-1]": "isFill()",
    "[class.tw-min-h-0]": "isFill()",
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

  /**
   * Render style. `"table"` (default) draws the bordered column grid; `"list"`
   * drops the table chrome and renders each row as a standalone `bit-item`-style
   * card. The data, filtering, sort, and selection engine is identical in both.
   */
  readonly presentation = input<"table" | "list">("table");

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
   * set {@link height}.
   */
  readonly virtualRowHeight = input<number>();

  /**
   * How tall the table is. Omit to grow to content (manual tables size via a CSS
   * class instead). `"fill"` grows to the host's height and scrolls the body within
   * it — use inside a bounded, full-height container. A number caps the body at that
   * many rows (minimum 4) before it scrolls; that cap needs a known row height, so it
   * applies only when {@link virtualRowHeight} is set and is otherwise a no-op.
   */
  readonly height = input<"fill" | number>();

  /** Optional trackBy for the virtualized row list. */
  readonly trackBy = input<TrackByFunction<T>>();

  /** Number of skeleton rows to show while {@link loading} is true. */
  readonly loadingRows = input(3);

  /**
   * Syncs sort, filters, and pagination to the URL query string, namespaced under
   * this prefix — e.g. `queryParam="vault"` yields `?vault.sort=name&vault.direction=asc&vault.type=login`.
   * Set it to enable URL sync (omit to disable); a distinct prefix per table lets
   * several coexist on one page. On load, params restore state (winning over
   * `[filters]` and `defaultSort`); changes write back with `replaceUrl`. Requires
   * a router in context — a no-op without one (e.g. Storybook, a dialog).
   */
  readonly queryParam = input<string>();

  /**
   * The table's combined URL state — filter values plus the sort/direction/page/
   * pageSize keys — mirrored to the `queryParam` namespace. Seeds from the URL on
   * first read (so restore and chip seeding pull the shared-link values) and writes
   * back on change. A no-op signal when `queryParam` is unset or there's no router.
   */
  private readonly urlStore = queryParamStore<ParamState>(this.queryParam);

  /** Whether initial URL state has been applied — gates write-back until then. */
  private readonly urlRestored = signal(false);

  /** The paginator's consumer-configured page size; the `pageSize` param is omitted at this value. */
  private readonly baselinePageSize = signal<number | undefined>(undefined);

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

  /** Registers a projected filter chip. Called by the chip as it self-registers. */
  registerFilter(control: FilterControl): void {
    this._filters.update((filters) => [...filters, control]);
  }

  /** @see {@link registerFilter} */
  unregisterFilter(control: FilterControl): void {
    this._filters.update((filters) => filters.filter((f) => f !== control));
  }

  /**
   * Faceted count for a chip option: rows matching {@link filter} with `key` pinned
   * to `value` and every other active filter still applied. `undefined` with no
   * `[filter]` (server-side) — the chip then shows an explicit `count` instead.
   */
  optionCount(key: string, value: unknown): number | undefined {
    const filter = this.filter();
    if (!filter) {
      return undefined;
    }
    const values = { ...(this.filterValues() as Record<string, unknown>), [key]: value } as F;
    return this.tableDef()
      .data()
      .filter((row) => filter(row, values)).length;
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

    // Seed chips as they register and their keys resolve — from the URL store when
    // it holds a value for the key (a shared link restores faithfully), else from
    // `[filters]`. Reading the store seeds it from the URL synchronously. Each chip
    // is seeded once; later user edits aren't undone.
    effect(() => {
      const fromUrl = this.urlStore() as Record<string, unknown>;
      const initial = this.filters() as Record<string, unknown> | undefined;
      for (const control of this._filters()) {
        if (this.seeded.has(control)) {
          continue;
        }
        const key = control.key();
        if (!key) {
          continue;
        }
        let value: unknown;
        if (key in fromUrl) {
          value = fromUrl[key];
        } else if (initial && key in initial) {
          value = initial[key];
        } else {
          continue;
        }
        this.seeded.add(control);
        control.setValue(value);
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

    // Mirror the table's combined state back to the URL on change. Gated on
    // `urlRestored` so defaults don't clobber incoming params before they're read.
    // Inactive/default facets become empty values, which the store omits, so the
    // URL self-cleans. The store is a no-op when `queryParam` is unset.
    effect(() => {
      if (!this.urlRestored()) {
        return;
      }
      const state: ParamState = {};
      for (const control of this._filters()) {
        const key = control.key();
        if (key) {
          // Inactive → `undefined`, which the store omits (so an off toggle, whose
          // value is `false`, leaves no `favorite=false` behind).
          state[key] = control.active() ? (control.value() as ParamValue) : undefined;
        }
      }
      const sort = this.sort();
      state[SORT_PARAM] = sort.column;
      state[DIRECTION_PARAM] = sort.column ? sort.direction : undefined;
      const paginator = this.paginator();
      if (paginator) {
        const page = paginator.pageIndex();
        state[PAGE_PARAM] = page > 0 ? page + 1 : undefined;
        const pageSize = paginator.pageSize();
        state[PAGE_SIZE_PARAM] = pageSize === this.baselinePageSize() ? undefined : pageSize;
      }
      this.urlStore.set(state);
    });

    // `<bit-row-group>` only renders in list presentation; warn if declared in table mode.
    effect(() => {
      if (this.presentation() === "table" && this._groups().length > 0) {
        this.logService?.warning(
          'bit-table-v2: `<bit-row-group>` is only supported in `presentation="list"`. ' +
            "Groups are ignored in table presentation.",
        );
      }
    });

    // Only one level of nesting is supported; deeper subgroups are ignored.
    effect(() => {
      const tooDeep = this._groups().some((g) => g.children().some((c) => c.children().length > 0));
      if (tooDeep) {
        this.logService?.warning(
          "bit-table-v2: `<bit-row-group>` supports only one level of nesting; " +
            "groups nested deeper than that are ignored.",
        );
      }
    });

    // The strategy pulls heights lazily, so a collapse (which changes the row count)
    // is handled by CDK's `onDataLengthChanged`. This covers the other case — heights
    // changing with no row-count change (e.g. row height) — which CDK can't observe.
    effect(() => {
      this.itemHeights();
      this.scrollStrategy.refresh();
    });
  }

  /**
   * Applies URL state to sort and pagination once, then opens the write-back gate.
   * Filters restore in the seeding effect as their chips register. Runs before the
   * `defaultSort` fallback so a sorted link wins.
   */
  private restoreFromUrl(): void {
    const fromUrl = this.urlStore();
    const column = fromUrl[SORT_PARAM];
    if (typeof column === "string") {
      const direction = fromUrl[DIRECTION_PARAM] === "desc" ? "desc" : "asc";
      this.sort.set({ column: column as ColumnName<T, S>, direction });
    }
    const paginator = this.paginator();
    if (paginator) {
      // Capture the configured size before any URL override, so write-back can
      // omit `pageSize` whenever it returns to this baseline.
      this.baselinePageSize.set(paginator.pageSize());
      const pageSize = fromUrl[PAGE_SIZE_PARAM];
      if (typeof pageSize === "number" && pageSize > 0) {
        paginator.pageSize.set(pageSize);
      }
      const page = fromUrl[PAGE_PARAM];
      if (typeof page === "number" && page > 0) {
        paginator.pageIndex.set(page - 1);
      }
    }
    this.urlRestored.set(true);
  }

  private readonly _columns = signal<BitColumnComponent[]>([]);

  /**
   * Whether any `<bit-column>` has been projected. When false, the table renders
   * in manual mode — the consumer's `<bit-header-row>` / `<bit-row>` render
   * directly with no column registry. Use column-def mode for sort, selection,
   * filter, or virtualization.
   */
  protected readonly hasColumns = computed(() => this._columns().length > 0);

  /** Registered `<bit-row-group>`s, in declaration order. Empty = ungrouped rendering. */
  private readonly _groups = signal<BitRowGroupComponent<T>[]>([]);

  /**
   * Whether groups actually render. `<bit-row-group>` is a `list`-presentation
   * feature; in `table` presentation groups are ignored (and a warning is logged),
   * so the body falls back to flat rows.
   */
  protected readonly groupingActive = computed(
    () => this.presentation() === "list" && this._groups().length > 0,
  );

  /** Registers a row-group. Called by {@link BitRowGroupComponent} via DI. */
  registerGroup(group: BitRowGroupComponent<T>): void {
    this._groups.update((groups) => [...groups, group]);
  }

  /** @see {@link registerGroup} */
  unregisterGroup(group: BitRowGroupComponent<T>): void {
    this._groups.update((groups) => groups.filter((g) => g !== group));
  }

  /**
   * Header chrome for a group at `level` (0 = top, 1 = subgroup). A muted subheader
   * in `list`; subgroups are indented. (Grouping no-ops in `table` presentation, so
   * the table-mode style is kept only for coherence.)
   */
  protected groupHeaderClass(level: number): string {
    if (this.presentation() !== "list") {
      return "tw-flex tw-items-center tw-border-0 tw-border-b tw-border-solid tw-border-b-shadow tw-bg-background-alt tw-px-3 tw-py-2 tw-text-sm tw-font-bold tw-text-muted";
    }
    // Match the extension's section/subsection type: top = `h6` (text-sm, main,
    // medium); subgroup = the muted subheader (text-xs, muted, medium), indented.
    const type =
      level === 0
        ? "tw-text-sm tw-text-main tw-font-medium tw-px-1 tw-pb-1 tw-pt-3"
        : "tw-text-xs tw-text-muted tw-font-medium tw-ps-4 tw-pe-1 tw-py-1";
    return `tw-flex tw-items-center ${type}`;
  }

  /** Collapsible-header chrome: the base header plus a full-width hover/focus toggle affordance. */
  protected groupHeaderButtonClass(level: number): string {
    return (
      this.groupHeaderClass(level) +
      " tw-w-full tw-cursor-pointer tw-rounded tw-border-0 tw-bg-transparent tw-text-start" +
      " hover:tw-bg-hover-default focus-visible:tw-outline-none focus-visible:tw-ring-2" +
      " focus-visible:tw-ring-inset focus-visible:tw-ring-primary-600"
    );
  }

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

  /** Total column count including the selection column — the `aria-colspan` a group header spans. */
  protected readonly columnCount = computed(
    () => this.effectiveColumns().length + (this.selectionModel() ? 1 : 0),
  );

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

  /**
   * The table's horizontal scroll position, shared across its scroll containers —
   * the header row and the body (the non-virtualized scroll div or the CDK
   * viewport). {@link SyncScrollLeftDirective} two-way binds each to this signal,
   * so scrolling any one moves them all in lockstep: the columns stay aligned
   * while the header stays pinned vertically.
   */
  protected readonly horizontalScroll = signal(0);

  /** Registers a column. Called by {@link BitColumnComponent} via DI. */
  register(col: BitColumnComponent): void {
    this._columns.update((cols) => [...cols, col]);
  }

  /** @see {@link register} */
  unregister(col: BitColumnComponent): void {
    this._columns.update((cols) => cols.filter((c) => c !== col));
  }

  protected readonly isVirtualized = computed(() => this.virtualRowHeight() !== undefined);

  /** True when {@link height} is `"fill"`. */
  protected readonly isFill = computed(() => this.height() === "fill");

  /** Row-count cap from {@link height} (clamped to a minimum of 4), or undefined when it isn't a number. */
  protected readonly maxRows = computed(() => {
    const h = this.height();
    return typeof h === "number" ? Math.max(4, Math.floor(h)) : undefined;
  });

  /** Outer container chrome: border, rounded corners, subtle shadow. Dropped in `list` presentation so rows float as cards. Becomes a fill flex column when {@link height} is `"fill"`. */
  protected readonly containerClass = computed(() => [
    ...(this.presentation() === "list"
      ? []
      : [
          "tw-bg-bg-primary",
          "tw-border",
          "tw-border-solid",
          "tw-border-border-base",
          "tw-rounded-xl",
          "tw-overflow-clip",
          "tw-shadow-[0px_1px_0.5px_0.05px_rgba(29,41,61,0.02)]",
        ]),
    ...(this.isFill() ? ["tw-flex", "tw-min-h-0", "tw-flex-1", "tw-flex-col"] : []),
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

  /**
   * The non-virtualized body's render list: {@link rows} as-is when ungrouped, or
   * interleaved group headers and rows when `<bit-row-group>`s are projected. Each
   * row joins the first group whose `match` claims it (declaration order); empty
   * groups are skipped, and rows no group claims trail in a headerless block.
   */
  protected readonly renderItems = computed<RenderItem<T>[]>(() => {
    const rows = this.rows();
    if (!this.groupingActive()) {
      return rows.map((row): RenderItem<T> => ({ kind: "row", row }));
    }

    // First-match-wins partition of `toSplit` across `groups`, preserving row order.
    const partition = (groups: readonly BitRowGroupComponent<T>[], toSplit: readonly T[]) => {
      const buckets = new Map<BitRowGroupComponent<T>, T[]>();
      const unmatched: T[] = [];
      for (const row of toSplit) {
        const group = groups.find((g) => g.match()(row));
        if (!group) {
          unmatched.push(row);
          continue;
        }
        const bucket = buckets.get(group);
        if (bucket) {
          bucket.push(row);
        } else {
          buckets.set(group, [row]);
        }
      }
      return { buckets, unmatched };
    };
    const rowItems = (rs: readonly T[]): RenderItem<T>[] =>
      rs.map((row): RenderItem<T> => ({ kind: "row", row }));

    const items: RenderItem<T>[] = [];
    const top = partition(this._groups(), rows);
    for (const group of this._groups()) {
      const groupRows = top.buckets.get(group);
      if (!groupRows?.length) {
        continue;
      }
      // A collapsed group still shows its header (with the full count) but hides its body.
      items.push({ kind: "group", group, count: groupRows.length, level: 0 });
      if (group.collapsible() && group.collapsed()) {
        continue;
      }
      const children = group.children();
      if (children.length === 0) {
        items.push(...rowItems(groupRows));
        continue;
      }
      // One extra level: sub-partition the group's rows across its child groups.
      const sub = partition(children, groupRows);
      // Rows no subgroup claims render flat directly under the parent header, BEFORE
      // the subheadered subgroups — e.g. the extension's flat run followed by a
      // "Cards" subgroup section.
      items.push(...rowItems(sub.unmatched));
      for (const child of children) {
        const childRows = sub.buckets.get(child);
        if (!childRows?.length) {
          continue;
        }
        items.push({ kind: "group", group: child, count: childRows.length, level: 1 });
        if (!(child.collapsible() && child.collapsed())) {
          items.push(...rowItems(childRows));
        }
      }
    }
    items.push(...rowItems(top.unmatched));
    return items;
  });

  /**
   * Per-item pixel heights for {@link TableVirtualScrollStrategy}, in render order:
   * data rows use {@link virtualRowHeight}, group headers use the fixed
   * {@link headerHeight} for their level. Empty until {@link virtualRowHeight} is set.
   */
  protected readonly itemHeights = computed<number[]>(() => {
    const rowHeight = this.virtualRowHeight();
    if (rowHeight === undefined) {
      return [];
    }
    return this.renderItems().map((item) =>
      item.kind === "row" ? rowHeight : this.headerHeight(item.level),
    );
  });

  /** Fixed virtualized height for a group header at `level` (0 = top, 1 = subgroup). */
  protected headerHeight(level: number): number {
    return level === 0 ? GROUP_HEADER_HEIGHT : SUBGROUP_HEADER_HEIGHT;
  }

  /** Total pixel height of every render item (rows + group headers). */
  protected readonly totalContentHeight = computed(() =>
    this.itemHeights().reduce((sum, height) => sum + height, 0),
  );

  /**
   * trackBy for the render list — a header by its group, a row by the consumer's
   * {@link trackBy} (falling back to row identity). Shared by the virtualized
   * `cdkVirtualFor` and the non-virtualized `@for`.
   */
  protected readonly trackRenderItem: TrackByFunction<RenderItem<T>> = (index, item) => {
    if (item.kind !== "row") {
      return item.group;
    }
    const trackBy = this.trackBy();
    return trackBy ? trackBy(index, item.row) : item.row;
  };

  /**
   * Virtual-scroll strategy for the viewport, provided to it via
   * `VIRTUAL_SCROLL_STRATEGY`. Reads {@link itemHeights} lazily; the constructor
   * effect nudges it to re-render when heights change.
   */
  readonly scrollStrategy = new TableVirtualScrollStrategy(this.itemHeights);

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
   * at {@link maxRows} rows. The viewport needs an explicit height because CDK
   * positions rows absolutely, so they contribute no in-flow height.
   */
  protected readonly viewportHeight = computed<string | undefined>(() => {
    const rowHeight = this.virtualRowHeight();
    if (rowHeight === undefined) {
      return undefined;
    }
    // Content height includes group headers, so grouped tables grow to fit them;
    // the `maxRows` cap stays row-based ("show N rows before scrolling").
    const contentHeight = this.totalContentHeight();
    const maxRows = this.maxRows();
    const height =
      maxRows !== undefined ? Math.min(maxRows * rowHeight, contentHeight) : contentHeight;
    return `${height}px`;
  });

  private readonly logService = inject(LogService, { optional: true });

  ngAfterContentInit(): void {
    if (this._groups().length > 0 && this.paginator()) {
      throw new Error(
        "bit-table-v2: `<bit-row-group>` and `<bit-table-paginator>` are not supported together — " +
          "grouping with pagination is not implemented.",
      );
    }
    if (!this.hasColumns()) {
      if (this.selection()) {
        this.logService?.warning(
          "bit-table-v2: `selection` is configured but no `<bit-column>` was projected. " +
            "Selection requires column-def mode; no checkbox column will render.",
        );
      }
      return;
    }
    if (this.isVirtualized() && this.height() === undefined) {
      this.logService?.warning(
        "bit-table-v2: virtualization (`virtualRowHeight`) needs a bounded height — set `height` to a " +
          'row count or `"fill"` (inside a bounded container). Without one the viewport collapses and no rows render.',
      );
    }
    if (this.isVirtualized() && this.paginator()) {
      this.logService?.warning(
        "bit-table-v2: a paginator and virtualization (`virtualRowHeight`) are mutually exclusive — " +
          "virtualization already renders large sets efficiently.",
      );
    }
    // Restore sort/pagination from the URL (filters restore as their chips
    // register), then open the write-back gate.
    this.restoreFromUrl();

    // Seed the initial sort from the first column declaring `defaultSort`, unless
    // a sort column is already set (e.g. via `[(sort)]` or restored from the URL).
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

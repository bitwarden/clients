import { _isNumberValue } from "@angular/cdk/coercion";
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  AfterContentInit,
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  TrackByFunction,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { ScrollLayoutDirective } from "../../layout";
import { NoItemsComponent } from "../../no-items/no-items.component";
import { SEARCH_CONSUMER, SearchConsumer } from "../../search/search-consumer";
import { SkeletonTextComponent } from "../../skeleton";
import { SortDirection, SortFn } from "../table-data-source";

import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderRowComponent } from "./bit-header-row.component";
import { BitRowComponent } from "./bit-row.component";
import { TableModel } from "./table-model";

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
 * Copyright (c) 2024 Google LLC).
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
    ScrollLayoutDirective,
    BitCellComponent,
    BitHeaderRowComponent,
    BitRowComponent,
    NoItemsComponent,
    SkeletonTextComponent,
    I18nPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: SEARCH_CONSUMER, useExisting: forwardRef(() => BitTableV2Component) }],
})
export class BitTableV2Component<T = unknown>
  implements AfterContentInit, AfterViewInit, SearchConsumer
{
  /**
   * The single construct that configures the table — data, columns, search,
   * filters, and optional selection — see {@link TableModel}. Also the source of
   * the typed `table.ref.*` references bound to `*bitCellDef`. Defaults to an
   * empty model, so manual-mode tables need not bind it.
   */
  readonly table = input(new TableModel<T>({ displayedColumns: [] }));

  /**
   * Defaults to `"auto"`. Forced to `"fixed"` when virtualization is on
   * ({@link virtualRowHeight} is set) — virtual scrolling requires predictable
   * row geometry, which a fixed layout provides.
   */
  readonly layout = input<"auto" | "fixed">("auto");

  /**
   * Fixed row height in pixels for virtual scrolling. Setting it turns the
   * table into a virtual scroll viewport (rows lay out with `table-fixed`
   * regardless of {@link layout}); omit it for a non-virtualized table.
   */
  readonly virtualRowHeight = input<number>();

  /** Optional trackBy for the virtualized row list. */
  readonly trackBy = input<TrackByFunction<T>>();

  /** Number of skeleton rows to show while {@link TableModel.loading} is true. */
  readonly loadingRows = input(3);

  /** The model's active sort (`{ column, direction }`). Read by header cells. */
  readonly sort = computed(() => this.table().sort());

  /** The model's selection model, if configured. Read by `bit-bulk-actions-bar` via DI. */
  readonly selection = computed(() => this.table().selection);

  /** Whether the model is loading — shows skeleton rows in place of data. */
  protected readonly loading = computed(() => this.table().loading());

  /**
   * The {@link SearchConsumer} surface a projected `<bit-search>` binds to —
   * the model's `search.term` signal, forwarded along.
   */
  get searchTerm() {
    return this.table().search.term;
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
      parts.push("40px");
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

  /** Outer container chrome: border, rounded corners, subtle shadow. */
  protected readonly containerClass = [
    "tw-bg-bg-primary",
    "tw-border",
    "tw-border-solid",
    "tw-border-border-base",
    "tw-rounded-xl",
    "tw-overflow-clip",
    "tw-shadow-[0px_1px_0.5px_0.05px_rgba(29,41,61,0.02)]",
  ];

  /** Rendered rows: the model's `filtered` sorted by {@link sort} using the column's `sortFn` or default. */
  protected readonly rows = computed(() => {
    const filtered = this.table().filtered();
    const sort = this.table().sort();
    if (!sort.column) {
      return filtered;
    }
    const col = this.effectiveColumns().find((c) => c.name() === sort.column);
    return sortRows(filtered, sort.column, sort.direction, sort.fn ?? col?.sortFn());
  });

  /** Index array for the skeleton rows shown while loading. */
  protected readonly skeletonRows = computed(() => [...Array(this.loadingRows()).keys()]);

  /** Column-def mode, not loading, with no rows to render (empty or fully filtered out). */
  protected readonly isEmpty = computed(
    () => this.hasColumns() && !this.loading() && this.rows().length === 0,
  );

  /** Height of the thead element (px); used to pad the virtual scroll viewport. */
  protected readonly headerHeight = signal(0);

  private readonly el = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  ngAfterContentInit(): void {
    this.applyInitialSort();
  }

  ngAfterViewInit(): void {
    if (!this.isVirtualized()) {
      return;
    }
    const headerRow = this.el.nativeElement.querySelector('[role="row"]');
    if (!headerRow) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      // signal.set triggers CD on dependents directly — no NgZone.run needed
      this.headerHeight.set(entries[0].contentRect.height);
    });
    observer.observe(headerRow);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /**
   * Cycles the model's sort for the column. Called by the bit-cell header
   * component when its sort button is clicked.
   */
  toggleSort(col: BitColumnComponent): void {
    const colName = col.name();
    if (!colName) {
      return;
    }
    const current = this.table().sort();
    const active = current.column === colName;
    const defaultDir = col.defaultSort() === "desc" ? "desc" : "asc";
    const direction = active ? (current.direction === "asc" ? "desc" : "asc") : defaultDir;
    this.table().sort.set({ column: colName, direction });
  }

  private applyInitialSort(): void {
    if (this.table().sort().column) {
      return;
    }
    const defaultCol = this.effectiveColumns().find((c) => c.defaultSort());
    const name = defaultCol?.name();
    if (name) {
      this.table().sort.set({ column: name, direction: defaultCol!.defaultSort() ?? "asc" });
    }
  }
}

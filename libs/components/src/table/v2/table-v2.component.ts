import { isDataSource } from "@angular/cdk/collections";
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
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { finalize, Observable, of, switchMap } from "rxjs";

import { ScrollLayoutDirective } from "../../layout";
import { SEARCH_CONSUMER, SearchConsumer } from "../../search/search-consumer";
import { Sort, TableDataSource } from "../table-data-source";

import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderRowComponent } from "./bit-header-row.component";
import { BitRowComponent } from "./bit-row.component";
import { FilterModel } from "./filter-model";
import { TableSelectionModel } from "./table-selection-model";

@Component({
  selector: "bit-table-v2",
  templateUrl: "./table-v2.component.html",
  imports: [
    CommonModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    ScrollLayoutDirective,
    BitHeaderRowComponent,
    BitRowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: SEARCH_CONSUMER, useExisting: forwardRef(() => BitTableV2Component) }],
})
export class BitTableV2Component<T = unknown>
  implements AfterContentInit, AfterViewInit, SearchConsumer
{
  /**
   * Data source for the table. Sort state is read from / written to this
   * source. The row type `T` is inferred from this binding and threads
   * through {@link selection}, {@link trackBy}, and other typed surfaces.
   */
  readonly dataSource = input<TableDataSource<T>>();

  /**
   * Order and visibility of columns, by `name`. Columns whose names aren't
   * listed here are not rendered, even if registered. Required in column-def
   * mode; omitted in manual-rows mode.
   */
  readonly displayedColumns = input<string[]>([]);

  /**
   * Defaults to `"auto"`. Forced to `"fixed"` when virtualization is on
   * ({@link rowSize} is set) — virtual scrolling requires predictable row
   * geometry, which a fixed layout provides.
   */
  readonly layout = input<"auto" | "fixed">("auto");

  /**
   * Row height in pixels. When set, the table renders inside a virtual
   * scroll viewport; columns lay out with `table-fixed` regardless of
   * {@link layout}.
   */
  readonly rowSize = input<number>();

  /** Optional trackBy for the virtualized row list. */
  readonly trackBy = input<TrackByFunction<T>>();

  /**
   * Selection model. When provided, the table prepends a checkbox column
   * with a select-all header. Select-all targets the currently filtered
   * rows (per `dataSource.filteredData`), matching CDK conventions. Supply a
   * `canSelect` option on the model to make only some rows selectable.
   */
  readonly selection = input<TableSelectionModel<T>>();

  /**
   * Filter state and definitions, constructed by the consumer (parallel to
   * {@link dataSource} and {@link selection}). The table applies the model's
   * composed `predicate` to `dataSource.filter` and re-filters whenever it
   * changes; `<bit-table-toolbar>` renders the applied-filters chips from it,
   * and a projected `<bit-search>` binds to it via the provided
   * {@link SEARCH_CONSUMER}. Defaults to an empty model (matches nothing), so
   * tables without filtering need not bind it.
   */
  readonly filterModel = input(new FilterModel<T>());

  constructor() {
    effect(() => {
      const ds = this.dataSource();
      if (ds) {
        ds.filter = this.filterModel().predicate();
      }
    });
  }

  /**
   * The {@link SearchConsumer} surface a projected `<bit-search>` binds to —
   * the current {@link filterModel}'s `searchTerm` signal, forwarded along.
   */
  get searchTerm() {
    return this.filterModel().searchTerm;
  }

  private readonly _columns = signal<BitColumnComponent[]>([]);

  /** All registered columns, regardless of `displayedColumns`. */
  protected readonly columns = this._columns.asReadonly();

  /**
   * Whether any `<bit-column>` has been projected. When false, the table
   * renders in manual mode — the consumer's `<thead>` / `<tbody>` markup is
   * projected directly inside the v2 chrome with no datasource or column
   * registry. Use column-def mode if you need sort, selection, filter, or
   * virtualization.
   */
  protected readonly hasColumns = computed(() => this._columns().length > 0);

  /** Registered columns filtered/ordered by {@link displayedColumns}. */
  readonly effectiveColumns = computed(() => {
    const registry = new Map(this._columns().map((c) => [c.name(), c]));
    return this.displayedColumns()
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

  protected readonly isVirtualized = computed(() => this.rowSize() !== undefined);

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

  /**
   * Connects to whatever `dataSource` resolves to (including changes), and
   * tears down the connection on unsubscribe. Driven via `toObservable` so
   * the pipeline can be `readonly` rather than reassigned in `ngOnInit`.
   */
  protected readonly rows$: Observable<T[]> = toObservable(this.dataSource).pipe(
    switchMap((ds) =>
      isDataSource(ds) ? ds.connect().pipe(finalize(() => ds.disconnect())) : of<T[]>([]),
    ),
  );

  /**
   * Bridges `dataSource.sort$` into a signal so header-cell computeds can
   * react to sort changes (the data source is RxJS-internal; v2 is signal-
   * based). Re-subscribes when `dataSource` swaps.
   */
  readonly sort = toSignal(
    toObservable(this.dataSource).pipe(
      switchMap((ds) => (ds ? ds.sort$ : of<Sort | undefined>(undefined))),
    ),
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
   * Updates `dataSource.sort` for the column. Called by the bit-cell header
   * component when its sort button is clicked.
   */
  toggleSort(col: BitColumnComponent): void {
    const ds = this.dataSource();
    if (!ds) {
      return;
    }
    const current = ds.sort;
    const colName = col.name();
    if (!colName) {
      return;
    }
    const active = current?.column === colName;
    const defaultDir = col.defaultSort() === "desc" ? "desc" : "asc";
    const direction = active ? (current?.direction === "asc" ? "desc" : "asc") : defaultDir;
    ds.sort = { column: colName, direction, fn: col.sortFn() };
  }

  /** Whether a row may be selected, per the selection model's predicate. */
  protected isSelectable(row: T): boolean {
    return this.selection()?.isSelectable(row) ?? true;
  }

  protected selectableRows(): T[] {
    const rows = this.dataSource()?.filteredData ?? this.dataSource()?.data ?? [];
    return rows.filter((row) => this.isSelectable(row));
  }

  protected isAllSelected(): boolean {
    const sel = this.selection();
    if (!sel) {
      return false;
    }
    const rows = this.selectableRows();
    return rows.length > 0 && rows.every((r) => sel.isSelected(r));
  }

  protected isIndeterminate(): boolean {
    const sel = this.selection();
    if (!sel) {
      return false;
    }
    const rows = this.selectableRows();
    const selected = rows.filter((r) => sel.isSelected(r)).length;
    return selected > 0 && selected < rows.length;
  }

  protected toggleAll(): void {
    const sel = this.selection();
    if (!sel) {
      return;
    }
    const rows = this.selectableRows();
    if (this.isAllSelected()) {
      rows.forEach((r) => sel.deselect(r));
    } else {
      rows.forEach((r) => sel.select(r));
    }
  }

  private applyInitialSort(): void {
    const ds = this.dataSource();
    if (!ds || ds.sort?.column) {
      return;
    }
    const defaultCol = this.effectiveColumns().find((c) => c.defaultSort());
    if (defaultCol) {
      const name = defaultCol.name();
      if (name) {
        ds.sort = {
          column: name,
          direction: defaultCol.defaultSort() ?? "asc",
          fn: defaultCol.sortFn(),
        };
      }
    }
  }
}

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
import { toSignal } from "@angular/core/rxjs-interop";
import { finalize, Observable } from "rxjs";

import { ScrollLayoutDirective } from "../../layout";
import { SEARCH_CONSUMER, SearchConsumer } from "../../search/search-consumer";
import { TableDataSource } from "../table-data-source";

import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderRowComponent } from "./bit-header-row.component";
import { BitRowComponent } from "./bit-row.component";
import { TableModel } from "./table-model";

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
   * The single construct that configures the table — data, columns, filter, and
   * optional selection — see {@link TableModel}. Also the source of the typed
   * `table.ref.*` references bound to `*bitCellDef`. Defaults to an empty model,
   * so manual-mode tables need not bind it.
   */
  readonly table = input(new TableModel<T>());

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
   * The RxJS engine that filters and sorts the model's data into rendered rows.
   * A private implementation detail — fed from the model's `data` and `filter`,
   * and owns sort state. Not exposed on the model.
   */
  private readonly dataSource = new TableDataSource<T>();

  /** The model's column model. */
  protected readonly columnModel = computed(() => this.table().columns);

  /** The model's selection model, if configured. Read by `bit-bulk-actions-bar` via DI. */
  readonly selection = computed(() => this.table().selection);

  /**
   * The {@link SearchConsumer} surface a projected `<bit-search>` binds to —
   * the model's filter `searchTerm` signal, forwarded along.
   */
  get searchTerm() {
    return this.table().filter.searchTerm;
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
   * Registered columns ordered and filtered by the model's {@link ColumnModel}:
   * its `order` (or declaration order when unset), minus its hidden set.
   */
  readonly effectiveColumns = computed(() => {
    const registry = new Map(this._columns().map((c) => [c.name(), c]));
    const model = this.columnModel();
    const names = model.order() ?? this._columns().map((c) => c.name());
    const hidden = model.hidden();
    return names
      .filter((name): name is string => name != null && !hidden.has(name))
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

  /** The rendered (filtered + sorted) rows; disconnects on unsubscribe. */
  protected readonly rows$: Observable<readonly T[]> = this.dataSource
    .connect()
    .pipe(finalize(() => this.dataSource.disconnect()));

  /**
   * Bridges the data source's `sort$` into a signal so header-cell computeds
   * can react to sort changes (the data source is RxJS-internal; v2 is signal-
   * based).
   */
  readonly sort = toSignal(this.dataSource.sort$);

  /** Height of the thead element (px); used to pad the virtual scroll viewport. */
  protected readonly headerHeight = signal(0);

  private readonly el = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Bridge the model's signals into the data source (the component has the
    // injection context the plain model lacks).
    effect(() => {
      this.dataSource.data = this.table().data();
    });
    effect(() => {
      this.dataSource.filter = this.table().filter.predicate();
    });
  }

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
   * Updates the data source's sort for the column. Called by the bit-cell
   * header component when its sort button is clicked.
   */
  toggleSort(col: BitColumnComponent): void {
    const ds = this.dataSource;
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
    const ds = this.dataSource;
    const rows = ds.filteredData ?? ds.data ?? [];
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
    const ds = this.dataSource;
    if (ds.sort?.column) {
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

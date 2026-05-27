import { isDataSource, SelectionModel } from "@angular/cdk/collections";
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from "@angular/cdk/scrolling";
import { CommonModule } from "@angular/common";
import {
  AfterContentInit,
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  TrackByFunction,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { Observable, of } from "rxjs";

import { ScrollLayoutDirective } from "../../layout";
import { CellDirective } from "../cell.directive";
import { RowDirective } from "../row.directive";
import { TableDataSource } from "../table-data-source";

import { BitColumnComponent } from "./bit-column.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-table-v2",
  templateUrl: "./table-v2.component.html",
  imports: [
    CommonModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    ScrollLayoutDirective,
    CellDirective,
    RowDirective,
  ],
})
export class BitTableV2Component implements OnInit, OnDestroy, AfterContentInit, AfterViewInit {
  /** Data source for the table. Sort state is read from / written to this source. */
  readonly dataSource = input<TableDataSource<any>>();

  /**
   * Order and visibility of columns, by `name`. Columns whose names aren't
   * listed here are not rendered, even if registered.
   */
  readonly displayedColumns = input.required<string[]>();

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
  readonly trackBy = input<TrackByFunction<unknown>>();

  /**
   * Selection model. When provided, the table prepends a checkbox column
   * with a select-all header. Select-all targets the currently filtered
   * rows (per `dataSource.filteredData`), matching CDK conventions.
   */
  readonly selection = input<SelectionModel<any>>();

  private readonly _columns = signal<BitColumnComponent[]>([]);

  /** All registered columns, regardless of `displayedColumns`. */
  protected readonly columns = this._columns.asReadonly();

  /** Registered columns filtered/ordered by {@link displayedColumns}. */
  protected readonly effectiveColumns = computed(() => {
    const registry = new Map(this._columns().map((c) => [c.name(), c]));
    return this.displayedColumns()
      .map((name) => registry.get(name))
      .filter((c): c is BitColumnComponent => c !== undefined);
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

  protected readonly tableClass = computed(() => {
    const fixed = this.isVirtualized() || this.layout() === "fixed";
    return [
      "tw-w-full",
      "tw-leading-normal",
      "tw-text-main",
      "tw-border-collapse",
      "tw-text-start",
      fixed ? "tw-table-fixed" : "tw-table-auto",
    ];
  });

  protected rows$: Observable<any[]> = of([]);

  /** Height of the thead element (px); used to pad the virtual scroll viewport. */
  protected headerHeight = 0;

  private readonly zone = inject(NgZone);
  private readonly el = inject(ElementRef);
  private headerObserver?: ResizeObserver;
  private initialSortApplied = false;

  ngOnInit(): void {
    const ds = this.dataSource();
    if (isDataSource(ds)) {
      this.rows$ = ds.connect();
    }
  }

  ngAfterContentInit(): void {
    this.applyInitialSort();
  }

  ngAfterViewInit(): void {
    if (this.isVirtualized()) {
      const thead = this.el.nativeElement.querySelector("thead");
      if (thead) {
        this.headerObserver = new ResizeObserver((entries) => {
          this.zone.run(() => {
            this.headerHeight = entries[0].contentRect.height;
          });
        });
        this.headerObserver.observe(thead);
      }
    }
  }

  ngOnDestroy(): void {
    const ds = this.dataSource();
    if (isDataSource(ds)) {
      ds.disconnect();
    }
    this.headerObserver?.disconnect();
  }

  protected toggleSort(col: BitColumnComponent): void {
    const ds = this.dataSource();
    if (!ds) {
      return;
    }
    const current = ds.sort;
    const active = current?.column === col.name();
    const defaultDir = col.defaultSort() === "desc" ? "desc" : "asc";
    const direction = active ? (current?.direction === "asc" ? "desc" : "asc") : defaultDir;
    ds.sort = { column: col.name(), direction, fn: col.sortFn() };
  }

  protected ariaSort(col: BitColumnComponent): "ascending" | "descending" | undefined {
    if (!col.sortable()) {
      return undefined;
    }
    const sort = this.dataSource()?.sort;
    if (sort?.column !== col.name()) {
      return undefined;
    }
    return sort.direction === "asc" ? "ascending" : "descending";
  }

  protected sortIcon(col: BitColumnComponent): string {
    const sort = this.dataSource()?.sort;
    if (sort?.column !== col.name()) {
      return "bwi-up-down-btn";
    }
    return sort.direction === "asc" ? "bwi-up-solid" : "bwi-down-solid";
  }

  protected cellValue(row: any, col: BitColumnComponent): unknown {
    return row?.[col.name()];
  }

  protected selectableRows(): any[] {
    return this.dataSource()?.filteredData ?? this.dataSource()?.data ?? [];
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

  protected readonly sortButtonClasses = [
    "tw-min-w-max",
    "tw-font-medium",
    "tw-border",
    "tw-border-solid",
    "tw-rounded",
    "tw-transition",
    "hover:tw-no-underline",
    "focus:tw-outline-none",
    "tw-bg-transparent",
    "!tw-text-muted",
    "tw-border-transparent",
    "hover:tw-bg-transparent-hover",
    "hover:tw-border-primary-700",
    "focus-visible:before:tw-ring-primary-700",
    "disabled:tw-opacity-60",
    "disabled:hover:tw-border-transparent",
    "disabled:hover:tw-bg-transparent",
    "tw-relative",
    "before:tw-content-['']",
    "before:tw-block",
    "before:tw-absolute",
    "before:-tw-inset-[3px]",
    "before:tw-rounded-md",
    "before:tw-transition",
    "before:tw-ring",
    "before:tw-ring-transparent",
    "focus-visible:tw-z-10",
  ];

  private applyInitialSort(): void {
    if (this.initialSortApplied) {
      return;
    }
    const ds = this.dataSource();
    if (!ds || ds.sort?.column) {
      this.initialSortApplied = true;
      return;
    }
    const defaultCol = this.effectiveColumns().find((c) => c.defaultSort());
    if (defaultCol) {
      ds.sort = {
        column: defaultCol.name(),
        direction: defaultCol.defaultSort() ?? "asc",
        fn: defaultCol.sortFn(),
      };
    }
    this.initialSortApplied = true;
  }
}

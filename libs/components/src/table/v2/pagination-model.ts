import { computed, Signal, signal, WritableSignal } from "@angular/core";

/** Default page sizes offered in the paginator's size select. */
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export type PaginationConfig = {
  /** Rows per page. Defaults to the first {@link pageSizeOptions} entry, or 10. */
  pageSize?: number;
  /** Selectable page sizes shown in the size select. Defaults to `[10, 25, 50, 100]`. */
  pageSizeOptions?: number[];
  /** Initial 0-based page. Defaults to 0. */
  pageIndex?: number;
  /**
   * Total row count across all pages. Providing it selects server-side mode:
   * `data()` is expected to hold only the current page and the table does not
   * slice. Omit it for client-side pagination — the table slices its filtered
   * rows to the page and derives the total from them.
   */
  length?: Signal<number>;
};

/**
 * Pagination state and transitions for `bit-table-v2`, a consumer-constructed
 * sub-model parallel to {@link SortModel}/{@link TableSelectionModel}.
 * Holds the current page and page size in signals; the table reads {@link currentPage}
 * to slice its rendered rows (client mode) and `bit-table-paginator` renders the controls.
 *
 * The total ({@link length}) is supplied by {@link TableModel}: the filtered row
 * count in client mode, or the consumer's signal in {@link manual} (server-side)
 * mode. {@link currentPage} clamps to a valid page so the view stays correct as
 * the data shrinks (e.g. a filter excludes most rows).
 */
export class PaginationModel {
  /** Selectable page sizes shown in the size select. */
  readonly pageSizeOptions: number[];

  /**
   * Whether the consumer paginates the data themselves (server-side); the table
   * won't slice. Derived from {@link PaginationConfig.length} being supplied.
   */
  readonly manual: boolean;

  /** Rows per page. Two-way: the size select sets it; read it to build a server query. */
  readonly pageSize: WritableSignal<number>;

  /**
   * The requested 0-based page. May transiently exceed the valid range when the
   * data shrinks; read {@link currentPage} for the effective, clamped page.
   */
  readonly pageIndex: WritableSignal<number>;

  /** Total row count across all pages. */
  readonly length: Signal<number>;

  /**
   * @param config Consumer pagination config.
   * @param clientLength Row count used in client mode (when `config.length` is
   *   omitted) — the table's filtered row count.
   */
  constructor(config: PaginationConfig, clientLength: Signal<number>) {
    this.pageSizeOptions = config.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS;
    this.manual = config.length != null;
    this.length = config.length ?? clientLength;
    this.pageSize = signal(config.pageSize ?? this.pageSizeOptions[0] ?? 10);
    this.pageIndex = signal(config.pageIndex ?? 0);
  }

  /** Total number of pages, at least 1. */
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.length() / this.pageSize())));

  /** The effective current page, clamped to `[0, pageCount - 1]`. */
  readonly currentPage = computed(() => Math.min(this.pageIndex(), this.pageCount() - 1));

  /** 1-based index of the first row shown (0 when empty). */
  readonly rangeStart = computed(() =>
    this.length() === 0 ? 0 : this.currentPage() * this.pageSize() + 1,
  );

  /** 1-based index of the last row shown. */
  readonly rangeEnd = computed(() =>
    Math.min((this.currentPage() + 1) * this.pageSize(), this.length()),
  );

  /** Whether a previous page exists. */
  readonly hasPrevious = computed(() => this.currentPage() > 0);

  /** Whether a next page exists. */
  readonly hasNext = computed(() => this.currentPage() < this.pageCount() - 1);

  /** Goes to a 0-based page, clamped to a valid page. */
  goTo(page: number): void {
    this.pageIndex.set(Math.max(0, Math.min(page, this.pageCount() - 1)));
  }

  /** Goes to the next page, if any. */
  next(): void {
    this.goTo(this.currentPage() + 1);
  }

  /** Goes to the previous page, if any. */
  previous(): void {
    this.goTo(this.currentPage() - 1);
  }

  /** Changes the page size, keeping the first visible row in view. */
  setPageSize(size: number): void {
    const firstRow = this.currentPage() * this.pageSize();
    this.pageSize.set(size);
    this.goTo(Math.floor(firstRow / size));
  }
}

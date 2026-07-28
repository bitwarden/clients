import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
} from "@angular/core";
import { FormsModule } from "@angular/forms";

import { I18nPipe } from "@bitwarden/ui-common";

import { FormFieldModule } from "../../form-field";
import { IconButtonModule } from "../../icon-button";
import { InputModule } from "../../input";
import { SelectModule } from "../../select";

import { BitTableV2Component } from "./table-v2.component";

/** Default page sizes offered in the size select. */
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Pagination footer for `bit-table-v2`. Projected inside the table; it owns the
 * page state ({@link pageIndex} / {@link pageSize}, both two-way) and reads the
 * total row count from the table — the filtered count by default (client mode),
 * or the explicit {@link length} for server-side pagination (the table won't
 * slice; `data()` is expected to hold only the current page). The table reads
 * {@link currentPage} / {@link pageSize} back to slice its rows.
 */
@Component({
  selector: "bit-table-paginator",
  templateUrl: "./bit-table-paginator.component.html",
  imports: [SelectModule, IconButtonModule, InputModule, FormFieldModule, FormsModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-border-0 tw-border-t tw-border-solid tw-border-border-base",
  },
})
export class BitTablePaginatorComponent {
  private readonly table = inject<BitTableV2Component>(
    forwardRef(() => BitTableV2Component),
    { optional: true },
  );

  /** Current 0-based page. Two-way: controls/`goTo` set it; bind `[(pageIndex)]` to persist. */
  readonly pageIndex = model(0);

  /** Rows per page. Two-way: the size select sets it. */
  readonly pageSize = model(DEFAULT_PAGE_SIZE_OPTIONS[0]);

  /** Selectable page sizes shown in the size select. */
  readonly pageSizeOptions = input(DEFAULT_PAGE_SIZE_OPTIONS);

  /**
   * Total row count across all pages. Omit for client-side pagination (the table
   * slices its filtered rows and this derives from them). Supply it for
   * server-side mode — the table won't slice.
   */
  readonly length = input<number>();

  /** Whether the consumer paginates server-side (an explicit {@link length} was given). */
  readonly manual = computed(() => this.length() != null);

  /** Effective total: the explicit {@link length}, else the table's filtered row count. */
  protected readonly total = computed(() => this.length() ?? this.table?.filteredCount() ?? 0);

  /** Total number of pages, at least 1. */
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  /** The effective current page, clamped to `[0, pageCount - 1]`. */
  readonly currentPage = computed(() => Math.min(this.pageIndex(), this.pageCount() - 1));

  /** 1-based index of the first row shown (0 when empty). */
  readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : this.currentPage() * this.pageSize() + 1,
  );

  /** 1-based index of the last row shown. */
  readonly rangeEnd = computed(() =>
    Math.min((this.currentPage() + 1) * this.pageSize(), this.total()),
  );

  /** Whether a previous page exists. */
  readonly hasPrevious = computed(() => this.currentPage() > 0);

  /** Whether a next page exists. */
  readonly hasNext = computed(() => this.currentPage() < this.pageCount() - 1);

  /** Goes to a 0-based page, clamped to a valid page. */
  goTo(page: number): void {
    this.pageIndex.set(Math.max(0, Math.min(page, this.pageCount() - 1)));
  }

  protected next(): void {
    this.goTo(this.currentPage() + 1);
  }

  protected previous(): void {
    this.goTo(this.currentPage() - 1);
  }

  /** Changes the page size from the select, keeping the first visible row in view. */
  protected setPageSize(size: number): void {
    const firstRow = this.currentPage() * this.pageSize();
    this.pageSize.set(Number(size));
    this.goTo(Math.floor(firstRow / Number(size)));
  }

  /** Jumps to a 1-based page number entered in the page input. */
  protected goToPage(page: number | string): void {
    const value = Number(page);
    if (Number.isFinite(value)) {
      this.goTo(value - 1);
    }
  }
}

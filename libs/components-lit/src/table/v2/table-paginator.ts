import { ContextConsumer } from "@lit/context";
import { css, html, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { live } from "lit/directives/live.js";

import { BitElement } from "../../core/bit-element";
import { t } from "../../core/i18n";
import "../../icon-button/icon-button";
import "../../input/input";
import "../../select/select";
import type { BitSelect } from "../../select/select";

import { BitTableV2, TableRowRange, tableV2Context } from "./table-v2";

/** Default page sizes offered in the size select. */
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * Pagination footer for `bit-table-v2`. Place it inside the table; it owns the page state
 * ({@link pageIndex} / {@link pageSize}) and reads the total row count from the table — the
 * filtered count by default (client mode), or the explicit {@link length} for server-side
 * pagination (the table won't slice; `data` is expected to hold only the current page).
 *
 * @fires pageIndexChange - `detail` is the new 0-based page.
 * @fires pageSizeChange - `detail` is the new page size.
 */
@customElement("bit-table-paginator")
export class BitTablePaginator extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Current 0-based page. */
  @property({ type: Number, attribute: "page-index" }) pageIndex = 0;

  /** Rows per page. */
  @property({ type: Number, attribute: "page-size" }) pageSize = DEFAULT_PAGE_SIZE_OPTIONS[0];

  /** Selectable page sizes shown in the size select. */
  @property({ attribute: false }) pageSizeOptions: readonly number[] = DEFAULT_PAGE_SIZE_OPTIONS;

  /**
   * Total row count across all pages. Omit for client-side pagination. Supply it for server-side
   * mode — the table won't slice.
   */
  @property({ type: Number }) length?: number;

  private table?: BitTableV2<any, any, any>;

  private readonly tableConsumer = new ContextConsumer(
    this,
    tableV2Context,
    (table) => {
      if (table !== this.table) {
        this.table?.unregisterPaginator(this);
        this.table = table;
        table.registerPaginator(this);
      }
    },
    true,
  );

  disconnectedCallback() {
    super.disconnectedCallback();
    this.table?.unregisterPaginator(this);
    this.table = undefined;
  }

  /** Whether the consumer paginates server-side (an explicit {@link length} was given). */
  get manual(): boolean {
    return this.length != null;
  }

  private get total(): number {
    return this.length ?? this.tableConsumer.value?.filteredCount ?? 0;
  }

  /** Total number of pages, at least 1. */
  get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  /** The effective current page, clamped to `[0, pageCount - 1]`. */
  get currentPage(): number {
    return Math.min(this.pageIndex, this.pageCount - 1);
  }

  /** The rows on the current page. */
  get range(): TableRowRange {
    const total = this.total;
    return {
      start: total === 0 ? 0 : this.currentPage * this.pageSize + 1,
      end: Math.min((this.currentPage + 1) * this.pageSize, total),
      total,
    };
  }

  get hasPrevious(): boolean {
    return this.currentPage > 0;
  }

  get hasNext(): boolean {
    return this.currentPage < this.pageCount - 1;
  }

  /** Goes to a 0-based page, clamped to a valid page. */
  goTo(page: number) {
    const next = Math.max(0, Math.min(page, this.pageCount - 1));
    if (next !== this.pageIndex) {
      this.pageIndex = next;
      this.emit("pageIndexChange", next);
    }
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has("pageIndex") || changed.has("pageSize") || changed.has("length")) {
      this.table?.requestUpdate();
    }
  }

  private emit(type: string, detail: number) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  /** Changes the page size from the select, keeping the first visible row in view. */
  private setPageSize(size: number) {
    const firstRow = this.currentPage * this.pageSize;
    this.pageSize = size;
    this.emit("pageSizeChange", size);
    this.goTo(Math.floor(firstRow / size));
  }

  /** Jumps to a 1-based page number entered in the page input. */
  private goToPage(value: string) {
    const page = Number(value);
    if (value !== "" && Number.isFinite(page)) {
      this.goTo(page - 1);
    }
    this.requestUpdate();
  }

  protected render() {
    return html`<div
      class="tw-flex tw-items-center tw-justify-between tw-gap-4 tw-ps-5 tw-pe-3 tw-py-4"
    >
      <bit-select
        class="tw-w-44 tw-shrink-0"
        label=${t("rowsPerPage")}
        hide-label
        disable-margin
        .items=${this.pageSizeOptions.map((size) => ({
          value: size,
          label: t("rowsPerPageOption", size),
        }))}
        .value=${this.pageSize}
        @change=${(e: Event) => this.setPageSize((e.target as BitSelect<number>).value as number)}
      ></bit-select>

      <div class="tw-flex tw-items-center tw-gap-2">
        <bit-icon-button
          icon="bwi-angle-left"
          size="small"
          label=${t("previousPage")}
          ?disabled=${!this.hasPrevious}
          @click=${() => this.goTo(this.currentPage - 1)}
        ></bit-icon-button>

        <bit-input
          class="tw-w-20"
          type="number"
          min="1"
          max=${String(this.pageCount)}
          hide-label
          disable-margin
          label=${t("goToPage")}
          .value=${live(String(this.currentPage + 1))}
          @change=${(e: Event) => this.goToPage((e.target as HTMLInputElement).value)}
        ></bit-input>

        <span class="tw-text-sm tw-text-fg-heading tw-whitespace-nowrap">
          ${t("ofPageCount", this.pageCount)}
        </span>

        <bit-icon-button
          icon="bwi-angle-right"
          size="small"
          label=${t("nextPage")}
          ?disabled=${!this.hasNext}
          @click=${() => this.goTo(this.currentPage + 1)}
        ></bit-icon-button>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-table-paginator": BitTablePaginator;
  }
}

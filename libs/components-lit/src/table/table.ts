import { css, html, nothing, PropertyValues, TemplateResult } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

import { BitElement } from "../core/bit-element";

import type { SortDirection, SortFn, TableDataSource } from "./table-data-source";
import {
  RowAlignment,
  sortButtonClasses,
  tableCellClasses,
  tableClasses,
  tableHeadClasses,
  tableRowClasses,
} from "./table-styles";

/** A `bit-table` column: its header, how to render a row's cell, and its sort behavior. */
export type TableColumn<T> = {
  /** Identifies the column; also the default sort key. */
  id: string;
  /** Header cell content. */
  header: unknown;
  /** Body cell content for `row`. */
  cell: (row: T, index: number) => unknown;
  /**
   * Make the header a sort toggle (Angular `bitSortable`). Requires a `dataSource`. Sorts by
   * `sortKey`, defaulting to `id`.
   */
  sortable?: boolean;
  sortKey?: string;
  /** Sort by this column initially (`true` is ascending). */
  defaultSort?: boolean | SortDirection;
  /**
   * Custom sorting function
   *
   * @example
   * fn = (a, b) => a.name.localeCompare(b.name)
   *
   * fn = (a, b, direction) => {
   *  const result = a.name.localeCompare(b.name)
   *  return direction === 'asc' ? result : -result;
   * }
   */
  sortFn?: SortFn;
  /** Header cell width, e.g. `"120px"`. */
  width?: string;
};

/**
 * Native table with Bitwarden styling. Rows come from a `TableDataSource` (sorted and filtered)
 * or a plain `rows` array; `columns` describe the header and how each cell renders.
 *
 * Renders a real `<table>` in its shadow root, so table semantics are intact.
 *
 * @deprecated Use `bit-table-v2` for new tables.
 */
@customElement("bit-table")
export class BitTable<T = any> extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Sorts and filters the rows. Takes precedence over `rows`. */
  @property({ attribute: false }) dataSource?: TableDataSource<T>;

  /** Rows to render as-is, when there's no `dataSource`. */
  @property({ attribute: false }) rows?: readonly T[];

  @property({ attribute: false }) columns: readonly TableColumn<T>[] = [];

  @property({ reflect: true }) layout: "auto" | "fixed" = "auto";

  /** Vertical alignment of row content (Angular `bitRow`'s `alignContent`). */
  @property({ attribute: "align-content" }) alignContent: RowAlignment = "middle";

  /** Identity for row reuse across updates. Defaults to the row object. */
  @property({ attribute: false }) trackBy?: (index: number, row: T) => unknown;

  /** Accessible name for the table. */
  @property() label?: string;

  @query("tbody") protected tbody!: HTMLTableSectionElement | null;

  private unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.subscribe();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  protected willUpdate(changed: PropertyValues) {
    if (changed.has("dataSource")) {
      this.subscribe();
    }
    if ((changed.has("dataSource") || changed.has("columns")) && this.dataSource) {
      this.applyDefaultSort(this.dataSource);
    }
  }

  /** The rows currently rendered (sorted and filtered when a data source is set). */
  get renderedRows(): readonly T[] {
    return this.dataSource?.renderData ?? this.rows ?? [];
  }

  private subscribe() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    const ds = this.dataSource;
    if (ds && this.isConnected) {
      const onChange = () => this.requestUpdate();
      ds.addEventListener("change", onChange);
      this.unsubscribe = () => ds.removeEventListener("change", onChange);
    }
  }

  private applyDefaultSort(ds: TableDataSource<T>) {
    if (ds.sort.column) {
      return;
    }
    const column = this.columns.find((c) => c.sortable && c.defaultSort);
    if (column) {
      ds.sort = {
        column: column.sortKey ?? column.id,
        direction: column.defaultSort === "desc" ? "desc" : "asc",
        fn: column.sortFn,
      };
    }
  }

  private toggleSort(column: TableColumn<T>) {
    const ds = this.dataSource;
    if (!ds) {
      return;
    }
    const key = column.sortKey ?? column.id;
    const defaultDirection = column.defaultSort === "desc" ? "desc" : "asc";
    const direction =
      ds.sort.column === key ? (ds.sort.direction === "asc" ? "desc" : "asc") : defaultDirection;
    ds.sort = { column: key, direction, fn: column.sortFn };
  }

  protected renderHeaderCell(column: TableColumn<T>) {
    const style = styleMap({ width: column.width });
    if (!column.sortable || !this.dataSource) {
      return html`<th class="${tableCellClasses} tw-text-start" style=${style}>
        ${column.header}
      </th>`;
    }
    const sort = this.dataSource.sort;
    const active = sort.column === (column.sortKey ?? column.id);
    const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : nothing;
    const icon = !active
      ? "bwi-up-down-btn"
      : sort.direction === "asc"
        ? "bwi-up-solid"
        : "bwi-down-solid";
    return html`<th class="${tableCellClasses} tw-text-start" style=${style} aria-sort=${ariaSort}>
      <button
        type="button"
        class=${sortButtonClasses}
        aria-pressed=${active ? "true" : "false"}
        @click=${() => this.toggleSort(column)}
      >
        ${column.header}<i class="bwi tw-ms-2 ${icon}" aria-hidden="true"></i>
      </button>
    </th>`;
  }

  protected renderCells(row: T, index: number) {
    return this.columns.map(
      (column) => html`<td class=${tableCellClasses}>${column.cell(row, index)}</td>`,
    );
  }

  protected renderBody(): TemplateResult | unknown {
    const rows = this.renderedRows;
    const rowClass = tableRowClasses(this.alignContent);
    return repeat(
      rows,
      (row, index) => (this.trackBy ? this.trackBy(index, row) : row),
      (row, index) =>
        html`<tr class=${rowClass}>
          ${this.renderCells(row, index)}
        </tr>`,
    );
  }

  protected tableAttributes(): { rowCount?: number } {
    return {};
  }

  protected render() {
    const { rowCount } = this.tableAttributes();
    return html`<table
      class=${tableClasses(this.layout)}
      aria-label=${this.label ?? nothing}
      aria-rowcount=${rowCount ?? nothing}
    >
      <thead class=${tableHeadClasses}>
        <tr>
          ${this.columns.map((column) => this.renderHeaderCell(column))}
        </tr>
      </thead>
      <tbody>
        ${this.renderBody()}
      </tbody>
    </table>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-table": BitTable;
  }
}

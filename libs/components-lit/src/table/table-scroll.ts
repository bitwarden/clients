import { html, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { styleMap } from "lit/directives/style-map.js";

import { BitTable } from "./table";
import { tableRowClasses } from "./table-styles";
import { VirtualScrollController } from "./virtual-scroll";

/**
 * Virtually scrolled `bit-table` for large data sets: only the rows near the viewport render.
 * Scrolls with its nearest scrolling ancestor (e.g. the page's main region), or with itself when
 * given a bounded height and `overflow: auto`.
 *
 * Rows must render at exactly `rowSize` pixels.
 *
 * @deprecated Use `bit-table-v2` with `virtualRowHeight` for new tables.
 */
@customElement("bit-table-scroll")
export class BitTableScroll<T = any> extends BitTable<T> {
  /** The size of the rows in the list (in pixels). */
  @property({ type: Number, attribute: "row-size" }) rowSize = 0;

  private heights: readonly number[] = [];

  private readonly virtualizer = new VirtualScrollController(this, {
    heights: () => this.heights,
    content: () => this.tbody,
  });

  protected willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    const rows = this.renderedRows;
    if (this.heights.length !== rows.length || this.heights[0] !== this.rowSize) {
      this.heights = new Array<number>(rows.length).fill(this.rowSize);
    }
    this.virtualizer.prepare();
  }

  protected tableAttributes() {
    // +1 for the header row.
    return { rowCount: this.renderedRows.length + 1 };
  }

  protected renderBody() {
    const rows = this.renderedRows;
    const { start, end } = this.virtualizer.range;
    const before = start * this.rowSize;
    const after = (rows.length - end) * this.rowSize;
    const rowClass = tableRowClasses(this.alignContent);
    const height = styleMap({ height: `${this.rowSize}px` });
    // Spacer rows hold the scroll height of the rows that aren't rendered.
    return html`${
      before > 0
        ? html`<tr aria-hidden="true" style=${styleMap({ height: `${before}px` })}></tr>`
        : null
    }${repeat(
      rows.slice(start, end),
      (row, i) => (this.trackBy ? this.trackBy(start + i, row) : row),
      (row, i) =>
        html`<tr class=${rowClass} style=${height} aria-rowindex=${start + i + 2}>
          ${this.renderCells(row, start + i)}
        </tr>`,
    )}${
      after > 0
        ? html`<tr aria-hidden="true" style=${styleMap({ height: `${after}px` })}></tr>`
        : null
    }`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-table-scroll": BitTableScroll;
  }
}

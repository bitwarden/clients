import { html } from "lit";
import { customElement } from "lit/decorators.js";

import type { BadgeGroupItem } from "../../badge-group/badge-group";
import { openSimpleDialog } from "../../dialog/dialog-service";
import type { TableV2Column } from "../../table/v2/column";
import "../../badge-group/badge-group";
import "../../icon-button/icon-button";
import "../../table/v2/table-v2";

import { KitchenSinkElement } from "./kitchen-sink-element";

type Row = { id: number; name: string; updatedAt: Date; tags: BadgeGroupItem[] };

const TAG_POOL = ["Personal", "Work", "Shared", "Archived", "Favorite", "Family"];

const base = new Date(Date.UTC(2026, 0, 1));

const rows: Row[] = [...Array(100).keys()].map((i) => {
  const date = new Date(base);
  date.setUTCDate(base.getUTCDate() + i);
  return {
    id: i,
    name: `name-${i}`,
    updatedAt: date,
    tags: Array.from({ length: (i % 3) + 1 }, (_, j) => ({
      label: TAG_POOL[(i + j) % TAG_POOL.length],
      variant: "subtle" as const,
    })),
  };
});

const tagNames = (row: Row) => row.tags.map((tag) => tag.label).join(",");

const mediumDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

const openDefaultDialog = () =>
  openSimpleDialog({
    type: "info",
    title: "Foo",
    content: "Bar",
  });

const columns: TableV2Column<Row, "actions">[] = [
  { name: "id", header: "Id", sortable: true, defaultSort: "asc", cell: (row) => row.id },
  { name: "name", header: "Name", sortable: true, cell: (row) => row.name },
  {
    name: "updatedAt",
    header: "Updated",
    sortable: true,
    cell: (row) => mediumDate.format(row.updatedAt),
  },
  {
    name: "tags",
    header: "Tags",
    sortable: true,
    sortFn: (a: Row, b: Row) => tagNames(a).localeCompare(tagNames(b)),
    cell: (row) => html`<bit-badge-group .badges=${row.tags}></bit-badge-group>`,
  },
  {
    name: "actions",
    header: "",
    width: "80px",
    cell: () =>
      html`<bit-icon-button
        icon="bwi-ellipsis-v"
        label="Options"
        @click=${openDefaultDialog}
      ></bit-icon-button>`,
  },
];

/**
 * A 100-row virtualized table filling the page body; each row's button opens a dialog.
 *
 * @internal Stories only.
 */
@customElement("dialog-virtual-scroll-block")
export class DialogVirtualScrollBlock extends KitchenSinkElement {
  connectedCallback() {
    super.connectedCallback();
    // Fill the page body so the table grows to the available height and scrolls.
    this.classList.add("tw-flex", "tw-min-h-0", "tw-flex-1", "tw-flex-col");
  }

  render() {
    return html`<bit-table-v2
      .data=${rows}
      .columns=${columns}
      virtual-row-height="64"
      height="fill"
    ></bit-table-v2>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "dialog-virtual-scroll-block": DialogVirtualScrollBlock;
  }
}

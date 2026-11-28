import { html } from "lit";
import { customElement } from "lit/decorators.js";

import type { BadgeGroupItem } from "../../badge-group/badge-group";
import { cellParts, type TableV2Column } from "../../table/v2/column";
import "../../badge-group/badge-group";
import "../../button/button";
import "../../filter-menu/filter-menu";
import "../../filter-menu/filter-option";
import "../../icon-button/icon-button";
import "../../icon-tile/icon-tile";
import "../../menu/menu";
import "../../menu/menu-divider";
import "../../menu/menu-item";
import "../../search/search";
import "../../table/v2/table-paginator";
import "../../table/v2/table-toolbar";
import "../../table/v2/table-v2";

import { KitchenSinkElement } from "./kitchen-sink-element";

type ProductRow = {
  id: string;
  product: string;
  description: string;
  user: string;
  badges: BadgeGroupItem[];
};

type ProductFilters = {
  search?: string;
  user?: string;
  feature?: string[];
};

const PRODUCT_ROWS: ProductRow[] = [
  {
    id: "pm",
    product: "Password Manager",
    description: "Vault, autofill, and credential generator",
    user: "Everyone",
    badges: [
      { label: "Autofill", variant: "success", startIcon: "bwi-check-circle" },
      { label: "Secrets", variant: "danger" },
      { label: "Generator", variant: "subtle" },
    ],
  },
  {
    id: "sm",
    product: "Secrets Manager",
    description: "API keys, certificates, and infrastructure secrets",
    user: "Developers",
    badges: [
      { label: "Certificates", variant: "accent-primary" },
      { label: "Secrets", variant: "danger" },
      { label: "Infrastructure", variant: "primary" },
    ],
  },
];

/** The row's options button and menu; both render into the table's shadow root, where the id resolves. */
const actionsCell = (row: ProductRow) => {
  const id = `options-${row.id}`;
  return html`<bit-icon-button id=${id} icon="bwi-ellipsis-v" label="Options"></bit-icon-button>
    <bit-menu trigger=${id}>
      <bit-menu-item href="#">Anchor link</bit-menu-item>
      <bit-menu-item href="#">Another link</bit-menu-item>
      <bit-menu-divider></bit-menu-divider>
      <bit-menu-item>Button after divider</bit-menu-item>
    </bit-menu>`;
};

const productCell = (row: ProductRow) =>
  cellParts({
    start: html`<bit-icon-tile icon="bwi-globe" size="sm"></bit-icon-tile>`,
    content: row.product,
    secondary: row.description,
  });

const badgesCell = (row: ProductRow) =>
  html`<bit-badge-group .badges=${row.badges}></bit-badge-group>`;

const legacyColumns: TableV2Column<ProductRow, "actions">[] = [
  { name: "product", header: "Product", cell: productCell },
  { name: "user", header: "User", cell: (row) => row.user },
  { name: "badges", header: "Features", cell: badgesCell },
  { name: "actions", header: "Actions", cell: actionsCell },
];

/**
 * The pre-VFO1 kitchen sink table: static rows, no toolbar.
 *
 * @internal Stories only.
 */
@customElement("bit-kitchen-sink-table")
export class KitchenSinkTable extends KitchenSinkElement {
  render() {
    return html`<bit-table-v2 .data=${PRODUCT_ROWS} .columns=${legacyColumns}></bit-table-v2>`;
  }
}

const columns: TableV2Column<ProductRow, "actions">[] = [
  {
    name: "product",
    header: "Product",
    sortable: true,
    defaultSort: "asc",
    width: "minmax(240px, 2fr)",
    cell: productCell,
  },
  { name: "user", header: "User", sortable: true, width: "160px", cell: (row) => row.user },
  { name: "badges", header: "Features", width: "minmax(200px, 1fr)", cell: badgesCell },
  {
    name: "actions",
    header: html`<span class="tw-sr-only">Actions</span>`,
    width: "80px",
    cell: actionsCell,
  },
];

const users = [...new Set(PRODUCT_ROWS.map((row) => row.user))];

const features = [
  ...new Set(PRODUCT_ROWS.flatMap((row) => row.badges.map((badge) => badge.label))),
];

const filter = (row: ProductRow, f: ProductFilters) =>
  (!f.search || row.product.toLowerCase().includes(f.search.toLowerCase())) &&
  (f.user == null || row.user === f.user) &&
  (!f.feature?.length || row.badges.some((badge) => f.feature?.includes(badge.label)));

/**
 * The VFO1 kitchen sink table: toolbar with search, actions and filter chips, sorting and paging.
 *
 * @internal Stories only.
 */
@customElement("bit-kitchen-sink-table-v2")
export class KitchenSinkTableV2 extends KitchenSinkElement {
  render() {
    return html`<bit-table-v2 .data=${PRODUCT_ROWS} .columns=${columns} .filter=${filter}>
      <bit-table-toolbar>
        <bit-search class="tw-flex-1" placeholder="Search" aria-label="Search"></bit-search>
        <bit-button button-type="secondary" slot="end" start-icon="bwi-download">
          Import from another app
        </bit-button>
        <bit-button button-type="secondary" slot="end" start-icon="bwi-upload">
          Export all items
        </bit-button>
        <bit-button button-type="primary" slot="end" start-icon="bwi-plus">Add new item</bit-button>

        <bit-filter-menu key="user" placeholder-text="User" unset-label="All">
          ${users.map(
            (user) => html`<bit-filter-option .value=${user}>${user}</bit-filter-option>`,
          )}
        </bit-filter-menu>

        <bit-filter-menu icon="bwi-tag" key="feature" placeholder-text="Features" multiple>
          ${features.map(
            (feature) => html`<bit-filter-option .value=${feature}>${feature}</bit-filter-option>`,
          )}
        </bit-filter-menu>
      </bit-table-toolbar>

      <bit-table-paginator page-size="5" .pageSizeOptions=${[5, 10, 25]}></bit-table-paginator>
    </bit-table-v2>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-kitchen-sink-table": KitchenSinkTable;
    "bit-kitchen-sink-table-v2": KitchenSinkTableV2;
  }
}

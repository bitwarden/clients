import { ChangeDetectionStrategy, Component, signal } from "@angular/core";

import { BadgeGroupComponent, BadgeGroupItem } from "../../../badge-group";
import { FilterMenuModule } from "../../../filter-menu";
import { IconTileComponent } from "../../../icon-tile";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTablePaginatorComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  defineTable,
} from "../../../table/v2";
import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

type ProductRow = {
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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "bit-kitchen-sink-table-v2",
  imports: [
    KitchenSinkSharedModule,
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
    BitTableToolbarComponent,
    BitTablePaginatorComponent,
    FilterMenuModule,
    IconTileComponent,
    BadgeGroupComponent,
  ],
  template: `
    <bit-table-v2 [tableDef]="table" [filter]="filter">
      <bit-table-toolbar>
        <bit-search class="tw-flex-1" placeholder="Search" aria-label="Search"></bit-search>
        <button bitButton buttonType="primary" type="button" slot="end" startIcon="bwi-plus">
          Add
        </button>

        <bit-filter-menu key="user" placeholderText="User" unsetLabel="All">
          @for (user of users; track user) {
            <bit-filter-option [value]="user">{{ user }}</bit-filter-option>
          }
        </bit-filter-menu>

        <bit-filter-menu icon="bwi-tag" key="feature" placeholderText="Features" multiple>
          @for (feature of features; track feature) {
            <bit-filter-option [value]="feature">{{ feature }}</bit-filter-option>
          }
        </bit-filter-menu>
      </bit-table-toolbar>

      <bit-column sortable defaultSort="asc" width="minmax(240px, 2fr)">
        <bit-header-cell>Product</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.product; let row">
          <bit-icon-tile slot="start" icon="bwi-globe" size="sm" />
          {{ row.product }}
          <span slot="secondary">{{ row.description }}</span>
        </bit-cell>
      </bit-column>
      <bit-column sortable width="160px">
        <bit-header-cell>User</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.user; let row">{{ row.user }}</bit-cell>
      </bit-column>
      <bit-column width="minmax(200px, 1fr)">
        <bit-header-cell>Features</bit-header-cell>
        <bit-cell *bitCellDef="table.columns.badges; let row">
          <bit-badge-group [badges]="row.badges" />
        </bit-cell>
      </bit-column>
      <bit-column width="80px">
        <bit-header-cell><span class="tw-sr-only">Actions</span></bit-header-cell>
        <bit-cell *bitCellDef="table.columns.actions; let row">
          <button
            type="button"
            bitIconButton="bwi-ellipsis-v"
            [bitMenuTriggerFor]="menu"
            label="Options"
          ></button>
          <bit-menu #menu>
            <a href="#" bitMenuItem>Anchor link</a>
            <a href="#" bitMenuItem>Another link</a>
            <bit-menu-divider></bit-menu-divider>
            <button type="button" bitMenuItem>Button after divider</button>
          </bit-menu>
        </bit-cell>
      </bit-column>

      <bit-table-paginator [pageSize]="5" [pageSizeOptions]="pageSizeOptions"></bit-table-paginator>
    </bit-table-v2>
  `,
})
export class KitchenSinkTableV2Component {
  protected readonly table = defineTable<ProductRow, "actions">(signal(PRODUCT_ROWS));

  protected readonly pageSizeOptions = [5, 10, 25];

  protected readonly users = [...new Set(PRODUCT_ROWS.map((row) => row.user))];

  protected readonly features = [
    ...new Set(PRODUCT_ROWS.flatMap((row) => row.badges.map((badge) => badge.label))),
  ];

  protected readonly filter = (row: ProductRow, f: ProductFilters) =>
    (!f.search || row.product.toLowerCase().includes(f.search.toLowerCase())) &&
    (f.user == null || row.user === f.user) &&
    (!f.feature?.length || row.badges.some((badge) => f.feature?.includes(badge.label)));
}

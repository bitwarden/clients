import { ChangeDetectionStrategy, Component, InjectionToken, inject, signal } from "@angular/core";

import { BadgeGroupComponent, BadgeGroupItem } from "../../../badge-group";
import { FilterMenuModule, FilterOptionNode } from "../../../filter-menu";
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
  /** Shared folder ids the row belongs to, like a cipher's `collectionIds`. */
  folderIds: string[];
};

type ProductFilters = {
  search?: string;
  user?: string;
  feature?: string[];
  sharedFolder?: string[];
};

/**
 * Overrides the demo data with a generated dataset, for the kitchen sink's perf stress story.
 * `rows` products are spread across `users` distinct users and `features` distinct badges, and
 * each holds one to three of `sharedFolders` folders. The Shared folders chip mirrors the vault's:
 * a data-driven, multi-select tree counted in one pass through the table's `optionValues`.
 */
export type KitchenSinkTableV2Stress = {
  rows: number;
  sharedFolders: number;
  users: number;
  features: number;
  pageSize: number;
};

export const KITCHEN_SINK_TABLE_V2_STRESS = new InjectionToken<KitchenSinkTableV2Stress>(
  "KitchenSinkTableV2Stress",
);

const BADGE_VARIANTS = ["success", "danger", "subtle", "accent-primary", "primary"] as const;

/** Deterministic, so runs are comparable: a tiny LCG rather than `Math.random`. */
function lcg(seed: number) {
  return (max: number) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    // High bits: an LCG's low bits cycle quickly and would skip half the values.
    return (seed >>> 16) % max;
  };
}

/** A mostly flat tree, like a real collection list: one folder in fifty is a parent of ten. */
function generateSharedFolders(count: number): FilterOptionNode<string>[] {
  const nodes: FilterOptionNode<string>[] = [];
  let id = 0;
  const node = (): FilterOptionNode<string> => {
    const value = `folder-${id++}`;
    return { value, label: `Shared folder ${value.slice(7).padStart(4, "0")}` };
  };
  while (id < count) {
    const parent = node();
    if (nodes.length % 50 === 0) {
      parent.options = Array.from({ length: Math.min(10, count - id) }, node);
    }
    nodes.push(parent);
  }
  return nodes;
}

function generateRows({ rows, users, features, sharedFolders }: KitchenSinkTableV2Stress) {
  const next = lcg(42);
  return Array.from({ length: rows }, (_, i): ProductRow => {
    const badgeCount = 1 + next(3);
    const folderCount = 1 + next(3);
    return {
      product: `Product ${i.toString().padStart(5, "0")}`,
      description: `Generated description for product ${i}`,
      user: `User ${next(users).toString().padStart(4, "0")}`,
      badges: Array.from({ length: badgeCount }, () => ({
        label: `Feature ${next(features)}`,
        variant: BADGE_VARIANTS[next(BADGE_VARIANTS.length)],
      })),
      folderIds: Array.from({ length: folderCount }, () => `folder-${next(sharedFolders)}`),
    };
  });
}

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
    folderIds: ["folder-0"],
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
    folderIds: ["folder-1"],
  },
];

const DEMO_SHARED_FOLDERS: FilterOptionNode<string>[] = [
  { value: "folder-0", label: "Engineering" },
  { value: "folder-1", label: "Infrastructure" },
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
    <bit-table-v2 [tableDef]="table" [filter]="filter" [optionValues]="optionValues">
      <bit-table-toolbar>
        <bit-search class="tw-flex-1" placeholder="Search" aria-label="Search"></bit-search>
        <button bitButton buttonType="secondary" type="button" slot="end" startIcon="bwi-download">
          Import from another app
        </button>
        <button bitButton buttonType="secondary" type="button" slot="end" startIcon="bwi-upload">
          Export all items
        </button>
        <button bitButton buttonType="primary" type="button" slot="end" startIcon="bwi-plus">
          Add new item
        </button>

        <!-- "virtualized" is a no-op where the filter menu doesn't support it. -->
        <bit-filter-menu
          key="sharedFolder"
          placeholderText="Shared folders"
          multiple
          virtualized
          [options]="sharedFolders"
        ></bit-filter-menu>

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

      <bit-table-paginator
        [pageSize]="pageSize"
        [pageSizeOptions]="pageSizeOptions"
      ></bit-table-paginator>
    </bit-table-v2>
  `,
})
export class KitchenSinkTableV2Component {
  private readonly stress = inject(KITCHEN_SINK_TABLE_V2_STRESS, { optional: true });

  private readonly rows = this.stress ? generateRows(this.stress) : PRODUCT_ROWS;

  protected readonly table = defineTable<ProductRow, "actions">(signal(this.rows));

  protected readonly pageSize = this.stress?.pageSize ?? 5;

  protected readonly pageSizeOptions = [5, 10, 25, 50, 100];

  protected readonly sharedFolders = this.stress
    ? generateSharedFolders(this.stress.sharedFolders)
    : DEMO_SHARED_FOLDERS;

  protected readonly users = [...new Set(this.rows.map((row) => row.user))].sort();

  protected readonly features = [
    ...new Set(this.rows.flatMap((row) => row.badges.map((badge) => badge.label))),
  ].sort();

  /** One-pass option counts for the Shared folders chip, as the vault table binds them. */
  protected readonly optionValues = {
    sharedFolder: (row: ProductRow) => row.folderIds,
  };

  /** Mirrors the vault's `matchesSharedFolder`: a row matches any selected folder it holds. */
  private static matchesSharedFolder(row: ProductRow, selected: string[] | undefined) {
    if (!selected || selected.length === 0) {
      return true;
    }
    for (const id of row.folderIds) {
      if (selected.includes(id)) {
        return true;
      }
    }
    return false;
  }

  protected readonly filter = (row: ProductRow, f: ProductFilters) =>
    (!f.search || row.product.toLowerCase().includes(f.search.toLowerCase())) &&
    (f.user == null || row.user === f.user) &&
    (!f.feature?.length || row.badges.some((badge) => f.feature?.includes(badge.label))) &&
    KitchenSinkTableV2Component.matchesSharedFolder(row, f.sharedFolder);
}

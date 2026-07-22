import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router } from "@angular/router";
import { RouterTestingModule } from "@angular/router/testing";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { filter as rxFilter, map } from "rxjs";
import { userEvent } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { BulkActionComponent } from "../../bulk-actions-bar/bulk-action.component";
import { BulkActionsBarComponent } from "../../bulk-actions-bar/bulk-actions-bar.component";
import { BulkAdditionalActionComponent } from "../../bulk-actions-bar/bulk-additional-action.component";
import { ButtonModule } from "../../button";
import { DialogModule } from "../../dialog";
import { FilterMenuModule } from "../../filter-menu";
import { IconTileComponent } from "../../icon-tile/icon-tile.component";
import { LayoutComponent, PageComponent } from "../../layout";
import { mockLayoutI18n } from "../../layout/mocks";
import { SearchModule } from "../../search";
import { SkeletonTextComponent } from "../../skeleton";
import { positionFixedWrapperDecorator } from "../../stories/storybook-decorators";
import { TypographyModule } from "../../typography";
import { I18nMockService, StorybookGlobalStateProvider } from "../../utils";

import { BitCellDefDirective } from "./bit-cell-def.directive";
import { BitCellLoadingDirective } from "./bit-cell-loading.directive";
import { BitCellComponent } from "./bit-cell.component";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { BitHeaderRowComponent } from "./bit-header-row.component";
import { BitRowGroupComponent } from "./bit-row-group.component";
import { BitRowComponent } from "./bit-row.component";
import { BitTablePaginatorComponent } from "./bit-table-paginator.component";
import { BitTableToolbarComponent } from "./bit-table-toolbar.component";
import { TableDef, defineTable } from "./table-def";
import { BitTableV2Component } from "./table-v2.component";

type DemoRow = { id: number; name: string; other: string };
type UsersRow = { id: number; name: string; email: string; starred: boolean };

@Component({
  selector: "demo-status-column",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BitColumnComponent, BitCellDefDirective, BitHeaderCellComponent, BitCellComponent],
  template: `
    <bit-column sortable>
      <bit-header-cell>Status</bit-header-cell>
      <bit-cell *bitCellDef="table().columns.other; let row">
        <span class="tw-rounded tw-bg-primary-100 tw-px-2 tw-py-0.5 tw-text-xs">
          {{ row.other }}
        </span>
      </bit-cell>
    </bit-column>
  `,
})
class DemoStatusColumnComponent {
  readonly table = input.required<TableDef<DemoRow>>();
}

type VaultRow = {
  id: number;
  name: string;
  type: "login" | "card" | "note";
  vault: "mine" | "acme";
  collectionIds: string[];
  favorite: boolean;
};

const VAULT_ROWS: VaultRow[] = [
  { id: 1, name: "Acme", type: "login", vault: "acme", collectionIds: ["eng"], favorite: true },
  { id: 2, name: "Amazon", type: "login", vault: "mine", collectionIds: [], favorite: false },
  { id: 3, name: "Apple ID", type: "login", vault: "mine", collectionIds: [], favorite: true },
  {
    id: 4,
    name: "Chase Bank",
    type: "card",
    vault: "acme",
    collectionIds: ["ops"],
    favorite: false,
  },
  {
    id: 5,
    name: "Corporate amex",
    type: "card",
    vault: "acme",
    collectionIds: ["ops", "eng"],
    favorite: true,
  },
  { id: 6, name: "Datadog", type: "login", vault: "acme", collectionIds: ["eng"], favorite: false },
  {
    id: 7,
    name: "Docusign",
    type: "login",
    vault: "acme",
    collectionIds: ["ops"],
    favorite: false,
  },
  {
    id: 8,
    name: "Recovery codes",
    type: "note",
    vault: "mine",
    collectionIds: ["personal"],
    favorite: false,
  },
  {
    id: 9,
    name: "Wifi password",
    type: "note",
    vault: "acme",
    collectionIds: ["pm"],
    favorite: false,
  },
];

const VAULTS = [
  { id: "mine", name: "My vault" },
  { id: "acme", name: "Acme corporation" },
] as const;

const COLLECTION_ORGS = [
  {
    name: "Acme corporation",
    collections: [
      { id: "eng", name: "Engineering" },
      { id: "ops", name: "Operations" },
      { id: "pm", name: "Project management" },
      { id: "infra", name: "Infrastructure" },
      { id: "monitoring", name: "Monitoring" },
      { id: "security", name: "Security" },
      { id: "design", name: "Design" },
      { id: "marketing", name: "Marketing" },
      { id: "sales", name: "Sales" },
    ],
  },
  {
    name: "My vault",
    collections: [
      { id: "personal", name: "Personal" },
      { id: "finance", name: "Finance" },
      { id: "travel", name: "Travel" },
    ],
  },
];

type VaultFilters = {
  search?: string;
  type?: VaultRow["type"];
  vault?: string[];
  collection?: string[];
  favorite?: boolean;
};

/**
 * Filtering with the form-group model: each chip declares a `key`, owns its own
 * selection, and the table collects them into `table.filterValues()` (a
 * `{ key: value }` object). The model's `filter` reads that object — no per-chip
 * state or `ngModel`. `filters` seeds the initial selection.
 *
 * Shows the range of menu content: a radio group (Type), a checkbox group
 * (Vault), a checkbox group with in-menu search + collapsible sections
 * (Collections), and a toggle (Favorites).
 */
@Component({
  selector: "demo-filterable-table",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
    BitTableToolbarComponent,
    FilterMenuModule,
    SearchModule,
    ButtonModule,
    LayoutComponent,
  ],
  template: `
    <bit-layout>
      <bit-table-v2 [tableDef]="table" [filter]="filter" [presentation]="presentation()">
        <bit-table-toolbar>
          <bit-search class="tw-flex-1" placeholder="Search" aria-label="Search"></bit-search>
          <button bitButton buttonType="primary" type="button" slot="end">New</button>

          <bit-filter-menu key="type" placeholderText="Type" unsetLabel="All">
            @for (option of typeOptions; track option.value) {
              <bit-filter-option [value]="option.value">
                {{ option.label }}
              </bit-filter-option>
            }
          </bit-filter-menu>

          <bit-filter-divider></bit-filter-divider>

          <bit-filter-menu key="vault" placeholderText="Vault" multiple>
            @for (option of vaultOptions; track option.value) {
              <bit-filter-option [value]="option.value">
                {{ option.label }}
              </bit-filter-option>
            }
          </bit-filter-menu>

          <bit-filter-menu key="collection" placeholderText="Collections" multiple>
            @for (org of collectionOrgs; track org.name) {
              <bit-filter-section [label]="org.name" collapsible>
                @for (collection of org.collections; track collection.id) {
                  <bit-filter-option [value]="collection.id">
                    {{ collection.name }}
                  </bit-filter-option>
                }
              </bit-filter-section>
            }
          </bit-filter-menu>

          <bit-filter-toggle
            key="favorite"
            label="Favorites"
            icon="bwi-star"
            iconActive="bwi-star-f"
          ></bit-filter-toggle>
        </bit-table-toolbar>

        <bit-column sortable defaultSort="asc">
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
        <bit-column sortable width="120px">
          <bit-header-cell>Type</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.type; let row">{{ row.type }}</bit-cell>
        </bit-column>
        <bit-column width="160px">
          <bit-header-cell>Vault</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.vault; let row">{{ vaultName(row.vault) }}</bit-cell>
        </bit-column>
      </bit-table-v2>
    </bit-layout>
  `,
})
class DemoFilterableTableComponent {
  readonly presentation = input<"table" | "list">("table");

  protected readonly data = signal(VAULT_ROWS);
  protected readonly table = defineTable<VaultRow>(this.data);

  protected readonly filter = (row: VaultRow, f: Partial<VaultFilters>) =>
    (!f.search || row.name.toLowerCase().includes(f.search.toLowerCase())) &&
    (f.type == null || row.type === f.type) &&
    (!f.vault?.length || f.vault.includes(row.vault)) &&
    (!f.collection?.length || f.collection.some((c) => row.collectionIds.includes(c))) &&
    (!f.favorite || row.favorite);

  // Options carry no `count` — the table computes faceted counts automatically
  // (rows matching each option given the other active filters).
  protected readonly typeOptions = (["login", "card", "note"] as const).map((value) => ({
    value,
    label: value,
  }));

  protected readonly vaultOptions = VAULTS.map((vault) => ({
    value: vault.id,
    label: vault.name,
  }));

  /** Collections grouped by org. The in-menu search narrows them automatically. */
  protected readonly collectionOrgs = COLLECTION_ORGS;

  protected vaultName(id: string): string {
    return VAULTS.find((v) => v.id === id)?.name ?? id;
  }
}

/**
 * Sync filters, sort, and pagination to the URL with **`queryParam`** — set it to a
 * namespace and the table mirrors its state to `?<namespace>.*` params. A shared
 * link restores the view; inactive/default facets leave no param behind. The live
 * URL is shown above the table (with `RouterTestingModule` it updates in memory, not
 * the address bar).
 */
@Component({
  selector: "demo-url-sync-table",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
    BitTableToolbarComponent,
    BitTablePaginatorComponent,
    FilterMenuModule,
    SearchModule,
    LayoutComponent,
  ],
  template: `
    <bit-layout>
      <p class="tw-mb-2 tw-font-mono tw-text-sm tw-text-main">{{ url() }}</p>
      <bit-table-v2 [tableDef]="table" [filter]="filter" queryParam="items">
        <bit-table-toolbar>
          <bit-search class="tw-flex-1" placeholder="Search" aria-label="Search"></bit-search>

          <bit-filter-menu key="type" placeholderText="Type" unsetLabel="All">
            @for (option of typeOptions(); track option.value) {
              <bit-filter-option [value]="option.value">{{ option.label }}</bit-filter-option>
            }
          </bit-filter-menu>

          <bit-filter-menu key="vault" placeholderText="Vault" multiple>
            @for (option of vaultOptions(); track option.value) {
              <bit-filter-option [value]="option.value">{{ option.label }}</bit-filter-option>
            }
          </bit-filter-menu>

          <bit-filter-toggle
            key="favorite"
            label="Favorites"
            icon="bwi-star"
            iconActive="bwi-star-f"
          ></bit-filter-toggle>
        </bit-table-toolbar>

        <bit-column sortable defaultSort="asc">
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
        <bit-column sortable width="120px">
          <bit-header-cell>Type</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.type; let row">{{ row.type }}</bit-cell>
        </bit-column>
        <bit-column width="160px">
          <bit-header-cell>Vault</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.vault; let row">{{ vaultName(row.vault) }}</bit-cell>
        </bit-column>

        <bit-table-paginator [pageSize]="5" [pageSizeOptions]="[5, 10, 25]" />
      </bit-table-v2>
    </bit-layout>
  `,
})
class DemoUrlSyncTableComponent {
  private readonly router = inject(Router);
  protected readonly data = signal(VAULT_ROWS);
  protected readonly table = defineTable<VaultRow>(this.data);

  /** The live URL, so the synced params are visible as filters/sort/page change. */
  protected readonly url = toSignal(
    this.router.events.pipe(
      rxFilter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly filter = (row: VaultRow, f: Partial<VaultFilters>) =>
    (!f.search || row.name.toLowerCase().includes(f.search.toLowerCase())) &&
    (f.type == null || row.type === f.type) &&
    (!f.vault?.length || f.vault.includes(row.vault)) &&
    (!f.favorite || row.favorite);

  protected readonly typeOptions = computed(() =>
    (["login", "card", "note"] as const)
      .map((value) => ({ value, label: value }))
      .filter((option) => this.data().some((r) => r.type === option.value)),
  );

  protected readonly vaultOptions = computed(() =>
    VAULTS.map((vault) => ({ value: vault.id, label: vault.name })),
  );

  protected vaultName(id: string): string {
    return VAULTS.find((v) => v.id === id)?.name ?? id;
  }
}

export default {
  title: "Component Library/Table V2",
  decorators: [
    positionFixedWrapperDecorator(undefined, { border: false }),
    moduleMetadata({
      imports: [
        BitTableV2Component,
        BitColumnComponent,
        BitCellDefDirective,
        BitHeaderCellComponent,
        BitCellComponent,
        BitHeaderRowComponent,
        BitRowComponent,
        BitRowGroupComponent,
        BitTableToolbarComponent,
        BitTablePaginatorComponent,
        BitCellLoadingDirective,
        SkeletonTextComponent,
        DemoStatusColumnComponent,
        DemoFilterableTableComponent,
        DemoUrlSyncTableComponent,
        BulkActionsBarComponent,
        BulkActionComponent,
        BulkAdditionalActionComponent,
        IconTileComponent,
        LayoutComponent,
        PageComponent,
        TypographyModule,
        SearchModule,
        DialogModule,
        RouterTestingModule,
      ],
    }),
    applicationConfig({
      providers: [
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
        },
        // Provided at the application (root) level so dialogs opened via DialogService —
        // which root their injector at the app injector, not the story module — resolve it.
        {
          provide: I18nService,
          useFactory: () =>
            new I18nMockService({
              ...mockLayoutI18n,
              selected: "selected",
              selectionCleared: "Selection cleared",
              clear: "Clear",
              bulkActionsBar: "Bulk actions",
              bulkActionsBarAnnouncement: "__$1__ item(s) selected. Press __$2__ to focus the bar.",
              additionalActions: "Additional actions",
              search: "Search",
              resetSearch: "Reset search",
              viewItemsIn: (name) => `View items in ${name}`,
              back: "Back",
              backTo: (name) => `Back to ${name}`,
              removeItem: (name) => `Remove ${name}`,
              clearFilters: "Clear all filters",
              filtersApplied: (count) => `${count} filters applied`,
              nothingToShow: "Nothing to show",
              noMatchingItems: "No matching items",
              selectAllRows: "Select all rows",
              selectRow: "Select row",
              showingItemRange: (start, end, total) => `Showing ${start} - ${end} of ${total}`,
              rowsPerPage: "Rows per page",
              rowsPerPageOption: (count) => `${count} rows per page`,
              itemCount: (count) => `${count} items`,
              all: "All",
              filter: "Filter",
              filters: "Filters",
              done: "Done",
              clearAll: "Clear all",
              filtersSelected: (count) => `${count} selected`,
              previousPage: "Previous page",
              nextPage: "Next page",
              goToPage: "Go to page",
              ofPageCount: (count) => `of ${count}`,
              selectPlaceholder: "-- Select --",
            }),
        },
      ],
    }),
  ],
} as Meta;

type Story = StoryObj;

const basicData = signal<DemoRow[]>(
  [...Array(5).keys()].map((i) => ({
    id: i,
    name: `name-${i}`,
    other: `other-${i}`,
  })),
);

const basicTable = defineTable<DemoRow>(basicData);
const emptyTable = defineTable<DemoRow>(signal<DemoRow[]>([]));
const loadingTable = defineTable<DemoRow>(signal<DemoRow[]>([]));

export const Default: Story = {
  render: () => ({
    props: {
      table: basicTable,
      sortFn: (a: DemoRow, b: DemoRow) => a.id - b.id,
    },
    template: `
      <bit-table-v2 [tableDef]="table">
        <bit-column sortable defaultSort="asc">
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
        </bit-column>
        <bit-column sortable>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
        <bit-column sortable [sortFn]="sortFn">
          <bit-header-cell>Other</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
        </bit-column>
      </bit-table-v2>
    `,
  }),
};

/**
 * The `presentation` input switches between the bordered column grid (`table`)
 * and a `bit-item`-style card list (`list`). Reuses the {@link Filterable} demo
 * so the filtering chrome carries over unchanged — toggle the control to compare.
 */
export const List: Story = {
  args: { presentation: "list" },
  argTypes: {
    presentation: { control: "inline-radio", options: ["table", "list"] },
  },
  render: (args) => ({
    props: args,
    template: `<demo-filterable-table [presentation]="presentation"></demo-filterable-table>`,
  }),
};

export const CustomCell: Story = {
  render: () => ({
    props: { table: basicTable },
    template: `
      <bit-table-v2 [tableDef]="table">
        <bit-column width="80px">
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Link</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.other; let row">
            <a href="#">{{ row.other }} →</a>
          </bit-cell>
        </bit-column>
      </bit-table-v2>
    `,
  }),
};

/**
 * `width` on `<bit-column>` sets the column's grid track. Use content-independent
 * values so columns align across every row: a fixed length, `1fr` (the default,
 * an equal share of the remainder), or `minmax(min, max)`. Here Id is a fixed
 * `80px`, Name takes the remaining space, and Other is bounded with
 * `minmax(120px, 200px)`. Avoid `max-content` / `min-content` / `auto` — they size
 * per row and drift out of alignment.
 */
export const ColumnSizing: Story = {
  render: () => ({
    props: { table: basicTable },
    template: `
      <bit-table-v2 [tableDef]="table">
        <bit-column width="80px">
          <bit-header-cell>Id (80px)</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Name (1fr)</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
        <bit-column width="minmax(120px, 200px)">
          <bit-header-cell>Other (minmax)</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
        </bit-column>
      </bit-table-v2>
    `,
  }),
};

const userTable = defineTable<UsersRow>(
  signal([
    { id: 1, name: "Alex Johnson", email: "alex@example.com", starred: true },
    { id: 2, name: "Sam Rivera", email: "sam.rivera@example.com", starred: false },
    { id: 3, name: "Jordan Park", email: "jordan.park@example.com", starred: true },
  ]),
);

/**
 * Rich cells use the slot vocabulary on `<bit-cell>` directly:
 * `slot=start` for a leading icon/tile, default for the title, `slot=secondary`
 * for a subtitle, `slot=end` for a trailing affordance.
 */
export const RichCells: Story = {
  render: () => ({
    props: { table: userTable },
    template: `
      <bit-table-v2 [tableDef]="table">
        <bit-column sortable defaultSort="asc">
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">
            <bit-icon-tile slot="start" icon="bwi-globe" size="sm" />
            {{ row.name }}
            <span slot="secondary">{{ row.email }}</span>
            @if (row.starred) {
              <i slot="end" class="bwi bwi-star-f tw-text-warning"></i>
            }
          </bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>
            <i class="bwi bwi-envelope tw-me-1"></i> Contact
          </bit-header-cell>
          <bit-cell *bitCellDef="table.columns.email; let row">
            {{ row.email }}
            <span slot="secondary">User #{{ row.id }}</span>
          </bit-cell>
        </bit-column>
      </bit-table-v2>
    `,
  }),
};

/**
 * `[displayedColumns]` sets display order; columns it omits aren't rendered even
 * though they're declared. Here `other` is declared but left out. (Omit
 * `[displayedColumns]` entirely to show every column in declaration order.)
 */
export const ReorderedAndHidden: Story = {
  render: () => ({
    props: { table: basicTable, displayed: ["name", "id"] },
    template: `
      <bit-table-v2 [tableDef]="table" [displayedColumns]="displayed">
        <bit-column>
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Hidden</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
        </bit-column>
      </bit-table-v2>
    `,
  }),
};

/**
 * Columns can be composed into reusable wrapper components. The inner
 * `<bit-column>` registers itself with the ancestor `<bit-table-v2>` via DI,
 * so the wrapper is transparent — the table sees the inner column directly.
 */
export const WrappedColumn: Story = {
  render: () => ({
    props: { table: basicTable },
    template: `
      <bit-table-v2 [tableDef]="table">
        <bit-column>
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
        </bit-column>
        <bit-column sortable>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
        <demo-status-column [table]="table" />
      </bit-table-v2>
    `,
  }),
};

const largeTable = defineTable<DemoRow>(
  signal([...Array(100).keys()].map((i) => ({ id: i, name: `name-${i}`, other: `other-${i}` }))),
);

export const Scrollable: Story = {
  render: () => ({
    props: {
      table: largeTable,
      sortFn: (a: DemoRow, b: DemoRow) => a.id - b.id,
      trackBy: (_: number, item: DemoRow) => item.id,
    },
    template: `
      <bit-layout>
        <bit-table-v2 [tableDef]="table" [virtualRowHeight]="64" [trackBy]="trackBy" [height]="6">
          <bit-column sortable defaultSort="asc">
            <bit-header-cell>Id</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
          </bit-column>
          <bit-column sortable>
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
          </bit-column>
          <bit-column sortable [sortFn]="sortFn">
            <bit-header-cell>Other</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
          </bit-column>
        </bit-table-v2>
      </bit-layout>
    `,
  }),
};

type GroupedRow = { id: number; name: string; type: "login" | "card" | "note" };

const GROUP_TYPES = ["login", "card", "note"] as const;

const groupedTable = defineTable<GroupedRow>(
  signal(
    [...Array(90).keys()].map((i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      type: GROUP_TYPES[i % 3],
    })),
  ),
);

/**
 * Grouping composes with virtualization. A single scroll viewport renders the
 * interleaved group headers and rows, positioned by a variable-size scroll strategy
 * (headers and rows have different heights). Groups are a `list`-presentation
 * feature; collapsing one drops its rows from the virtual list and the viewport
 * re-measures. `virtualRowHeight` is the row's full advance — for a single-line
 * `list` row that's the `bit-item`-aligned content height plus the row's bottom margin.
 */
export const GroupedVirtualized: Story = {
  render: () => ({
    props: {
      table: groupedTable,
      trackBy: (_: number, item: GroupedRow) => item.id,
      isLogin: (row: GroupedRow) => row.type === "login",
      isCard: (row: GroupedRow) => row.type === "card",
      isNote: (row: GroupedRow) => row.type === "note",
    },
    template: `
      <bit-layout>
        <bit-table-v2
          [tableDef]="table"
          presentation="list"
          [virtualRowHeight]="44"
          [trackBy]="trackBy"
          [height]="8"
        >
          <bit-column sortable defaultSort="asc">
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
          </bit-column>

          <bit-row-group collapsible [match]="isLogin">Logins</bit-row-group>
          <bit-row-group collapsible [match]="isCard">Cards</bit-row-group>
          <bit-row-group collapsible [match]="isNote">Notes</bit-row-group>
        </bit-table-v2>
      </bit-layout>
    `,
  }),
};

type WideRow = {
  id: number;
  name: string;
  email: string;
  department: string;
  role: string;
  location: string;
  status: string;
  updated: string;
};

const wideTable = defineTable<WideRow>(
  signal(
    [...Array(50).keys()].map((i) => ({
      id: i + 1,
      name: `Person ${i + 1}`,
      email: `person${i + 1}@example.com`,
      department: ["Engineering", "Design", "Support", "Sales"][i % 4],
      role: ["Member", "Admin", "Owner"][i % 3],
      location: ["Remote", "New York", "Berlin", "Tokyo"][i % 4],
      status: i % 2 === 0 ? "Active" : "Invited",
      updated: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`,
    })),
  ),
);

/**
 * Fixed-width columns whose combined width exceeds the table, in a width-capped
 * container to force horizontal overflow. The header row and body are synced
 * horizontal scroll containers, so scrolling either keeps the columns aligned while
 * the header stays pinned vertically. The same wiring drives the virtualized body —
 * swap in `[virtualRowHeight]` and it holds.
 */
export const ManyColumns: Story = {
  render: () => ({
    props: { table: wideTable },
    template: `
      <div class="tw-max-w-3xl">
        <bit-table-v2 [tableDef]="table" [virtualRowHeight]="48" [height]="8">
          <bit-column width="64px">
            <bit-header-cell>Id</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
          </bit-column>
          <bit-column width="200px" sortable defaultSort="asc">
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
          </bit-column>
          <bit-column width="240px">
            <bit-header-cell>Email</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.email; let row">{{ row.email }}</bit-cell>
          </bit-column>
          <bit-column width="160px" sortable>
            <bit-header-cell>Department</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.department; let row">{{ row.department }}</bit-cell>
          </bit-column>
          <bit-column width="140px">
            <bit-header-cell>Role</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.role; let row">{{ row.role }}</bit-cell>
          </bit-column>
          <bit-column width="160px">
            <bit-header-cell>Location</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.location; let row">{{ row.location }}</bit-cell>
          </bit-column>
          <bit-column width="140px" sortable>
            <bit-header-cell>Status</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.status; let row">{{ row.status }}</bit-cell>
          </bit-column>
          <bit-column width="160px" sortable>
            <bit-header-cell>Updated</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.updated; let row">{{ row.updated }}</bit-cell>
          </bit-column>
        </bit-table-v2>
      </div>
    `,
  }),
};

/**
 * `height="fill"` makes the table grow to its container's height and scroll
 * internally, instead of sizing to content. Dropped into a `bit-page` body — a
 * bounded, full-height region — the table fills the main content area with the
 * header pinned. Compare with `Scrollable`, which caps the body at a row count
 * via `[height]`.
 */
export const FillPage: Story = {
  render: () => ({
    props: {
      table: largeTable,
      trackBy: (_: number, item: DemoRow) => item.id,
    },
    template: `
      <bit-layout>
        <bit-page>
          <h1 bitTypography="h1" class="tw-mb-4">Members</h1>
          <bit-table-v2 [tableDef]="table" [virtualRowHeight]="64" [trackBy]="trackBy" height="fill">
            <bit-column sortable defaultSort="asc">
              <bit-header-cell>Id</bit-header-cell>
              <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
            </bit-column>
            <bit-column sortable>
              <bit-header-cell>Name</bit-header-cell>
              <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
            </bit-column>
            <bit-column>
              <bit-header-cell>Other</bit-header-cell>
              <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
            </bit-column>
          </bit-table-v2>
        </bit-page>
      </bit-layout>
    `,
  }),
};

/**
 * Filtering with projected filter chips. A radio chip and a toggle chip register
 * with the table automatically when projected in; the table composes their
 * predicates into the rendered rows and shows a "no matching items" state when
 * they exclude everything. See [Filter menu](?path=/docs/component-library-filter-menu--docs).
 */
export const Filterable: Story = {
  render: () => ({
    template: `<demo-filterable-table></demo-filterable-table>`,
  }),
};

/**
 * Binding `queryParam` syncs filters, sort, and pagination to the URL under that
 * namespace, so a filtered/sorted view is shareable and survives a reload. The
 * live URL is shown above the table.
 */
export const UrlSync: Story = {
  render: () => ({
    template: `<demo-url-sync-table></demo-url-sync-table>`,
  }),
};

/**
 * Configuring `selection` on the model prepends an internal checkbox column and
 * lets `<bit-bulk-actions-bar>` (projected inside the table) read `selectedCount`
 * implicitly via DI; the bar's clear button also clears the selection. No
 * `[selectedCount]` or `(clear)` wiring needed.
 */
export const WithBulkActions: Story = {
  render: () => {
    const table = defineTable<DemoRow>(basicData);
    const noop = () => {
      /* story noop */
    };
    return {
      props: {
        table,
        selection: { multiple: true },
        move: noop,
        archive: noop,
        del: noop,
        exp: noop,
      },
      template: `
        <bit-table-v2 [tableDef]="table" [selection]="selection">
          <bit-bulk-actions-bar>
            <bit-bulk-action [action]="move" icon="bwi-folder" label="Move" />
            <bit-bulk-action [action]="archive" icon="bwi-archive" label="Archive" />
            <bit-bulk-action [action]="del" icon="bwi-trash" label="Delete" />
            <bit-bulk-additional-action [action]="exp" icon="bwi-upload" label="Export" />
          </bit-bulk-actions-bar>

          <bit-column>
            <bit-header-cell>Id</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
          </bit-column>
          <bit-column>
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
          </bit-column>
          <bit-column>
            <bit-header-cell>Other</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
          </bit-column>
        </bit-table-v2>
      `,
    };
  },
  play: async ({ canvas }) => {
    // Check the header "select all" box so the bulk actions bar is shown.
    const selectAll = await canvas.findByRole("checkbox", { name: "Select all rows" });
    await userEvent.click(selectAll);
  },
};

/**
 * `selection: { multiple: true }` prepends an internal checkbox column. The
 * header checkbox selects all currently-filtered rows; row checkboxes toggle
 * individually.
 */
export const Selectable: Story = {
  render: () => {
    const table = defineTable<DemoRow>(basicData);
    return {
      props: { table, selection: { multiple: true } },
      template: `
        <bit-table-v2 [tableDef]="table" [selection]="selection">
          <bit-column>
            <bit-header-cell>Id</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
          </bit-column>
          <bit-column>
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
          </bit-column>
          <bit-column>
            <bit-header-cell>Other</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
          </bit-column>
        </bit-table-v2>
      `,
    };
  },
};

/**
 * A `canSelect` predicate makes only some rows selectable. Non-selectable rows
 * render no checkbox, and select-all / indeterminate scope to selectable rows
 * only. Here only even-`id` rows are selectable.
 */
export const SelectableSubset: Story = {
  render: () => {
    const table = defineTable<DemoRow>(basicData);
    return {
      props: {
        table,
        selection: { multiple: true, canSelect: (row: DemoRow) => row.id % 2 === 0 },
      },
      template: `
        <bit-table-v2 [tableDef]="table" [selection]="selection">
          <bit-column>
            <bit-header-cell>Id</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
          </bit-column>
          <bit-column>
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
          </bit-column>
          <bit-column>
            <bit-header-cell>Other</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
          </bit-column>
        </bit-table-v2>
      `,
    };
  },
};

/**
 * When no rows render (in column-def mode) — empty data, or a filter that
 * excluded everything — the table shows a default `<bit-no-items>`. Project
 * `slot="empty"` to override it with your own empty state.
 */
export const Empty: Story = {
  render: () => ({
    props: { table: emptyTable },
    template: `
      <bit-table-v2 [tableDef]="table">
        <bit-column>
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
      </bit-table-v2>
    `,
  }),
};

/**
 * When `loading` is true, the table shows skeleton rows (count via `[loadingRows]`)
 * in place of data. Each column renders its `bitCellLoading` template if it has
 * one — here the Id column does — otherwise a default skeleton.
 */
export const Loading: Story = {
  render: () => ({
    props: { table: loadingTable },
    template: `
      <bit-table-v2 [tableDef]="table" [loading]="true" [loadingRows]="4">
        <bit-column width="80px">
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
          <bit-cell *bitCellLoading><bit-skeleton-text class="tw-w-8"></bit-skeleton-text></bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Other</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
        </bit-column>
      </bit-table-v2>
    `,
  }),
};

const paginatedTable = defineTable<DemoRow>(
  signal([...Array(23).keys()].map((i) => ({ id: i, name: `name-${i}`, other: `other-${i}` }))),
);

/**
 * Project a `<bit-table-paginator>` and the table slices its filtered (and sorted)
 * rows to the page. The paginator owns the page state (`[(pageIndex)]`,
 * `[pageSize]`) and reads the total row count back from the table; the footer
 * shows the row range, a page-size select, prev/next, and a page input.
 */
export const Pagination: Story = {
  render: () => ({
    props: {
      table: paginatedTable,
      sortFn: (a: DemoRow, b: DemoRow) => a.id - b.id,
      pageSizeOptions: [5, 10, 25],
    },
    template: `
      <bit-table-v2 [tableDef]="table">
        <bit-column sortable defaultSort="asc" [sortFn]="sortFn">
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.id; let row">{{ row.id }}</bit-cell>
        </bit-column>
        <bit-column sortable>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Other</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.other; let row">{{ row.other }}</bit-cell>
        </bit-column>
        <bit-table-paginator [pageSize]="10" [pageSizeOptions]="pageSizeOptions"></bit-table-paginator>
      </bit-table-v2>
    `,
  }),
};

/**
 * Manual mode — for simple presentational tables. Project `<bit-header-row>` /
 * `<bit-row>` directly inside the table; the table provides only the chrome and
 * the cell/row styling. No model, no column registry, no built-in
 * sort / select / virtualization. Use column-def mode if you need any of those.
 */
export const Manual: Story = {
  render: () => ({
    template: `
      <bit-table-v2>
        <bit-header-row>
          <bit-header-cell>Product</bit-header-cell>
          <bit-header-cell>Owner</bit-header-cell>
        </bit-header-row>
        <bit-row>
          <bit-cell>Password Manager</bit-cell>
          <bit-cell>Everyone</bit-cell>
        </bit-row>
        <bit-row>
          <bit-cell>Secrets Manager</bit-cell>
          <bit-cell>Developers</bit-cell>
        </bit-row>
      </bit-table-v2>
    `,
  }),
};

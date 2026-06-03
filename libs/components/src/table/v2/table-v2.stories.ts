import { ChangeDetectionStrategy, Component, input, signal } from "@angular/core";
import { RouterTestingModule } from "@angular/router/testing";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";
import { userEvent } from "storybook/test";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { BulkActionComponent } from "../../bulk-actions-bar/bulk-action.component";
import { BulkActionsBarComponent } from "../../bulk-actions-bar/bulk-actions-bar.component";
import { BulkAdditionalActionComponent } from "../../bulk-actions-bar/bulk-additional-action.component";
import { ButtonModule } from "../../button";
import { ChipActionComponent } from "../../chips";
import { countries } from "../../form/countries";
import { IconTileComponent } from "../../icon-tile/icon-tile.component";
import { LayoutComponent, PageComponent } from "../../layout";
import { mockLayoutI18n } from "../../layout/mocks";
import { MenuModule } from "../../menu";
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
import { BitRowComponent } from "./bit-row.component";
import { BitTableToolbarComponent } from "./bit-table-toolbar.component";
import { TableModel } from "./table-model";
import { BitTableV2Component } from "./table-v2.component";

type DemoRow = { id: number; name: string; other: string };
type UsersRow = { id: number; name: string; email: string; starred: boolean };
type Country = { value: string; name: string };

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
  readonly table = input.required<TableModel<DemoRow>>();
}

/**
 * Demonstrates the integrated toolbar + filter flow. A single `TableModel`
 * configures the table — data plus the top-level `search` matcher and `filters`
 * facet definitions. The projected `<bit-search>` binds to it automatically; the
 * Filters menu applies facets by id; the toolbar renders the applied chips.
 */
@Component({
  selector: "demo-toolbar-table",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BitTableV2Component,
    BitColumnComponent,
    BitCellDefDirective,
    BitHeaderCellComponent,
    BitCellComponent,
    BitTableToolbarComponent,
    ButtonModule,
    ChipActionComponent,
    LayoutComponent,
    MenuModule,
    SearchModule,
  ],
  template: `
    <bit-layout>
      <bit-table-v2 [table]="table" [virtualRowHeight]="64" maxHeight="400px">
        <bit-table-toolbar>
          <bit-search class="tw-flex-1" placeholder="Search"></bit-search>
          <button
            slot="start"
            type="button"
            bitButton
            buttonType="secondary"
            startIcon="bwi-filter"
            [endIcon]="filterTrigger.isOpen ? 'bwi-angle-up' : 'bwi-angle-down'"
            [bitMenuTriggerFor]="filterMenu"
            #filterTrigger="menuTrigger"
          >
            Filters
          </button>
          <button
            slot="end"
            type="button"
            bit-chip-action
            label="Add"
            startIcon="bwi-plus"
          ></button>
        </bit-table-toolbar>
        <bit-column sortable defaultSort="asc">
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
        </bit-column>
        <bit-column sortable width="120px">
          <bit-header-cell>Value</bit-header-cell>
          <bit-cell *bitCellDef="table.columns.value; let row">{{ row.value }}</bit-cell>
        </bit-column>
      </bit-table-v2>
    </bit-layout>

    <bit-menu #filterMenu>
      <button type="button" bitMenuItem (click)="table.filters.apply('range:a-m')">A–M</button>
      <button type="button" bitMenuItem (click)="table.filters.apply('range:n-z')">N–Z</button>
    </bit-menu>
  `,
})
class DemoToolbarTableComponent {
  protected readonly table = new TableModel<Country>({
    data: signal(countries.slice(0, 100)),
    displayedColumns: ["name", "value"],
    search: (row, term) => row.name.toLowerCase().includes(term.toLowerCase()),
    filters: [
      { id: "range:a-m", label: "A–M", predicate: (row) => row.name.toLowerCase() < "n" },
      { id: "range:n-z", label: "N–Z", predicate: (row) => row.name.toLowerCase() >= "n" },
    ],
  });
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
        BitTableToolbarComponent,
        BitCellLoadingDirective,
        SkeletonTextComponent,
        DemoStatusColumnComponent,
        DemoToolbarTableComponent,
        BulkActionsBarComponent,
        BulkActionComponent,
        BulkAdditionalActionComponent,
        IconTileComponent,
        LayoutComponent,
        PageComponent,
        TypographyModule,
        SearchModule,
        RouterTestingModule,
      ],
      providers: [
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
              selectAllRows: "Select all rows",
              selectRow: "Select row",
            }),
        },
      ],
    }),
    applicationConfig({
      providers: [
        {
          provide: GlobalStateProvider,
          useClass: StorybookGlobalStateProvider,
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

const basicTable = new TableModel<DemoRow>({
  data: basicData,
  displayedColumns: ["id", "name", "other"],
});
const reorderTable = new TableModel<DemoRow>({
  data: basicData,
  displayedColumns: ["name", "id"],
});
const emptyTable = new TableModel<DemoRow>({
  data: signal<DemoRow[]>([]),
  displayedColumns: ["id", "name"],
});
const loadingTable = new TableModel<DemoRow>({
  data: signal<DemoRow[]>([]),
  displayedColumns: ["id", "name", "other"],
  loading: signal(true),
});

export const Default: Story = {
  render: () => ({
    props: {
      table: basicTable,
      sortFn: (a: DemoRow, b: DemoRow) => a.id - b.id,
    },
    template: `
      <bit-table-v2 [table]="table">
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

export const CustomCell: Story = {
  render: () => ({
    props: { table: basicTable },
    template: `
      <bit-table-v2 [table]="table">
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

const userTable = new TableModel<UsersRow>({
  data: signal([
    { id: 1, name: "Alex Johnson", email: "alex@example.com", starred: true },
    { id: 2, name: "Sam Rivera", email: "sam.rivera@example.com", starred: false },
    { id: 3, name: "Jordan Park", email: "jordan.park@example.com", starred: true },
  ]),
  displayedColumns: ["name", "email"],
});

/**
 * Rich cells use the slot vocabulary on `<bit-cell>` directly:
 * `slot=start` for a leading icon/tile, default for the title, `slot=secondary`
 * for a subtitle, `slot=end` for a trailing affordance.
 */
export const RichCells: Story = {
  render: () => ({
    props: { table: userTable },
    template: `
      <bit-table-v2 [table]="table">
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
 * The model's `displayedColumns` sets display order; columns it omits aren't
 * rendered even though they're declared. Here `other` is declared but left out.
 */
export const ReorderedAndHidden: Story = {
  render: () => ({
    props: { table: reorderTable },
    template: `
      <bit-table-v2 [table]="table">
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
      <bit-table-v2 [table]="table">
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

const largeTable = new TableModel<DemoRow>({
  data: signal(
    [...Array(100).keys()].map((i) => ({ id: i, name: `name-${i}`, other: `other-${i}` })),
  ),
  displayedColumns: ["id", "name", "other"],
});

export const Scrollable: Story = {
  render: () => ({
    props: {
      table: largeTable,
      sortFn: (a: DemoRow, b: DemoRow) => a.id - b.id,
      trackBy: (_: number, item: DemoRow) => item.id,
    },
    template: `
      <bit-layout>
        <bit-table-v2 [table]="table" [virtualRowHeight]="64" [trackBy]="trackBy" maxHeight="400px">
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

/**
 * `fill` makes the table grow to its container's height and scroll internally,
 * instead of sizing to content. Dropped into a `bit-page` body — a bounded,
 * full-height region — the table fills the main content area with the header
 * pinned. Compare with `Scrollable`, which caps the height via `maxHeight`.
 */
export const FillPage: Story = {
  render: () => ({
    props: {
      table: largeTable,
      trackBy: (_: number, item: DemoRow) => item.id,
    },
    template: `
      <bit-layout disablePadding>
        <bit-page>
          <h1 slot="header" bitTypography="h1" class="tw-mb-4">Members</h1>
          <bit-table-v2 [table]="table" [virtualRowHeight]="64" [trackBy]="trackBy" fill>
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

const filterTable = new TableModel<Country>({
  data: signal(countries.slice(0, 100)),
  displayedColumns: ["name", "value"],
  search: (row, term) => row.name.toLowerCase().includes(term.toLowerCase()),
});

export const Filterable: Story = {
  render: () => ({
    props: { table: filterTable },
    template: `
      <bit-layout>
        <bit-table-v2 [table]="table" [virtualRowHeight]="64" maxHeight="400px">
          <bit-table-toolbar>
            <bit-search class="tw-flex-1" placeholder="Search"></bit-search>
          </bit-table-toolbar>
          <bit-column sortable defaultSort="asc">
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.name; let row">{{ row.name }}</bit-cell>
          </bit-column>
          <bit-column sortable width="120px">
            <bit-header-cell>Value</bit-header-cell>
            <bit-cell *bitCellDef="table.columns.value; let row">{{ row.value }}</bit-cell>
          </bit-column>
        </bit-table-v2>
      </bit-layout>
    `,
  }),
};

/**
 * `<bit-table-toolbar>` renders inside the chrome above the header row and owns
 * the applied-filters row. A `<bit-search>` goes in its own slot and binds to
 * the table model's `filter` automatically; other left controls (a Filters
 * menu) use `slot="start"`, actions use `slot="end"`. Picking from the menu
 * calls `table.filters.apply(id)`, which the toolbar renders as a value-only
 * chip and the model folds into the row test the table applies. The
 * Filters trigger is a stateless `bitButton` + `bit-menu` with a chevron
 * `endIcon` that flips with the menu's open state. See `DemoToolbarTableComponent`.
 */
export const WithToolbar: Story = {
  render: () => ({
    template: `<demo-toolbar-table></demo-toolbar-table>`,
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
    const table = new TableModel<DemoRow>({
      data: basicData,
      displayedColumns: ["id", "name", "other"],
      selection: { multiple: true },
    });
    const noop = () => {
      /* story noop */
    };
    return {
      props: { table, move: noop, archive: noop, del: noop, exp: noop },
      template: `
        <bit-table-v2 [table]="table">
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
    const table = new TableModel<DemoRow>({
      data: basicData,
      displayedColumns: ["id", "name", "other"],
      selection: { multiple: true },
    });
    return {
      props: { table },
      template: `
        <bit-table-v2 [table]="table">
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
    const table = new TableModel<DemoRow>({
      data: basicData,
      displayedColumns: ["id", "name", "other"],
      selection: { multiple: true, canSelect: (row) => row.id % 2 === 0 },
    });
    return {
      props: { table },
      template: `
        <bit-table-v2 [table]="table">
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
      <bit-table-v2 [table]="table">
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
      <bit-table-v2 [table]="table" [loadingRows]="4">
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

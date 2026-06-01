import { SelectionModel } from "@angular/cdk/collections";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterTestingModule } from "@angular/router/testing";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { BulkActionComponent } from "../../bulk-actions-bar/bulk-action.component";
import { BulkActionsBarComponent } from "../../bulk-actions-bar/bulk-actions-bar.component";
import { BulkAdditionalActionComponent } from "../../bulk-actions-bar/bulk-additional-action.component";
import { countries } from "../../form/countries";
import { IconTileComponent } from "../../icon-tile/icon-tile.component";
import { LayoutComponent } from "../../layout";
import { mockLayoutI18n } from "../../layout/mocks";
import { positionFixedWrapperDecorator } from "../../stories/storybook-decorators";
import { I18nMockService, StorybookGlobalStateProvider } from "../../utils";
import { TableDataSource } from "../table-data-source";

import { BitCellComponent } from "./bit-cell.component";
import { BitColumnForDirective } from "./bit-column-for.directive";
import { BitColumnComponent } from "./bit-column.component";
import { BitHeaderCellComponent } from "./bit-header-cell.component";
import { BitHeaderRowComponent } from "./bit-header-row.component";
import { BitRowComponent } from "./bit-row.component";
import { BitTableV2Component } from "./table-v2.component";

type DemoRow = { id: number; name: string; other: string };

@Component({
  selector: "demo-status-column",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BitColumnComponent, BitColumnForDirective, BitHeaderCellComponent, BitCellComponent],
  template: `
    <bit-column sortable>
      <bit-header-cell>Status</bit-header-cell>
      <bit-cell *bitColumnFor="ds().columns.other; let cell">
        <span class="tw-rounded tw-bg-primary-100 tw-px-2 tw-py-0.5 tw-text-xs">
          {{ cell.other }}
        </span>
      </bit-cell>
    </bit-column>
  `,
})
class DemoStatusColumnComponent {
  readonly ds = input.required<TableDataSource<DemoRow>>();
}

export default {
  title: "Component Library/Table V2",
  decorators: [
    positionFixedWrapperDecorator(undefined, { border: false }),
    moduleMetadata({
      imports: [
        BitTableV2Component,
        BitColumnComponent,
        BitColumnForDirective,
        BitHeaderCellComponent,
        BitCellComponent,
        BitHeaderRowComponent,
        BitRowComponent,
        DemoStatusColumnComponent,
        BulkActionsBarComponent,
        BulkActionComponent,
        BulkAdditionalActionComponent,
        IconTileComponent,
        LayoutComponent,
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

const basic = new TableDataSource<DemoRow>();
basic.data = [...Array(5).keys()].map((i) => ({
  id: i,
  name: `name-${i}`,
  other: `other-${i}`,
}));

export const Default: Story = {
  render: () => ({
    props: {
      dataSource: basic,
      displayedColumns: ["id", "name", "other"],
      sortFn: (a: DemoRow, b: DemoRow) => a.id - b.id,
    },
    template: `
      <bit-table-v2 [dataSource]="dataSource" [displayedColumns]="displayedColumns">
        <bit-column sortable defaultSort="asc">
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.id; let cell">{{ cell.id }}</bit-cell>
        </bit-column>
        <bit-column sortable>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.name; let cell">{{ cell.name }}</bit-cell>
        </bit-column>
        <bit-column sortable [sortFn]="sortFn">
          <bit-header-cell>Other</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.other; let cell">{{ cell.other }}</bit-cell>
        </bit-column>
      </bit-table-v2>
    `,
  }),
};

export const CustomCell: Story = {
  render: () => ({
    props: { dataSource: basic, displayedColumns: ["id", "name", "other"] },
    template: `
      <bit-table-v2 [dataSource]="dataSource" [displayedColumns]="displayedColumns">
        <bit-column width="80px">
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.id; let cell">{{ cell.id }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.name; let cell">{{ cell.name }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Link</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.other; let cell">
            <a href="#">{{ cell.other }} →</a>
          </bit-cell>
        </bit-column>
      </bit-table-v2>
    `,
  }),
};

const users = new TableDataSource<{
  id: number;
  name: string;
  email: string;
  starred: boolean;
}>();
users.data = [
  { id: 1, name: "Alex Johnson", email: "alex@example.com", starred: true },
  { id: 2, name: "Sam Rivera", email: "sam.rivera@example.com", starred: false },
  { id: 3, name: "Jordan Park", email: "jordan.park@example.com", starred: true },
];

/**
 * Rich cells use the slot vocabulary on `<bit-cell>` directly:
 * `slot=start` for a leading icon/tile, default for the title, `slot=secondary`
 * for a subtitle, `slot=end` for a trailing affordance.
 */
export const RichCells: Story = {
  render: () => ({
    props: { dataSource: users, displayedColumns: ["name", "email"] },
    template: `
      <bit-table-v2 [dataSource]="dataSource" [displayedColumns]="displayedColumns">
        <bit-column sortable defaultSort="asc">
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.name; let cell">
            <bit-icon-tile slot="start" icon="bwi-globe" size="sm" />
            {{ cell.name }}
            <span slot="secondary">{{ cell.email }}</span>
            @if (cell.starred) {
              <i slot="end" class="bwi bwi-star-f tw-text-warning"></i>
            }
          </bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>
            <i class="bwi bwi-envelope tw-me-1"></i> Contact
          </bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.email; let cell">
            {{ cell.email }}
            <span slot="secondary">User #{{ cell.id }}</span>
          </bit-cell>
        </bit-column>
      </bit-table-v2>
    `,
  }),
};

export const ReorderedAndHidden: Story = {
  render: () => ({
    props: { dataSource: basic, displayedColumns: ["name", "id"] },
    template: `
      <bit-table-v2 [dataSource]="dataSource" [displayedColumns]="displayedColumns">
        <bit-column>
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.id; let cell">{{ cell.id }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.name; let cell">{{ cell.name }}</bit-cell>
        </bit-column>
        <bit-column>
          <bit-header-cell>Hidden</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.other; let cell">{{ cell.other }}</bit-cell>
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
    props: { dataSource: basic, displayedColumns: ["id", "name", "other"] },
    template: `
      <bit-table-v2 [dataSource]="dataSource" [displayedColumns]="displayedColumns">
        <bit-column>
          <bit-header-cell>Id</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.id; let cell">{{ cell.id }}</bit-cell>
        </bit-column>
        <bit-column sortable>
          <bit-header-cell>Name</bit-header-cell>
          <bit-cell *bitColumnFor="dataSource.columns.name; let cell">{{ cell.name }}</bit-cell>
        </bit-column>
        <demo-status-column [ds]="dataSource" />
      </bit-table-v2>
    `,
  }),
};

const large = new TableDataSource<DemoRow>();
large.data = [...Array(100).keys()].map((i) => ({
  id: i,
  name: `name-${i}`,
  other: `other-${i}`,
}));

export const Scrollable: Story = {
  render: () => ({
    props: {
      dataSource: large,
      displayedColumns: ["id", "name", "other"],
      sortFn: (a: DemoRow, b: DemoRow) => a.id - b.id,
      trackBy: (_: number, item: DemoRow) => item.id,
    },
    template: `
      <bit-layout>
        <bit-table-v2
          [dataSource]="dataSource"
          [displayedColumns]="displayedColumns"
          [rowSize]="64"
          [trackBy]="trackBy"
        >
          <bit-column sortable defaultSort="asc">
            <bit-header-cell>Id</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.id; let cell">{{ cell.id }}</bit-cell>
          </bit-column>
          <bit-column sortable>
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.name; let cell">{{ cell.name }}</bit-cell>
          </bit-column>
          <bit-column sortable [sortFn]="sortFn">
            <bit-header-cell>Other</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.other; let cell">{{ cell.other }}</bit-cell>
          </bit-column>
        </bit-table-v2>
      </bit-layout>
    `,
  }),
};

const filterable = new TableDataSource<{ value: string; name: string }>();
filterable.data = countries.slice(0, 100);

export const Filterable: Story = {
  render: () => ({
    props: { dataSource: filterable, displayedColumns: ["name", "value"] },
    template: `
      <bit-layout>
        <input
          type="search"
          placeholder="Search"
          (input)="dataSource.filter = $event.target.value"
        />
        <bit-table-v2
          [dataSource]="dataSource"
          [displayedColumns]="displayedColumns"
          [rowSize]="64"
        >
          <bit-column sortable defaultSort="asc">
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.name; let cell">{{ cell.name }}</bit-cell>
          </bit-column>
          <bit-column sortable width="120px">
            <bit-header-cell>Value</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.value; let cell">{{ cell.value }}</bit-cell>
          </bit-column>
        </bit-table-v2>
      </bit-layout>
    `,
  }),
};

/**
 * `<bit-bulk-actions-bar>` projected into the table reads `selectedCount`
 * implicitly from the table's selection model via DI; the bar's clear button
 * also clears the model. No `[selectedCount]` or `(clear)` wiring needed.
 */
export const WithBulkActions: Story = {
  render: () => {
    const selection = new SelectionModel<DemoRow>(true, []);
    const noop = () => {
      /* story noop */
    };
    return {
      props: {
        dataSource: basic,
        displayedColumns: ["id", "name", "other"],
        selection,
        move: noop,
        archive: noop,
        del: noop,
        exp: noop,
      },
      template: `
        <bit-table-v2
          [dataSource]="dataSource"
          [displayedColumns]="displayedColumns"
          [selection]="selection"
        >
          <bit-bulk-actions-bar>
            <bit-bulk-action [action]="move" icon="bwi-folder" label="Move" />
            <bit-bulk-action [action]="archive" icon="bwi-archive" label="Archive" />
            <bit-bulk-action [action]="del" icon="bwi-trash" label="Delete" />
            <bit-bulk-additional-action [action]="exp" icon="bwi-upload" label="Export" />
          </bit-bulk-actions-bar>

          <bit-column>
            <bit-header-cell>Id</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.id; let cell">{{ cell.id }}</bit-cell>
          </bit-column>
          <bit-column>
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.name; let cell">{{ cell.name }}</bit-cell>
          </bit-column>
          <bit-column>
            <bit-header-cell>Other</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.other; let cell">{{ cell.other }}</bit-cell>
          </bit-column>
        </bit-table-v2>
      `,
    };
  },
};

/**
 * Passing a `SelectionModel` to `[selection]` prepends an internal checkbox
 * column. The header checkbox selects all currently-filtered rows; row
 * checkboxes toggle individually. The model is owned by the consumer.
 */
export const Selectable: Story = {
  render: () => {
    const selection = new SelectionModel<DemoRow>(true, []);
    return {
      props: {
        dataSource: basic,
        displayedColumns: ["id", "name", "other"],
        selection,
      },
      template: `
        <bit-table-v2
          [dataSource]="dataSource"
          [displayedColumns]="displayedColumns"
          [selection]="selection"
        >
          <bit-column>
            <bit-header-cell>Id</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.id; let cell">{{ cell.id }}</bit-cell>
          </bit-column>
          <bit-column>
            <bit-header-cell>Name</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.name; let cell">{{ cell.name }}</bit-cell>
          </bit-column>
          <bit-column>
            <bit-header-cell>Other</bit-header-cell>
            <bit-cell *bitColumnFor="dataSource.columns.other; let cell">{{ cell.other }}</bit-cell>
          </bit-column>
        </bit-table-v2>
      `,
    };
  },
};

/**
 * Manual mode — for simple presentational tables. Project a standard HTML
 * `<thead>` / `<tbody>` structure inside the table; the table provides only
 * the chrome and the cell/row directives' styling. No datasource, no
 * column registry, no built-in sort / select / virtualization. Use
 * column-def mode if you need any of those.
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

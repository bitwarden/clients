import { SelectionModel } from "@angular/cdk/collections";
import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterTestingModule } from "@angular/router/testing";
import { applicationConfig, Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { GlobalStateProvider } from "@bitwarden/state";

import { countries } from "../../form/countries";
import { LayoutComponent } from "../../layout";
import { mockLayoutI18n } from "../../layout/mocks";
import { positionFixedWrapperDecorator } from "../../stories/storybook-decorators";
import { I18nMockService, StorybookGlobalStateProvider } from "../../utils";
import { TableDataSource } from "../table-data-source";

import { BitColumnComponent } from "./bit-column.component";
import { BitTableV2Component } from "./table-v2.component";

@Component({
  selector: "demo-status-column",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BitColumnComponent],
  template: `
    <bit-column name="other" header="Status" sortable>
      <ng-template let-row>
        <span class="tw-rounded tw-bg-primary-100 tw-px-2 tw-py-0.5 tw-text-xs">
          {{ row.other }}
        </span>
      </ng-template>
    </bit-column>
  `,
})
class DemoStatusColumnComponent {}

export default {
  title: "Component Library/Table V2",
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [
        BitTableV2Component,
        BitColumnComponent,
        DemoStatusColumnComponent,
        LayoutComponent,
        RouterTestingModule,
      ],
      providers: [
        {
          provide: I18nService,
          useFactory: () => new I18nMockService(mockLayoutI18n),
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

const basic = new TableDataSource<{ id: number; name: string; other: string }>();
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
      sortFn: (a: any, b: any) => a.id - b.id,
    },
    template: `
      <bit-table-v2 [dataSource]="dataSource" [displayedColumns]="displayedColumns">
        <bit-column name="id" header="Id" sortable defaultSort="asc" />
        <bit-column name="name" header="Name" sortable />
        <bit-column name="other" header="Other" sortable [sortFn]="sortFn" />
      </bit-table-v2>
    `,
  }),
};

export const CustomCell: Story = {
  render: () => ({
    props: { dataSource: basic, displayedColumns: ["id", "name", "other"] },
    template: `
      <bit-table-v2 [dataSource]="dataSource" [displayedColumns]="displayedColumns">
        <bit-column name="id" header="Id" width="80px" />
        <bit-column name="name" header="Name" />
        <bit-column name="other" header="Link">
          <ng-template let-row>
            <a href="#">{{ row.other }} →</a>
          </ng-template>
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
        <bit-column name="id" header="Id" />
        <bit-column name="name" header="Name" />
        <bit-column name="other" header="Other (not displayed)" />
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
        <bit-column name="id" header="Id" />
        <bit-column name="name" header="Name" sortable />
        <demo-status-column />
      </bit-table-v2>
    `,
  }),
};

const large = new TableDataSource<{ id: number; name: string; other: string }>();
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
      sortFn: (a: any, b: any) => a.id - b.id,
      trackBy: (_: number, item: any) => item.id,
    },
    template: `
      <bit-layout>
        <bit-table-v2
          [dataSource]="dataSource"
          [displayedColumns]="displayedColumns"
          [rowSize]="43"
          [trackBy]="trackBy"
        >
          <bit-column name="id" header="Id" sortable defaultSort="asc" />
          <bit-column name="name" header="Name" sortable />
          <bit-column name="other" header="Other" sortable [sortFn]="sortFn" />
        </bit-table-v2>
      </bit-layout>
    `,
  }),
};

/**
 * Passing a `SelectionModel` to `[selection]` prepends an internal checkbox
 * column. The header checkbox selects all currently-filtered rows; row
 * checkboxes toggle individually. The model is owned by the consumer — the
 * table reads and writes through it but does not construct it.
 */
export const Selectable: Story = {
  render: () => {
    const selection = new SelectionModel<{ id: number }>(true, []);
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
          <bit-column name="id" header="Id" />
          <bit-column name="name" header="Name" />
          <bit-column name="other" header="Other" />
        </bit-table-v2>
      `,
    };
  },
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
          [rowSize]="43"
        >
          <bit-column name="name" header="Name" sortable defaultSort="asc" />
          <bit-column name="value" header="Value" width="120px" sortable />
        </bit-table-v2>
      </bit-layout>
    `,
  }),
};

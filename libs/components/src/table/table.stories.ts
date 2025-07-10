import { RouterTestingModule } from "@angular/router/testing";
import { Meta, moduleMetadata, StoryObj } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { countries } from "../form/countries";
import { LayoutComponent } from "../layout";
import { mockLayoutI18n } from "../layout/mocks";
import { positionFixedWrapperDecorator } from "../stories/storybook-decorators";
import { I18nMockService } from "../utils";

import { TableDataSource } from "./table-data-source";
import { TableModule } from "./table.module";

export default {
  title: "Component Library/Table",
  decorators: [
    positionFixedWrapperDecorator(),
    moduleMetadata({
      imports: [TableModule, LayoutComponent, RouterTestingModule],
      providers: [
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService(mockLayoutI18n);
          },
        },
      ],
    }),
  ],
  argTypes: {
    alignRowContent: {
      options: ["top", "middle", "bottom", "baseline"],
      control: { type: "select" },
    },
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=16329-41282&t=b5tDKylm5sWm2yKo-4",
    },
  },
} as Meta;

type Story = StoryObj;

export const Default: Story = {
  render: (args) => ({
    props: args,
    template: `
      <bit-table>
        <ng-container header>
          <tr>
            <th bitCell>Header 1</th>
            <th bitCell>Header 2</th>
            <th bitCell>Header 3</th>
          </tr>
        </ng-container>
        <ng-template body>
          <tr bitRow [alignContent]="alignRowContent">
            <td bitCell>Cell 1</td>
            <td bitCell>Cell 2 <br /> Multiline Cell</td>
            <td bitCell>Cell 3</td>
          </tr>
          <tr bitRow [alignContent]="alignRowContent">
            <td bitCell>Cell 4</td>
            <td bitCell>Cell 5</td>
            <td bitCell>Cell 6</td>
          </tr>
          <tr bitRow [alignContent]="alignRowContent">
            <td bitCell>Cell 7 <br /> Multiline Cell</td>
            <td bitCell>Cell 8</td>
            <td bitCell>Cell 9</td>
          </tr>
        </ng-template>
      </bit-table>
    `,
  }),
  args: {
    alignRowContent: "middle",
  },
};

const data = new TableDataSource<{ id: number; name: string; other: string }>();

data.data = [...Array(5).keys()].map((i) => ({
  id: i,
  name: `name-${i}`,
  other: `other-${i}`,
}));

export const DataSource: Story = {
  render: (args) => ({
    props: {
      dataSource: data,
      sortFn: (a: any, b: any) => a.id - b.id,
    },
    template: `
      <bit-table [dataSource]="dataSource">
        <ng-container header>
          <tr>
            <th bitCell bitSortable="id" default>Id</th>
            <th bitCell bitSortable="name">Name</th>
            <th bitCell bitSortable="other" [fn]="sortFn">Other</th>
          </tr>
        </ng-container>
        <ng-template body let-rows$>
          <tr bitRow *ngFor="let r of rows$ | async">
            <td bitCell>{{ r.id }}</td>
            <td bitCell>{{ r.name }}</td>
            <td bitCell>{{ r.other }}</td>
          </tr>
        </ng-template>
      </bit-table>
    `,
  }),
};

const data2 = new TableDataSource<{ id: number; name: string; other: string }>();

data2.data = [...Array(100).keys()].map((i) => ({
  id: i,
  name: `name-${i}`,
  other: `other-${i}`,
}));

export const Scrollable: Story = {
  render: (args) => ({
    props: {
      dataSource: data2,
      sortFn: (a: any, b: any) => a.id - b.id,
      trackBy: (index: number, item: any) => item.id,
    },
    template: `
      <bit-layout>
        <bit-table-scroll [dataSource]="dataSource" [rowSize]="43">
          <ng-container header>
            <th bitCell bitSortable="id" default>Id</th>
            <th bitCell bitSortable="name">Name</th>
            <th bitCell bitSortable="other" [fn]="sortFn">Other</th>
          </ng-container>
          <ng-template bitRowDef let-row>
            <td bitCell>{{ row.id }}</td>
            <td bitCell>{{ row.name }}</td>
            <td bitCell>{{ row.other }}</td>
          </ng-template>
        </bit-table-scroll>
      </bit-layout>
    `,
  }),
};

const data3 = new TableDataSource<{ value: string; name: string }>();

// Chromatic has a max page size, lowering the number of entries to ensure we don't hit it
data3.data = countries.slice(0, 100);

export const Filterable: Story = {
  render: (args) => ({
    props: {
      dataSource: data3,
      sortFn: (a: any, b: any) => a.id - b.id,
    },
    template: `
      <bit-layout>
        <input type="search" placeholder="Search" (input)="dataSource.filter = $event.target.value" />
        <bit-table-scroll [dataSource]="dataSource" [rowSize]="43">
          <ng-container header>
            <th bitCell bitSortable="name" default>Name</th>
            <th bitCell bitSortable="value" width="120px">Value</th>
          </ng-container>
          <ng-template bitRowDef let-row>
            <td bitCell>{{ row.name }}</td>
            <td bitCell>{{ row.value }}</td>
          </ng-template>
        </bit-table-scroll>
      </bit-layout>
    `,
  }),
};

const data4 = new TableDataSource<{ name: string }>();

data4.data = [...Array(5).keys()].map((i) => ({
  name: i % 2 == 0 ? `name-${i}`.toUpperCase() : `name-${i}`.toLowerCase(),
}));

export const VariableCase: Story = {
  render: (args) => ({
    props: {
      dataSource: data4,
    },
    template: `
      <bit-table [dataSource]="dataSource">
        <ng-container header>
          <tr>
            <th bitCell bitSortable="name" default>Name</th>
          </tr>
        </ng-container>
        <ng-template body let-rows$>
          <tr bitRow *ngFor="let r of rows$ | async">
            <td bitCell>{{ r.name }}</td>
          </tr>
        </ng-template>
      </bit-table>
    `,
  }),
};

import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

import "../search/search";

import { countries } from "./story-countries";
import type { TableColumn } from "./table";
import { TableDataSource } from "./table-data-source";
import type { RowAlignment } from "./table-styles";
import "./table";
import "./table-scroll";

type Args = { alignRowContent: RowAlignment };

export default {
  title: "Component Library/Table",
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
} satisfies Meta<Args>;

type Story = StoryObj<Args>;

type StaticRow = [unknown, unknown, unknown];

const staticColumns: TableColumn<StaticRow>[] = [0, 1, 2].map((i) => ({
  id: String(i),
  header: `Header ${i + 1}`,
  cell: (row) => row[i],
}));

const staticRows: StaticRow[] = [
  ["Cell 1", html`Cell 2 <br />Multiline Cell`, "Cell 3"],
  ["Cell 4", "Cell 5", "Cell 6"],
  [html`Cell 7 <br />Multiline Cell`, "Cell 8", "Cell 9"],
];

export const Default: Story = {
  args: { alignRowContent: "middle" },
  render: (args) => html`
    <bit-table
      align-content=${args.alignRowContent}
      .columns=${staticColumns}
      .rows=${staticRows}
    ></bit-table>
  `,
};

type DemoRow = { id: number; name: string; other: string };

const sortFn = (a: DemoRow, b: DemoRow) => a.id - b.id;

const demoColumns: TableColumn<DemoRow>[] = [
  { id: "id", header: "Id", sortable: true, defaultSort: true, cell: (r) => r.id },
  { id: "name", header: "Name", sortable: true, cell: (r) => r.name },
  { id: "other", header: "Other", sortable: true, sortFn, cell: (r) => r.other },
];

const data = new TableDataSource<DemoRow>();
data.data = [...Array(5).keys()].map((i) => ({ id: i, name: `name-${i}`, other: `other-${i}` }));

export const DataSource: Story = {
  render: () => html`<bit-table .dataSource=${data} .columns=${demoColumns}></bit-table>`,
};

const data2 = new TableDataSource<DemoRow>();
data2.data = [...Array(100).keys()].map((i) => ({
  id: i,
  name: `name-${i}`,
  other: `other-${i}`,
}));

/** Only the rows near the viewport render; the page region (here a fixed-height box) scrolls. */
export const Scrollable: Story = {
  render: () => html`
    <div style="height: 500px; overflow: auto">
      <bit-table-scroll
        .dataSource=${data2}
        .columns=${demoColumns}
        .trackBy=${(_: number, row: DemoRow) => row.id}
        row-size="43"
      ></bit-table-scroll>
    </div>
  `,
};

type Country = { value: string; name: string };

// Chromatic has a max page size, lowering the number of entries to ensure we don't hit it
const data3 = new TableDataSource<Country>();
data3.data = countries.slice(0, 100);

const countryColumns: TableColumn<Country>[] = [
  { id: "name", header: "Name", sortable: true, defaultSort: true, cell: (r) => r.name },
  { id: "value", header: "Value", sortable: true, width: "120px", cell: (r) => r.value },
];

export const Filterable: Story = {
  render: () => html`
    <div style="height: 500px; overflow: auto">
      <bit-search
        placeholder="Search"
        @input=${(e: Event) => (data3.filter = (e.target as HTMLInputElement).value)}
      ></bit-search>
      <bit-table-scroll
        .dataSource=${data3}
        .columns=${countryColumns}
        row-size="43"
      ></bit-table-scroll>
    </div>
  `,
};

const data4 = new TableDataSource<{ name: string }>();
data4.data = [...Array(5).keys()].map((i) => ({
  name: i % 2 == 0 ? `name-${i}`.toUpperCase() : `name-${i}`.toLowerCase(),
}));

export const VariableCase: Story = {
  render: () => html`
    <bit-table
      .dataSource=${data4}
      .columns=${[
        {
          id: "name",
          header: "Name",
          sortable: true,
          defaultSort: true,
          cell: (r: { name: string }) => r.name,
        },
      ]}
    ></bit-table>
  `,
};

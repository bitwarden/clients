import { Meta, moduleMetadata } from "@storybook/angular";

import { TableDataSource, TableModule } from "../../table";

import { IconStoryData } from "./icon-data";

type IconWithUsage = {
  id: string;
  usage: string;
};

export default {
  title: "Documentation / Icons",
  decorators: [
    moduleMetadata({
      imports: [TableModule],
    }),
  ],
} as Meta;

const statusIconData = new TableDataSource<IconWithUsage>();
statusIconData.data = IconStoryData.statusIndicators;

export const StatusIcons = {
  render: (args: { dataSource: typeof statusIconData }) => ({
    props: args,
    template: /*html*/ `
      <bit-table [dataSource]="dataSource">
        <ng-container header>
          <tr>
            <th bitCell>Icon</th>
            <th bitCell>Icon Class</th>
            <th bitCell>Usage</th>
          </tr>
        </ng-container>
        <ng-template body let-rows$>
          @for (row of rows$ | async; track row.id) {
            <tr bitRow alignContent="middle">
              <td bitCell><i class="bwi" [ngClass]="row.id"></i> </td>
              <td bitCell><code class="tw-text-danger-700">{{row.id}}</code></td>
              <td bitCell>{{row.usage}}</td>
            </tr>
          }
        </ng-template>
      </bit-table>
    `,
  }),
  args: {
    dataSource: statusIconData,
  },
};

const bitwardenObjectsData = new TableDataSource<IconWithUsage>();
bitwardenObjectsData.data = IconStoryData.bitwardenObjects;

export const BitwardenObjects = {
  ...StatusIcons,
  args: {
    dataSource: bitwardenObjectsData,
  },
};

const actionsData = new TableDataSource<IconWithUsage>();
actionsData.data = IconStoryData.actions;

export const Actions = {
  ...StatusIcons,
  args: {
    dataSource: actionsData,
  },
};

const directionalMenuIndicatorsData = new TableDataSource<IconWithUsage>();
directionalMenuIndicatorsData.data = IconStoryData.directionalMenuIndicators;

export const DirectionalMenuIndicators = {
  ...StatusIcons,
  args: {
    dataSource: directionalMenuIndicatorsData,
  },
};

const miscObjectsData = new TableDataSource<IconWithUsage>();
miscObjectsData.data = IconStoryData.miscObjects;

export const MiscObjects = {
  ...StatusIcons,
  args: {
    dataSource: miscObjectsData,
  },
};

const platformsAndLogosData = new TableDataSource<IconWithUsage>();
platformsAndLogosData.data = IconStoryData.platformsAndLogos;

export const PlatformsAndLogos = {
  ...StatusIcons,
  args: {
    dataSource: platformsAndLogosData,
  },
};

const sizeData = new TableDataSource<{
  size: string;
  usage: string;
}>();

sizeData.data = [
  {
    size: "",
    usage: "default size",
  },
  {
    size: "bwi-sm",
    usage: "reduce font size to 0.875em",
  },
  {
    size: "bwi-lg",
    usage: "increase font size to ~1.33em",
  },
  {
    size: "bwi-2x",
    usage: "increase font size to 2em",
  },
  {
    size: "bwi-3x",
    usage: "increase font size to 3em",
  },
  {
    size: "bwi-4x",
    usage: "increase font size to 4em",
  },
  {
    size: "bwi-fw",
    usage: "set fixed width of ~1.3em and text-align center",
  },
];

export const SizeVariants = {
  render: (args: { dataSource: typeof sizeData }) => ({
    props: args,
    template: /*html*/ `
      <bit-table [dataSource]="dataSource">
        <ng-container header>
          <tr>
            <th bitCell>Icon</th>
            <th bitCell>Size Class</th>
            <th bitCell>Class notes</th>
          </tr>
        </ng-container>
        <ng-template body let-rows$>
          @for (row of rows$ | async; track row.size) {
            <tr bitRow alignContent="middle">
              <td bitCell><i class="bwi bwi-plus" [ngClass]="row.size"></i> </td>
              <td bitCell><code class="tw-text-danger-700">{{row.size}}</code></td>
              <td bitCell>{{row.usage}}</td>
            </tr>
          }
        </ng-template>
      </bit-table>
    `,
  }),
  args: {
    dataSource: sizeData,
  },
};

const rotationData = new TableDataSource<{
  class: string;
  usage: string;
}>();

rotationData.data = [
  {
    class: "",
    usage: "default",
  },
  {
    class: "bwi-rotate-270",
    usage: "rotate by 270 degrees",
  },
  {
    class: "bwi-spin",
    usage: "animated spin",
  },
];

export const RotationVariants = {
  render: (args: { dataSource: typeof rotationData }) => ({
    props: args,
    template: /*html*/ `
      <bit-table [dataSource]="dataSource">
        <ng-container header>
          <tr>
            <th bitCell>Icon</th>
            <th bitCell>Size Class</th>
            <th bitCell>Class notes</th>
          </tr>
        </ng-container>
        <ng-template body let-rows$>
          @for (row of rows$ | async; track row.class) {
            <tr bitRow alignContent="middle">
              <td bitCell><i class="bwi bwi-lock" [ngClass]="row.class"></i> </td>
              <td bitCell><code class="tw-text-danger-700">{{row.class}}</code></td>
              <td bitCell>{{row.usage}}</td>
            </tr>
          }
        </ng-template>
      </bit-table>
    `,
  }),
  args: {
    dataSource: rotationData,
  },
};

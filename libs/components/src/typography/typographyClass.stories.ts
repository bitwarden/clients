import { Meta, moduleMetadata } from "@storybook/angular";

import { TableModule, TableDataSource } from "../table";

export default {
  title: "Documentation / Typography",
  decorators: [
    moduleMetadata({
      imports: [TableModule],
    }),
  ],
} as Meta;

type TypographyData = {
  id: string;
  style: string;
  classes: string;
  weight: string;
  size: number;
  lineHeight: string;
};

const typographyProps: TypographyData[] = [
  {
    id: "h1",
    style: "h1",
    classes: "bit-typography-h1",
    weight: "Regular",
    size: 30,
    lineHeight: "150%",
  },
  {
    id: "h2",
    style: "h2",
    classes: "bit-typography-h2",
    weight: "Regular",
    size: 24,
    lineHeight: "150%",
  },
  {
    id: "h3",
    style: "h3",
    classes: "bit-typography-h3",
    weight: "Regular",
    size: 20,
    lineHeight: "150%",
  },
  {
    id: "h4",
    style: "h4",
    classes: "bit-typography-h4",
    weight: "Regular",
    size: 18,
    lineHeight: "150%",
  },
  {
    id: "h5",
    style: "h5",
    classes: "bit-typography-h5",
    weight: "Regular",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "h6",
    style: "h6",
    classes: "bit-typography-h6",
    weight: "Regular",
    size: 14,
    lineHeight: "150%",
  },
  {
    id: "body",
    style: "body",
    classes: "bit-typography-body",
    weight: "Regular",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "body-med",
    style: "body",
    classes: "bit-typography-body tw-font-medium",
    weight: "Medium",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "body-semi",
    style: "body",
    classes: "bit-typography-body tw-font-semibold",
    weight: "Semibold",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "body-underline",
    style: "body",
    classes: "bit-typography-body tw-underline",
    weight: "Regular",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "body-sm",
    style: "body-sm",
    classes: "bit-typography-body-sm",
    weight: "Regular",
    size: 14,
    lineHeight: "150%",
  },
  {
    id: "body-sm-med",
    style: "body-sm",
    classes: "bit-typography-body-sm tw-font-medium",
    weight: "Medium",
    size: 14,
    lineHeight: "150%",
  },
  {
    id: "body-sm-semi",
    style: "body-sm",
    classes: "bit-typography-body-sm tw-font-semibold",
    weight: "Semibold",
    size: 14,
    lineHeight: "150%",
  },
  {
    id: "body-sm-underline",
    style: "body-sm",
    classes: "bit-typography-body-sm tw-underline",
    weight: "Regular",
    size: 14,
    lineHeight: "150%",
  },
  {
    id: "helper",
    style: "helper",
    classes: "bit-typography-helper",
    weight: "Regular",
    size: 12,
    lineHeight: "150%",
  },
  {
    id: "helper-med",
    style: "helper",
    classes: "bit-typography-helper tw-font-medium",
    weight: "Medium",
    size: 12,
    lineHeight: "150%",
  },
  {
    id: "helper-semi",
    style: "helper",
    classes: "bit-typography-helper tw-font-semibold",
    weight: "Semibold",
    size: 12,
    lineHeight: "150%",
  },
  {
    id: "helper-underline",
    style: "helper",
    classes: "bit-typography-helper tw-underline",
    weight: "Regular",
    size: 12,
    lineHeight: "150%",
  },
  {
    id: "code",
    style: "code",
    classes: "bit-typography-code",
    weight: "Regular",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "code-sm",
    style: "code-sm",
    classes: "bit-typography-code-sm",
    weight: "Regular",
    size: 14,
    lineHeight: "150%",
  },

  {
    id: "code-helper",
    style: "code-helper",
    classes: "bit-typography-code-helper",
    weight: "Regular",
    size: 12,
    lineHeight: "150%",
  },
];

const typographyData = new TableDataSource<TypographyData>();
typographyData.data = typographyProps;

export const Typography = {
  render: (args: { text: string; dataSource: typeof typographyProps }) => ({
    props: args,
    template: /*html*/ `
      <bit-table [dataSource]="dataSource">
        <ng-container header>
          <tr>
            <th bitCell>Rendered Text</th>
            <th bitCell>Style</th>
            <th bitCell>Weight</th>
            <th bitCell>Classes</th>
            <th bitCell>Size</th>
            <th bitCell>Line Height</th>
          </tr>
        </ng-container>
        <ng-template body let-rows$>
          @for (row of rows$ | async; track row.id) {
            <tr bitRow alignContent="middle">
              <td bitCell><div [ngClass]="row.classes">{{ text }}</div></td>
              <td bitCell class="bit-typography-body-sm">{{row.style}}</td>
              <td bitCell class="bit-typography-body-sm">{{row.weight}}</td>
              <td bitCell class="bit-typography-body-sm">{{row.classes}}</td>
              <td bitCell class="bit-typography-body-sm">{{row.size}}</td>
              <td bitCell class="bit-typography-body-sm">{{row.lineHeight}}</td>
            </tr>
          }
        </ng-template>
      </bit-table>
    `,
  }),
  args: {
    text: `Sphinx of black quartz, judge my vow.`,
    dataSource: typographyData,
  },
};

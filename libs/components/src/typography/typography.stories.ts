import { Meta, moduleMetadata } from "@storybook/angular";

import { TableModule, TableDataSource } from "../table";

import { TypographyDirective } from "./typography.directive";

export default {
  title: "Component Library/Typography",
  component: TypographyDirective,
  decorators: [
    moduleMetadata({
      imports: [TableModule],
    }),
  ],
} as Meta;

type TypographyData = {
  id: string;
  typography: string;
  classes?: string;
  weight: string;
  size: number;
  lineHeight: string;
};

const typographyProps: TypographyData[] = [
  {
    id: "h1",
    typography: "h1",
    weight: "Regular",
    size: 30,
    lineHeight: "150%",
  },
  {
    id: "h2",
    typography: "h2",
    weight: "Regular",
    size: 24,
    lineHeight: "150%",
  },
  {
    id: "h3",
    typography: "h3",
    weight: "Regular",
    size: 20,
    lineHeight: "150%",
  },
  {
    id: "h4",
    typography: "h4",
    weight: "Regular",
    size: 18,
    lineHeight: "150%",
  },
  {
    id: "h5",
    typography: "h5",
    weight: "Regular",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "h6",
    typography: "h6",
    weight: "Regular",
    size: 14,
    lineHeight: "150%",
  },
  {
    id: "body",
    typography: "body1",
    weight: "Regular",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "body-med",
    typography: "body1",
    classes: "tw-font-medium",
    weight: "Medium",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "body-semi",
    typography: "body1",
    classes: "tw-font-semibold",
    weight: "Semibold",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "body-underline",
    typography: "body1",
    classes: "tw-underline",
    weight: "Regular",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "body-sm",
    typography: "body2",
    weight: "Regular",
    size: 14,
    lineHeight: "150%",
  },
  {
    id: "body-sm-med",
    typography: "body2",
    classes: "tw-font-medium",
    weight: "Medium",
    size: 14,
    lineHeight: "150%",
  },
  {
    id: "body-sm-semi",
    typography: "body2",
    classes: "tw-font-semibold",
    weight: "Semibold",
    size: 14,
    lineHeight: "150%",
  },
  {
    id: "body-sm-underline",
    typography: "body2",
    classes: "tw-underline",
    weight: "Regular",
    size: 14,
    lineHeight: "150%",
  },
  {
    id: "helper",
    typography: "helper",
    weight: "Regular",
    size: 12,
    lineHeight: "150%",
  },
  {
    id: "helper-med",
    typography: "helper",
    classes: "tw-font-medium",
    weight: "Medium",
    size: 12,
    lineHeight: "150%",
  },
  {
    id: "helper-semi",
    typography: "helper",
    classes: "tw-font-semibold",
    weight: "Semibold",
    size: 12,
    lineHeight: "150%",
  },
  {
    id: "helper-underline",
    typography: "helper",
    classes: "tw-underline",
    weight: "Regular",
    size: 12,
    lineHeight: "150%",
  },
  {
    id: "code",
    typography: "body1",
    classes: "tw-font-mono tw-text-code",
    weight: "Regular",
    size: 16,
    lineHeight: "150%",
  },
  {
    id: "code-sm",
    typography: "body2",
    classes: "tw-font-mono tw-text-code",
    weight: "Regular",
    size: 14,
    lineHeight: "150%",
  },

  {
    id: "code-helper",
    typography: "helper",
    classes: "tw-font-mono tw-text-code",
    weight: "Regular",
    size: 12,
    lineHeight: "150%",
  },
];

const typographyData = new TableDataSource<TypographyData>();
typographyData.data = typographyProps;

export const Default = {
  render: (args: { text: string; dataSource: typeof typographyProps }) => ({
    props: args,
    template: /*html*/ `
      <bit-table [dataSource]="dataSource">
        <ng-container header>
          <tr>
            <th bitCell>Rendered Text</th>
            <th bitCell>bitTypography Variant</th>
            <th bitCell>Additional Classes</th>
            <th bitCell>Weight</th>
            <th bitCell>Size</th>
            <th bitCell>Line Height</th>
          </tr>
        </ng-container>
        <ng-template body let-rows$>
          @for (row of rows$ | async; track row.id) {
            <tr bitRow alignContent="middle">
              <td bitCell><div [bitTypography]="row.typography" [ngClass]="row.classes">{{text}}</div></td>
              <td bitCell bitTypography="body2">{{row.typography}}</td>
              <td bitCell bitTypography="body2">{{row.classes}}</td>
              <td bitCell bitTypography="body2">{{row.weight}}</td>
              <td bitCell bitTypography="body2">{{row.size}}</td>
              <td bitCell bitTypography="body2">{{row.lineHeight}}</td>
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

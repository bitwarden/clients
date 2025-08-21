import { Meta, moduleMetadata } from "@storybook/angular";

import * as SvgIcons from "@bitwarden/assets/svg";

import { TableDataSource, TableModule } from "../table";

import { BitIconComponent } from "./icon.component";

export default {
  title: "Component Library/Icon",
  component: BitIconComponent,
  decorators: [
    moduleMetadata({
      imports: [TableModule],
    }),
  ],
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-50335&t=k6OTDDPZOTtypRqo-11",
    },
  },
} as Meta;

type IconWithName = {
  icon: string;
  name: string;
};

const {
  // Filtering out the few non-icons in the libs/assets/svg import
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  DynamicContentNotAllowedError: _DynamicContentNotAllowedError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isIcon,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  svgIcon,
  ...Icons
}: {
  [key: string]: any;
} = SvgIcons;

function iconsMapped(): IconWithName[] {
  const iconNames = Object.keys(Icons);

  return iconNames.reduce((result: IconWithName[], iconName) => {
    result.push({
      icon: Icons[iconName],
      name: iconName,
    });

    return result;
  }, []);
}

const iconsData = new TableDataSource<IconWithName>();
iconsData.data = iconsMapped();

export const Default = {
  render: (args: { dataSource: typeof iconsData }) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-bg-secondary-100">
      <bit-table [dataSource]="dataSource">
        <ng-container header>
          <tr>
            <th bitCell class="tw-text-main">Icon Name</th>
            <th bitCell class="tw-text-main">Icon</th>
          </tr>
        </ng-container>
        <ng-template body let-rows$>
          @for (row of rows$ | async; track row.name) {
            <tr bitRow alignContent="middle">
              <td bitCell>{{row.name}}</td>
              <td bitCell class=" tw-size-72">
                <bit-icon [icon]="row.icon"></bit-icon>
              </td>
            </tr>
          }
        </ng-template>
      </bit-table>
    </div>
    `,
  }),
  args: {
    dataSource: iconsData,
  },
};

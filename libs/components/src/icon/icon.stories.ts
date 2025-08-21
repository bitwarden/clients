import { Meta } from "@storybook/angular";

import * as SvgIcons from "@bitwarden/assets/svg";

import { BitIconComponent } from "./icon.component";

export default {
  title: "Component Library/Icon",
  component: BitIconComponent,
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

const iconsData = iconsMapped();

export const Default = {
  render: (args: { dataSource: typeof iconsData }) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-bg-secondary-100 tw-p-2 tw-grid tw-grid-cols-[repeat(auto-fit,minmax(224px,1fr))] tw-gap-2">
      @for (icon of dataSource; track icon.name) {
        <div class="tw-size-56 tw-border tw-border-secondary-300 tw-rounded-md">
          <div class="tw-text-xs tw-text-center">{{icon.name}}</div>
          <div class="tw-size-52 tw-w-full tw-content-center">
            <bit-icon [icon]="icon.icon" class="tw-flex tw-justify-center tw-max-h-full"></bit-icon>
          </div>
        </div>
      }
    </div>
    `,
  }),
  args: {
    dataSource: iconsData,
  },
};

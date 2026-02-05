import { Meta } from "@storybook/angular";

import * as SvgIcons from "@bitwarden/assets/svg";

import { SvgComponent } from "./svg.component";

export default {
  title: "Component Library/Svg",
  component: SvgComponent,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/Zt3YSeb6E6lebAffrNLa0h/Tailwind-Component-Library?node-id=21662-50335&t=k6OTDDPZOTtypRqo-11",
    },
  },
} as Meta;

const {
  // Filtering out the few non-icons in the libs/assets/svg import
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  DynamicContentNotAllowedError: _DynamicContentNotAllowedError,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isBitSvg,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  svg,
  ...Icons
}: {
  [key: string]: any;
} = SvgIcons;

export const Default = {
  render: (args: { icons: [string, any][] }) => ({
    props: args,
    template: /*html*/ `
    <div class="tw-bg-secondary-100 tw-p-2 tw-grid tw-grid-cols-[repeat(auto-fit,minmax(224px,1fr))] tw-gap-2">
      @for (icon of icons; track icon[0]) {
        <div class="tw-size-56 tw-border tw-border-secondary-300 tw-rounded-md">
          <div class="tw-text-xs tw-text-center">{{icon[0]}}</div>
          <div class="tw-size-52 tw-w-full tw-content-center">
            <bit-svg [content]="icon[1]"></bit-svg>
          </div>
        </div>
      }
    </div>
    `,
  }),
  args: {
    icons: Object.entries(Icons),
  },
};

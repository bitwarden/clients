import { Meta, StoryObj } from "@storybook/angular";

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

type Story = StoryObj<BitIconComponent>;

// Filtering out the few non-icons in the libs/assets/svg import
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { DynamicContentNotAllowedError, isIcon, svgIcon, ...Icons } = SvgIcons;

export const Default: Story = {
  args: {
    icon: Icons.NoAccess,
  },
  argTypes: {
    icon: {
      options: Object.keys(Icons),
      mapping: Icons,
      control: { type: "select" },
    },
    ariaLabel: {
      control: "text",
      description: "the text used by a screen reader to describe the icon",
    },
  },
};

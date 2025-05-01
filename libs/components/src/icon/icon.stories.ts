import { Meta, StoryObj } from "@storybook/angular";

import { BitIconComponent } from "./icon.component";
import * as GenericIcons from "./icons";

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

export const Default: Story = {
  args: {
    icon: GenericIcons.NoAccess,
  },
  argTypes: {
    icon: {
      options: Object.keys(GenericIcons),
      mapping: GenericIcons,
      control: { type: "select" },
    },
    ariaLabel: {
      control: "text",
      description: "the text used by a screen reader to describe the icon",
    },
  },
};

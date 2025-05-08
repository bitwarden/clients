import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { BadgeButton, BadgeButtonProps } from "../../buttons/badge-button";

export default {
  title: "Components/Buttons/Badge Button",
  argTypes: {
    buttonText: { control: "text" },
    disabled: { control: "boolean" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    buttonAction: { control: false },
  },
  args: {
    buttonText: "Click Me",
    disabled: false,
    theme: ThemeTypes.Light,
    buttonAction: () => alert("Clicked"),
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=502-24973&t=2O7uCAkwRZCcjumm-4",
    },
  },
} as Meta<BadgeButtonProps>;

const Template = (args: BadgeButtonProps) => BadgeButton({ ...args });

export const Default: StoryObj<BadgeButtonProps> = {
  render: Template,
};

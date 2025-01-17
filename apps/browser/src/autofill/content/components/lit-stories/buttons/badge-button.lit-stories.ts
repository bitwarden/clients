import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { BadgeButton } from "../../buttons/badge-button";

type Args = {
  buttonAction: (e: Event) => void;
  buttonText: string;
  disabled?: boolean;
  theme: Theme;
};

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
} as Meta<Args>;

const Template = (args: Args) => BadgeButton({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

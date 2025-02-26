import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { ActionButton } from "../../buttons/action-button";

type Args = {
  buttonText: string;
  disabled: boolean;
  theme: Theme;
  buttonAction: (e: Event) => void;
};

export default {
  title: "Components/Buttons/Action Button",
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
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=487-14755&t=2O7uCAkwRZCcjumm-4",
    },
  },
} as Meta<Args>;

const Template = (args: Args) => ActionButton({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

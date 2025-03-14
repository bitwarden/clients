import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { themes } from "../../constants/styles";
import { ButtonRow, ButtonRowProps } from "../../rows/button-row";

export default {
  title: "Components/Rows/Button Row",
  argTypes: {},
  args: {
    primaryButton: {
      text: "Action",
      handlePrimaryButtonClick: (e: Event) => {
        window.alert("Button clicked!");
      },
    },
  },
} as Meta<ButtonRowProps>;

const Component = (args: ButtonRowProps) => ButtonRow({ ...args });

export const Light: StoryObj<ButtonRowProps> = {
  render: Component,
  argTypes: {
    theme: { control: "radio", options: [ThemeTypes.Light] },
  },
  args: {
    theme: ThemeTypes.Light,
  },
  parameters: {
    backgrounds: {
      values: [{ name: "Light", value: themes.light.background.alt }],
      default: "Light",
    },
  },
};

export const Dark: StoryObj<ButtonRowProps> = {
  render: Component,
  argTypes: {
    theme: { control: "radio", options: [ThemeTypes.Dark] },
  },
  args: {
    theme: ThemeTypes.Dark,
  },
  parameters: {
    backgrounds: {
      values: [{ name: "Dark", value: themes.dark.background.alt }],
      default: "Dark",
    },
  },
};

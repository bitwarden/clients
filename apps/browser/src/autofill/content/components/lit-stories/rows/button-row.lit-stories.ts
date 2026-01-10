import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { themes } from "../../constants/styles";
import { ButtonRow, ButtonRowProps } from "../../rows/button-row";
import { mockBrowserI18nGetMessage } from "../mock-data";

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
    selectButtons: [
      {
        id: "select-1",
        label: "select 1",
        options: [
          {
            text: "item 1",
            value: 1,
          },
          {
            default: true,
            text: "item 2",
            value: 2,
          },
          {
            text: "item 3",
            value: 3,
          },
        ],
      },
      {
        id: "select-2",
        label: "select 2",
        options: [
          {
            text: "item a",
            value: "a",
          },
          {
            text: "item b",
            value: "b",
          },
          {
            text: "item c",
            value: "c",
          },
          {
            text: "item d",
            value: "d",
          },
        ],
      },
    ],
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

window.chrome = {
  ...window.chrome,
  i18n: {
    getMessage: mockBrowserI18nGetMessage,
  },
} as typeof chrome;

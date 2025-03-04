import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { themes } from "../../constants/styles";
import { ButtonRow } from "../../rows/button-row";

type Args = {
  theme: Theme;
  primaryButtonText: string;
  handlePrimaryButtonClick: (e: Event) => void;
  handleSelectionUpdate: (selectValue: any, selectId: string) => void;
};

export default {
  title: "Components/Rows/Button Row",
  argTypes: {
    primaryButtonText: { control: "text" },
  },
  args: {
    primaryButtonText: "Action",
    handlePrimaryButtonClick: (e: Event) => {
      window.alert("Button clicked!");
    },
    handleSelectionUpdate: (selectValue: any, selectId: string) => {
      /* eslint-disable-next-line no-console */
      console.log(selectValue, selectId);
    },
  },
} as Meta<Args>;

const Template = (args: Args) => ButtonRow({ ...args });

export const Light: StoryObj<Args> = {
  render: Template,
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

export const Dark: StoryObj<Args> = {
  render: Template,
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

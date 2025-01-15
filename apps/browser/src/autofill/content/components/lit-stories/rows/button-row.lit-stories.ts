import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { ButtonRow } from "../../rows/button-row";

type Args = {
  theme: Theme;
};

export default {
  title: "Components/Rows/Button Row",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    theme: ThemeTypes.Light,
  },
} as Meta<Args>;

const Template = (args: Args) => ButtonRow({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

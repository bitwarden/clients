import { Meta, StoryObj } from "@storybook/web-components";
import { TemplateResult } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { ItemRow } from "../../rows/item-row";

type Args = {
  theme: Theme;
  children: TemplateResult | TemplateResult[];
};

export default {
  title: "Components/Rows/Item Row",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    children: { control: "object" },
  },
  args: {
    theme: ThemeTypes.Light,
  },
} as Meta<Args>;

const Template = (args: Args) => ItemRow({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

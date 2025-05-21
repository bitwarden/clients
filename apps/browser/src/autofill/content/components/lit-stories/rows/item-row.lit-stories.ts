import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { ItemRow, ItemRowProps } from "../../rows/item-row";

export default {
  title: "Components/Rows/Item Row",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    children: { control: "object" },
  },
  args: {
    theme: ThemeTypes.Light,
  },
} as Meta<ItemRowProps>;

const Template = (args: ItemRowProps) => ItemRow({ ...args });

export const Default: StoryObj<ItemRowProps> = {
  render: Template,
};

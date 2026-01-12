import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { ActionRow, ActionRowProps } from "../../rows/action-row";

export default {
  title: "Components/Rows/Action Row",
  argTypes: {
    itemText: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    handleAction: { control: false },
  },
  args: {
    itemText: "Action Item",
    theme: ThemeTypes.Light,
    handleAction: () => alert("Action triggered"),
  },
} as Meta<ActionRowProps>;

const Template = (args: ActionRowProps) => ActionRow({ ...args });

export const Default: StoryObj<ActionRowProps> = {
  render: Template,
};

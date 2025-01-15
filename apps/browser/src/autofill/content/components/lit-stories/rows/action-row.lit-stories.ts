import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { ActionRow } from "../../rows/action-row";

type Args = {
  itemText: string;
  handleAction: (e: Event) => void;
  theme: Theme;
};

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
} as Meta<Args>;

const Template = (args: Args) => ActionRow({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

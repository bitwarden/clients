import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { EditButton } from "../../../buttons/edit-button";

export default {
  title: "Components/Buttons/Edit Button",
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
} as Meta;

type Story = StoryObj;

const Template = (args: any) => EditButton({ ...args });

export const Default: Story = {
  render: Template,
};

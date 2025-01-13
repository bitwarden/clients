import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { CloseButton } from "../../../buttons/close-button";

export default {
  title: "Components/Buttons/Close Button",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    handleCloseNotification: { control: false },
  },
  args: {
    theme: ThemeTypes.Light,
    handleCloseNotification: () => {
      alert("Close button clicked!");
    },
  },
} as Meta;

type Story = StoryObj;

const Template = (args: any) => CloseButton({ ...args });

export const Default: Story = {
  render: Template,
};

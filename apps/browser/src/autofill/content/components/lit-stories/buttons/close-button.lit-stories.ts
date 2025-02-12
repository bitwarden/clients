import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { CloseButton } from "../../buttons/close-button";

type Args = {
  handleCloseNotification: (e: Event) => void;
  theme: Theme;
};
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
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=502-24633&t=2O7uCAkwRZCcjumm-4",
    },
  },
} as Meta<Args>;

const Template = (args: Args) => CloseButton({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

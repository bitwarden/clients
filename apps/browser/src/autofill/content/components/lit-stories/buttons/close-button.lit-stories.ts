import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { CloseButton, CloseButtonProps } from "../../buttons/close-button";
import { mockI18n } from "../mock-data";

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
    i18n: mockI18n,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=502-24633&t=2O7uCAkwRZCcjumm-4",
    },
  },
} as Meta<CloseButtonProps>;

const Template = (args: CloseButtonProps) => CloseButton({ ...args });

export const Default: StoryObj<CloseButtonProps> = {
  render: Template,
};

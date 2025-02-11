import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { NotificationConfirmationBody } from "../../notification/confirmation";

type Args = {
  buttonText: string;
  confirmationMessage: string;
  handleClick: () => void;
  theme: Theme;
  error: string;
};

export default {
  title: "Components/Notifications/Notification Confirmation Body",
  argTypes: {
    buttonText: { control: "text" },
    confirmationMessage: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    buttonText: "View",
    confirmationMessage: "[item name] updated in Bitwarden.",
    theme: ThemeTypes.Light,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=32-3461&m=dev",
    },
  },
} as Meta<Args>;

const Template = (args: Args) => NotificationConfirmationBody({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

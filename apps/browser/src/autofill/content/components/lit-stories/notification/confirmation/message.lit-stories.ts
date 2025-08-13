import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import {
  NotificationConfirmationMessage,
  NotificationConfirmationMessageProps,
} from "../../../notification/confirmation/message";

export default {
  title: "Components/Notifications/Confirmation/Message",
  argTypes: {
    buttonAria: { control: "text" },
    buttonText: { control: "text" },
    message: { control: "text" },
    messageDetails: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    buttonText: "View",
    message: "[item name] updated in Bitwarden.",
    messageDetails: "It was added to your vault.",
    handleClick: () => window.alert("link was clicked!"),
    theme: ThemeTypes.Light,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=485-20160&m=dev",
    },
  },
} as Meta<NotificationConfirmationMessageProps>;

const Template = (args: NotificationConfirmationMessageProps) =>
  NotificationConfirmationMessage({ ...args });

export const Default: StoryObj<NotificationConfirmationMessageProps> = {
  render: Template,
};

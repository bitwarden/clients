import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import {
  NotificationConfirmationBody,
  NotificationConfirmationBodyProps,
} from "../../../notification/confirmation/body";

export default {
  title: "Components/Notifications/Confirmation/Body",
  argTypes: {
    error: { control: "text" },
    buttonText: { control: "text" },
    confirmationMessage: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    error: "",
    buttonText: "View",
    confirmationMessage: "[item name] updated in Bitwarden.",
    task: {
      cipherName: "user@org.org",
      orgName: "Acme, Inc.",
      remainingTasksCount: 0,
      taskCompleted: true,
    },
    theme: ThemeTypes.Light,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=485-20160&m=dev",
    },
  },
} as Meta<NotificationConfirmationBodyProps>;

const Template = (args: NotificationConfirmationBodyProps) =>
  NotificationConfirmationBody({ ...args });

export const Default: StoryObj<NotificationConfirmationBodyProps> = {
  render: Template,
};

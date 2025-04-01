import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { NotificationTypes } from "../../../../../notification/abstractions/notification-bar";
import {
  NotificationConfirmationContainer,
  NotificationConfirmationContainerProps,
} from "../../../notification/confirmation/container";

export default {
  title: "Components/Notifications/Confirmation",
  argTypes: {
    error: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    type: { control: "select", options: [NotificationTypes.Change, NotificationTypes.Add] },
  },
  args: {
    error: "",
    task: {
      cipherName: "user@org.org",
      orgName: "Acme, Inc.",
      remainingTasksCount: 0,
      taskCompleted: true,
    },
    i18n: {
      loginSaveSuccess: "Login saved",
      loginUpdateSuccess: "Login updated",
      nextSecurityTaskAction: "Change next password",
      saveFailure: "Error saving",
      saveFailureDetails: "Oh no! We couldn't save this. Try entering the details manually.",
      view: "View",
    },
    type: NotificationTypes.Change,
    username: "mockUsername",
    theme: ThemeTypes.Light,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=485-20160&m=dev",
    },
  },
} as Meta<NotificationConfirmationContainerProps>;

const Template = (args: NotificationConfirmationContainerProps) =>
  NotificationConfirmationContainer({ ...args });

export const Default: StoryObj<NotificationConfirmationContainerProps> = {
  render: Template,
};

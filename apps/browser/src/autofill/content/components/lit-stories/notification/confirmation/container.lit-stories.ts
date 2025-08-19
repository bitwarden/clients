import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { NotificationTypes } from "../../../../../notification/abstractions/notification-bar";
import {
  getConfirmationHeaderMessage,
  getNotificationTestId,
} from "../../../../../notification/bar";
import {
  NotificationConfirmationContainer,
  NotificationConfirmationContainerProps,
} from "../../../notification/confirmation/container";
import { mockI18n, mockCiphers, mockBrowserI18nGetMessage, mockTasks } from "../../mock-data";

export default {
  title: "Components/Notifications/Confirmation",
  argTypes: {
    error: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    type: { control: "select", options: [NotificationTypes.Change, NotificationTypes.Add] },
  },
  args: {
    error: "",
    task: mockTasks[0],
    itemName: mockCiphers[0].name,
    type: NotificationTypes.Change,
    theme: ThemeTypes.Light,
    handleCloseNotification: () => alert("Close notification action triggered"),
    handleOpenVault: () => alert("Open vault action triggered"),
    handleOpenTasks: () => alert("Open tasks action triggered"),
    i18n: mockI18n,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=485-20160&m=dev",
    },
  },
} as Meta<NotificationConfirmationContainerProps>;

const Template = (args: NotificationConfirmationContainerProps) => {
  const headerMessage = getConfirmationHeaderMessage(args.i18n, args.type, args.error);
  const notificationTestId = getNotificationTestId(args.type, true);
  return NotificationConfirmationContainer({ ...args, headerMessage, notificationTestId });
};

export const Default: StoryObj<NotificationConfirmationContainerProps> = {
  render: Template,
};

window.chrome = {
  ...window.chrome,
  i18n: {
    getMessage: mockBrowserI18nGetMessage,
  },
} as typeof chrome;

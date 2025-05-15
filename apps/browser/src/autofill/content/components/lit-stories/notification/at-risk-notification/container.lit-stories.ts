import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums";

import { NotificationTypes } from "../../../../../notification/abstractions/notification-bar";
import {
  AtRiskNotification,
  AtRiskNotificationProps,
} from "../../../notification/at-risk-password/container";
import { mockI18n, mockBrowserI18nGetMessage } from "../../mock-data";

export default {
  title: "Components/Notifications/AtRiskNotification",
  argTypes: {
    error: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    type: { control: "select", options: [NotificationTypes.AtRiskPassword] },
  },
  args: {
    error: "",
    type: NotificationTypes.AtRiskPassword,
    theme: ThemeTypes.Light,
    handleCloseNotification: () => alert("Close notification action triggered"),
    params: {
      passwordChangeUri: "https://webtests.dev", // Remove to see "navigate" version of notification
      organizationName: "Acme Co.",
    },
    i18n: mockI18n,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=485-20160&m=dev",
    },
  },
} as Meta<AtRiskNotificationProps>;

const Template = (args: AtRiskNotificationProps) => AtRiskNotification({ ...args });

export const Default: StoryObj<AtRiskNotificationProps> = {
  render: Template,
};

window.chrome = {
  ...window.chrome,
  i18n: {
    getMessage: mockBrowserI18nGetMessage,
  },
} as typeof chrome;

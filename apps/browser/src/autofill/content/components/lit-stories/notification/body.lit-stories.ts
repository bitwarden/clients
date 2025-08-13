import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationTypes } from "../../../../notification/abstractions/notification-bar";
import { NotificationBody, NotificationBodyProps } from "../../notification/body";
import { mockCiphers, mockI18n } from "../mock-data";

export default {
  title: "Components/Notifications/Body",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    notificationType: {
      control: "select",
      options: [...Object.values(NotificationTypes)],
    },
    handleEditOrUpdateAction: { control: false },
  },
  args: {
    ciphers: mockCiphers,
    notificationType: NotificationTypes.Change,
    theme: ThemeTypes.Light,
    handleEditOrUpdateAction: () => window.alert("clicked!"),
    i18n: mockI18n,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=217-6841&m=dev",
    },
  },
} as Meta<NotificationBodyProps>;

const Template = (args: NotificationBodyProps) => NotificationBody({ ...args });

export const Default: StoryObj<NotificationBodyProps> = {
  render: Template,
};

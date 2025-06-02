import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationHeader, NotificationHeaderProps } from "../../notification/header";
import { mockI18n } from "../mock-data";

export default {
  title: "Components/Notifications/Header",
  argTypes: {
    message: { control: "text" },
    standalone: { control: "boolean" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    message: "This is a notification message",
    standalone: true,
    theme: ThemeTypes.Light,
    handleCloseNotification: () => alert("Close Clicked"),
    i18n: mockI18n,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=32-3461&m=dev",
    },
  },
} as Meta<NotificationHeaderProps>;

const Template = (args: NotificationHeaderProps) =>
  html`<div style="max-width:400px;">${NotificationHeader({ ...args })}</div>`;

export const Default: StoryObj<NotificationHeaderProps> = {
  render: Template,
};

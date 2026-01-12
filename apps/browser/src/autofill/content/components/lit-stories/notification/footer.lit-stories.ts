import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationTypes } from "../../../../notification/abstractions/notification-bar";
import { NotificationFooter, NotificationFooterProps } from "../../notification/footer";
import { mockCollections, mockI18n, mockFolders, mockOrganizations } from "../mock-data";

export default {
  title: "Components/Notifications/Footer",
  argTypes: {
    notificationType: {
      control: "select",
      options: [...Object.values(NotificationTypes)],
    },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    collections: mockCollections,
    folders: mockFolders,
    notificationType: NotificationTypes.Add,
    organizations: mockOrganizations,
    theme: ThemeTypes.Light,
    handleSaveAction: () => alert("Save action triggered"),
    i18n: mockI18n,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=32-4949&m=dev",
    },
  },
} as Meta<NotificationFooterProps>;

const Template = (args: NotificationFooterProps) =>
  html`<div style="max-width:400px;">${NotificationFooter({ ...args })}</div>`;

export const Default: StoryObj<NotificationFooterProps> = {
  render: Template,
};

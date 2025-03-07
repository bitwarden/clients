import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationFooter, NotificationFooterProps } from "../../notification/footer";
import { mockFolderData, mockOrganizationData } from "../mock-data";

export default {
  title: "Components/Notifications/Notification Footer",
  argTypes: {
    notificationType: {
      control: "select",
      options: ["add", "change", "unlock", "fileless-import"],
    },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    folders: mockFolderData,
    i18n: {
      saveAction: "Save",
      saveAsNewLoginAction: "Save as New Login",
    },
    notificationType: "add",
    organizations: mockOrganizationData,
    theme: ThemeTypes.Light,
    handleSaveAction: () => alert("Save action triggered"),
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=32-4949&m=dev",
    },
  },
} as Meta<NotificationFooterProps>;

const Template = (args: NotificationFooterProps) => NotificationFooter({ ...args });

export const Default: StoryObj<NotificationFooterProps> = {
  render: Template,
};

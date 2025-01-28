import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationHeader } from "../../notification/header";

type Args = {
  message: string;
  standalone: boolean;
  theme: Theme;
  handleCloseNotification: (e: Event) => void;
};

export default {
  title: "Components/Notifications/Notification Header",
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
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=32-3461&m=dev",
    },
  },
} as Meta<Args>;

const Template = (args: Args) => NotificationHeader({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

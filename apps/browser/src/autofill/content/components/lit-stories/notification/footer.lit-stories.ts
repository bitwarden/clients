import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationType } from "../../../../notification/abstractions/notification-bar";
import { NotificationFooter } from "../../notification/footer";

type Args = {
  notificationType: NotificationType;
  theme: Theme;
};

export default {
  title: "Components/Notifications/Notification Footer",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    notificationType: {
      control: "select",
      options: ["add", "change", "unlock", "fileless-import"],
    },
  },
  args: {
    theme: ThemeTypes.Light,
    notificationType: "add",
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=32-4949&m=dev",
    },
  },
} as Meta<Args>;

const Template = (args: Args) => NotificationFooter({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

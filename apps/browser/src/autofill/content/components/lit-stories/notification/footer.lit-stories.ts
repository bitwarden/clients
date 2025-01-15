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
} as Meta<Args>;

const Template = (args: Args) => NotificationFooter({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

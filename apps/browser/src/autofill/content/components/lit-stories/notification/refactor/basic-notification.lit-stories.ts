import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { PresentationalNotificationProps } from "../../../notification/presentational/notification";
import { BasicNotification } from "../../../notification/types/basic-notification";
import { ExampleComponent } from "../../../notification/types/example-component";

export default {
  title: "Components/Refactor/BasicNotification",
  argTypes: {
    title: { control: "text" },
    message: { control: "text" },
    footer: {
      options: ["Plain", "Example"],
      mapping: {
        Plain: ExampleComponent({ message: "Plain" }),
        Example: ExampleComponent({ message: "Example" }),
      },
    },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
  },
  args: {
    title: "Basic Notification",
    message: "Notifications are happening, more or less constantly.",
    footer: ExampleComponent({ message: "Plain" }),
    theme: ThemeTypes.Light,
  },
} as Meta<PresentationalNotificationProps>;

const Template = (args: PresentationalNotificationProps) => BasicNotification();

export const Default: StoryObj<PresentationalNotificationProps> = {
  render: Template,
};

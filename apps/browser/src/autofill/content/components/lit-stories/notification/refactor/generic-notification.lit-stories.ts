import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { PresentationalNotificationProps } from "../../../notification/presentational/notification";
import { ExampleComponent } from "../../../notification/types/example-component";
import { GenericNotification } from "../../../notification/types/generic-notification";

export default {
  title: "Components/Refactor/GenericNotification",
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
    title: "Generic Alert",
    message: "Notifications are happening, more or less constantly.",
    footer: ExampleComponent({ message: "Plain" }),
    theme: ThemeTypes.Light,
  },
} as Meta<PresentationalNotificationProps>;

const Template = (args: PresentationalNotificationProps) => GenericNotification();

export const Default: StoryObj<PresentationalNotificationProps> = {
  render: Template,
};

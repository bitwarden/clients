import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationTypes } from "../../../../notification/abstractions/notification-bar";
import { CipherAction } from "../../../components/cipher/cipher-action";

export default {
  title: "Components/Cipher/Cipher Action",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    notificationType: {
      control: "select",
      options: [NotificationTypes.Change, NotificationTypes.Add],
    },
    handleAction: { control: false },
  },
  args: {
    theme: ThemeTypes.Light,
    notificationType: NotificationTypes.Change,
    handleAction: () => {
      alert("Action triggered!");
    },
  },
} as Meta;

type Story = StoryObj;

const Template = (args: any) => CipherAction({ ...args });

export const Default: Story = {
  render: Template,
};

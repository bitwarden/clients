import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationTypes } from "../../../../notification/abstractions/notification-bar";
import { CipherAction } from "../../cipher/cipher-action";

type Args = {
  handleAction?: (e: Event) => void;
  notificationType: typeof NotificationTypes.Change | typeof NotificationTypes.Add;
  theme: Theme;
};
export default {
  title: "Components/Ciphers/Cipher Action",
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
} as Meta<Args>;

const Template = (args: Args) => CipherAction({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

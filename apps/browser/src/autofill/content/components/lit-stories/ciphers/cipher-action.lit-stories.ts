import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationTypes } from "../../../../notification/abstractions/notification-bar";
import { CipherAction, CipherActionProps } from "../../cipher/cipher-action";
import { mockI18n } from "../mock-data";

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
    handleAction: () => alert("Action triggered!"),
    i18n: mockI18n,
  },
} as Meta<CipherActionProps>;

const Template = (args: CipherActionProps) => CipherAction({ ...args });

export const Default: StoryObj<CipherActionProps> = {
  render: Template,
};

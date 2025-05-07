import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationTypes } from "../../../../notification/abstractions/notification-bar";
import { CipherItem, CipherItemProps } from "../../cipher/cipher-item";
import { mockCiphers, mockI18n } from "../mock-data";

export default {
  title: "Components/Ciphers/Cipher Item",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    handleAction: { control: false },
    notificationType: {
      control: "select",
      options: [NotificationTypes.Change, NotificationTypes.Add],
    },
  },
  args: {
    cipher: mockCiphers[0],
    theme: ThemeTypes.Light,
    notificationType: NotificationTypes.Change,
    handleAction: () => alert("Clicked"),
    i18n: mockI18n,
  },
} as Meta<CipherItemProps>;

const Template = (args: CipherItemProps) => CipherItem({ ...args });

export const Default: StoryObj<CipherItemProps> = {
  render: Template,
};

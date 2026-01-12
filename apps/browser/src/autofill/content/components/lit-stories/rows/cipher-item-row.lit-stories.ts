import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { NotificationTypes } from "../../../../notification/abstractions/notification-bar";
import { CipherItemRow, CipherItemRowProps } from "../../rows/cipher-item-row";
import { mockCiphers, mockI18n } from "../mock-data";

export default {
  title: "Components/Rows/Cipher Item Row",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    notificationType: {
      control: "select",
      options: [...Object.values(NotificationTypes)],
    },
    handleAction: { control: false },
  },
  args: {
    cipher: mockCiphers[0],
    i18n: mockI18n,
    notificationType: NotificationTypes.Change,
    theme: ThemeTypes.Light,
    handleAction: () => window.alert("clicked!"),
  },
} as Meta<CipherItemRowProps>;

const Template = (props: CipherItemRowProps) => CipherItemRow({ ...props });

export const Default: StoryObj<CipherItemRowProps> = {
  render: Template,
};

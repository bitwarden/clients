import { Meta, StoryObj } from "@storybook/web-components";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { NotificationType } from "../../../../notification/abstractions/notification-bar";
import { NotificationCipherData } from "../../cipher/types";
import { NotificationBody } from "../../notification/body";

type Args = {
  ciphers: NotificationCipherData[];
  notificationType: NotificationType;
  theme: Theme;
  handleEditOrUpdateAction: (e: Event) => void;
};

export default {
  title: "Components/Notifications/Notification Body",
  argTypes: {
    ciphers: { control: "object" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    notificationType: {
      control: "select",
      options: ["add", "change", "unlock", "fileless-import"],
    },
  },
  args: {
    ciphers: [
      {
        id: "1",
        name: "Example Cipher",
        type: CipherType.Login,
        favorite: false,
        reprompt: CipherRepromptType.None,
        icon: {
          imageEnabled: true,
          image: "",
          fallbackImage: "https://example.com/fallback.png",
          icon: "icon-class",
        },
        login: { username: "user@example.com" },
      },
    ],
    theme: ThemeTypes.Light,
    notificationType: "change",
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=217-6841&m=dev",
    },
  },
} as Meta<Args>;

const Template = (args: Args) => NotificationBody({ ...args });

export const Default: StoryObj<Args> = {
  render: Template,
};

import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { NotificationTypes } from "../../../../notification/abstractions/notification-bar";
import { getNotificationHeaderMessage, getNotificationTestId } from "../../../../notification/bar";
import { NotificationContainer, NotificationContainerProps } from "../../notification/container";
import { mockBrowserI18nGetMessage, mockI18n } from "../mock-data";

export default {
  title: "Components/Notifications",
  argTypes: {
    error: { control: "text" },
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    type: { control: "select", options: [...Object.values(NotificationTypes)] },
  },
  args: {
    error: "",
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
    type: NotificationTypes.Change,
    username: "mockUsername",
    theme: ThemeTypes.Light,
    i18n: mockI18n,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=485-20160&m=dev",
    },
  },
} as Meta<NotificationContainerProps>;

const Template = (args: NotificationContainerProps) => {
  const headerMessage = getNotificationHeaderMessage(args.i18n, args.type);
  const notificationTestId = getNotificationTestId(args.type);
  return NotificationContainer({ ...args, headerMessage, notificationTestId });
};

export const Default: StoryObj<NotificationContainerProps> = {
  render: Template,
};

window.chrome = {
  ...window.chrome,
  i18n: {
    getMessage: mockBrowserI18nGetMessage,
  },
} as typeof chrome;

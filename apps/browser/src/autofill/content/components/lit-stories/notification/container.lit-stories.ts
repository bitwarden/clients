import { Meta, StoryObj } from "@storybook/web-components";

import { ThemeTypes } from "@bitwarden/common/platform/enums";
import { CipherTypes } from "@bitwarden/common/vault/enums";
import { CipherRepromptTypes } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { NotificationTypes } from "../../../../notification/abstractions/notification-bar";
import { NotificationContainer, NotificationContainerProps } from "../../notification/container";

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
        type: CipherTypes.Login,
        favorite: false,
        reprompt: CipherRepromptTypes.None,
        icon: {
          imageEnabled: true,
          image: "",
          fallbackImage: "https://example.com/fallback.png",
          icon: "icon-class",
        },
        login: { username: "user@example.com" },
      },
    ],
    i18n: {
      loginSaveSuccess: "Login saved",
      loginUpdateSuccess: "Login updated",
      saveAction: "Save",
      saveAsNewLoginAction: "Save as new login",
      saveFailure: "Error saving",
      saveFailureDetails: "Oh no! We couldn't save this. Try entering the details manually.",
      updateLoginPrompt: "Update existing login?",
      view: "View",
    },
    type: NotificationTypes.Change,
    username: "mockUsername",
    theme: ThemeTypes.Light,
  },
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/design/LEhqLAcBPY8uDKRfU99n9W/Autofill-notification-redesign?node-id=485-20160&m=dev",
    },
  },
} as Meta<NotificationContainerProps>;

const Template = (args: NotificationContainerProps) => NotificationContainer({ ...args });

export const Default: StoryObj<NotificationContainerProps> = {
  render: Template,
};

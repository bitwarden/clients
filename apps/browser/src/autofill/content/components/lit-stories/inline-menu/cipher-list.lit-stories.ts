import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { InlineMenuCipherData } from "../../../../background/abstractions/overlay.background";
import { InlineMenuCipherList, InlineMenuCipherListProps } from "../../inline-menu/cipher-list";
import { mockI18n } from "../mock-data";

const mockIcon = {
  imageEnabled: false,
  image: "",
  fallbackImage: "",
  icon: "globe",
};

const mockCiphers: InlineMenuCipherData[] = [
  {
    id: "1",
    name: "bitwarden.com",
    type: 1,
    favorite: false,
    reprompt: 0,
    icon: mockIcon,
    login: { username: "test@bitwarden.com", passkey: null },
  },
  {
    id: "2",
    name: "bitwarden.com",
    type: 1,
    favorite: false,
    reprompt: 0,
    icon: mockIcon,
    login: { username: "test@bitwarden.com", passkey: null },
  },
  {
    id: "3",
    name: "bitwarden.com",
    type: 1,
    favorite: false,
    reprompt: 0,
    icon: mockIcon,
    login: { username: "test@bitwarden.com", passkey: null },
  },
];

const mockTotpCiphers: InlineMenuCipherData[] = [
  {
    id: "1",
    name: "site-a",
    type: 1,
    favorite: false,
    reprompt: 0,
    icon: mockIcon,
    login: {
      username: "ergbreb",
      totp: "454143",
      totpField: true,
      totpCodeTimeInterval: 30,
      passkey: null,
    },
  },
  {
    id: "2",
    name: "site-b",
    type: 1,
    favorite: false,
    reprompt: 0,
    icon: mockIcon,
    login: {
      username: "tesd",
      totp: "174593",
      totpField: true,
      totpCodeTimeInterval: 30,
      passkey: null,
    },
  },
];

const mockPasskeyCiphers: InlineMenuCipherData[] = [
  {
    id: "1",
    name: "bitwarden.com",
    type: 1,
    favorite: false,
    reprompt: 0,
    icon: mockIcon,
    login: {
      username: "test@bitwarden.com",
      passkey: {
        rpName: "Bitwarden",
        userName: "test@bitwarden.com",
      },
    },
  },
  {
    id: "2",
    name: "Example Site",
    type: 1,
    favorite: false,
    reprompt: 0,
    icon: mockIcon,
    login: {
      passkey: {
        rpName: "Example Site",
        userName: "passkey-user",
      },
    },
  },
];

const mockPasskeysAndPasswords: InlineMenuCipherData[] = [
  ...mockPasskeyCiphers,
  {
    id: "3",
    name: "bitwarden.com",
    type: 1,
    favorite: false,
    reprompt: 0,
    icon: mockIcon,
    login: { username: "password-user@bitwarden.com", passkey: null },
  },
];

type ComponentAndControls = InlineMenuCipherListProps & { width: number };

export default {
  title: "Components/Inline Menu/Cipher List",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    totpSecondsRemaining: { control: { type: "number", min: 1, max: 30, step: 1 } },
    handleFillCipher: { control: false },
    handleViewCipher: { control: false },
    width: { control: "number", min: 160, max: 480, step: 8 },
  },
  args: {
    ciphers: mockCiphers,
    theme: ThemeTypes.Dark,
    viewButtonText: mockI18n.view,
    opensInANewWindowText: mockI18n.opensInANewWindow,
    fillCredentialsForText: mockI18n.fillCredentialsFor,
    logInWithPasskeyAriaLabel: mockI18n.logInWithPasskeyAriaLabel,
    usernameText: mockI18n.username,
    cardNumberEndsWithText: mockI18n.cardNumberEndsWith,
    fillVerificationCodeText: mockI18n.fillVerificationCode,
    totpCodeAria: mockI18n.totpCodeAria,
    passkeysText: mockI18n.passkeys,
    passwordsText: mockI18n.passwords,
    handleFillCipher: (cipher) => alert(`Fill ${cipher.name}`),
    handleViewCipher: (cipher) => alert(`View ${cipher.name}`),
    width: 280,
  },
} as Meta<ComponentAndControls>;

const Template = (args: ComponentAndControls) => {
  const { width, ...componentProps } = args;
  return html`<div style="width: ${width}px;">${InlineMenuCipherList({ ...componentProps })}</div>`;
};

export const Default: StoryObj<ComponentAndControls> = {
  render: Template,
};

export const Totp: StoryObj<ComponentAndControls> = {
  args: {
    ciphers: [mockTotpCiphers[1]],
  },
  render: Template,
};

export const TotpExpiring: StoryObj<ComponentAndControls> = {
  args: {
    ciphers: [mockTotpCiphers[1]],
    totpSecondsRemaining: 7,
  },
  render: Template,
};

export const TotpMultiple: StoryObj<ComponentAndControls> = {
  args: {
    ciphers: mockTotpCiphers,
  },
  render: Template,
};

export const Passkeys: StoryObj<ComponentAndControls> = {
  args: {
    ciphers: mockPasskeyCiphers,
  },
  render: Template,
};

export const PasskeysAndPasswords: StoryObj<ComponentAndControls> = {
  args: {
    ciphers: mockPasskeysAndPasswords,
  },
  render: Template,
};

import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { InlineMenuCipherData } from "../../../../background/abstractions/overlay.background";
import { InlineMenuCipherList, InlineMenuCipherListProps } from "../../inline-menu/cipher-list";
import { mockI18n } from "../mock-data";

const mockIcon = {
  imageEnabled: false,
  image: "",
  fallbackImage: "",
  icon: "globe",
};

function makeCipher(
  overrides: Omit<Partial<InlineMenuCipherData>, "id" | "name" | "type"> &
    Pick<InlineMenuCipherData, "id" | "name" | "type">,
): InlineMenuCipherData {
  return {
    favorite: false,
    reprompt: CipherRepromptType.None,
    icon: mockIcon,
    ...overrides,
  };
}

const mockCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "1",
    name: "bitwarden.com",
    type: CipherType.Login,
    login: { username: "test@bitwarden.com", passkey: null },
  }),
  makeCipher({
    id: "2",
    name: "example.com",
    type: CipherType.Login,
    login: { username: "codestradamus", passkey: null },
  }),
  makeCipher({
    id: "3",
    name: "A really long site name that should ellipsize in the list",
    type: CipherType.Login,
    login: { username: "long.username@example.com", passkey: null },
  }),
];

const mockTotpCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "1",
    name: "site-a",
    type: CipherType.Login,
    login: {
      username: "alice@example.com",
      totp: "454143",
      totpField: true,
      totpCodeTimeInterval: 30,
      passkey: null,
    },
  }),
  makeCipher({
    id: "2",
    name: "site-b",
    type: CipherType.Login,
    login: {
      username: "liz@example.com",
      totp: "174593",
      totpField: true,
      totpCodeTimeInterval: 30,
      passkey: null,
    },
  }),
];

const mockPasskeyCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "1",
    name: "bitwarden.com",
    type: CipherType.Login,
    login: {
      username: "test@bitwarden.com",
      passkey: {
        rpName: "Bitwarden",
        userName: "test@bitwarden.com",
      },
    },
  }),
  makeCipher({
    id: "2",
    name: "Example Site",
    type: CipherType.Login,
    login: {
      passkey: {
        rpName: "Example Site",
        userName: "passkey-user",
      },
    },
  }),
];

const mockPasskeysAndPasswords: InlineMenuCipherData[] = [
  ...mockPasskeyCiphers,
  makeCipher({
    id: "3",
    name: "bitwarden.com",
    type: CipherType.Login,
    login: { username: "password-user@bitwarden.com", passkey: null },
  }),
];

const mockCardCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "1",
    name: "Personal Visa",
    type: CipherType.Card,
    card: "Visa, *4242",
  }),
  makeCipher({
    id: "2",
    name: "Work Amex",
    type: CipherType.Card,
    card: "Amex, *10005",
  }),
];

const mockIdentityCiphers: InlineMenuCipherData[] = [
  makeCipher({
    id: "1",
    name: "Home Address",
    type: CipherType.Identity,
    identity: { fullName: "Jane Doe" },
  }),
  makeCipher({
    id: "2",
    name: "Work Profile",
    type: CipherType.Identity,
    identity: { fullName: "Jane Doe", username: "jane.doe@bitwarden.com" },
  }),
];

type ComponentAndControls = InlineMenuCipherListProps & { width: number };

const baseArgs: ComponentAndControls = {
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
};

export default {
  title: "Components/Inline Menu/Cipher List",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    totpSecondsRemaining: { control: { type: "number", min: 1, max: 30, step: 1 } },
    handleFillCipher: { control: false },
    handleViewCipher: { control: false },
    width: { control: "number", min: 160, max: 480, step: 8 },
  },
  args: baseArgs,
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

export const Cards: StoryObj<ComponentAndControls> = {
  args: {
    ciphers: mockCardCiphers,
  },
  render: Template,
};

export const Identities: StoryObj<ComponentAndControls> = {
  args: {
    ciphers: mockIdentityCiphers,
  },
  render: Template,
};

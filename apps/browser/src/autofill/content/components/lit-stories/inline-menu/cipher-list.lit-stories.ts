import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

import { InlineMenuCipherList, InlineMenuCipherListProps } from "../../inline-menu/cipher-list";
import {
  mockCardCiphers,
  mockCipherListI18n,
  mockIdentityCiphers,
  mockLoginCiphers,
  mockPasskeyCiphers,
  mockPasskeysAndPasswords,
  mockTotpCiphers,
} from "../mock-data";

type ComponentAndControls = InlineMenuCipherListProps & { width: number };

const baseArgs: ComponentAndControls = {
  ciphers: mockLoginCiphers,
  theme: ThemeTypes.Dark,
  ...mockCipherListI18n,
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

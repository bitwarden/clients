import { Meta, StoryObj, componentWrapperDecorator, moduleMetadata } from "@storybook/angular";

import { startClockAtStoryNow } from "@bitwarden/storybook";

import {
  mockCardCiphers,
  mockIdentityCiphers,
  mockLoginCiphers,
  mockPasskeyCiphers,
  mockPasskeysAndPasswords,
  mockTotpCiphers,
} from "../shared/story-mock-data";
import { autofillStoryProviders } from "../shared/story-providers";

import { InlineMenuListComponent } from "./inline-menu-list.component";

export default {
  title: "Browser/Autofill/Inline Menu List",
  component: InlineMenuListComponent,
  decorators: [
    moduleMetadata({ providers: autofillStoryProviders }),
    componentWrapperDecorator((story) => `<div style="width: 280px">${story}</div>`),
  ],
  beforeEach: startClockAtStoryNow,
  parameters: {
    chromatic: { modes: { light: { theme: "light" }, dark: { theme: "dark" } } },
  },
} as Meta<InlineMenuListComponent>;

type Story = StoryObj<InlineMenuListComponent>;

export const Locked: Story = {
  args: { state: { view: "locked" } },
};

export const NoResults: Story = {
  args: { state: { view: "noResults", newItemKind: "login" } },
};

export const SaveLogin: Story = {
  args: { state: { view: "saveLogin" } },
};

export const Authenticating: Story = {
  args: { state: { view: "authenticating" } },
};

export const Logins: Story = {
  args: { state: { view: "ciphers", ciphers: mockLoginCiphers, newItemKind: "login" } },
};

export const Scrolling: Story = {
  args: {
    state: {
      view: "ciphers",
      ciphers: [...mockLoginCiphers, ...mockCardCiphers, ...mockIdentityCiphers],
      newItemKind: "item",
    },
  },
};

export const Totp: Story = {
  args: { state: { view: "ciphers", ciphers: [mockTotpCiphers[0]], totpSecondsRemaining: 21 } },
};

export const TotpExpiring: Story = {
  args: { state: { view: "ciphers", ciphers: [mockTotpCiphers[0]], totpSecondsRemaining: 5 } },
};

/** Multiple TOTP items show the username. The second item requires master password re-prompt. */
export const TotpMultiple: Story = {
  args: { state: { view: "ciphers", ciphers: mockTotpCiphers, totpSecondsRemaining: 21 } },
};

export const TotpLive: Story = {
  args: { state: { view: "ciphers", ciphers: [mockTotpCiphers[0]] } },
};

export const Passkeys: Story = {
  args: { state: { view: "ciphers", ciphers: mockPasskeyCiphers } },
};

export const PasskeysAndPasswords: Story = {
  args: { state: { view: "ciphers", ciphers: mockPasskeysAndPasswords, newItemKind: "login" } },
};

export const Cards: Story = {
  args: { state: { view: "ciphers", ciphers: mockCardCiphers, newItemKind: "card" } },
};

export const Identities: Story = {
  args: { state: { view: "ciphers", ciphers: mockIdentityCiphers, newItemKind: "identity" } },
};

export const PasswordGenerator: Story = {
  args: { state: { view: "passwordGenerator", password: "f9#WxF4HjsC&*6aB3!k" } },
};

export const PasswordGeneratorLongPassword: Story = {
  args: {
    state: { view: "passwordGenerator", password: "f9#WxF4HjsC&*6aB3!kQz8$Lp2@Vn7^Rm5%Ty1" },
  },
};

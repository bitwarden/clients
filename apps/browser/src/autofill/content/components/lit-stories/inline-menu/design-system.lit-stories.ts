import { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";
import { CipherType } from "@bitwarden/common/vault/enums";

import { InlineMenuCipherData } from "../../../../background/abstractions/overlay.background";
import { Lock, Plus } from "../../icons";
import { InlineMenuCipherItem } from "../../inline-menu/cipher-item";
import { InlineMenuContainer } from "../../inline-menu/container";
import { InlineMenuPasswordGenerator } from "../../inline-menu/password-generator";
import { InlineMenuPrompt } from "../../inline-menu/prompt";
import {
  makeCipher,
  mockCardCiphers,
  mockCipherListI18n,
  mockIdentityCiphers,
  mockI18n,
  mockLoginCiphers,
  mockPasskeyCiphers,
  mockPasswordGeneratorI18n,
  mockTotpCiphers,
} from "../mock-data";

const itemI18n = (({ passkeysText, passwordsText, ...i18n }) => i18n)(mockCipherListI18n);

function withIcon(cipher: InlineMenuCipherData, icon: string): InlineMenuCipherData {
  return { ...cipher, icon: { ...cipher.icon, icon } };
}

const ciphers = [
  withIcon(mockLoginCiphers[0], "bwi-globe"),
  withIcon(mockCardCiphers[0], "bwi-credit-card"),
  withIcon(mockIdentityCiphers[0], "bwi-id-card"),
  withIcon(
    makeCipher({ id: "ssh", name: "GitHub deploy key", type: CipherType.SshKey }),
    "bwi-key",
  ),
  withIcon(mockPasskeyCiphers[0], "bwi-globe"),
  withIcon(
    makeCipher({
      id: "org-passkey",
      name: "Gmail",
      type: CipherType.Login,
      organizationId: "org-1",
      login: {
        username: "dfinnegan@acme.com",
        passkey: {
          rpName: "Google",
          userName: "dfinnegan@acme.com",
        },
      },
    }),
    "bwi-globe",
  ),
  mockTotpCiphers[0],
];

type StoryArgs = { theme: Theme; width: number };

export default {
  title: "Components/Inline Menu/Design System",
  argTypes: {
    theme: { control: "select", options: [...Object.values(ThemeTypes)] },
    width: { control: "number", min: 160, max: 480, step: 8 },
  },
  args: {
    theme: ThemeTypes.Light,
    width: 280,
  },
} as Meta<StoryArgs>;

function column(title: string, theme: Theme, width: number, useCipherTypeIcon = false) {
  return html`
    <div style="width: ${width}px;">
      <div style="margin-bottom: 8px; color: #1a1a1a; font: 600 14px sans-serif;">${title}</div>
      ${InlineMenuContainer({
        theme,
        children: ciphers.map((cipher, index) =>
          InlineMenuCipherItem({
            ...itemI18n,
            cipher,
            theme,
            bordered: index < ciphers.length - 1,
            useCipherTypeIcon,
            handleFillCipher: () => alert(`Fill ${cipher.name}`),
            handleViewCipher: () => alert(`View ${cipher.name}`),
          }),
        ),
      })}
    </div>
  `;
}

const handleAction = (): void => undefined;

function pair<T>(width: number, before: T, after: T) {
  return html`
    <div style="display: flex; gap: 24px; align-items: flex-start;">
      <div style="width: ${width}px;">${before}</div>
      <div style="width: ${width}px;">${after}</div>
    </div>
  `;
}

function actionsSection(theme: Theme, width: number) {
  return html`
    <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 32px;">
      <div style="color: #1a1a1a; font: 600 14px sans-serif;">Actions</div>
      ${pair(
        width,
        InlineMenuPrompt({
          theme,
          message: mockI18n.noItemsToShow,
          actionText: mockI18n.newLogin,
          i18n: { actionAria: mockI18n.addNewLoginItemAria },
          icon: Plus,
          handleAction,
        }),
        InlineMenuPrompt({
          theme,
          actionText: mockI18n.addNewLogin,
          i18n: { actionAria: mockI18n.addNewLoginItemAria },
          icon: Plus,
          handleAction,
        }),
      )}
      ${pair(
        width,
        InlineMenuPrompt({
          theme,
          actionText: mockI18n.saveToBitwarden,
          i18n: { actionAria: `${mockI18n.saveToBitwarden}, ${mockI18n.opensInANewWindow}` },
          handleAction,
        }),
        InlineMenuPrompt({
          theme,
          actionText: mockI18n.addToBitwarden,
          i18n: { actionAria: `${mockI18n.addToBitwarden}, ${mockI18n.opensInANewWindow}` },
          icon: Plus,
          handleAction,
        }),
      )}
      ${pair(
        width,
        InlineMenuPrompt({
          theme,
          message: mockI18n.unlockYourAccountToViewAutofillSuggestions,
          actionText: mockI18n.unlockAccount,
          i18n: { actionAria: mockI18n.unlockAccountAria },
          icon: Lock,
          handleAction,
        }),
        InlineMenuPrompt({
          theme,
          actionText: mockI18n.unlockBitwarden,
          i18n: { actionAria: mockI18n.unlockBitwardenAria },
          icon: Plus,
          handleAction,
        }),
      )}
    </div>
  `;
}

const generatedPassword = "f9#WxF4HjsC&*6";

function passwordAction(label: string, content: ReturnType<typeof InlineMenuPasswordGenerator>) {
  return html`
    <div>
      <div style="margin-bottom: 8px; color: #62748e; font: 400 13px/20px sans-serif;">
        ${label}
      </div>
      ${content}
    </div>
  `;
}

function passwordGeneratorSection(theme: Theme, width: number) {
  const suggested = () =>
    InlineMenuPasswordGenerator({
      password: generatedPassword,
      headingText: "Fill suggested password",
      theme,
      i18n: mockPasswordGeneratorI18n,
      designSystem: true,
      handleFillPassword: handleAction,
      handleRefreshPassword: handleAction,
    });

  return html`
    <div style="display: flex; gap: 24px; align-items: flex-start; margin-top: 32px;">
      <div style="width: ${width}px;">
        <div style="margin-bottom: 8px; color: #1a1a1a; font: 600 14px sans-serif;">Before</div>
        ${InlineMenuPasswordGenerator({
          password: generatedPassword,
          headingText: mockI18n.fillGeneratedPassword,
          theme,
          i18n: mockPasswordGeneratorI18n,
          handleFillPassword: handleAction,
          handleRefreshPassword: handleAction,
        })}
      </div>
      <div style="display: flex; flex-direction: column; gap: 24px; width: ${width}px;">
        ${passwordAction("Password actions — Start", suggested())}
      </div>
    </div>
  `;
}

export const BeforeAndAfter: StoryObj<StoryArgs> = {
  render: ({ theme, width }) => html`
    <div style="padding: 16px; background: #fff;">
      <div style="display: flex; gap: 24px; align-items: flex-start;">
        ${column("Before", theme, width)} ${column("After", theme, width, true)}
      </div>
      ${actionsSection(theme, width)} ${passwordGeneratorSection(theme, width)}
    </div>
  `,
};

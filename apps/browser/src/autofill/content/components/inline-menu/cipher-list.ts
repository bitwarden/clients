import { css } from "@emotion/css";
import { html, TemplateResult } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { scrollbarStyles, spacing, themes, typography } from "../constants/styles";

import { InlineMenuCipherItem, InlineMenuCipherItemProps } from "./cipher-item";
import { InlineMenuContainer } from "./container";

export type InlineMenuCipherListProps = Omit<
  InlineMenuCipherItemProps,
  "cipher" | "bordered" | "showTotpUsername" | "handleFillCipher" | "handleViewCipher"
> & {
  ciphers: InlineMenuCipherData[];
  handleFillCipher: (cipher: InlineMenuCipherData, e: Event) => void;
  handleViewCipher: (cipher: InlineMenuCipherData, e: Event) => void;
  passkeysText?: string;
  passwordsText?: string;
  showPasskeysLabels?: boolean;
};

export function InlineMenuCipherList({
  ciphers,
  theme = ThemeTypes.Light,
  passkeysText = "",
  passwordsText = "",
  showPasskeysLabels,
  handleFillCipher,
  handleViewCipher,
  ...itemProps
}: InlineMenuCipherListProps) {
  const showTotpUsername =
    ciphers.filter((cipher) => cipher.login?.totpField && cipher.login?.totp).length > 1;
  const withHeadings =
    showPasskeysLabels ??
    (ciphers.some((cipher) => !!cipher.login?.passkey) &&
      ciphers.some((cipher) => !cipher.login?.passkey));
  const ordered = withHeadings ? partitionByPasskey(ciphers) : ciphers;

  return InlineMenuContainer({
    theme,
    dataTestId: "inline-menu-cipher-list",
    children: html`
      <div class=${cipherListStyles(theme)}>
        ${renderItems(ordered, withHeadings, theme, passkeysText, passwordsText, (cipher, index) =>
          InlineMenuCipherItem({
            ...itemProps,
            theme,
            cipher,
            bordered: index < ordered.length - 1,
            showTotpUsername,
            handleFillCipher: (e) => handleFillCipher(cipher, e),
            handleViewCipher: (e) => handleViewCipher(cipher, e),
          }),
        )}
      </div>
    `,
  });
}

function partitionByPasskey(ciphers: InlineMenuCipherData[]) {
  return [
    ...ciphers.filter((cipher) => cipher.login?.passkey),
    ...ciphers.filter((cipher) => !cipher.login?.passkey),
  ];
}

function renderItems(
  ciphers: InlineMenuCipherData[],
  withHeadings: boolean,
  theme: Theme,
  passkeysText: string,
  passwordsText: string,
  renderItem: (cipher: InlineMenuCipherData, index: number) => TemplateResult,
): TemplateResult[] {
  if (!withHeadings) {
    return ciphers.map(renderItem);
  }

  const items: TemplateResult[] = [];
  let sawPasskey = false;
  let sawPassword = false;

  ciphers.forEach((cipher, index) => {
    if (cipher.login?.passkey && !sawPasskey) {
      sawPasskey = true;
      items.push(heading(theme, passkeysText));
    } else if (!cipher.login?.passkey && !sawPassword) {
      sawPassword = true;
      items.push(heading(theme, passwordsText));
    }
    items.push(renderItem(cipher, index));
  });

  return items;
}

function heading(theme: Theme, text: string) {
  return html`<div data-cipher-heading class=${cipherListHeadingStyles(theme)}>${text}</div>`;
}

const cipherListStyles = (theme: Theme) => {
  const scrollbars = scrollbarStyles(theme);

  return css`
    box-sizing: border-box;
    max-height: calc(${spacing["4"]} * 11 + ${spacing["1"]});
    overflow-x: hidden;
    overflow-y: auto;
    background-color: ${themes[theme].background.DEFAULT};

    ${scrollbars.default}
    ${scrollbars.safari}
  `;
};

const cipherListHeadingStyles = (theme: Theme) => css`
  ${typography.body2}

  position: sticky;
  top: 0;
  z-index: 1;
  box-sizing: border-box;
  width: 100%;
  padding: ${spacing["2"]} ${spacing["3"]};
  font-weight: 500;
  letter-spacing: 0.025rem;
  color: ${themes[theme].text.main};
  background-color: ${themes[theme].background.DEFAULT};
  border-bottom: 1px solid ${themes[theme].background.DEFAULT};
`;

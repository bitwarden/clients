import { css } from "@emotion/css";
import { html } from "lit";

import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { scrollbarStyles, spacing, themes } from "../constants/styles";

import { InlineMenuCipherItem } from "./cipher-item";
import { InlineMenuContainer } from "./container";

export type InlineMenuCipherListProps = {
  ciphers: InlineMenuCipherData[];
  theme: Theme;
  viewButtonText: string;
  handleFillCipher: (cipher: InlineMenuCipherData, e: Event) => void;
  handleViewCipher: (cipher: InlineMenuCipherData, e: Event) => void;
  fillVerificationCodeText?: string;
  totpSecondsRemaining?: number;
};

export function InlineMenuCipherList({
  ciphers,
  theme = ThemeTypes.Light,
  viewButtonText,
  handleFillCipher,
  handleViewCipher,
  fillVerificationCodeText,
  totpSecondsRemaining,
}: InlineMenuCipherListProps) {
  // @TODO get client vendor from context PM-40541
  const isSafari = false;
  const showTotpUsername =
    ciphers.filter((cipher) => cipher.login?.totpField && cipher.login?.totp).length > 1;

  return InlineMenuContainer({
    theme,
    dataTestId: "inline-menu-cipher-list",
    children: html`
      <div class=${cipherListStyles({ isSafari, theme })}>
        ${ciphers.map((cipher, index) =>
          InlineMenuCipherItem({
            cipher,
            theme,
            viewButtonText,
            bordered: index < ciphers.length - 1,
            fillVerificationCodeText,
            showTotpUsername,
            totpSecondsRemaining,
            handleFillCipher: (e) => handleFillCipher(cipher, e),
            handleViewCipher: (e) => handleViewCipher(cipher, e),
          }),
        )}
      </div>
    `,
  });
}

const cipherListStyles = ({ isSafari, theme }: { isSafari: boolean; theme: Theme }) => css`
  box-sizing: border-box;
  max-height: calc(${spacing["4"]} * 11 + ${spacing["1"]});
  overflow-x: hidden;
  overflow-y: auto;
  background-color: ${themes[theme].background.DEFAULT};

  ${isSafari ? scrollbarStyles(theme).safari : scrollbarStyles(theme).default}
`;

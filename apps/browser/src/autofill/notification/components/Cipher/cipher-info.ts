import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes, typography } from "../../constants/styles";
import { CipherData } from "../../types";

import { CipherInfoIndicatorIcons } from "./cipher-indicator-icons";

export function CipherInfo({ cipher, theme }: { cipher: CipherData; theme: Theme }) {
  const { name, login } = cipher;

  return html`
    <div>
      <div class=${cipherItemPrimaryTextStyles(theme)}>
        ${name}${CipherInfoIndicatorIcons({ cipher, theme })}
      </div>

      ${login.username
        ? html`<div class=${cipherItemSecondaryTextStyles(theme)}>${login.username}</div>`
        : null}
    </div>
  `;
}

const cipherItemPrimaryTextStyles = (theme: Theme) => css`
  ${typography.body2}

  gap: 2px;
  display: flex;
  color: ${themes[theme].text.main};
  font-weight: 500;
`;

const cipherItemSecondaryTextStyles = (theme: Theme) => css`
  ${typography.helperMedium}

  color: ${themes[theme].text.muted};
  font-weight: 400;
`;

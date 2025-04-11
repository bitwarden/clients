import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes, typography } from "../../../content/components/constants/styles";

import { CipherInfoIndicatorIcons } from "./cipher-indicator-icons";
import { NotificationCipherData } from "./types";

// @TODO support other cipher types (card, identity, notes, etc)
export function CipherInfo({ cipher, theme }: { cipher: NotificationCipherData; theme: Theme }) {
  const { name, login, cipherIndicatorIcon } = cipher;
  const renderIndicator =
    cipherIndicatorIcon &&
    (cipherIndicatorIcon.showBusinessIcon || cipherIndicatorIcon.showFamilyIcon);

  return html`
    <div>
      <span class=${cipherInfoPrimaryTextStyles(theme)}>
        ${[
          name,
          renderIndicator
            ? CipherInfoIndicatorIcons({
                theme,
                showBusinessIcon: cipherIndicatorIcon?.showBusinessIcon,
                showFamilyIcon: cipherIndicatorIcon?.showFamilyIcon,
              })
            : nothing,
        ]}
      </span>

      ${login?.username
        ? html`<span class=${cipherInfoSecondaryTextStyles(theme)}>${login.username}</span>`
        : null}
    </div>
  `;
}

const cipherInfoPrimaryTextStyles = (theme: Theme) => css`
  ${typography.body2}

  gap: 2px;
  display: flex;
  display: block;
  overflow-x: hidden;
  text-overflow: ellipsis;
  color: ${themes[theme].text.main};
  font-weight: 500;
`;

const cipherInfoSecondaryTextStyles = (theme: Theme) => css`
  ${typography.helperMedium}

  display: block;
  overflow-x: hidden;
  text-overflow: ellipsis;
  color: ${themes[theme].text.muted};
  font-weight: 400;
`;

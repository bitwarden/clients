import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes, typography } from "../constants/styles";

export type TotpCipherInfoProps = {
  theme: Theme;
  heading: string;
  totp: string;
  totpCodeAria?: string;
  username?: string;
  masked: boolean;
};

export function TotpCipherInfo({
  theme,
  heading,
  totp,
  totpCodeAria,
  username,
  masked,
}: TotpCipherInfoProps) {
  const code = masked ? "●●●●●●" : `${totp.substring(0, 3)} ${totp.substring(3)}`;

  return html`
    <div>
      <span title=${heading} class=${primaryTextStyles(theme)}>${heading}</span>
      ${
        username
          ? html`<span title=${username} class=${secondaryTextStyles(theme)}>${username}</span>`
          : nothing
      }
      <span
        class=${totpCodeStyles(theme, masked)}
        data-testid="totp-code"
        title=${code}
        aria-label=${totpCodeAria ?? nothing}
        >${code}</span
      >
    </div>
  `;
}

const primaryTextStyles = (theme: Theme) => css`
  ${typography.body2}

  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${themes[theme].text.main};
  font-weight: 500;
`;

const secondaryTextStyles = (theme: Theme) => css`
  ${typography.helperMedium}

  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${themes[theme].text.muted};
`;

const totpCodeStyles = (theme: Theme, masked: boolean) => css`
  ${typography.helperMedium}

  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${themes[theme].text.muted};
  ${masked ? "letter-spacing: 0.2rem;" : ""}
`;

import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { InlineMenuCipherData } from "../../../background/abstractions/overlay.background";
import { spacing, themes, typography } from "../constants/styles";
import { BwiIcon, Passkey } from "../icons";

export type CipherDetailsProps = {
  cipher: InlineMenuCipherData;
  theme: Theme;
  /** Design-system inline menu. Passkeys drop the org name and show bwi-passkey beside the name. */
  designSystem?: boolean;
  passkeyText?: string;
};

export function CipherDetails({
  cipher,
  theme,
  designSystem = false,
  passkeyText,
}: CipherDetailsProps) {
  const passkey = cipher.login?.passkey;
  const showOrgIcon = designSystem && !!cipher.organizationId;
  const showPasskeyIcon = designSystem && !!passkey;
  const name = html`
    <span title=${cipher.name} class=${primaryTextStyles(theme)}>${cipher.name}</span>
  `;
  const nameContent =
    showOrgIcon || showPasskeyIcon
      ? html`
          <span class=${nameWithIconStyles}>
            ${name} ${showOrgIcon ? nameIcon("bwi-business", theme) : nothing}
            ${
              showPasskeyIcon
                ? html`<span title=${passkeyText ?? nothing} class=${passkeyBadgeStyles}
                    >${nameIcon("bwi-passkey", theme)}</span
                  >`
                : nothing
            }
          </span>
        `
      : name;

  if (passkey && !designSystem) {
    const showRpName = cipher.name !== passkey.rpName;
    const secondary = cipher.login?.username || passkey.userName;
    const firstLine = showRpName ? passkey.rpName : secondary;
    const secondLine = showRpName ? secondary : undefined;

    return html`
      <div>
        ${name}
        ${
          firstLine
            ? html`<span title=${firstLine} class=${passkeySubtitleStyles(theme)}>
                ${Passkey({ theme, color: themes[theme].text.muted })} ${firstLine}
              </span>`
            : nothing
        }
        ${
          secondLine
            ? html`<span title=${secondLine} class=${passkeySubtitleStyles(theme)}
                >${secondLine}</span
              >`
            : nothing
        }
      </div>
    `;
  }

  const subtitle = passkey
    ? cipher.login?.username || passkey.userName
    : cipher.identity?.username ||
      cipher.identity?.fullName ||
      cipher.login?.username ||
      cipher.card ||
      "";

  return html`
    <div>
      ${nameContent}
      ${
        subtitle
          ? html`<span title=${subtitle} class=${secondaryTextStyles(theme)}>${subtitle}</span>`
          : nothing
      }
    </div>
  `;
}

function nameIcon(name: string, theme: Theme) {
  return BwiIcon({ name, color: themes[theme].text.muted, size: "14px" });
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

const nameWithIconStyles = css`
  display: flex;
  align-items: center;
  gap: ${spacing["1"]};
  min-width: 0;

  > span:first-child {
    min-width: 0;
  }
`;

const passkeyBadgeStyles = css`
  display: inline-flex;
  flex-shrink: 0;
`;

const passkeySubtitleStyles = (theme: Theme) => css`
  ${typography.helperMedium}

  display: flex;
  align-items: center;
  gap: ${spacing["1"]};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${themes[theme].text.muted};

  > svg {
    flex-shrink: 0;
    width: ${spacing["3"]};
    height: ${spacing["3"]};
  }
`;

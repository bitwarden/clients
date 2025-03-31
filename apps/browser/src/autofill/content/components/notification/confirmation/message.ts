import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes, typography } from "../../constants/styles";

export type NotificationConfirmationMessageProps = {
  buttonText?: string;
  message?: string;
  messageDetails?: string;
  handleClick: (e: Event) => void;
  theme: Theme;
};

export function NotificationConfirmationMessage({
  buttonText,
  message,
  messageDetails,
  handleClick,
  theme,
}: NotificationConfirmationMessageProps) {
  return html`
    <div>
      ${message || buttonText
        ? html`
            <span
              title=${message || buttonText}
              class=${notificationConfirmationMessageStyles(theme)}
            >
              ${message || nothing}
              ${buttonText
                ? html`
                    <a
                      title=${buttonText}
                      class=${notificationConfirmationButtonTextStyles(theme)}
                      @click=${handleClick}
                    >
                      ${buttonText}
                    </a>
                  `
                : nothing}
            </span>
          `
        : nothing}
      ${messageDetails
        ? html`<div class=${AdditionalMessageStyles({ theme })}>${messageDetails}</div>`
        : nothing}
    </div>
  `;
}

const baseTextStyles = css`
  flex-grow: 1;
  overflow-x: hidden;
  text-align: left;
  text-overflow: ellipsis;
  line-height: 24px;
  font-family: "DM Sans", sans-serif;
  font-size: 16px;
`;

const notificationConfirmationMessageStyles = (theme: Theme) => css`
  ${baseTextStyles}

  color: ${themes[theme].text.main};
  font-weight: 400;
`;

const notificationConfirmationButtonTextStyles = (theme: Theme) => css`
  ${baseTextStyles}

  color: ${themes[theme].primary[600]};
  font-weight: 700;
  cursor: pointer;
`;

const AdditionalMessageStyles = ({ theme }: { theme: Theme }) => css`
  ${typography.body2}

  font-size: 14px;
  color: ${themes[theme].text.muted};
`;

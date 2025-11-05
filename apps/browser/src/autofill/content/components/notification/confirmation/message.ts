import { css } from "@emotion/css";
import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { spacing, themes, typography } from "../../constants/styles";

export type NotificationConfirmationMessageProps = {
  buttonAria?: string;
  buttonText?: string;
  itemName?: string;
  message?: string;
  messageDetails?: string;
  handleClick: (e: Event) => void;
  theme: Theme;
};

export function NotificationConfirmationMessage({
  buttonAria,
  buttonText,
  itemName,
  message,
  messageDetails,
  handleClick,
  theme,
}: NotificationConfirmationMessageProps) {
  return html`
    <div class=${containerStyles}>
      ${message || buttonText
        ? html`
            <div class=${singleLineWrapperStyles}>
              ${itemName
                ? html`
                    <span class=${itemNameStyles(theme)} title=${itemName}> ${itemName} </span>
                  `
                : nothing}
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
                        @keydown=${(e: KeyboardEvent) =>
                          handleButtonKeyDown(e, () => handleClick(e))}
                        aria-label=${buttonAria}
                        tabindex="0"
                        role="button"
                      >
                        ${buttonText}
                      </a>
                    `
                  : nothing}
              </span>
            </div>
          `
        : nothing}
      ${messageDetails
        ? html`<div class=${AdditionalMessageStyles({ theme })}>${messageDetails}</div>`
        : nothing}
    </div>
  `;
}

const containerStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${spacing[1]};
  width: 100%;
`;

const singleLineWrapperStyles = css`
  display: inline;
  white-space: normal;
  word-break: break-word;
`;

const baseTextStyles = css`
  overflow-x: hidden;
  text-align: left;
  text-overflow: ellipsis;
  line-height: 24px;
  font-family: Inter, sans-serif;
  font-size: 16px;
`;

const notificationConfirmationMessageStyles = (theme: Theme) => css`
  ${baseTextStyles}

  color: ${themes[theme].text.main};
  font-weight: 400;
  white-space: normal;
  word-break: break-word;
  display: inline;
`;

const itemNameStyles = (theme: Theme) => css`
  ${baseTextStyles}

  color: ${themes[theme].text.main};
  font-weight: 400;
  white-space: nowrap;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  vertical-align: bottom;
`;

const notificationConfirmationButtonTextStyles = (theme: Theme) => css`
  ${baseTextStyles}

  color: ${themes[theme].primary[600]};
  font-weight: 500;
  cursor: pointer;
`;

const AdditionalMessageStyles = ({ theme }: { theme: Theme }) => css`
  ${typography.body2}

  font-size: 14px;
  color: ${themes[theme].text.muted};
`;

function handleButtonKeyDown(event: KeyboardEvent, handleClick: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handleClick();
  }
}

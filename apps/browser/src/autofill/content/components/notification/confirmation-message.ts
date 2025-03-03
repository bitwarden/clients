import { css } from "@emotion/css";
import { html } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { themes } from "../constants/styles";

export function NotificationConfirmationMessage({
  buttonText,
  confirmationMessage,
  handleClick,
  theme,
}: {
  buttonText: string;
  confirmationMessage: string;
  handleClick: (e: Event) => void;
  theme: Theme;
}) {
  return html`
    <span title=${confirmationMessage} class=${notificationConfirmationMessageStyles(theme)}
      >${confirmationMessage}
      <a
        title=${buttonText}
        class=${notificationConfirmationButtonTextStyles(theme)}
        @click=${handleClick}
        >${buttonText}</a
      ></span
    >
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

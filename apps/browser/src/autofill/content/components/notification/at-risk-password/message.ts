import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import {
  AdditionalMessageStyles,
  notificationConfirmationButtonTextStyles,
  notificationConfirmationMessageStyles,
} from "../confirmation/message";

export type AtRiskNotificationMessageProps = {
  buttonAria?: string;
  buttonText?: string;
  itemName?: string;
  message?: string;
  messageDetails?: string;
  handleClick: (e: Event) => void;
  theme: Theme;
};

export function AtRiskNotificationMessage({
  buttonAria,
  buttonText,
  message,
  messageDetails,
  handleClick,
  theme,
}: AtRiskNotificationMessageProps) {
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
                      @keydown=${(e: KeyboardEvent) => handleButtonKeyDown(e, () => handleClick(e))}
                      aria-label=${buttonAria}
                      tabindex="0"
                      role="button"
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

function handleButtonKeyDown(event: KeyboardEvent, handleClick: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    handleClick();
  }
}

import { html, nothing } from "lit";

import { Theme } from "@bitwarden/common/platform/enums";

import { Warning } from "../../illustrations";
import { iconContainerStyles, notificationConfirmationBodyStyles } from "../confirmation/body";

import { AtRiskNotificationMessage } from "./message";

export const componentClassPrefix = "notification-confirmation-body";

export type AtRiskNotificationBodyProps = {
  confirmationMessage: string;
  messageDetails?: string;
  theme: Theme;
  handleOpenVault: (e: Event) => void;
};

export function AtRiskNotificationBody({
  confirmationMessage,
  messageDetails,
  theme,
  handleOpenVault,
}: AtRiskNotificationBodyProps) {
  const showConfirmationMessage = confirmationMessage || messageDetails;

  return html`
    <div class=${notificationConfirmationBodyStyles({ theme })}>
      <div class=${iconContainerStyles(true)}>${Warning()}</div>
      ${showConfirmationMessage
        ? AtRiskNotificationMessage({
            message: confirmationMessage,
            messageDetails,
            theme,
            handleClick: handleOpenVault,
          })
        : nothing}
    </div>
  `;
}
